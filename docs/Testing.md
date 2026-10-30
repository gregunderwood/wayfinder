# Testing

## What it is

Vitest, colocated `*.spec.ts`. Server tests run against real Postgres, with coverage
**thresholds** on the server paths where a bug costs the most: `src/app/auth/**` (a hole in admin
login), `src/app/projects/**` (a draft leaking to the public, or a lost edit) and
`src/app/posts/**` (lost or prematurely published writing), at 90% lines / 90% functions / 85%
branches / 90% statements.
Cypress covers route visibility end to end.

## Key files

- [../vitest.workspace.ts](../vitest.workspace.ts) — discovers each project's own vitest config
- [../apps/server/vitest.config.ts](../apps/server/vitest.config.ts) — the coverage `include` list and thresholds
- [../apps/web/vite.config.mts](../apps/web/vite.config.mts) — Angular tests via Analog's Vitest plugin
- [../apps/server/src/testing/](../apps/server/src/testing/) — the test database (global setup, `useTestDatabase()`) and the running API (`useTestApp()`)
- [../apps/web-e2e/](../apps/web-e2e/) — Cypress

## How it works

```bash
npx nx run-many -t lint,test,build     # the gate
npx nx test server --coverage          # where thresholds are checked
npx nx test server -- posts            # one file, by substring
npx nx e2e web-e2e                     # Cypress against a served build
```

Vitest globals are on: `describe`, `it`, `expect` and `vi` need no import.

### Four kinds of test, in descending order of value

1. **Pure decision functions** — slug generation, publish/schedule state, token expiry, reading
   time. No mocks; time is a parameter.
2. **Service tests against real Postgres.**
   `new PostsService(db.repository(PostEntity), new FixedClock(NOW))`: a real repository on the
   test database, no fake repositories or data sources, and no `@nestjs/testing` module
   compilation. A fake cannot fail a unique index, a foreign key or a migration, and those are
   where persistence bugs live.
3. **API tests through HTTP.** `useTestApp(database)` boots the real `AppModule` on a free port
   against the spec's own database, and `send()` makes real requests. For what only the HTTP
   layer decides: guards, validation, status codes, cookies and rate limits.
4. **Cypress route visibility.** Every route asserted for three cases: unauthenticated visitor,
   authenticated admin, and admin-only route hit while logged out.

Angular component tests use `provideZonelessChangeDetection()`.

### The test database

`npx nx test server` needs Postgres running (`docker compose up -d --wait postgres`); CI's `main`
job starts it as a service. A Vitest global setup creates a template database
(`wayfinder_test_template`), runs every migration into it from the same `migrations/index.ts`
list the image uses. Each spec file that calls `useTestDatabase()` gets its own copy
(`CREATE DATABASE … TEMPLATE`), so files run in parallel without sharing rows. Tables are truncated before each test, so the rows the seed migrations put in the template never reach one. Test databases
are dropped at the end, and the development database is never touched.

A case that needs the database _unreachable_ points a real connection at a port with nothing
listening, rather than faking the failure.

## Patterns to follow

### ✅ Name the behaviour and the reason, not the method

```ts
it('does not list a scheduled post before its publish time', ...)
```

### ✅ Real collaborators over mocks

The database is real. Something outside the system (the clock, email delivery, an S3 client) is
replaced by a small hand-written class, never a deep `vi.fn()` chain.

### ❌ Don't let a spec depend on wall-clock time

### ❌ Don't leave a `jest` artifact anywhere

## Pitfalls

- **`connect ECONNREFUSED 127.0.0.1:5432` in the server tests.** Postgres is not running; start
  it with `docker compose up -d --wait postgres`.
- **Two server test runs at once break each other.** Each run's setup and teardown drop every
  `wayfinder_test_*` database, including the other run's.
- **A migration missing from `migrations/index.ts` fails the tests,** because the test database
  is built from that list. That is deliberate: the image uses the same list.
- **Coverage thresholds only run under `--coverage`.** That is why it is part of the gate.

## When to update this file

- The coverage `include` list or thresholds change
- A new kind of test is introduced (e.g. API integration against a real database)
