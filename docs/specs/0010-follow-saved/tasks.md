# Spec 0010 Tasks

- [x] `Follow` + `SavedSession` models with relations.
- [x] Migration `20260626122738_follows_saved_sessions`.
- [x] `savedOnly` added to `SessionFeedQuerySchema`.
- [x] `social.ts`: follow PUT/DELETE, `/me/following`, save PUT/DELETE, `/me/saved`.
- [x] `savedOnly` wired into the `GET /v1/sessions` where clause.
- [x] Register `socialRoutes`.
- [x] Verified: idempotent follow/save, self-follow 400, savedOnly filter.

## Follow-ups

- iOS: Follow button + Saved filter wiring (Phase A).
- Optional: notify followers when a followed host posts a session.
