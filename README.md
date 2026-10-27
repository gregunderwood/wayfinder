# Wayfinder

The source of [underwoodstyles.ca](https://underwoodstyles.ca) — Greg Underwood's portfolio and
blog, built as a working sample of how he builds software.

|          |                                                                    |
| -------- | ------------------------------------------------------------------ |
| Monorepo | Nx 22, npm, Node 22                                                |
| Web      | Angular 20 standalone, zoneless, SSR + prerender, no CSS framework |
| API      | NestJS 11 (CMS arriving: PostgreSQL, TypeORM, single-user admin)   |
| Shared   | `libs/domain` → `@wayfinder/domain`, types only                    |
| Tests    | Vitest (colocated `*.spec.ts`), Cypress                            |

## Quick start

```bash
nvm use                               # Node 22
npm ci
npx nx serve web                      # http://localhost:4200
npx nx run-many -t lint,test,build    # the gate
npx nx e2e web-e2e                    # Cypress
```

## Documentation

Start at [docs/Architecture.md](docs/Architecture.md). If you are an agent, start at
[AGENTS.md](AGENTS.md). Progress and open questions live in [docs/Roadmap.md](docs/Roadmap.md).
