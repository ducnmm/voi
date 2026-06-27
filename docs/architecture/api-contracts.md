# API Contracts Draft

This document describes product-level backend contracts. Exact implementation may be REST, RPC, or SDK calls depending on the backend.

## Create Session

Input:

- group_id
- starts_at
- ends_at
- venue_name
- court_count
- max_players
- fee_total_vnd
- shuttlecock_cost_vnd
- skill_level
- visibility

Output:

- session
- invite_url

Rules:

- max_players should default to court_count * 4.
- starts_at must be before ends_at.
- court_count must be greater than zero.
- Monetary values should be integer VND amounts.

## Join Session

Input:

- session_id
- user_id

Output:

- participant
- effective_status

Rules:

- If joined count is below max_players, status becomes joined.
- If joined count is at max_players, status becomes waitlisted.
- If the user previously declined, their status can become joined or waitlisted.

## Leave Session

Input:

- session_id
- user_id

Output:

- participant
- promoted_participant, if any

Rules:

- A joined participant can cancel.
- A waitlisted participant can leave the waitlist.
- When a joined participant cancels, the first waitlisted participant can be promoted.

## Update Lineup

Input:

- session_id
- court_assignments

Output:

- lineup

Rules:

- Only hosts can update lineup.
- Only joined participants can be assigned to courts.
- One participant can appear in at most one lineup slot.

## Update Payment Status

Input:

- session_id
- participant_id
- payment_status

Output:

- participant
- session_payment_summary

Rules:

- Only hosts can update payment status.
- Payment status is manual in MVP.
