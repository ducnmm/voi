# ADR 0001: Start iOS First

## Status

Superseded by [ADR 0003: Start Web First](0003-web-first.md) (2026-06-19).

The original decision is kept below for historical context.

## Context

The product direction prioritizes a minimal, polished mobile experience for casual badminton groups. The expected usage pattern is mobile-first: hosts create sessions from their phone, players respond from a shared invite, and reminders arrive before the session.

## Decision

Start with a native iOS app using SwiftUI.

## Consequences

- The first experience can feel high-quality and native.
- Push notifications and Apple ecosystem integration are easier to prioritize.
- Android and web support are deferred.
- Invite links still need a lightweight fallback strategy later, especially for players without the app.

