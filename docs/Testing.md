# Testing

## What it is

Vitest, colocated `*.spec.ts`, with coverage **thresholds** on the two server paths where a bug
costs the most: `src/app/auth/**` (a hole in admin login) and `src/app/posts/**` (lost or
prematurely published writing), at 90% lines / 90% functions / 85% branches / 90% statements.
Cypress covers route visibility end to end.

## Key files

- [../vitest.workspace.ts](../vitest.workspace.ts) — discovers each project's own vitest config
- [../apps/server/vitest.config.ts](../apps/server/vitest.config.ts) — the coverage `include` list and thresholds
- [../apps/web/vite.config.mts](../apps/web/vite.config.mts) — Angular tests via Analog's Vitest plugin
- [../apps/web-e2e/](../apps/web-e2e/) — Cypress

## How it works

```bash
npx nx run-many -t lint,test,build     # the gate
npx nx test server --coverage          # where thresholds are checked
npx nx test server -- posts            # one file, by substring
npx nx e2e web-e2e                     # Cypress against a served build
```

Vitest globals are on: `describe`, `it`, `expect` and `vi` need no import.

### Three kinds of test, in descending order of value

1. **Pure decision functions** — slug generation, publish/schedule state, token expiry, reading
   time. No mocks; time is a parameter.
2. **Service tests with hand-rolled fakes.** `new PostsService(fakeRepo, new FixedClock(NOW))` —
   no `@nestjs/testing` module compilation.
3. **Cypress route visibility.** Every route asserted for three cases: unauthenticated visitor,
   authenticated admin, and admin-only route hit while logged out.

Angular component tests use `provideZonelessChangeDetection()`.

## Patterns to follow

### ✅ Name the behaviour and the reason, not the method

```ts
it('does not list a scheduled post before its publish time', ...)
```

### ✅ Hand-rolled fakes over deep mock chains

### ❌ Don't let a spec depend on wall-clock time

### ❌ Don't leave a `jest` artifact anywhere

## Pitfalls

- **A mocked repository cannot fail a database constraint.** Where a unique index carries the
  guarantee (slugs), verify against real Postgres.
- **Coverage thresholds only run under `--coverage`.** That is why it is part of the gate.

## When to update this file

- The coverage `include` list or thresholds change
- A new kind of test is introduced (e.g. API integration against a real database)
