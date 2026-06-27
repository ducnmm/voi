# Spec 0007: Session Discovery, Fixed Price & Geo

## Status

Draft

## Problem

The iOS Sessions tab needs a single endpoint to browse, filter, and sort
sessions instead of deriving them client-side from groups. Hosts also want to
set a fixed per-player price (instead of an auto split), turn cost tracking on
or off per session, and place a session on the map.

## Goal

One authenticated discovery endpoint returns a user's sessions with server-side
filtering and sorting, and sessions carry optional fixed price, an opt-in
cost-tracking flag, and venue coordinates.

## Users

- Host
- Player

## In Scope

- `GET /v1/sessions` feed: scope (upcoming/past), skill, venue, availableOnly,
  sort (date/price/spots), keyset pagination for the date sort.
- Feed = sessions in groups the authenticated user belongs to.
- `Session.feePerPlayerVnd` — host-set fixed price (overrides the auto split).
- `Session.costTrackingEnabled` — host opt-in at creation; when off, no cost or
  payment UI is shown.
- `Session.venueLat` / `Session.venueLng` — for the map.
- Surface the new fields in the presented session.

## Out of Scope

- `savedOnly` filter (depends on Spec 0010 favorites).
- Public/global discovery beyond the user's groups.
- In-app payment.

## Primary Flow

1. Player opens the Sessions tab → `GET /v1/sessions?scope=upcoming&sort=date`.
2. Player filters by skill/venue/availability or changes sort.
3. Host creates a session with `costTrackingEnabled` + optional
   `feePerPlayerVnd` and venue coordinates.

## Edge Cases

- User in no groups → empty feed (not an error).
- Fixed price set with zero joined players → per-player still equals the fixed
  price.
- `availableOnly` with a full session → excluded.
- Sorting by price/spots is computed from per-row aggregates (capped to `limit`,
  no deep pagination yet).

## Data Model

- sessions.cost_tracking_enabled (boolean, default false)
- sessions.fee_per_player_vnd (nullable int)
- sessions.venue_lat / sessions.venue_lng (nullable float)

## Acceptance Criteria

- Given a user in a group with upcoming sessions, when they call
  `GET /v1/sessions`, then only that group's upcoming, non-cancelled sessions
  are returned.
- Given `feePerPlayerVnd` is set, when the session is presented, then
  `summary.perPlayerCostVnd` equals it regardless of joined count.
- Given `costTrackingEnabled` is false, when the session is presented, then the
  flag is false so the client can hide cost UI.
- Given `sort=spots`, when the feed returns, then sessions with more open slots
  come first.
- Given a `cursor` from a previous date-sorted page, when passed back, then the
  next page continues without overlap.

## Open Questions

- Should past sessions include cancelled ones? (Currently: excluded from
  upcoming; past = started before now.)
