# Architecture Overview

Voi should start with a pragmatic architecture that supports fast product iteration.

## Starting Stack

- Native iOS app (SwiftUI): the primary client.
- Web app: Next.js (React, App Router) — companion client and invite-link fallback.
- Authentication: development login first, durable auth next, with Sign in with Apple as the primary iOS sign-in path.
- Backend: custom TypeScript API.
- API framework: Fastify.
- Database: PostgreSQL.
- ORM: Prisma.
- Notifications: persisted records surfaced in-app; background APNs delivery later.
- Analytics: lightweight product events once the core flow exists.
- API routes: versioned under `/v1`.
- API documentation: OpenAPI document served at `/openapi.json`.

## Why Custom Backend First

The product has domain-specific rules around capacity, waitlist promotion, court lineups, invite access, and cost split behavior. A custom backend keeps those rules explicit, testable, and portable from the start.

## Client Responsibilities

- Render session, group, and player states.
- Handle local form validation.
- Show optimistic UI where safe.
- Provide polished empty, loading, and error states.
- Keep session creation fast.

## Backend Responsibilities

- Store canonical session state.
- Enforce capacity and waitlist rules.
- Manage invite access.
- Send reminders.
- Calculate cost split values.
- Track payment status.
- Register push devices.
- Store notification preferences.

## Default Currency

The default currency is VND. MVP monetary values should be stored as integer VND amounts, not floating point decimal values.

## Data Consistency Priorities

The backend should be the source of truth for:

- RSVP status.
- Confirmed player count.
- Waitlist order.
- Payment status.
- Session cancellation.

## Initial Deployment Assumption

During MVP, staging and production can share the same architecture but must use separate databases, API secrets, and push notification credentials.
