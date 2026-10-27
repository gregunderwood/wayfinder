# Development setup

## Prerequisites

- **Node 22** via nvm: `nvm install && nvm use` in the repo root reads `.nvmrc`.
- npm 10 (ships with Node 22).
- Postgres and Docker arrive with the CMS phases; Phase 1 needs neither.

## First run

```bash
npm ci
npx nx run-many -t lint,test,build    # confirm a clean tree is green
npx nx serve web                      # http://localhost:4200
npx nx serve server                   # API, proxied from the web dev server under /api
```

## Pitfalls

- **`node: command not found` in a fresh shell.** nvm only loads in interactive shells; run
  `. ~/.nvm/nvm.sh && nvm use`.
- **`ERESOLVE` on install.** Usually a generator re-added Prettier 2 or let Vitest float to 4.
  See the pitfalls in [AGENTS.md](../../AGENTS.md).
