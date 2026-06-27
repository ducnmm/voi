# Data Model Draft

This is an implementation-oriented draft. Field names can change when the backend is selected.

## users

- id
- display_name
- avatar_url
- default_skill_level
- created_at
- updated_at

## groups

- id
- name
- description
- default_venue_name
- default_skill_level
- created_by_user_id
- created_at
- updated_at

## group_members

- id
- group_id
- user_id
- role
- joined_at

Roles:

- host
- member

## sessions

- id
- group_id
- host_user_id
- title
- starts_at
- ends_at
- venue_name
- venue_note
- court_count
- max_players
- fee_total_vnd
- shuttlecock_cost_vnd
- currency
- skill_level
- visibility
- status
- created_at
- updated_at

Visibility:

- private_link
- group_only

Status:

- draft
- scheduled
- cancelled
- completed

## session_participants

- id
- session_id
- user_id
- rsvp_status
- joined_at
- waitlist_position
- payment_status
- notes
- updated_at

RSVP status:

- joined
- maybe
- declined
- waitlisted
- cancelled

Payment status:

- not_required
- unpaid
- paid

## courts

- id
- session_id
- label
- sort_order

## lineup_slots

- id
- session_id
- court_id
- participant_id
- slot_order

## notifications

- id
- user_id
- session_id
- type
- delivery_status
- scheduled_for
- sent_at
- created_at

## push_devices

- id
- user_id
- platform
- device_token
- app_version
- disabled_at
- created_at
- updated_at

## notification_preferences

- id
- user_id
- reminders_enabled
- status_changes_enabled
- waitlist_enabled
- reminder_lead_minutes
- created_at
- updated_at

## Important Constraints

- A user should have at most one participant record per session.
- A session should not exceed max_players in joined state.
- Waitlist positions should be stable and ordered.
- Cancelling a joined participant should promote the first waitlisted participant if auto-promotion is enabled.
- Monetary values should be stored as integer VND amounts.
- Push device tokens should be stored server-side and can be disabled without deleting historical notification records.
- Notification preferences should be created lazily with sensible defaults.
