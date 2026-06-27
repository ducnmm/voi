# Spec 0009 Tasks

- [x] `Review` model (subject/author/session relations, unique constraint).
- [x] Migration `20260626123142_reviews`.
- [x] `CreateReviewSchema` in `packages/shared`.
- [x] `user-presenter` (`presentUserSummary`), reused by social + people routes.
- [x] `people.ts`: review POST (attendance-gated), `/users/:id/reviews`,
      `/users/:id/profile` (computed stats), `/people` directory (group-by, no N+1).
- [x] Register `peopleRoutes`.
- [x] Integration tests: attendance gate, self/non-participant rejection, upsert,
      rating validation, profile stats, directory role filter + isolation.

## Follow-ups

- iOS: wire PeopleView + PersonDetail + WriteReview to these endpoints (Phase A).
