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

The API listens on `http://localhost:43187` by default. Versioned app routes live under `/v1`, and the OpenAPI document is served at `/openapi.json`.

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

