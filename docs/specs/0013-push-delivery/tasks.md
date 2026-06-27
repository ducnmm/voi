# Spec 0013 Tasks

- [x] `Notification.attempts` + `nextAttemptAt` columns.
- [x] Migration `20260626133022_notification_delivery_attempts`.
- [x] `PushSender` interface + `MockPushSender` + `UnconfiguredApnsSender` +
      `isPushConfigured`.
- [x] `notification-delivery` service: `runDeliveryTick`, `backoffMs`,
      `preferenceAllows`, `buildPayload`.
- [x] Gated interval runner `startNotificationWorker`; wired into `server.ts`.
- [x] `APNS_*` env (optional).
- [x] Tests: unit (backoff/preference/payload) + integration (deliver, idempotent,
      suppress, no-device, retry→DLQ, future-scheduled). 77/77 green.

## Blocked / follow-ups

- [ ] Real APNs sender (HTTP/2 + JWT from `.p8`) — needs a **paid Apple Developer
      account**. Implements the `PushSender` interface; swap it into
      `startNotificationWorker`.
- [ ] iOS: register the device token via the existing devices route on launch.
