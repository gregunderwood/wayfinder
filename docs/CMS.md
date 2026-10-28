# CMS

## What it is

The design for the content management system that Phase 3 builds: one admin account, Projects
stored in Postgres and edited at `/admin`, and public pages that render from the API. Phases 4–6
(posts, testimonials, media) reuse the same patterns.

The [Roadmap](Roadmap.md#phase-3--cms) holds scope, order and status. This file holds _how_ each
part is meant to work, so a step can be reviewed against what it set out to do. A section is
written before the step that builds it; when the code and this file disagree, either the code is
wrong or this file is out of date, and the review settles which.

Status: **3.1 built.** Sections 3.2–3.5 are the agreed design, not yet code. Anything listed
under [Open questions](#open-questions) is undecided; a step does not settle one silently.

## Key files

Built:

- [../apps/server/src/database.ts](../apps/server/src/database.ts) — the one Postgres config; the `ENTITIES` list
- [../apps/server/src/migrations/index.ts](../apps/server/src/migrations/index.ts) — every migration, in order
- [../apps/server/src/main.ts](../apps/server/src/main.ts) — bootstrap and the `node main.js <command>` CLI
- [../apps/server/src/app/common/api-exception.filter.ts](../apps/server/src/app/common/api-exception.filter.ts) — the `ApiError` response shape
- [../libs/domain/src/lib/errors/api-error.model.ts](../libs/domain/src/lib/errors/api-error.model.ts) — `ApiErrorCode`

Planned (the path is part of the design):

- `apps/server/src/app/common/clock.ts` — `Clock`, `SystemClock`, and `FixedClock` for tests
- `apps/server/src/app/auth/` — module, controller, service, `models.ts`, `jwt.strategy.ts`, `admin.guard.ts`, `current-user.decorator.ts`, `dto/`
- `apps/server/src/app/projects/` — module, public and admin controllers, service, `models.ts`, `dto/`
- `libs/domain/src/lib/auth/auth.model.ts`, and additions to `projects/project.model.ts`
- `apps/web/src/app/core/api.service.ts`, `core/api-error.interceptor.ts`, `core/auth/`
- `apps/web/src/app/features/admin/` — `login`, `projects` (list and editor)

## How it works

### Server layout

Every feature is a folder under `apps/server/src/app/<feature>/` holding `<feature>.module.ts`,
`.controller.ts`, `.service.ts`, `models.ts` (entities, named `…Entity`) and
`dto/<verb>-<noun>.dto.ts`. DTOs `implements` the payload interface from `@wayfinder/domain`.

Database conventions: uuid primary keys (`gen_random_uuid()`), `snake_case` columns mapped with an
explicit `name:`, `timestamptz` only, and named indexes (`ix_projects_slug`). Each new entity is
added to `ENTITIES` and each migration to `migrations/index.ts` by hand.

Commands run in the image as `node main.js <command>`: `migrate:show|run|revert` (built) and
`create-admin` (3.2). None runs on deploy by itself.

### Sensitive data

Anything sensitive in the database is protected so that a copy of the database, or of a backup, is
not enough to read it or to sign in. There are three layers, and every new column is put in one:

1. **Every disk and backup is encrypted at rest.** The host's root volume already is; the Postgres
   data volume (3.6) is too, and the S3 backups use server-side encryption. This covers
   everything, but only against someone holding the raw disk.
2. **What only needs verifying is hashed, not encrypted:** passwords (argon2id) and refresh tokens
   (SHA-256). Anything that can be decrypted can leak; a hash cannot be turned back.
3. **What must be read back is encrypted by the API before it is stored:** AES-256-GCM through a
   TypeORM column transformer in `common/encrypted-column.ts`. The key, `DATA_ENCRYPTION_KEY`, is
   an SSM SecureString, so it is never in the database or its backups. Each value is stored with
   the id of the key that encrypted it, so the key can be rotated.

| Data                                                       | Layer | Lands         |
| ---------------------------------------------------------- | ----- | ------------- |
| Admin password, refresh tokens                             | 2     | 3.2           |
| Admin email                                                | 3     | 3.2           |
| Two-factor secret                                          | 3     | Later         |
| Contact messages, and testimonial submitters' emails       | 3     | Phase 5       |
| Published content (projects, posts, approved testimonials) | 1     | Public anyway |

An encrypted column cannot be searched or indexed, so the design avoids needing to. Login, for
example, loads the single admin row and compares the email after decrypting it; there is never a
second admin to look up.

**The key is part of the backup plan.** A restored dump is unreadable without
`DATA_ENCRYPTION_KEY`, so the restore drill (3.6) proves the key is recoverable as well as the
data. Losing the key loses every layer-3 value.

### 3.2 Auth

One admin account, and nothing else: no sign-up, no roles. Every write except the later public
contact and testimonial forms needs it.

**Tables.**

| Table            | Columns                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `admin_users`    | `id`, `email` (encrypted, lowercased first), `password_hash`, `last_login_at`, `created_at`, `updated_at`         |
| `refresh_tokens` | `id`, `admin_user_id` (FK, cascade), `family_id`, `token_hash` (unique), `expires_at`, `revoked_at`, `created_at` |

**Creating the admin.** `node main.js create-admin --email <address>` reads the password from
stdin without echo, so it never lands in shell history or `ps`. It refuses if an admin already
exists; `--reset-password` replaces the hash and revokes every refresh token. There is no seeded
account and no default password anywhere.

**Passwords.** argon2id at OWASP's minimum: 19 MiB memory, 2 iterations, parallelism 1. Login with
an unknown email still verifies against a fixed dummy hash, so response time does not reveal
whether the account exists.

**Sessions.** Two cookies, both `HttpOnly` and `Secure`:

| Cookie       | Holds                                                 | Lifetime   | `SameSite` | `Path`              |
| ------------ | ----------------------------------------------------- | ---------- | ---------- | ------------------- |
| `wf_access`  | JWT (HS256, `sub` = admin id), signed by `JWT_SECRET` | 15 minutes | `Lax`      | `/api`              |
| `wf_refresh` | 32 random bytes; only the SHA-256 is stored           | 14 days    | `Strict`   | `/api/auth/refresh` |

A refresh rotates: the presented token is revoked and a new one is issued in the same
`family_id`. Presenting a token that was already revoked means it was copied, so the whole family
is revoked and the admin must sign in again. Logout revokes the current family and clears both
cookies.

Locally the API is plain HTTP behind the dev proxy, and browsers drop `Secure` cookies there except
on `localhost`, which they treat as secure. Use `localhost`, not `127.0.0.1`.

**CSRF.** No CORS is enabled; the admin is same-origin. `SameSite` stops cross-site requests
carrying the cookies, and every state-changing route requires `Content-Type: application/json`,
which a cross-site HTML form cannot send without a preflight that will fail.

**Endpoints.**

| Method and path          | Body                  | Success                   | Failure                                     |
| ------------------------ | --------------------- | ------------------------- | ------------------------------------------- |
| `POST /api/auth/login`   | `{ email, password }` | 204, sets both cookies    | 401 `InvalidCredentials`; 429 `RateLimited` |
| `POST /api/auth/refresh` | none                  | 204, rotates both cookies | 401 `Unauthorized`                          |
| `POST /api/auth/logout`  | none                  | 204, clears both cookies  | none                                        |
| `GET /api/auth/me`       | none                  | 200 `AdminProfile`        | 401 `Unauthorized`                          |

**Guarding.** A Passport JWT strategy reads `wf_access`. `AdminGuard` applies at controller level
to everything under `/api/admin/*`, and `@CurrentUser()` injects the profile. Public controllers
never use the guard, and admin controllers never skip it.

**Rate limits.** `@nestjs/throttler`: login 5 per minute per client IP, refresh 30 per minute, and
a global ceiling of 300 per minute. Nest must trust exactly one proxy hop (Caddy) to see the real
IP; see [Pitfalls](#pitfalls).

**Two-factor sign-in comes after cutover.** It is not in Phase 3. When it lands, the secret is a
layer-3 encrypted column, and a correct password without a valid code answers 401
`TotpRequired`.

**Time.** Expiry, rotation and rate windows read an injected `Clock`. Tests use `FixedClock`; no
decision calls `new Date()`.

**Coverage.** `src/app/auth/**` at 90/90/85/90, already configured in
[`vitest.config.ts`](../apps/server/vitest.config.ts).

### 3.3 Projects API

**Contract changes in `@wayfinder/domain`.** `Project` stays the public read shape and gains
nothing that a visitor should not see. New:

- `ProjectStatus` enum: `draft`, `published`.
- `AdminProject` — `Project` plus `id`, `status`, `publishedAt`, `createdAt`, `updatedAt` (ISO
  strings).
- `CreateProjectPayload` (every editable field), `UpdateProjectPayload` (all optional).

**Table `projects`.** `id`, `slug` (unique, `ix_projects_slug`), `name`, `tagline`, `kind`, `role`,
`period`, `stack` (`text[]`), `body_markdown`, `live_url`, `repo_url`, `docs_url`, `featured`,
`sort_order`, `status`, `published_at`, `created_at`, `updated_at`. Every field and limit in
`project.model.ts` and `content.spec.ts` carries over; for example a tagline over 160 characters
is a 400.

**Endpoints.**

| Method and path                  | Who    | Returns                                                          |
| -------------------------------- | ------ | ---------------------------------------------------------------- |
| `GET /api/projects`              | Public | Published projects, in `sort_order`                              |
| `GET /api/projects/:slug`        | Public | One published project; a draft or a missing slug is the same 404 |
| `GET /api/admin/projects`        | Admin  | Every project, as `AdminProject`                                 |
| `POST /api/admin/projects`       | Admin  | 201; 409 `SlugTaken`                                             |
| `PATCH /api/admin/projects/:id`  | Admin  | 200; 409 `SlugTaken`                                             |
| `DELETE /api/admin/projects/:id` | Admin  | 204                                                              |

**Rules.**

- **A draft never leaves through a public endpoint.** The published filter lives in one
  repository query used by both public routes, not in each controller.
- **A published slug is a URL.** Renaming it is rejected with a 400 while the project is
  published; unpublish first, knowing old links will 404. Redirects from old slugs are not
  planned; they get built if a rename is ever needed.
- **The slug's uniqueness is the database's job.** The service checks first so the common case
  gets a clean `SlugTaken`, but the unique index is the guarantee, and a constraint violation maps
  to the same 409.
- `published_at` is set the first time a project is published and kept on later edits.

**Seed.** Today's projects arrive through a data migration, so every environment gets the same
rows through the same reviewed path. The server cannot import `apps/web/.../content/projects.ts`
(apps never import each other), so a one-off script generates the migration's SQL from that file
and the generated migration is what is committed and reviewed.

**Tests.** Every rule above is tested against real Postgres (see
[Testing](Testing.md#the-test-database)), so the unique index and the published filter are
exercised as they run in production. `src/app/projects/**` joins the coverage `include` list.

### 3.4 Admin UI

**Routes.**

| Path                  | Shows                          |
| --------------------- | ------------------------------ |
| `/admin/login`        | Email and password             |
| `/admin`              | Redirects to `/admin/projects` |
| `/admin/projects`     | Every project, with status     |
| `/admin/projects/new` | Editor                         |
| `/admin/projects/:id` | Editor                         |

All are `RenderMode.Client` in `app.routes.server.ts`, listed before the `**` catch-all, never
prerendered and never in the sitemap. They carry a `noindex` meta tag, Caddy adds
`X-Robots-Tag: noindex` for `/admin/*`, and `robots.txt` disallows `/admin`. The admin feature is
lazy-loaded, so none of its code reaches a public page's bundle.

**Plumbing.**

- `core/api.service.ts` is the only class that calls `HttpClient`. Every method is typed from
  `@wayfinder/domain`.
- `core/api-error.interceptor.ts` is the only place HTTP errors are handled. On 401 `Unauthorized`
  it calls `/api/auth/refresh` once and retries; if that fails it routes to `/admin/login` with a
  return URL. Components see a typed `ApiError`, never an `HttpErrorResponse`.
- `core/auth/` holds a signal of the current admin, loaded from `/api/auth/me`, and an `adminGuard`
  (`CanMatch`) on the `/admin` subtree except `login`.

**Editor.** A strictly typed reactive form (`FormGroup<ProjectForm>`). The markdown preview uses
the same `core/markdown.ts` renderer, and its sanitising, as the public page, so the preview cannot
differ from what is published. A 400's `details.errors` show next to the form; a 409 `SlugTaken`
shows on the slug field.

**Styling** uses the site's own tokens and shared classes in `styles.scss`, with no component
library, so there is one styling approach and the admin adds little to the bundle.

Same rules as the rest of the app: standalone, signals, `OnPush`, `inject()`, inline SVG, no
`ngModel`, no browser globals outside `afterNextRender`.

### 3.5 Public pages from the API

**Render modes.** `/`, `/work` and `/work/:slug` show projects, so they move from `Prerender` to
`Server`. `/about` and `/resume` stay prerendered. The `getPrerenderParams` reading
`content/projects.ts` goes, and `content/projects.ts` is deleted once nothing imports it; the
`PROJECT_KIND_LABELS` it holds move to a component-level constant.

**Fetching.** The browser calls `/api`. During SSR, a server-only interceptor rewrites `/api/...`
to `API_INTERNAL_URL` (`http://api:3000/api` in Compose), so the render does not loop out through
Caddy and TLS. Angular's HTTP transfer cache, on by default with hydration, hands the server's
responses to the browser, so a page load makes no second API call.

**Status codes.**

- An unknown or draft slug answers a real 404 through `RESPONSE_INIT`, as today.
- **The API unreachable answers 503 with `Retry-After`, never a 404.** A 404 tells search engines
  the page is gone; a 503 tells them to come back.
- `/about` and `/resume` are unaffected by an API outage.

**Caching.** Server-rendered pages send `Cache-Control: public, max-age=60,
stale-while-revalidate=600`, so an edit is visible within a minute and a burst of visitors does
not mean a burst of queries.

**Sitemap.** `server.ts` builds `/sitemap.xml` from `GET /api/projects` plus the static paths. If
the API is down, it answers 503 rather than a sitemap missing every project.

**Review check.** For each project, the server-rendered page's title, description, canonical, Open
Graph tags and JSON-LD must match what the prerendered page on `main` produces today.

## Patterns to follow

### ✅ The published filter lives in one query

```ts
// projects.service.ts: both public routes go through this
private publishedQuery(): SelectQueryBuilder<ProjectEntity> {
  return this.projects.createQueryBuilder('p').where('p.status = :status', {
    status: ProjectStatus.Published,
  });
}
```

### ✅ Guard admin controllers as a whole

```ts
@Controller('admin/projects')
@UseGuards(AdminGuard)
export class AdminProjectsController {}
```

### ❌ Don't put a guard on individual admin methods

A method added later without its decorator is a public write.

### ❌ Don't return an entity from a controller

Map to the domain type. An entity carries every column, including the ones that must never leave
the server (`password_hash`, `token_hash`), and serialises `Date`s that the contract types as
strings.

### ❌ Don't store a token, only its hash

A copy of the `refresh_tokens` table, or a backup of it, must not be enough to sign in.

## Pitfalls

- **Behind Caddy, every request comes from Caddy's IP.** Without `app.set('trust proxy', 1)` the
  login rate limit counts every visitor as one client, so one attacker locks everyone out. Trust
  more than one hop and `X-Forwarded-For` can be forged to dodge the limit.
- **argon2 is a native module.** Verify that the runtime image (Alpine, arm64 on the host) loads
  it, not just the dev box: the CI container job runs `create-admin` inside the built image.
- **`Secure` cookies are dropped on `http://127.0.0.1`.** Use `http://localhost` locally.
- **A `RenderMode.Client` route listed after `**` never matches.** Admin entries go before the
  catch-all in `app.routes.server.ts`.
- **SSR with a relative `/api` URL fails in Node,** which has no origin to resolve against. That is
  what the server-side interceptor is for.
- **An entity or migration missing from its hand-written list** works from source and is absent
  from the image. The CI migration job runs `migrate:*` from the built image, not from source, to catch it.

## Open questions

None. A new one goes here, and is decided by the owner before the step that needs it.

## When to update this file

- Before starting a step: its section must describe what the step will build
- A design choice changes during a step, or an open question is answered
- An endpoint, table, cookie or render mode differs from what is written here
