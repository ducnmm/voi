# Spec 0010: Follow & Saved Sessions

## Status

Draft

## Problem

Players want to follow hosts/players they enjoy playing with, and bookmark
sessions to find later. Both live only in the iOS mock today.

## Goal

Users can follow/unfollow other users and save/unsave sessions, list both, and
filter the session feed to saved-only.

## Users

- Host
- Player

## In Scope

- `PUT`/`DELETE /v1/users/:userId/follow` (idempotent).
- `GET /v1/me/following`.
- `PUT`/`DELETE /v1/sessions/:sessionId/save` (idempotent).
- `GET /v1/me/saved`.
- `savedOnly` filter on `GET /v1/sessions`.

## Out of Scope

- Follow notifications/feed (a follow may later seed a notification).
- Mutual-follow / friend semantics.

## Primary Flow

1. On a profile, a user taps Follow → `PUT /users/:id/follow`.
2. On a session, a user taps Save → `PUT /sessions/:id/save`.
3. The user filters the feed to saved-only.

## Edge Cases

- Following yourself → 400.
- Re-follow / re-save → idempotent no-op.
- Saved session later left the group → simply not shown (feed still scopes to
  the user's groups).

## Data Model

- follows (follower_id, followee_id, created_at) — composite PK.
- saved_sessions (user_id, session_id, created_at) — composite PK.

## Acceptance Criteria

- Given A follows B, when A reads `/me/following`, then B is listed.
- Given A follows B twice, then the second call is a no-op (still 200).
- Given A saves a session, when A reads `/sessions?savedOnly=true`, then it
  appears; after unsave it does not.

## Open Questions

- Should following a host create a notification when they post a new session?
