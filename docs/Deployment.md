# Deployment

How underwoodstyles.ca runs, ships and recovers. The design rationale is in
[Roadmap.md § Phase 2](Roadmap.md#phase-2--live-on-aws); this page is the operating manual.

## Shape

```
push to main ─► CI (lint, test, build, container smoke test, cdk-nag synth)
                 └─ passes ─► Deploy workflow (production environment)
                               ├─ GitHub OIDC ─► IAM role wayfinder-github-deploy
                               ├─ build arm64 images ─► ECR wayfinder/web:<sha>, wayfinder/api:<sha>
                               └─ SSM Run Command ─► EC2 host /opt/wayfinder
                                                      docker compose: caddy :80/:443 ─┬─ /api/* → api :3000 → postgres
                                                                                      └─ else   → web :4000
EBS data volume ─► /var/lib/wayfinder (Postgres data, Caddy certificates)
nightly pg_dump ─► S3 wayfinder-backups-742188596859
```

| Stack (`infra/`)      | Region       | Holds                                                                                                                                                     | Replaceable?                                                   |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `WayfinderFoundation` | ca-central-1 | Route 53 zone + records, Elastic IP, both ECR repos, the data volume, the backup bucket, GitHub OIDC provider + deploy role, `wayfinder-alerts` SNS topic | No: termination-protected; IP, ECR, volume and bucket retained |
| `WayfinderHost`       | ca-central-1 | VPC, security group (80/443 only), the t4g.small instance and its role, status-check alarms                                                               | Yes: a new host re-attaches the data volume, then redeploy     |
| `WayfinderUptime`     | us-east-1    | Route 53 HTTPS health check on the public site, its alarm, `wayfinder-uptime-alerts` topic                                                                | Yes                                                            |

The uptime stack sits in us-east-1 because Route 53 publishes health check metrics only there.

## Deploying the site

Merge to `main`. CI runs; if it passes, the **Deploy** workflow builds the web and API images
(each skipped if that SHA already exists in ECR, since tags are immutable). It ships them with
the compose files, Caddyfile and backup scripts from the same commit. The host reads the
database password from SSM into a root-only `.env`, installs the backup timer, and waits for
every container's healthcheck. The workflow then checks `/`, `/sitemap.xml`, a 404, the
HTTP→HTTPS redirect and `/api/health` (`databaseReachable: true`) from outside, over the real
certificate.

Both images share one tag, the git SHA. If they never become healthy, the host restores the
previous tag for both and the workflow fails. The site keeps serving the old version. A deploy
refuses to start if the data volume is not mounted, so Postgres can never quietly write to the
root disk.

Migrations do not run on deploy. Run them deliberately from a shell on the host (below):
`docker compose run --rm api node main.js migrate:show`, then `migrate:run`.

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

- **Changing the host's user data replaces the instance** (`userDataCausesReplacement`).
  CloudFormation starts the new host before terminating the old one, so the new host retries
  attaching the data volume until the old one lets go. Run the Deploy workflow afterwards; the
  site is down from the old host's termination until that deploy finishes.
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
docker compose logs --tail 100 api
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
| Nightly database backup            | `wayfinder-backup.timer`; a failed run emails through `wayfinder-alerts`                         |

Alerts go to two SNS topics. Email subscriptions are added from the CLI so the address stays
out of this public repository; each sends a confirmation email that must be clicked:

```bash
aws sns subscribe --profile wayfinder --region ca-central-1 --protocol email \
  --topic-arn arn:aws:sns:ca-central-1:742188596859:wayfinder-alerts --notification-endpoint <email>
aws sns subscribe --profile wayfinder --region us-east-1 --protocol email \
  --topic-arn arn:aws:sns:us-east-1:742188596859:wayfinder-uptime-alerts --notification-endpoint <email>
```

## The database

- **Data** lives on a 10 GB encrypted EBS volume in `WayfinderFoundation`, mounted at
  `/var/lib/wayfinder` (`postgres/`, and `caddy/` for certificates). It survives host
  replacement and stack deletion.
- **The password** is the SSM SecureString `/wayfinder/production/database-password`, created
  once from the CLI so it never appears in the repo, GitHub or a terminal:

  ```bash
  aws ssm put-parameter --profile wayfinder --region ca-central-1 --type SecureString \
    --name /wayfinder/production/database-password --value "$(openssl rand -hex 32)"
  ```

  Changing it means also running `ALTER USER wayfinder PASSWORD '…'` in Postgres; the volume
  keeps the old one.

- **The API's secrets** are two more SecureStrings beside it, created the same way before the
  first deploy that needs them:

  ```bash
  for name in jwt-secret data-encryption-key; do
    aws ssm put-parameter --profile wayfinder --region ca-central-1 --type SecureString \
      --name /wayfinder/production/$name --value "$(openssl rand -hex 32)"
  done
  ```

  Changing `jwt-secret` signs every session out. **Never change `data-encryption-key`**: the
  encrypted columns can only be read with the key that wrote them, and backups hold the same
  ciphertext, so a lost key is lost data.

- **Backups** run nightly at 10:30 UTC: `pg_dump` to the data volume, checked with
  `pg_restore --list`, then uploaded to `s3://wayfinder-backups-742188596859/postgres/<timestamp>.dump`.
  The bucket is private, SSL-only, versioned, and expires backups after 30 days. The host can
  write and read backups but not delete them.
- **Restoring**, from a shell on the host:

  ```bash
  set -a && . /etc/wayfinder/backup.env && set +a && cd /opt/wayfinder
  host/backup-database.sh                               # take one now
  host/restore-database.sh latest wayfinder_restore_drill   # into a scratch database
  docker compose stop api                               # before restoring over production:
  host/restore-database.sh latest wayfinder && docker compose start api
  ```

## Rebuilding from nothing

If the host is lost or must be replaced:

1. `npx cdk deploy WayfinderHost` (after `cdk destroy WayfinderHost` if it is broken beyond
   repair). The Elastic IP, data volume and backups are in the foundation stack, so DNS, the
   database and the certificates all survive.
2. Run the Deploy workflow for the current `main` SHA.
3. If the data volume itself is lost, the new volume is formatted blank on first boot: deploy,
   then restore the latest backup into `wayfinder` as above.

If the whole account were lost: bootstrap CDK in both regions, deploy all three stacks, set the
`AWS_DEPLOY_ROLE_ARN` variable on the GitHub `production` environment, update the Namecheap
nameservers to the new zone's `NameServers` output, then deploy.

## Credentials

- **People:** IAM user with MFA; the CLI uses `aws login` short-lived sessions. No access keys.
- **GitHub:** OIDC only. The deploy role trusts a token only if its subject is this repository's
  `production` environment, in GitHub's immutable form
  (`repo:gregunderwood@313113/wayfinder@1435180502:environment:production`), so a repository
  recreated under the same name cannot deploy. The environment only accepts `main`.
- **The host:** its instance role can pull from the two ECR repositories, talk to SSM, read the
  one database password parameter, attach the data volume to itself, write and read (not
  delete) backups, and publish to `wayfinder-alerts`. IMDSv2 is required.
- **The deploy role** can push to and pull from the two ECR repositories, and run
  `AWS-RunShellScript` only on instances tagged `wayfinder:role=web`. It never sees the
  database password: the host reads it.
