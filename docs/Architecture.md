# Architecture

## What it is

A personal portfolio and blog with its own CMS: a public, server-rendered Angular site, a NestJS
API backed by Postgres, and a single-user admin area for writing posts, managing projects and
moderating testimonials. One Nx workspace, three projects plus an e2e suite.

## Key files

- [../apps/web/src/app/app.config.ts](../apps/web/src/app/app.config.ts) — browser + shared providers
- [../apps/web/src/app/app.config.server.ts](../apps/web/src/app/app.config.server.ts) — SSR providers, merged on top
- [../apps/web/src/app/app.routes.server.ts](../apps/web/src/app/app.routes.server.ts) — which routes prerender, which render per request, which are client-only
- [../apps/web/src/server.ts](../apps/web/src/server.ts) — the Express SSR host
- [../apps/server/src/main.ts](../apps/server/src/main.ts) — API bootstrap, global `/api` prefix, `migrate:*` commands
- [../apps/server/src/database.ts](../apps/server/src/database.ts) — the one Postgres config shared by the API, the bundled migration runner and the TypeORM CLI
- [../apps/server/src/app/common/api-exception.filter.ts](../apps/server/src/app/common/api-exception.filter.ts) — turns every thrown error into an `ApiError` body
- [../docker-compose.yml](../docker-compose.yml) / [../caddy/Caddyfile](../caddy/Caddyfile) — the production stack; Caddy sends `/api/*` to the API and everything else to SSR
- [../libs/domain/src/index.ts](../libs/domain/src/index.ts) — the shared contract and its invariant

## How it works

```
browser ──► Caddy (TLS) ──► web  (Angular SSR, Express)  ──► /api ──► server (NestJS) ──► Postgres
```

- **`apps/web`** — Angular 20, standalone, SSR with prerender. The public routes are prerendered
  at build time where their content is known and server-rendered otherwise; `/admin/*` is
  client-rendered, `noindex`, and never prerendered.
- **`apps/server`** — NestJS 11 under `/api`. Public endpoints are read-only and return published
  rows only. Every write is admin-guarded, with two deliberate public exceptions: `POST /contact`
  and `POST /testimonials` (which lands as `pending`).
- **`libs/domain`** — interfaces, enums and consts shared by both. The only thing either app may
  import from another project.

### Module boundaries

Enforced by `@nx/enforce-module-boundaries` in the root `eslint.config.mjs`:

| Tag           | May depend on | Notes                                                                       |
| ------------- | ------------- | --------------------------------------------------------------------------- |
| `type:app`    | `type:domain` | Apps never import each other                                                |
| `type:domain` | `type:domain` | Plus banned imports: Angular, Nest, TypeORM, class-validator, rxjs, express |

### Why SSR here

A portfolio lives or dies on search and link previews. A client-only Angular app shows crawlers
and Slack/LinkedIn unfurlers an empty `<wf-root>`. Prerendering also makes the public pages cheap
to serve and resilient to the API being down.

### Why TLS is not in Node

TLS terminates in Caddy, not in the SSR process. Certificates renew without restarting the app,
and the same config works on any host — the hosting choice is still open.

## Pitfalls

- **Anything touching `window`, `document` or `localStorage` breaks prerender.** Guard with
  `isPlatformBrowser` or `afterNextRender`, or keep it in an admin-only route.
- **The dev proxy (`apps/web/proxy.conf.json`) and the API port must agree.** Both are 3000, as
  is the Caddyfile's upstream.
- **A new entity or migration must be listed by hand** (`ENTITIES` in `database.ts`,
  `migrations/index.ts`). The API is a webpack bundle with no directory to glob, so a missed one
  works from source and is silently absent from the image.

## When to update this file

- A project is added, or a tag/boundary rule changes
- The request path changes (proxy, SSR host, API prefix)
- The rendering mode of a route group changes
