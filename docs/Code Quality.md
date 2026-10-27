# Code Quality

## What it is

The quality bar: TypeScript strict everywhere, Nx-enforced module boundaries, a shared contract
library both apps agree on, Vitest for tests, Prettier for formatting.

The repo is itself a work sample, so the aim is twofold: a session opening it cold can tell where
a thing belongs, and a reviewer reading it cold sees deliberate choices rather than generator
leftovers.

## Key files

- [../tsconfig.base.json](../tsconfig.base.json) — the `@portfolio/domain` path alias
- [../eslint.config.mjs](../eslint.config.mjs) — module boundaries, including the banned imports inside `libs/domain`
- [../.prettierrc](../.prettierrc) — single quotes, 2-space tabs
- [../.nvmrc](../.nvmrc) / `engines` in [../package.json](../package.json) — Node 22, kept in step with CI
- [../libs/domain/src/index.ts](../libs/domain/src/index.ts) — the invariant that governs the library

## How it works

### Final-step commands (always run before declaring work done)

```bash
npx nx run-many -t lint,test,build     # the gate
npx nx test server --coverage          # the thresholds are only checked here
npx prettier --write .                 # format
```

**`test` alone is not enough.** Vitest transpiles without typechecking, so a type error passes a
green test run and only fails in the webpack/Angular builds.

### TypeScript

- **Explicit return types on every exported function and method**, including `: void` and
  `: Promise<void>`. An inferred return type is where an accidental `any` or a widened union
  enters a contract.
- Path alias `@portfolio/domain` → `libs/domain/src/index.ts`. Populated `paths`, not project
  references.
- `apps/server` builds with `strictNullChecks` and `noImplicitAny`; the Angular app uses the
  generator's strict template and compiler settings.

### Runtime and frameworks

- Node 22 (`.nvmrc`, `engines` pins `>=22 <23`). CI matches.
- NestJS 11, TypeORM 0.3, Postgres. `synchronize: false`, always.
- Angular 20, standalone components, signals-first, `ChangeDetectionStrategy.OnPush` everywhere,
  `inject()` over constructor injection, inline `styles:`. No `mat-icon` / icon fonts — inline SVG.

## Patterns to follow

### The shared contract

#### ✅ Anything crossing the HTTP boundary is typed in `@portfolio/domain`

```ts
import { ApiErrorCode, type Post } from '@portfolio/domain';
```

#### ✅ A NestJS DTO class lives in the server and `implements` the shared interface

```ts
// apps/server/src/app/posts/dto/create-post.dto.ts
export class CreatePostDto implements CreatePostPayload {
  @IsString() @MaxLength(200) title!: string;
  @IsString() bodyMarkdown!: string;
}
```

That keeps `class-validator` out of the browser bundle while still failing compilation if the two
sides disagree.

#### ❌ Don't put a decorator, or a framework import, in `libs/domain`

The eslint `bannedExternalImports` list rejects it.

#### ❌ Don't hand-duplicate a type across the two apps

That is exactly what the alias exists to prevent.

### Wire types

#### ✅ Timestamps cross the wire as ISO-8601 `string`, never `Date`

`JSON.stringify` turns a `Date` into a string anyway; typing it as `Date` on the client is a lie
the compiler then trusts.

### Errors

#### ✅ A real HTTP status with a machine-readable code

```ts
throw new ConflictException({
  code: ApiErrorCode.SlugTaken,
  message: `A post with slug "${slug}" already exists`,
});
```

#### ❌ Don't return an error inside a 200

#### ❌ Don't throw a bare `Error` from a request path

It becomes a 500 with no `code`, and the web interceptor has nothing to branch on.

### Pure logic

#### ✅ Decisions take time as a parameter

Publishing, scheduling, token expiry and rate limits all depend on "now". Services take an
injected `Clock`; pure functions take `now: Date`. No `new Date()` inside a decision.

### Naming

- `camelCase` variables and functions, `PascalCase` types/classes/enums, `SCREAMING_SNAKE_CASE`
  for module constants.
- Files: `kebab-case.ts`; Angular files have no `.component.` infix. The entity file in every
  server feature folder is `models.ts`, entities end in `Entity`.
- DB columns are `snake_case` in SQL and `camelCase` in the entity, mapped with explicit
  `@Column({ name: 'published_at' })`. uuid primary keys, `timestamptz` only, named indexes.

### Logging

Use `new Logger(Class.name)`, never `console.log`. Log on change, not per request.

### Comments

#### ✅ Comment the invariant and what breaks without it

#### ❌ Don't restate the code

#### ❌ Don't reference tickets, phases-in-flight, or "as discussed"

#### ❌ Don't speculate about future problems

#### ❌ Don't let a comment explain a block that should be simplified

## Pitfalls

- **`npx nx run-many -t lint,test,build` is non-negotiable.** `test` cannot see a type error.
- **`libs/domain` bans `rxjs`.** Streams are an app concern, not a contract.
- **`pg` parses `timestamp without time zone` as local time.** Every timestamp column is `timestamptz`.
- **Nx caches `lint` and `test`.** If chasing a flake, `--skip-nx-cache`.
- **Don't add a dependency for one helper.**

## When to update this file

- A compiler flag, lint rule or `depConstraints` entry changes
- Prettier config changes
- A new convention becomes worth enforcing repo-wide
