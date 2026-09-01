# ADR 0001: Start iOS First

## Status

Accepted.

[ADR 0003: Start Web First](0003-web-first.md) is superseded and must not be followed.

## Context

Hosts create sessions from their phone, players RSVP from the app, and reminders arrive before play. A native iOS client is the product.

## Decision

Build a native iOS app with SwiftUI as the only client in scope. The Fastify API is shared later if another client is added.

## Consequences

- The experience is native (notifications, Keychain, TestFlight / App Store).
- Android and a public web app are out of scope.
- Invite links (`voi://invites/{token}`) open in the iOS app.
