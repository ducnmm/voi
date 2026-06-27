# Spec 0011 Tasks

- [x] `SessionParticipant.checkedInAt` column.
- [x] `MatchResult` model + `Session.matchResults` relation.
- [x] Migration `20260626122242_checkin_match_results`.
- [x] `CreateMatchResultSchema` in `packages/shared`.
- [x] `presentMatchResult` + `checkedInAt` in the participant DTO.
- [x] Routes: check-in `POST`/`DELETE` (host-only, idempotent).
- [x] Routes: results `GET` (public) / `POST` (host or joined player).
- [x] `assertCanLogResult` authorization helper.
- [x] Verified end-to-end: idempotent check-in, host-only enforcement,
      host/joined result authoring, score validation, public listing, undo.

## Follow-ups

- iOS: wire the Attendance + Match results sections to these endpoints (Phase A).
- Player win/loss stats from results → Spec 0009.
