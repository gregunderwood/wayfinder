# Deployment

How underwoodstyles.ca runs, ships and recovers. The design rationale is in
[Roadmap.md § Phase 2](Roadmap.md#phase-2--live-on-aws); this page is the operating manual.

## Shape

```
push to main ─► CI (lint, test, build, container smoke test, cdk-nag synth)
                 └─ passes ─► Deploy workflow (production environment)
                               ├─ GitHub OIDC ─► IAM role wayfinder-github-deploy
                               ├─ build arm64 image ─► ECR wayfinder/web:<git sha>
                               └─ SSM Run Command ─► EC2 host /opt/wayfinder
                                                      docker compose: caddy :80/:443 → web :4000
```

| Stack (`infra/`)      | Region       | Holds                                                                                                           | Replaceable?                                   |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `WayfinderFoundation` | ca-central-1 | Route 53 zone + records, Elastic IP, ECR repo, GitHub OIDC provider + deploy role, `wayfinder-alerts` SNS topic | No: termination-protected; IP and ECR retained |
| `WayfinderHost`       | ca-central-1 | VPC, security group (80/443 only), the t4g.small instance and its role, status-check alarms                     | Yes: rebuild, then redeploy                    |
| `WayfinderUptime`     | us-east-1    | Route 53 HTTPS health check on the public site, its alarm, `wayfinder-uptime-alerts` topic                      | Yes                                            |

The uptime stack sits in us-east-1 because Route 53 publishes health check metrics only there.

## Deploying the site

Merge to `main`. CI runs; if it passes, the **Deploy** workflow builds the image (skipped if
that SHA already exists in ECR, since tags are immutable), ships it with the compose file and
Caddyfile from the same commit, and waits for every container's healthcheck. It then checks
`/`, `/sitemap.xml`, a 404 and the HTTP→HTTPS redirect from outside, over the real certificate.

If the new image never becomes healthy, the host restores the image it was running and the
workflow fails. The site keeps serving the old version.

## Rolling back

Actions → **Deploy** → _Run workflow_ → paste the full SHA of the commit to go back to. That
image is already in ECR, so nothing is rebuilt. The last 20 images are kept. From a terminal:

```bash
gh workflow run Deploy -f sha=<full commit sha>
```

## Changing the infrastructure

Infrastructure is **not** deployed by CI. CI only synthesizes it and runs the cdk-nag checks.
Changes go out by hand, after reading the diff:

```bash
aws login --profile wayfinder --region ca-central-1   # browser sign-in with MFA
cd infra
npx cdk diff                                          # read it
npx cdk deploy WayfinderHost                          # or WayfinderFoundation / WayfinderUptime
```

- **Changing the host's user data replaces the instance** (`userDataCausesReplacement`). The new
  host starts empty: run the Deploy workflow afterwards, and Caddy re-issues certificates.
- **The AMI is pinned** in `cdk.context.json`. To move to a newer Amazon Linux, delete that
  entry, synth and deploy (this also replaces the instance).
- **Construct IDs are resource identities.** Renaming one replaces the resource; always diff.

## Getting a shell

There is no SSH and no key. Use Session Manager, which needs the
[Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html):

```bash
aws ssm start-session --profile wayfinder --target <instance id>   # WayfinderHost.InstanceId
sudo -i && cd /opt/wayfinder
docker compose ps
docker compose logs --tail 100 web
```

Or the EC2 console → the instance → _Connect_ → _Session Manager_.

## Health and alerts

| Watch                              | What happens                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Container healthchecks             | Gate every deploy; a failed rollout restores the previous image                                  |
| System status check (AWS hardware) | Alarm **recovers** the instance onto new hardware, same ID, IP and disk; emails                  |
| Instance status check (hung OS)    | Alarm **reboots** the instance; Docker restarts the containers; emails                           |
| CPU credits below 20               | Emails. Standard credits mean the host slows down under load rather than billing for surplus CPU |
| Route 53 HTTPS check, 3 regions    | Emails if `https://underwoodstyles.ca/` fails for 2 minutes, and again when it recovers          |
| AWS Budgets                        | Emails on actual or forecast monthly spend over budget (set up in the console, step 2.1)         |
| `dnf-automatic`                    | Applies security updates daily                                                                   |
| Docker log rotation                | 3 × 10 MB per container, so logs cannot fill the disk                                            |

Alerts go to two SNS topics. Email subscriptions are added from the CLI so the address stays
out of this public repository; each sends a confirmation email that must be clicked:

```bash
aws sns subscribe --profile wayfinder --region ca-central-1 --protocol email \
  --topic-arn arn:aws:sns:ca-central-1:742188596859:wayfinder-alerts --notification-endpoint <email>
aws sns subscribe --profile wayfinder --region us-east-1 --protocol email \
  --topic-arn arn:aws:sns:us-east-1:742188596859:wayfinder-uptime-alerts --notification-endpoint <email>
```

## Rebuilding from nothing

If the host is lost or must be replaced:

1. `npx cdk deploy WayfinderHost` (after `cdk destroy WayfinderHost` if it is broken beyond
   repair). The Elastic IP is in the foundation stack, so DNS does not change.
2. Run the Deploy workflow for the current `main` SHA.
3. Caddy issues fresh certificates on first request. Let's Encrypt allows five duplicate
   certificates a week, which is plenty unless this loops.

If the whole account were lost: bootstrap CDK in both regions, deploy all three stacks, set the
`AWS_DEPLOY_ROLE_ARN` variable on the GitHub `production` environment, update the Namecheap
nameservers to the new zone's `NameServers` output, then deploy.

## Credentials

- **People:** IAM user with MFA; the CLI uses `aws login` short-lived sessions. No access keys.
- **GitHub:** OIDC only. The deploy role trusts a token only if its subject is this repository's
  `production` environment, in GitHub's immutable form
  (`repo:gregunderwood@313113/wayfinder@1435180502:environment:production`), so a repository
  recreated under the same name cannot deploy. The environment only accepts `main`.
- **The host:** its instance role can pull from the one ECR repository and talk to SSM; nothing
  else. IMDSv2 is required.
- **The deploy role** can push to and pull from the one ECR repository, and run
  `AWS-RunShellScript` only on instances tagged `wayfinder:role=web`.
