# Spec 0013: Notification Delivery Worker

## Status

Draft — worker logic shipped; the real APNs sender is pending an Apple key (.p8).

## Problem

Notifications are persisted but never delivered to devices. We need a reliable
background delivery loop with retries and a dead-letter path.

## Goal

A worker drains due, pending notifications and pushes them to a user's active
devices, respecting preferences, retrying transient failures with backoff and
dead-lettering after a cap — idempotently.

## Users

- Host
- Player (recipients)

## In Scope

- `runDeliveryTick({ now, sender, maxAttempts, batchSize })` — process one batch.
- Respect `NotificationPreference` per type (suppress → CANCELLED).
- No active devices → mark SENT (nothing to deliver).
- Success → SENT + `sentAt`. Failure → increment `attempts`, set `nextAttemptAt`
  with exponential backoff; at `maxAttempts` → FAILED (dead-letter).
- Idempotent: only PENDING rows are processed; SENT/FAILED/CANCELLED are skipped.
- `PushSender` interface + `MockPushSender` (tests) + `UnconfiguredApnsSender`
  (placeholder). Gated interval runner (`startNotificationWorker`), idle until
  APNs is configured.

## Out of Scope (blocked on a paid Apple Developer account)

- The real APNs HTTP/2 sender (needs the `.p8` key, key id, team id).
- Email/web-push channels.
- Multi-instance claim/locking (single worker for now).

## Data Model

- notifications.attempts (int), notifications.next_attempt_at (nullable).
- Reuses delivery_status (PENDING/SENT/FAILED/CANCELLED), scheduled_for, sent_at.

## Acceptance Criteria

- Given a due pending reminder with an active device, when a tick runs, then the
  device is pushed and the row is SENT.
- Given a disabled preference, then the row is CANCELLED and nothing is sent.
- Given repeated send failures, then attempts back off and the row becomes FAILED
  at the cap.
- Given a SENT row, when another tick runs, then it is not re-sent.
- Given a future `scheduled_for`, then the row is not picked yet.

## Configuration (to provide later)

- `APNS_KEY_PATH` (.p8 file), `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`,
  `APNS_ENV` (sandbox|production). `isPushConfigured()` gates the runner.

## Open Questions

- Switch to a durable queue (Redis/BullMQ) when volume grows?
- Collapse multiple device failures vs. per-device retry granularity.
