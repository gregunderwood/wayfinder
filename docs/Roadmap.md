# Roadmap

## What it is

Phases are ordered so the site is live as early as possible: Phase 1 is deliberately
database-free, Phase 2 deploys it, and the CMS arrives underneath a site that is already public.

## Status

| Phase | Outcome                                                                                                      | State    |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 0     | Nx workspace, `libs/domain`, lint boundaries, Prettier, CI, AGENTS.md + docs                                 | **Done** |
| 1     | **Publishable.** Public shell, Home/About/Resume/Skills, SSR + prerender, SEO, a11y. Content hardcoded in TS | **Done** |
| 2     | **Live on AWS.** Account foundation, infrastructure as code, container, CI/CD, DNS + TLS                     | Next     |
| 3     | Postgres + TypeORM + migrate CLI; auth + admin shell; Projects end to end                                    |          |
| 4     | Blog: posts, tags, drafts/scheduling, markdown editor with preview, RSS                                      |          |
| 5     | Testimonials (submission → moderation) + contact form + email (SES)                                          |          |
| 6     | Media uploads to S3, OG image generation, Lighthouse + a11y budget, analytics                                |          |

Deployment moved up from last to Phase 2: a repo that is public and on a résumé should point at a
live site, and a static, database-free site is the simplest thing this project will ever deploy.

## Phase 2 — Live on AWS

### Shape

```
GitHub Actions ──(OIDC, no stored keys)──► ECR ──► EC2 t4g.small (ca-central-1)
                                                   └─ Docker Compose
                                                      ├─ caddy  :80/:443, Let's Encrypt
                                                      └─ web    Angular SSR (Node 22)
DNS: underwoodstyles.ca + www ──► Elastic IP
```

- **One small Graviton (arm64) EC2 instance running Docker Compose.** Phase 2 needs only the SSR
  container, but the box is sized for what comes next: the NestJS API and Postgres join the same
  compose file in Phase 3. A managed stack (ECS + ALB + RDS) costs roughly 3–4× as much for a
  single-owner site and buys nothing yet; the containers move to it unchanged if that changes.
- **Caddy** terminates TLS and renews certificates itself. Security group opens 80 and 443 only.
- **No SSH.** Shell access and deploys go through SSM (Session Manager / Run Command), so port 22
  is never open and there is no key to lose.
- **No long-lived AWS keys anywhere.** Humans sign in through IAM Identity Center with MFA; GitHub
  Actions assumes a role through OIDC, scoped to `gregunderwood/wayfinder` on `main`; the
  instance pulls from ECR through its instance role.
- **Images build in CI, not on the dev box** — on GitHub's arm64 runners, tagged by git SHA.
  Rollback is redeploying the previous SHA.
- **Infrastructure is code** (AWS CDK in TypeScript, `infra/` as an Nx project), so the AWS side
  is reviewable in the repo like everything else.
- **Rough cost:** ~US$18–22/month (instance, 20 GB gp3, public IPv4, Route 53 zone, ECR).

### Steps

| Step | What                                                                                                                                        | Who                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2.1  | **Account foundation:** root MFA, then lock root away; budget alarm; IAM Identity Center with an admin user + MFA; region `ca-central-1`    | Greg in the console, guided   |
| 2.2  | **Local access:** AWS CLI v2 installed under `/home` (root disk is tight), `aws configure sso`, CDK bootstrap                               | Greg signs in; Claude scripts |
| 2.3  | **Container:** `Dockerfile.web` (multi-stage, non-root), `docker-compose.yml`, `Caddyfile` (apex + www → apex, security headers)            | Claude                        |
| 2.4  | **Infrastructure:** CDK stack — EC2 + Elastic IP + security group, instance role (SSM, ECR pull), ECR repo, GitHub OIDC role, Route 53 zone | Claude writes, Greg approves  |
| 2.5  | **Deploy pipeline:** `deploy.yml` — after CI passes on `main`: build arm64 image → ECR → SSM `compose pull && up -d` → health check         | Claude                        |
| 2.6  | **DNS + TLS cutover:** point underwoodstyles.ca at Route 53 (or add records at the registrar), Caddy issues certificates                    | Greg at the registrar         |
| 2.7  | **Verify + harden:** HTTPS, 404s, sitemap, link previews, Lighthouse; instance auto-recovery + OS auto-updates; `docs/Deployment.md`        | Claude                        |

**Done when:** `https://underwoodstyles.ca` serves the site over HTTPS, a push to `main` deploys
itself, and rolling back is one command.

### Deliberately not in Phase 2

- **S3 / CloudFront for assets.** Every asset today is in the build and served with a one-year
  cache. Uploads arrive in Phase 6 and go to S3 then.
- **A database.** Phase 3.
- **Email.** SES arrives with the contact form in Phase 5.

## Open questions

- **Where underwoodstyles.ca is registered** — decides whether DNS moves to Route 53 or stays
  at the registrar.
- **Sign In Solutions end date and title.** The résumé shows "Feb 2019 – 2026" and "Senior
  Full-Stack Software Engineer" — both to confirm in `apps/web/src/app/content/experience.ts`.
  Gateway's period ("2025") is also a placeholder in `projects.ts`.
- **GitHub and LinkedIn links**, and an Open Graph share image (Phase 6).

## When to update this file

- A phase starts or finishes
- An open question is answered
