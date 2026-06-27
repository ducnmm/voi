# Spec 0003: RSVP and Waitlist

## Status

Draft

## Problem

Hosts need a reliable list of confirmed players and replacements when sessions fill up or someone cancels.

## Goal

Players can respond to a session, and the app automatically maintains confirmed capacity and waitlist order.

## Users

- Host
- Player

## In Scope

- RSVP actions: Join, Maybe, Can't Go.
- Joined capacity.
- Waitlist when capacity is full.
- Cancel attendance.
- Promote first waitlisted player when a joined player cancels.
- Show status clearly to host and player.

## Out of Scope

- Paid deposits.
- Penalty rules for late cancellation.
- Advanced approval workflows.
- Skill-based automatic acceptance.

## Primary Flow

1. Player opens a session invite.
2. Player taps Join.
3. If capacity is available, player becomes joined.
4. If capacity is full, player becomes waitlisted.
5. If a joined player cancels, the first waitlisted player is promoted.

## Edge Cases

- Two players join the last slot at the same time.
- Player changes from joined to can't go.
- Player changes from waitlisted to can't go.
- Host changes max capacity after people joined.
- Session is cancelled.

## Data Model

- session_participants
- sessions.max_players

## Acceptance Criteria

- Given available capacity, when a player joins, then their status becomes joined.
- Given a full session, when a player joins, then their status becomes waitlisted with a stable waitlist position.
- Given a joined player cancels, when there is a waitlisted player, then the first waitlisted player becomes joined.
- Given a player already has an RSVP, when they choose a new status, then their participant record is updated instead of duplicated.
- Given simultaneous joins, when only one slot remains, then only one player becomes joined.

## Open Questions

- Should Maybe count toward capacity?
- Should waitlist promotion be automatic or require host approval?

