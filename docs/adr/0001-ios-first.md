# ADR 0001: Start iOS First

## Status

Accepted (restored 2026-08-04).

[ADR 0003: Start Web First](0003-web-first.md) temporarily superseded this decision and is now historical.

## Context

The product direction prioritizes a minimal, polished mobile experience for casual badminton groups. The expected usage pattern is mobile-first: hosts create sessions from their phone, players respond from a shared invite, and reminders arrive before the session.

## Decision

Start with a native iOS app using SwiftUI.

## Consequences

- The first experience can feel high-quality and native.
- Push notifications and Apple ecosystem integration are easier to prioritize.
- Android support is deferred.
- The web app remains a lightweight companion for invite links and players without the app, not the primary product surface.
