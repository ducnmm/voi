# Feature Specs

This folder contains the MVP feature specs. Each feature should have:

- `spec.md`: product behavior, scope, edge cases, and acceptance criteria.
- `tasks.md`: implementation checklist tied to the spec.

## MVP Specs

| Spec | Status | Purpose |
| --- | --- | --- |
| [0001 Create Session](0001-create-session/spec.md) | Draft | Let hosts create a badminton session quickly. |
| [0002 Groups and Invites](0002-groups-and-invites/spec.md) | Draft | Reuse player circles and share sessions. |
| [0003 RSVP and Waitlist](0003-rsvp-waitlist/spec.md) | Draft | Manage attendance and full sessions. |
| [0004 Lineup Board](0004-lineup-board/spec.md) | Draft | Organize confirmed players by court. |
| [0005 Cost Split](0005-cost-split/spec.md) | Draft | Calculate per-player cost and track payment status. |
| [0006 Notifications](0006-notifications/spec.md) | Draft | Remind players and notify them about important changes. |

## Proposed Product Extensions

| Spec | Status | Purpose |
| --- | --- | --- |
| [0015 Community Listings](0015-community-listings/spec.md) | Verified locally | Muse ingestion API and public discovery/contact flow; production rollout and real-source Muse pilot pending. |

See its [API contract](0015-community-listings/api-contract.md), [implementation tasks](0015-community-listings/tasks.md) and [Muse operator guide](../integrations/muse-community-listings.md).

## Implementation Rule

Do not implement a feature until its spec is marked Ready or the product owner explicitly approves building from Draft.

