# Spec 0009: Reviews & Player Profiles

## Status

Draft

## Problem

The iOS People screen shows hosts/players with ratings, reviews, and activity
stats, and lets attendees review each other. All of it is mock today.

## Goal

Attendees can review co-participants (gated on attendance), and the app can read
a user's profile stats and a directory of the people they play with.

## Users

- Host
- Player

## In Scope

- `POST /v1/sessions/:id/reviews` — review a co-participant; **only if the author
  checked in**; one review per (subject, author, session), upsert on repeat.
- `GET /v1/users/:id/reviews`.
- `GET /v1/users/:id/profile` — computed stats: hosted, joined, average rating,
  review count, follower/following counts.
- `GET /v1/people?role=host|player` — co-members across the requester's groups,
  with role + activity + rating summary (aggregated, no N+1).

## Out of Scope

- Editing/deleting an individual review.
- Global user search beyond shared groups.

## Primary Flow

1. After a session, a checked-in player reviews someone they played with.
2. Players browse the People directory and open a profile to see stats/reviews.

## Edge Cases

- Author not checked in → 403 (attendance gate).
- Reviewing yourself → 400.
- Subject not in the session → 400.
- Re-review → upsert (no duplicate row).
- Rating outside 1..5 → 400.

## Data Model

- reviews (subject_id, author_id, session_id?, rating, comment?) — unique on
  (subject, author, session).
- Profile stats are computed, not stored.

## Acceptance Criteria

- Given a checked-in attendee reviews a co-participant, then the review is saved
  and listed under the subject.
- Given the same author reviews the same subject again, then the existing review
  updates instead of duplicating.
- Given a profile is requested, then it returns joined/hosted/rating/follower
  counts computed from the data.
- Given the People directory, then it lists co-members (not the requester) with
  their role and stats.

## Open Questions

- Should reviews be editable/deletable by the author?
- Should the directory include people met only through shared sessions (not just
  shared groups)?
