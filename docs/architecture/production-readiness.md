# Production Readiness

This checklist defines what "professional" means for Voi.

## Backend

- Versioned API routes under `/v1`.
- OpenAPI document served at `/openapi.json`.
- Strict environment validation.
- CORS configured through environment.
- Rate limiting enabled.
- PostgreSQL migrations checked into source control.
- Seed data for development.
- Dockerfile for API deployment.
- CI builds, typechecks, tests, and applies migrations.

## Data

- Server owns RSVP, capacity, waitlist, lineup, and payment state.
- Monetary values are integer VND amounts.
- Session cancellation preserves historical records.
- Notification records are persisted before delivery workers are added.

## Web

- Next.js (App Router) app, the primary client.
- API client uses the versioned backend and types shared from `packages/shared`.
- Code should separate the API client, shared response types, and view components.
- Screens should be designed for real use, not placeholder landing pages.
- Layout should be responsive and usable on a phone browser.

## iOS (later channel)

- Native SwiftUI app, deprioritized behind web.
- API client uses the same versioned backend.
- State management should separate view models, services, and models.

## Security

- Development login is temporary.
- Durable web auth (magic link or OAuth) is required before public release; Sign in with Apple ships with the iOS app.
- API secrets must be environment-only.
- Device tokens must not be logged.
- Host-only operations must be enforced on the server.

## Operations

- App logs should include request IDs.
- CI must run on pull requests.
- Production and staging must use separate databases and secrets.
- Notification delivery (web push, email, or APNs) should run through a background worker with retry behavior.

