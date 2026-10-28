# Development setup

## Prerequisites

- **Node 22** via nvm: `nvm install && nvm use` in the repo root reads `.nvmrc`.
- npm 10 (ships with Node 22).
- **Docker** with the Compose v2 plugin, for Postgres and for running the production images.

## First run

```bash
npm ci
cp .env.example .env                  # local-only values; .env is gitignored
docker compose up -d --wait postgres  # Postgres on 127.0.0.1:5432
npx nx run-many -t lint,test,build    # confirm a clean tree is green
npx nx serve web                      # http://localhost:4200
npx nx serve server                   # API on :3000, proxied from the web dev server under /api
curl -s localhost:3000/api/health     # {"status":"ok","databaseReachable":true}
```

## The production stack, locally

```bash
docker compose up -d --build --wait   # web, api, postgres and Caddy at https://localhost
docker compose run --rm api node main.js migrate:show
docker compose down                   # add -v to delete the database too
```

`COMPOSE_FILE` in `.env` layers [docker-compose.local.yml](../../docker-compose.local.yml) over the
production [docker-compose.yml](../../docker-compose.yml): it builds the images from the checkout
and publishes Postgres on loopback. Caddy serves `localhost` from its own CA, so the browser warns
once; `curl -k` skips the check.

## Migrations

```bash
npm run migration:generate -- apps/server/src/migrations/<Name>   # needs Postgres up
npm run migration:show | migration:run | migration:revert         # TypeORM CLI, from source
```

Add every new migration to `apps/server/src/migrations/index.ts`; the image runs migrations from
that list (`node main.js migrate:run`), not by scanning the directory.

## Pitfalls

- **`DATABASE_PASSWORD is not set`.** There is no default on purpose; copy `.env.example` to `.env`.
- **`docker: permission denied` on the socket.** Add yourself to the `docker` group, then log out
  and back in.

- **`node: command not found` in a fresh shell.** nvm only loads in interactive shells; run
  `. ~/.nvm/nvm.sh && nvm use`.
- **`ERESOLVE` on install.** Usually a generator re-added Prettier 2 or let Vitest float to 4.
  See the pitfalls in [AGENTS.md](../../AGENTS.md).
