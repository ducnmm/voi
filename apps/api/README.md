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

The production `api` service deploys when `main` is pushed to `ducnmm/voi`. Infrastructure is declared in `.railway/railway.ts` (Dockerfile builder, `/health`, restart policy). Follow the repository Railway configuration workflow for changes. The container runs `prisma migrate deploy` then `node apps/api/dist/server.js`.

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
- `APPLE_BUNDLE_ID` — audience for Sign in with Apple identity tokens. Defaults to `com.voi.app`.

Uploads are written to `/app/uploads`. Attach a Railway volume there or images disappear on each deploy.

The iOS app talks to `https://<domain>/v1`. CORS does not apply to the native client.

## Testing

Unit tests are pure (no database). Integration tests use Fastify's in-process
`inject()` against an explicitly selected disposable database. Set `TEST_DATABASE_URL`;
the database name must end in `_test` or contain `_test_`. The config refuses dev/production
database names before tests start. Integration tests truncate this database between cases.

One-time setup of the test database:

```sh
# create it (psql, against the same Postgres as dev)
createdb voi_test   # or: CREATE DATABASE voi_test;
# apply migrations to it
DATABASE_URL='postgresql://voi:voi@localhost:55487/voi_test?schema=public' pnpm db:deploy
```

Then run the suite (truncates `voi_test` between tests):

```sh
TEST_DATABASE_URL='postgresql://voi:voi@localhost:55487/voi_test?schema=public' pnpm test
```

## Community listing integration

See [Muse setup and operator commands](../../docs/integrations/muse-community-listings.md)
for source configuration, key rotation, dry runs, batch imports, moderation and retention.
Public discovery uses a separate model from native sessions and does not grant host ownership.

