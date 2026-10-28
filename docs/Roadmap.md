# Roadmap

## What it is

Phases are ordered so the site is live as early as possible: Phase 1 is deliberately
database-free, Phase 2 deploys it, and the CMS arrives underneath a site that is already public.

## Status

| Phase | Outcome                                                                                                            | State                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 0     | Nx workspace, `libs/domain`, lint boundaries, Prettier, CI, AGENTS.md + docs                                       | **Done**                               |
| 1     | **Publishable.** Public shell, Home/About/Resume/Skills, SSR + prerender, SEO, a11y. Content hardcoded in TS       | **Done**                               |
| 2     | **Live on AWS.** Account foundation, infrastructure as code, container, CI/CD, DNS + TLS                           | **Done**                               |
| 3     | Postgres + TypeORM + migrate CLI; auth + admin shell; Projects end to end                                          | **In progress** (branch `phase-3-cms`) |
| 4     | Blog: posts, tags, drafts/scheduling, markdown editor with preview, RSS                                            |                                        |
| 5     | Testimonials (submission → moderation) + contact form + email (SES)                                                |                                        |
| 6     | Media uploads to S3, OG image generation, Lighthouse + a11y budget, analytics                                      |                                        |
| 7     | **Starter.** Extract a reusable "your site on your AWS" template: one config file, a setup script, example content |                                        |

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
- **No long-lived AWS keys anywhere.** Greg signs in as an MFA-protected IAM user, and the CLI uses `aws login` short-lived credentials; GitHub
  Actions assumes a role through OIDC, scoped to this repo's `production` environment (which accepts only `main`); the
  instance pulls from ECR through its instance role.
- **Images build in CI, not on the dev box** — on GitHub's arm64 runners, tagged by git SHA.
  Rollback is redeploying the previous SHA.
- **Infrastructure is code** (AWS CDK in TypeScript, `infra/` as an Nx project), so the AWS side
  is reviewable in the repo like everything else.
- **Rough cost:** ~US$18–22/month (instance, 20 GB gp3, public IPv4, Route 53 zone and HTTPS health check, ECR).

### Steps

| Step   | What                                                                                                                                        | Who                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 2.1 ✅ | **Account foundation:** root MFA, then lock root away; budget alarm; admin IAM user with MFA; region `ca-central-1` (Canada Central)        | Greg in the console, guided   |
| 2.2 ✅ | **Local access:** AWS CLI v2 installed under `/home` (root disk is tight), `aws login`, CDK bootstrap                                       | Greg signs in; Claude scripts |
| 2.3 ✅ | **Container:** `Dockerfile.web` (multi-stage, non-root), `docker-compose.yml`, `Caddyfile` (apex + www → apex, security headers)            | Claude                        |
| 2.4 ✅ | **Infrastructure:** CDK stack — EC2 + Elastic IP + security group, instance role (SSM, ECR pull), ECR repo, GitHub OIDC role, Route 53 zone | Claude writes, Greg approves  |
| 2.5 ✅ | **Deploy pipeline:** `deploy.yml` — after CI passes on `main`: build arm64 image → ECR → SSM `compose pull && up -d` → health check         | Claude                        |
| 2.6 ✅ | **DNS + TLS cutover:** point underwoodstyles.ca at Route 53 (or add records at the registrar), Caddy issues certificates                    | Greg at the registrar         |
| 2.7 ✅ | **Verify + harden:** HTTPS, 404s, sitemap, link previews, Lighthouse; instance auto-recovery + OS auto-updates; `docs/Deployment.md`        | Claude                        |

**Done when:** `https://underwoodstyles.ca` serves the site over HTTPS, a push to `main` deploys
itself, and rolling back is one command.

### Deliberately not in Phase 2

- **S3 / CloudFront for assets.** Every asset today is in the build and served with a one-year
  cache. Uploads arrive in Phase 6 and go to S3 then.
- **A database.** Phase 3.
- **Email.** SES arrives with the contact form in Phase 5.

## Phase 3 — CMS

### How this phase is built

- **On a branch, `phase-3-cms`, tested locally until the whole phase is done.** `main` stays
  what production runs; only a merge to `main` deploys, so nothing in this phase reaches
  underwoodstyles.ca until the CMS works end to end on the dev box. A fix the live site needs
  meanwhile goes to `main` and the branch rebases onto it.
- **Local runs the same containers as production:** `docker compose` with web, api, Postgres
  and Caddy, plus the Nx dev servers for fast iteration.
- **Merging is the release:** the production infrastructure (3.6) is deployed first by hand,
  then the merge ships the code, then migrations run once (3.7).

### Shape

```
caddy :443 ─┬─ /api/*  ──► api :3000 (NestJS) ──► postgres :5432
            └─ else    ──► web :4000 (Angular SSR) ──(server-side fetch)──► api
postgres data ──► EBS volume in WayfinderFoundation (retained; survives host rebuilds)
nightly pg_dump ──► S3 bucket (versioned, 30-day expiry)
secrets ──► SSM Parameter Store (SecureString), read by the host at deploy time
```

### Decisions

