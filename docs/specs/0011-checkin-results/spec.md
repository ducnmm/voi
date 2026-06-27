# Spec 0011: Check-in & Match Results

## Status

Draft

## Problem

After a session runs, hosts want to mark who actually showed up (attendance),
and players want to record match scores. Today both live only in the iOS mock.

## Goal

Hosts can check participants in (idempotently), and the host or any joined
player can record match results that everyone can read back.

## Users

- Host
- Player

## In Scope

- `POST /v1/sessions/:id/participants/:pid/checkin` (host-only, idempotent).
- `DELETE /v1/sessions/:id/participants/:pid/checkin` (host-only, undo).
- `POST /v1/sessions/:id/results` (host or joined player).
- `GET /v1/sessions/:id/results` (public, like the session read).
- `SessionParticipant.checkedInAt` surfaced in the participant DTO.

## Out of Scope

- Per-court attendance.
- Editing/deleting a recorded result.
- Win/loss aggregation into player stats (Spec 0009 territory).

## Primary Flow

1. Players join (RSVP) and arrive.
2. Host opens the session and checks each present player in.
3. During play, the host or a joined player records court scores.
4. Anyone viewing the session sees the recorded results.

## Edge Cases

- Check-in called twice → no-op, original timestamp preserved (idempotent).
- A non-host tries to check someone in → 403.
- A user who is neither host nor a joined player tries to record a result → 403.
- Score out of range (0..99) → 400.

## Data Model

- session_participants.checked_in_at (nullable timestamp)
- match_results (id, session_id, label, score_a, score_b, created_at)

## Acceptance Criteria

- Given a host checks a participant in, when the session is read, then that
  participant has a `checkedInAt` timestamp.
- Given check-in is called again, when it runs, then the timestamp is unchanged.
- Given a non-host calls check-in, then the request is rejected with 403.
- Given a joined player records a result, then it is created and listed.
- Given a stranger records a result, then the request is rejected with 403.

## Open Questions

- Should results be editable, or append-only as now?
- Should check-in be self-serve (player checks themselves in) in addition to
  host check-in?
