# Voi API

Custom TypeScript backend for Voi.

## Stack

- Fastify
- PostgreSQL
- Prisma
- JWT development auth
- Vitest

## Local Development

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis from the repository root:

```sh
docker compose up -d postgres redis
```

HTTP and chat rate limits use Redis when `REDIS_URL` is set, and fall back to
in-process memory otherwise (Vitest always uses memory).

3. Install dependencies:

```sh
pnpm install
```

4. Generate Prisma client and run migrations:

```sh
pnpm db:generate
pnpm db:migrate
```

5. Start the API:

```sh
pnpm dev
```

The API listens on `http://localhost:43187` by default (or `PORT` / `API_PORT`). Versioned app routes live under `/v1`, and the OpenAPI document is served at `/openapi.json`. Health is at `/health` and `/v1/health`.

## Railway

The repo root `railway.json` is the live deploy config (Dockerfile builder, `/health`, restart policy). Do not `railway config apply` `.railway/railway.ts`. The container runs `prisma migrate deploy` then `node apps/api/dist/server.js`.

Required production variables:

- `DATABASE_URL` — Postgres (private plugin URL is fine)
- `REDIS_URL` — Redis (private plugin URL; ioredis uses IPv6-capable `family: 0`)
- `JWT_SECRET` — ≥16 characters
- `GOOGLE_IOS_CLIENT_ID` — iOS OAuth client id (dev login is disabled in production)
- `NODE_ENV=production`
- `API_HOST=0.0.0.0`

Optional:

- `PUBLIC_API_URL` — public origin with no `/v1` (e.g. `https://<service>.up.railway.app`). If unset, `RAILWAY_PUBLIC_DOMAIN` is used as `https://…`.
- `APP_BASE_URL=voi://` — invite deep links

Uploads are written to `/app/uploads`. Attach a Railway volume there or images disappear on each deploy.

The iOS app talks to `https://<domain>/v1`. CORS does not apply to the native client.

## Testing

Unit tests are pure (no database). Integration tests use Fastify's in-process
`inject()` against a dedicated `voi_test` database (derived from `DATABASE_URL`
by swapping the db name to `voi_test`), so they never touch dev data.

One-time setup of the test database:

```sh
# create it (psql, against the same Postgres as dev)
createdb voi_test   # or: CREATE DATABASE voi_test;
# apply migrations to it
DATABASE_URL="${DATABASE_URL/voi_dev/voi_test}" pnpm db:deploy
```

Then run the suite (truncates `voi_test` between tests):

```sh
pnpm test
```

