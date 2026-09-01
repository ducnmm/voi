# Voi

Voi is an **iOS-first** app for organizing casual badminton sessions with small groups.

The product direction is:

> A minimal, beautifully designed scheduling app for badminton groups: create a session, invite players, confirm attendance, handle waitlists, organize courts, and split costs.

The primary client is the SwiftUI iOS app. The Fastify API is the source of truth. A Next.js tree still lives under `apps/web` but is **not** the product path.

## Project Layout

- `apps/ios`: SwiftUI iOS app (primary client).
- `apps/api`: TypeScript API (Fastify + Prisma + Postgres).
- `packages/shared`: shared TypeScript contracts.
- `docs`: product, architecture, and feature specs.
- `apps/web`: leftover Next.js app — not in current scope.

## Local Development

```sh
pnpm install
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm dev          # API on http://localhost:43187
```

Versioned routes live under `/v1`. Postgres is on host port `55487`, Redis on `55479`. Point the iOS simulator at `http://localhost:43187/v1` (or `VOI_API_BASE_URL`).

Useful checks:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm test:e2e:ios
pnpm verify
```

## Documentation Map

- [Product Vision](docs/product/vision.md)
- [Product Requirements](docs/product/product-requirements.md)
- [MVP Scope](docs/product/mvp.md)
- [UX Principles](docs/product/ux-principles.md)
- [Spec-Driven Development Process](docs/process/spec-driven-development.md)
- [Architecture Overview](docs/architecture/overview.md)
- [Domain Model](docs/architecture/domain-model.md)
- [API Reference Draft](docs/architecture/api-reference.md)
- [Production Readiness](docs/architecture/production-readiness.md)
- [MVP Roadmap](docs/roadmap/mvp-roadmap.md)
- [Product Roadmap](docs/roadmap/product-roadmap.md)

## Product Spec Set

- [Spec Index](docs/specs/README.md)
- [Create Session](docs/specs/0001-create-session/spec.md)
- [Groups and Invites](docs/specs/0002-groups-and-invites/spec.md)
- [RSVP and Waitlist](docs/specs/0003-rsvp-waitlist/spec.md)
- [Lineup Board](docs/specs/0004-lineup-board/spec.md)
- [Cost Split](docs/specs/0005-cost-split/spec.md)
- [Notifications](docs/specs/0006-notifications/spec.md)

## Product Constraints

- Native iOS is the only client in scope.
- Start with badminton.
- Group is a roster; a session is one play.
- Start with group scheduling, not venue booking.
- No in-app purchases or selling.
- Use a custom TypeScript backend.
- Use VND as the default currency.
- Keep the core flow fast enough that a host can create a session in under 30 seconds.
- Prefer a focused MVP over a broad sports management platform.
