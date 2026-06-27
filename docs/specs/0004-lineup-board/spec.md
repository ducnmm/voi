# Spec 0004: Lineup Board

## Status

Draft

## Problem

Once players join, hosts still need to organize people across courts. Chat-based lists do not show court capacity or session structure clearly.

## Goal

The session page includes a badminton-specific lineup board that shows confirmed players organized by court.

## Users

- Host
- Player

## In Scope

- Show courts based on court_count.
- Show four default slots per court.
- Show confirmed players.
- Show waitlisted players below the courts.
- Allow host to assign or move players between courts.
- Allow unassigned joined players.

## Out of Scope

- Automatic skill balancing.
- Drag-and-drop in the first implementation if tap-to-assign is simpler.
- Rotation planning.
- Match history.

## Primary Flow

1. Host opens the session page.
2. Host views confirmed players.
3. Host assigns players to court slots.
4. Players can view the lineup.

## Edge Cases

- More joined players than visible court slots.
- Court count changes after lineup assignments.
- Assigned player cancels.
- Waitlisted player is promoted.

## Data Model

- courts
- lineup_slots
- session_participants

## Acceptance Criteria

- Given a session with two courts, when the lineup board loads, then it shows Court 1 and Court 2.
- Given joined players, when the host assigns them to court slots, then the lineup persists.
- Given a player is assigned to one slot, when assigned elsewhere, then the previous slot is cleared.
- Given an assigned player cancels, when the lineup refreshes, then their slot is empty.
- Given a non-host player, when they view the lineup, then they cannot edit assignments.

## Open Questions

- Should the MVP auto-fill courts in join order?
- Should players see only court assignment or also all payment statuses?

