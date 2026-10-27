# Roadmap

## What it is

Phases are ordered so the site is publishable as early as possible: Phase 1 is deliberately
database-free, and the CMS arrives underneath a site that is already live.

## Status

| Phase | Outcome                                                                                                      | State    |
| ----- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 0     | Nx workspace, `libs/domain`, lint boundaries, Prettier, CI, AGENTS.md + docs                                 | **Done** |
| 1     | **Publishable.** Public shell, Home/About/Resume/Skills, SSR + prerender, SEO, a11y. Content hardcoded in TS | Next     |
| 2     | Postgres + TypeORM + migrate CLI; auth + admin shell; Projects end to end                                    |          |
| 3     | Blog: posts, tags, drafts/scheduling, markdown editor with preview, RSS                                      |          |
| 4     | Testimonials (submission → moderation) + contact form + SMTP                                                 |          |
| 5     | Media uploads, OG image generation, Lighthouse + a11y budget, analytics                                      |          |
| 6     | Dockerfiles, compose, Caddy, `deploy.sh`, pick a host, go live                                               |          |

## Open questions

- **Résumé content past 2022.** The source résumé stops at Traction Guest (2019 - present as of 2022).
- **Hosting.** Deferred; everything is built container-first so any VPS works.

## When to update this file

- A phase starts or finishes
- An open question is answered
