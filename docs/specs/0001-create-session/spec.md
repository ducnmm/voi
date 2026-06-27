# Spec 0001: Create Session

## Status

Draft

## Problem

Hosts currently create badminton sessions through chat messages, then manually repeat details such as time, venue, court count, capacity, level, and cost.

## Goal

A host can create a clear badminton session in under 30 seconds.

## Users

- Host

## In Scope

- Create a session inside a group.
- Set date and time.
- Enter venue name and optional note.
- Set court count.
- Set max players.
- Enter estimated fee and shuttlecock cost.
- Set skill level.
- Save the session as scheduled.
- Generate an invite link.

## Out of Scope

- Venue search.
- Direct venue booking.
- Payment collection.
- Multi-sport session templates.
- Complex recurrence rules.

## Primary Flow

1. Host opens a group.
2. Host taps create session.
3. Host enters date, time, venue, court count, capacity, and fee estimate.
4. App previews the session summary.
5. Host creates the session.
6. App shows the session page and invite action.

## Edge Cases

- Host leaves a required field empty.
- Start time is after end time.
- Court count is zero.
- Capacity is lower than court count * 4.
- Host creates a session without estimated cost.

## Data Model

- sessions
- courts
- invites

## Acceptance Criteria

- Given valid required fields, when the host creates a session, then the app creates a scheduled session and shows its session page.
- Given a court count, when max players is not manually changed, then max players defaults to court count * 4.
- Given invalid time range, when the host tries to save, then the app shows a clear validation error.
- Given a created session, when the host opens the share action, then the app provides an invite link.

## Open Questions

- Should the first version support recurring sessions, or should recurrence wait until after one-off sessions feel excellent?
- Should fee_total_vnd include shuttlecock_cost_vnd, or should both be shown separately and combined in the cost split?
