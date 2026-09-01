# ADR 0003: Start Web First

## Status

Superseded by the product decision to return to iOS-first (2026-08-04).

This decision is retained below for historical context only. The current decision is [ADR 0001: Start iOS First](0001-ios-first.md).

## Context

ADR 0001 chose a native iOS app as the first client. In practice, starting with
iOS slows the core feedback loop for an early-stage product:

- Distribution requires TestFlight / App Store review before real groups can try it.
- Invite links — central to Voi's join flow — work best when they open directly
  in a browser without requiring an app install.
- Iteration is faster on the web, and the same TypeScript stack and shared contracts
  (`packages/shared`) are reused across the API and the web client.

The backend (ADR 0002) is client-agnostic, so the choice of first client does not
change the domain model or API.

## Historical Decision

Make the web app the primary client. Build it with Next.js (App Router) and React,
consuming the existing Fastify API and the shared contracts in `packages/shared`.

Keep the SwiftUI iOS skeleton in the repository as a deprioritized reference for a
later mobile channel that will target the same API.

## Consequences

- Real badminton groups can use Voi from any device via a shared URL.
- Invite links open directly in the browser with no install step.
- Development auth starts with email/dev login; durable web auth (magic link or OAuth)
  comes before public release, and Sign in with Apple ships with the iOS app.
- Notifications start as persisted records surfaced in-app; delivery (web push, email,
  or APNs) is added later through a background worker.
- The iOS app is deferred until the web product is validated.
