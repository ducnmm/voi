# ADR 0002: Use a Custom TypeScript Backend

## Status

Accepted

## Context

The MVP needs authentication, data storage, invite links, capacity enforcement, waitlist promotion, lineup assignment, cost split behavior, and notifications. These rules are core to the product rather than generic infrastructure.

## Decision

Build a custom backend for MVP using TypeScript, Fastify, PostgreSQL, and Prisma.

## Consequences

- Product rules stay explicit and testable.
- PostgreSQL keeps the data model portable.
- The API can expose a stable contract for web and, later, iOS.
- More infrastructure work is required than with a managed backend.
- Development auth can start with email/dev login, with Sign in with Apple added later.
