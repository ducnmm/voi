# Spec 0007 Tasks

- [x] Add `costTrackingEnabled`, `feePerPlayerVnd`, `venueLat`, `venueLng` to the
      `Session` Prisma model.
- [x] Migration `20260626111958_session_discovery` (nullable/defaulted columns).
- [x] Extend `CreateSessionSchema` / `UpdateSessionSchema` in `packages/shared`.
- [x] Add `SessionFeedQuerySchema` in `packages/shared`.
- [x] Cost service: fixed price overrides the auto split.
- [x] Presenter: expose `costTrackingEnabled`, `feePerPlayerVnd`, `venueLat`,
      `venueLng`; honor fixed price in the summary.
- [x] `session-feed` helper: keyset cursor encode/decode + sort comparators.
- [x] Route `GET /v1/sessions` with filter/sort/pagination.
- [x] Wire new fields through create/update session routes.
- [x] Unit tests: cost fixed-price, feed cursor + comparators (20/20 green).
- [x] Manual: curl the feed against a seeded group (all filters/sorts verified).

## Follow-ups (not blocking)

- `savedOnly` filter waits on Spec 0010 (favorites).
- Deep pagination for price/spots sorts (currently capped at 200; ample for one
  user's groups).
- iOS: add a `SessionsFeed` repository call to `GET /v1/sessions` (Phase A).