- **Postgres in Compose on a retained EBS volume, not RDS.** RDS would roughly double the
  monthly bill for one admin user. The data volume lives in the foundation stack, so replacing
  the host re-attaches it instead of losing it. Caddy's certificates move onto it too.
  Backups: nightly `pg_dump` to S3, plus a restore drill that is actually run before cutover.
- **Pages that show CMS data render on request; the rest stay prerendered.** CI has no
  database, so project pages (and anything listing projects) are server-rendered per request
  from the API. Visitors and crawlers still get full HTML, and an admin edit is live without a
  redeploy. Home, About, Resume and Skills stay prerendered unless they start showing CMS data.
- **Secrets never enter the repo or GitHub.** The database password and JWT signing keys are
  SSM SecureString parameters; the deploy script has the host read them into `.env`.
- **Migrations are a deliberate step.** Deploys don't run them automatically; a `migrate` flag
  on the Deploy workflow does, and every migration must pass `run → revert → run` in CI.

### Steps

| Step | What                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | **API + database locally:** Postgres and the Nest API in Compose, Caddy routes `/api`; config, TypeORM, migration CLI, `/api/health` reporting the database |
| 3.2  | **Auth:** `create-admin` CLI, argon2id, JWT in httpOnly cookies with refresh rotation, optional TOTP, rate-limited login; 90% coverage on auth              |
| 3.3  | **Projects API:** public read-only endpoints (published only) and admin CRUD, validation, a seed from today's `projects.ts`                                 |
| 3.4  | **Admin UI:** `/admin` login and Projects editor with markdown preview; client-only, `noindex`, excluded from prerender                                     |
| 3.5  | **Public pages from the API:** project pages server-rendered per request; sitemap built from the database                                                   |
| 3.6  | **Production infrastructure:** retained data volume, S3 backup bucket and nightly dump, SSM secrets, `migrate` flag on Deploy; restore drill                |
| 3.7  | **Cutover:** Cypress suite for public vs admin routes, `docs/Deployment.md` updated, merge to `main`, migrate, create the admin user, verify live           |

**Done when:** Greg can sign in at `/admin`, edit a project, and see it on the live site without
a deploy; and a deleted database can be restored from last night's backup.

### Deliberately not in Phase 3

- **A staging environment.** Today a merge to `main` goes straight to production, guarded by
  CI, container healthchecks and automatic rollback. Later: deploy every merge to a staging
  host first, then promote that same image to production with an explicit approval (a GitHub
  environment with a required reviewer, or a manual "promote" workflow). Images are already
  tagged by SHA, so promotion is a redeploy of the tested tag, not a rebuild. Worth doing before
  the starter (Phase 7) is offered to anyone else.

## Phase 7 — Starter

The Phase 2 stack (a site on the owner's own AWS account, with no stored keys, self-healing, alerts,
rollback and cdk-nag in CI) is useful beyond this site. `starter/aws-site` is a snapshot of it at
the end of Phase 2. It is scheduled after Phase 3 because a site plus a CMS is what someone would
pay for; a bare site competes with free tiers on Vercel, Netlify and Amplify.

### Steps

| Step | What                                                                                                                                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1  | **One config file** (`site.config.json`): domain, AWS account and region, repo, budget, instance size. Infra, both workflows, Angular `allowedHosts` and the SEO config read it; today the domain alone is set in five places.                                         |
| 7.2  | **`npm run setup`**: asks for the domain and AWS profile; discovers the account ID and the repo's OIDC subject; bootstraps CDK in both regions; deploys; creates the GitHub `production` environment and variable; subscribes the alert email; prints the nameservers. |
| 7.3  | **Example content** in place of Greg's; mark the repo as a GitHub template.                                                                                                                                                                                            |
| 7.4  | **Docs for what AWS will not automate:** account creation, root MFA, registrar nameservers.                                                                                                                                                                            |

**Structure:** the starter becomes the upstream and underwoodstyles.ca a fork of it, so fixes flow
from starter to site and nothing personal leaks the other way. Decide before Phase 3 adds much to
`main`, or the split gets harder.

### Business models (to test, not decided)

| Model                                      | Notes                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| One-time boilerplate license, US$99–299    | Most likely first step; low support load                                              |
| Open core: free starter, paid CMS "Pro"    | Keeps the portfolio value of a public repo; pairs with the license                    |
| Done-for-you setup in the client's account | US$500–1,500 per setup; revenue now, and shows what to productize                     |
| Customer-owned plus paid support/updates   | US$10–20/month recurring without hosting other people's sites                         |
| Managed hosting subscription               | Least attractive solo: on call for others' uptime, and competing with Vercel on price |

The repo stays open source while Greg is job hunting; a public, well-built repo is worth more
than early sales.

## Open questions

- **DNS:** underwoodstyles.ca is registered at **Namecheap**; the plan is a Route 53 hosted zone with
  Namecheap pointed at its nameservers (step 2.6).
- **Sign In Solutions end date and title.** The résumé shows "Feb 2019 – 2026" and "Senior
  Full-Stack Software Engineer" — both to confirm in `apps/web/src/app/content/experience.ts`.
  Gateway's period ("2025") is also a placeholder in `projects.ts`.
- **GitHub and LinkedIn links**, and an Open Graph share image (Phase 6).

## When to update this file

- A phase starts or finishes
- An open question is answered
