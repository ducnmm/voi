# Product Requirements

Voi is a polished iOS-first coordination product for badminton groups. It should be built as a durable product, not a throwaway MVP. A responsive web companion uses the same API for invite links and fallback access.

## Product Standard

The product should be production-minded from the start:

- Clear API contracts.
- Versioned backend routes.
- Database migrations.
- Strong domain rules on the server.
- Notification infrastructure designed before any delivery channel (web push, email, or APNs) is wired.
- Local development and CI workflows.
- iOS architecture that can grow without rewriting the app, sharing contracts with the web companion and API.

## Core Product Areas

### Identity

- Development email login during early builds.
- Durable auth before public release; Sign in with Apple is the primary iOS sign-in path.
- User profile with display name, avatar, and default skill level.

### Groups

- Groups represent recurring circles of players.
- Hosts can create groups.
- Hosts can create group invite links.
- Players can accept group or session invites.

### Sessions

- Sessions represent scheduled badminton play.
- Hosts can create, update, cancel, and eventually duplicate sessions.
- Court count, capacity, venue, skill level, and cost are first-class fields.
- Sessions should support recurring play after the one-off creation flow is stable.

### Attendance

- Players can join, decline, maybe, cancel, or become waitlisted.
- Capacity and waitlist promotion are server-owned.
- Joined players can be assigned to court lineups.

### Lineup

- Lineup is a signature product surface.
- Four slots per court is the default for doubles.
- Hosts can assign players manually.
- Future versions should support rotation and skill balancing.

### Payments

- VND is the default currency.
- Early product tracks payment status manually.
- Later product can add VietQR and reconciliation.

### Notifications

- Notification records are created by the backend and surfaced in-app on iOS and the web companion.
- Users can manage reminder and status-change preferences.
- iOS push device tokens are registered through the API from the primary client.
- Delivery (APNs first, then web push or email if needed) is a separate worker concern.

## Release Bar

Before a public beta:

- API routes must be versioned.
- All schema changes must be migrations.
- Core business rules must have tests.
- The iOS client must handle loading, empty, success, and error states.
- Invite, RSVP, waitlist, cancellation, and notification flows must be verified on iOS; invite fallback must be verified on the web.
