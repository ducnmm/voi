# Spec 0005: Cost Split

## Status

Draft

## Problem

Hosts often track court fees and shuttlecock costs manually. Players need a clear per-person estimate, and hosts need to know who has paid.

## Goal

The app calculates a simple per-player cost and lets the host manually mark players as paid.

## Users

- Host
- Player

## In Scope

- Enter total court fee.
- Enter shuttlecock cost.
- Calculate total session cost.
- Divide cost by joined players.
- Show per-player estimate.
- Host can mark payment status as paid or unpaid.
- Use VND as the default currency.

## Out of Scope

- In-app payment.
- Payment gateway integration.
- Automatic bank transfer reconciliation.
- Refund handling.
- Partial payments.

## Primary Flow

1. Host enters session fee estimate during creation or edit.
2. Players join the session.
3. App calculates per-player cost.
4. Host marks players as paid after receiving money externally.

## Edge Cases

- No players have joined.
- Fee is unknown.
- Player cancels after paying.
- Waitlisted player is promoted.
- Host changes total fee after players paid.

## Data Model

- sessions.fee_total_vnd
- sessions.shuttlecock_cost_vnd
- session_participants.payment_status

## Acceptance Criteria

- Given a session with joined players and a total cost, when the session page loads, then it shows the per-player cost.
- Given zero joined players, when cost is entered, then the app does not divide by zero.
- Given a host marks a player as paid, when the session refreshes, then the payment status persists.
- Given a player is waitlisted, when cost is shown, then the waitlisted player is not included in the split.
- Given a cost is stored, when the backend persists it, then it uses integer VND amounts rather than floating point values.

## Open Questions

- Should Maybe players be excluded from the split until they join?
- Should paid status be visible to all players or only the host?
