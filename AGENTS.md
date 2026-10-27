# Agent Guidelines for wayfinder

Quick-reference cheat sheet. For deeper docs, follow the links into `docs/`.

**Wayfinder is Greg Underwood's portfolio site (underwoodstyles.ca), and it is also a work sample.** A recruiter or client
who views source, runs Lighthouse, or reads the repo is evaluating the author. Sloppy code here
argues against the person it is meant to hire, so "it renders" is not the bar.

## Before starting any response, ask yourself, does this involve:

- **Any code changes** → Read [./docs/Code Quality.md](./docs/Code%20Quality.md) (TS strict, explicit return types, DTO/interface split, comments policy)
- Where a thing belongs, the three projects, SSR, the API seam → Read [./docs/Architecture.md](./docs/Architecture.md)
- The Angular app, routes, SEO, the admin area → Read [./docs/Web App.md](./docs/Web%20App.md)
- Tests (`*.spec.ts`), coverage, Cypress → Read [./docs/Testing.md](./docs/Testing.md)
- "What's next" / "where were we" → Read [./docs/Roadmap.md](./docs/Roadmap.md)
- First time in the repo, or nothing runs → Read [./docs/Getting Started/Development setup.md](./docs/Getting%20Started/Development%20setup.md)

## Build/Test/Lint Commands

```bash
npx nx serve web                      # Angular dev server on :4200
npx nx serve server                   # NestJS API
npx nx run-many -t lint,test,build    # the gate
npx nx test server --coverage         # also the gate: thresholds are checked ONLY here
npx nx e2e web-e2e                    # Cypress
npx prettier --write .                # format
```

- **`npx nx run-many -t lint,test,build` is the final step before declaring work done.** Not
  `test` alone: Vitest transpiles without typechecking, so only the webpack/Angular builds catch
  a type error.
- **And `npx nx test server --coverage`**, which is where the thresholds are actually checked.
- Node 22 via nvm (`.nvmrc`). A fresh non-login shell may not have `node` on `PATH`; run
  `. ~/.nvm/nvm.sh && nvm use` first.
- There is no `serve` on `libs/domain`; it is consumed through the `@wayfinder/domain` alias.

## Architecture

See [docs/Architecture.md](docs/Architecture.md) for full details.

- **Nx monorepo**: `apps/web` (Angular 20, SSR + prerender), `apps/server` (NestJS 11, `/api`),
  `libs/domain` (shared contract), `apps/web-e2e` (Cypress).
- **Public site is SSR'd and prerendered** — SEO and link previews are the point of a portfolio.
  `/admin/*` is client-only, `noindex`, and excluded from prerender.
- **Content is DB-backed** (Postgres via TypeORM) behind a single-user admin; until that lands,
  public content is hardcoded TypeScript so the site can go live without a database.
- **One API client** in the web app, every method typed from `@wayfinder/domain`; HTTP errors are
  handled in exactly one interceptor.

## Code Style

See [docs/Code Quality.md](docs/Code%20Quality.md) for full details.

- TypeScript strict, **explicit return types on every exported function and method**
- `@wayfinder/domain` for anything crossing the HTTP boundary; interfaces, enums and consts only,
  no framework imports (enforced by `@nx/enforce-module-boundaries`)
- NestJS DTO classes live in the server and `implements` the shared interface, so class-validator
  never reaches the browser bundle
- Errors are real HTTP status codes with a machine-readable `ApiErrorCode` — never `{error}` in a 200
- Angular: standalone, signals-first, `OnPush` everywhere, `inject()`, strictly typed reactive forms
- Prettier: single quotes, 2 spaces
- Tests colocated as `*.spec.ts`, Vitest only — no Jest artifacts anywhere

## Comments

- **Do** record why a line must be this way and what breaks if it changes — the failure being
  prevented. A future session re-deriving the reason from scratch is the cost being avoided.
- **Don't** restate what the code says.
- **Don't** reference tickets, PRs, phases-in-flight, or "as discussed" — the docs and the commit
  history are the time capsule. A comment reads as current understanding.
- **Don't** speculate about future problems. If it becomes real, fix it then.
- If a block needs a paragraph to explain _what it does_, simplify the block.

## Pitfalls that have already bitten

- **Don't let `vitest` float to 4.x.** npm 10.9's arborist crashes (`Cannot read properties of
null (reading 'edgesOut')`) resolving vitest 4's optional peer set. It is pinned `^3.2.4`.
- **`@nx/js:library` adds Prettier 2**, which conflicts with `@nestjs/schematics`' Prettier 3 peer
  and makes every later `npm install` fail with ERESOLVE. Prettier is pinned `^3.3.0`.
- **`@nx/nest:application` only offers Jest.** The server's Vitest setup is hand-wired
  (`apps/server/vitest.config.ts`, `tsconfig.spec.json`); generate future Nest projects with
  `--unitTestRunner=none` and copy it.
- **Never `synchronize: true`.** Schema changes go through reviewed migrations.
