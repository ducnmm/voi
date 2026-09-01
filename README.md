# Voi

Voi is a spec-driven, iOS-first product for organizing casual badminton sessions with small groups. A responsive web app supports invite links and users who do not have the native app.

The working product direction is:

> A minimal, beautifully designed scheduling app for badminton groups: create a session, invite players, confirm attendance, handle waitlists, organize courts, and split costs.

## Current Phase

This repository is in the foundation phase. Product specs are the source of truth, and implementation prioritizes the MVP backend and native iOS app. The web app is a companion client for invite links and fallback access.

## Project Layout

- `apps/api`: custom TypeScript backend.
- `apps/web`: Next.js web app (companion and invite-link fallback client).
- `apps/ios`: SwiftUI iOS app (primary client).
- `packages/shared`: shared TypeScript contracts and constants.
- `docs`: product, process, architecture, and feature specs.

## Local Development

```sh
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm dev          # API
pnpm dev:web      # Web app (in a second terminal)
```

The API runs on `http://localhost:43187`, with versioned app routes under `http://localhost:43187/v1`. The web app runs on `http://localhost:43188`. Local PostgreSQL is exposed on port `55487` to avoid colliding with common system database ports.

Useful checks:

```sh
pnpm build
pnpm typecheck
pnpm test
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

- Start with native iOS (web companion and invite-link fallback alongside it).
- Start with badminton.
- Start with group scheduling, not venue booking.
- Use a custom TypeScript backend.
- Use VND as the default currency.
- Keep the core flow fast enough that a host can create a session in under 30 seconds.
- Prefer a focused MVP over a broad sports management platform.
