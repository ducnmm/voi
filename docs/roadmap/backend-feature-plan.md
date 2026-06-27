# Backend & Integration Plan (post-MVP)

## Status

Draft — planning only. No code changes yet.

## Purpose

Voi already has a mature backend (`apps/api`: Fastify + Prisma + PostgreSQL + JWT)
and a feature-complete SwiftUI client (`apps/ios`) that currently runs on mock
data. This document plans the work to:

1. Connect the iOS client to the **real** backend for everything the backend
   already supports.
2. Design and build the backend for the **new** features that currently live
   only in the iOS mock layer (`DemoStore` / `Mock`).
3. Replace development login with durable authentication.

The design choices below are deliberately cross-referenced to backend
system-design fundamentals (latency vs. throughput, ACID & isolation, cache
strategies, async messaging, idempotency, REST/WebSocket trade-offs, auth) so
the plan is both a build roadmap and a record of *why* each decision was made.

---

## 1. Current state (what already exists)

### Backend `apps/api` — already built and tested

- **Stack:** Fastify 5, Prisma 6, PostgreSQL 16, `@fastify/jwt`,
  `@fastify/rate-limit`, `@fastify/cors`, `@fastify/helmet`, Zod, Vitest,
  OpenAPI at `/openapi.json`, versioned under `/v1`.
- **Auth:** `POST /v1/auth/dev` (dev login, upserts a user, signs a JWT),
  `GET /v1/me`, `PATCH /v1/me`.
- **Groups:** list / create / detail (members + sessions).
- **Sessions:** create, get, update (`PATCH`), cancel, RSVP (`POST .../rsvp`),
  host payment update (`PATCH .../participants/:id/payment`), lineup
  (`PUT .../lineup`).
- **RSVP/waitlist correctness:** capacity enforcement, automatic waitlist
  promotion, and **serializable transactions with retry**
  (`withSerializableRetry`) — i.e. the race condition on the last open slot is
  already handled at the strongest isolation level.
- **Notifications:** persisted `Notification` records + scheduling for reminders,
  waitlist promotion, cancellation, and change events; `PushDevice` registration
  and `NotificationPreference` already modeled.
- **Cost:** integer-VND cost service + tests.
- **Process:** spec-driven (`docs/specs/0001…0006`), ADRs, production-readiness
  checklist, shared Zod contract in `packages/shared`.

The iOS networking layer (`Voi/Services/APIClient.swift`,
`Voi/Networking/APIModels.swift`) already mirrors this contract (`SessionDTO`,
`UserProfile`, etc.) and `HomeViewModel.reload()` already calls the real API,
falling back to `Mock.sessions` only on failure.

### iOS — feature-complete on mock data

All screens exist; the social/engagement features added most recently live only
in `DemoStore` and `Mock` with **no backend contract yet**.

---

## 2. Gap analysis (iOS feature → backend status → action)

Legend: ✅ backend ready · 🟡 partial · ❌ missing.

| iOS feature | Backend status | Action |
|---|---|---|
| Google login screen | 🟡 dev-login JWT only | **Spec 0008** real OAuth + Apple + refresh; Keychain on iOS |
| Onboarding, theme, language, calendar add | n/a | Keep client-only |
| Sessions tab (browse list) | 🟡 no discovery endpoint (derived via groups) | **Spec 0007** `GET /v1/sessions` feed + filters |
| Session detail / create / edit / cancel | ✅ | Wire iOS to API |
| RSVP (Join / Maybe / Can't), waitlist | ✅ | Wire iOS to API |
| Lineup board | ✅ `PUT .../lineup` | Wire iOS to API |
| Cost split (auto) | ✅ cost service | Wire iOS to API |
| Fixed price per player | ❌ schema has `feeTotalVnd` only | Add nullable `feePerPlayerVnd` (Spec 0007) |
| Pay / mark paid | 🟡 host-only `PATCH payment` | Decide self-pay vs host-confirm (Spec 0007); QR stays client-side |
| Filter / sort / search | 🟡 client-side | Server support in `GET /v1/sessions` (Spec 0007) |
| Saved / favorites filter | ❌ | **Spec 0010** |
| Map (nearby) | ❌ single mock coordinate | Add `venueLat/venueLng` to Session (Spec 0007, optional) |
| People (hosts/players + stats) | ❌ | **Spec 0009** profiles + aggregates |
| Reviews / ratings | ❌ | **Spec 0009** |
| Follow host/player | ❌ | **Spec 0010** |
| Check-in (mark present) | ❌ `attendance.ts` is waitlist logic, not presence | **Spec 0011** add `checkedInAt` |
| Match scores | ❌ | **Spec 0011** |
| Group chat (per session) | ❌ | **Spec 0012** (realtime) |
| Alerts / notifications | ✅ persisted + routes | Wire iOS; delivery worker = **Spec 0013** |
| Invite (envelope) | ✅ `invites` route | Wire iOS to API |
| Settings → notif preferences | ✅ `NotificationPreference` + devices | Wire iOS to API |
| Sign out | n/a + 🟡 | Clear Keychain + revoke refresh token (Spec 0008) |

---

## 3. Guiding principles (applied system design)

These are the rules we hold the build to. Each cites the fundamental it comes
from so trade-offs stay explicit.

- **Don't over-engineer for the current size.** Voi serves badminton groups —
  read-heavy, low write volume, realistically thousands (not millions) of users.
  → **No sharding, no microservices, no Kafka, no CDN/edge** at this stage. Keep
  the **modular monolith** (one Fastify deployable, one Postgres). Add
  infrastructure only when a measurement demands it.
- **The backend is the source of truth** for RSVP, confirmed count, waitlist
  order, payment, cancellation (already an architecture decision). New
  money/coordination state (check-in, scores) follows the same rule;
  *cosmetic* state (favorites, follows) can be eventually consistent.
- **Strong vs. eventual consistency, chosen per feature.** Capacity/payment →
  strong (serializable, already done). Chat history, feeds, follower counts →
  eventual is fine.
- **Idempotency over "exactly once."** Any state-changing POST that a flaky
  mobile network may retry (join, pay, check-in, send-message) takes an
  **idempotency key** or is naturally idempotent (UPSERT / set-status). This is
  the at-least-once + idempotent-consumer pattern applied at the API edge.
- **Optimistic by default, pessimistic only when needed.** RSVP already uses
  serializable retry. Lineup edits can use optimistic concurrency
  (version / `If-Match` ETag) if concurrent host edits become real.
- **REST for resources, WebSocket only for chat.** Everything is a clean REST
  resource under `/v1` except the chat stream, which needs a persistent
  bidirectional channel. Realtime is the *only* place we accept stateful
  connections.
- **Cache is an optimization, not a dependency.** No Redis at MVP. When a hot
  read appears (session feed, player rating aggregates), add **cache-aside with
  TTL + invalidation on write**; the system must still serve correctly with the
  cache empty.
- **Async for slow / fire-and-forget work.** Push/email delivery moves to a
  **background worker + queue** (at-least-once, idempotent, retry with backoff,
  dead-letter queue + alert). The existing pattern of persisting the
  `Notification` row *inside the same transaction* as the triggering write is
  already an **outbox**, so this is an evolution, not a rewrite.
- **Security is a default, not a phase.** TLS everywhere, validate all input
  (Zod, already), host-only authZ enforced server-side (already), never log
  device tokens (already), rate limit (already), short-lived access tokens +
  refresh, secrets in env only.

---

## 4. Sizing & non-goals

- **Assumed scale (MVP → early growth):** ≤ ~50k users, ≤ ~a few hundred
  sessions/day, single region (Vietnam). Read:write ≈ 10:1.
- **Implications:** a single Postgres with good indexes and a single (or two for
  HA) API instance behind one load balancer comfortably covers this. Vertical
  headroom is large; horizontal scale is a later, easy step because the API is
  stateless (JWT).
- **Explicit non-goals now:** sharding, multi-region, CQRS/event-sourcing,
  service decomposition, a self-hosted message broker. Revisit only with metrics.

---

## 5. Target architecture (now and the scale path)

```
                       ┌──────────────┐
   iOS (SwiftUI) ─────▶│              │
   Web (Next.js) ─────▶│   Fastify    │──▶ PostgreSQL (source of truth)
                       │   /v1 REST   │
   Chat (WebSocket) ──▶│   + /ws      │──▶ (later) Redis: WS pub/sub + cache
                       └──────┬───────┘
                              │ enqueue
                              ▼
                     Notification worker ──▶ APNs / email
                     (retry + DLQ)
```

**Scale path (only when measured):**
1. Add read replicas; route "read-your-own-writes" to primary briefly after a
   write to avoid replica-lag confusion.
2. Add Redis: cache-aside for hot reads **and** pub/sub so chat WebSockets work
   across multiple API instances (the only thing blocking horizontal scale of
   the realtime layer).
3. Put a CDN in front of user/venue images.
4. Partition high-volume tables by time (e.g. `chat_messages`,
   `notifications`) before ever considering sharding.

---

## 6. Data model additions (Prisma)

All additions are backward-compatible. The one change to an existing table
(`Session.feePerPlayerVnd`, `SessionParticipant.checkedInAt`) is a **nullable
column**, added via the safe migration recipe (add nullable → deploy code →
backfill if needed → constrain), never a blocking `ALTER`.

```prisma
// Spec 0007 — discovery, fixed price, optional cost tracking, geo
model Session {
  // ...existing fields...
  costTrackingEnabled Boolean @default(false) @map("cost_tracking_enabled") // host opt-in at creation
  feePerPlayerVnd     Int?    @map("fee_per_player_vnd") // host-set fixed price
  venueLat            Float?  @map("venue_lat")          // for Map
  venueLng            Float?  @map("venue_lng")
}

// Spec 0008 — durable auth
model AuthIdentity {        // one row per external provider link
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  provider      AuthProvider                          // GOOGLE | APPLE
  providerSub   String   @map("provider_sub")         // subject from the IdP
  createdAt     DateTime @default(now()) @map("created_at")
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerSub])
  @@map("auth_identities")
}

model RefreshToken {        // hashed; enables revocation (sign-out)
  id         String   @id @default(cuid())
  userId     String   @map("user_id")
  tokenHash  String   @unique @map("token_hash")      // store a hash, never raw
  expiresAt  DateTime @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime @default(now()) @map("created_at")
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@map("refresh_tokens")
}

// Spec 0009 — reviews (player profiles/stats are computed, not stored)
model Review {
  id          String   @id @default(cuid())
  subjectId   String   @map("subject_id")   // reviewed user
  authorId    String   @map("author_id")    // reviewer
  sessionId   String?  @map("session_id")   // optional provenance
  rating      Int                            // 1..5 (validate in Zod)
  comment     String?
  createdAt   DateTime @default(now()) @map("created_at")
  @@unique([subjectId, authorId, sessionId]) // one review per author per context
  @@index([subjectId])
  @@map("reviews")
}

// Spec 0010 — follow + favorites
model Follow {
  followerId String   @map("follower_id")
  followeeId String   @map("followee_id")
  createdAt  DateTime @default(now()) @map("created_at")
  @@id([followerId, followeeId])
  @@index([followeeId])
  @@map("follows")
}

model SavedSession {
  userId    String   @map("user_id")
  sessionId String   @map("session_id")
  createdAt DateTime @default(now()) @map("created_at")
  @@id([userId, sessionId])
  @@index([sessionId])
  @@map("saved_sessions")
}

// Spec 0011 — check-in + match results
model SessionParticipant {
  // ...existing fields...
  checkedInAt DateTime? @map("checked_in_at") // presence at the venue
}

model MatchResult {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  label     String                         // e.g. "Court 1"
  scoreA    Int      @map("score_a")
  scoreB    Int      @map("score_b")
  createdAt DateTime @default(now()) @map("created_at")
  @@index([sessionId])
  @@map("match_results")
}

// Spec 0012 — chat
model ChatMessage {
  id        String   @id @default(cuid())
  sessionId String   @map("session_id")
  authorId  String   @map("author_id")
  body      String
  createdAt DateTime @default(now()) @map("created_at")
  @@index([sessionId, createdAt])          // keyset pagination
  @@map("chat_messages")
}
```

Indexing notes (B-tree, selectivity): `chat_messages(session_id, created_at)`
serves "latest N in this session" with keyset pagination (no large `OFFSET`).
`reviews(subject_id)` and `follows(followee_id)` serve the aggregate counts.
Don't index low-selectivity columns. Aggregate stats (avg rating, counts) are
**computed**, and only **denormalized/cached if** the People screen becomes hot.

---

## 7. API additions

All under `/v1`, JWT-protected unless noted, Zod-validated, contract added to
`packages/shared`, reflected in OpenAPI.

**Spec 0007 — discovery & price**
- `GET /v1/sessions?scope=upcoming|past&skill=&venue=&availableOnly=&savedOnly=&sort=date|price|spots&cursor=` → paginated feed for the Sessions tab (keyset pagination). Read-heavy → prime candidate for cache-aside later.
- Extend `CreateSession`/`UpdateSession` with optional `feePerPlayerVnd` (+ cost
  service: fixed price wins over computed split).

**Spec 0008 — durable auth**
- `POST /v1/auth/google` and `POST /v1/auth/apple` — verify the IdP identity
  token server-side, upsert `User` + `AuthIdentity`, return
  `{ accessToken (short-lived), refreshToken }`.
- `POST /v1/auth/refresh` — rotate refresh token, issue new access token.
- `POST /v1/auth/logout` — revoke the refresh token.
- Keep `POST /v1/auth/dev` for local/dev only (gated by env).

**Spec 0009 — profiles & reviews**
- `GET /v1/users/:id/profile` → display info + computed stats (hosted count,
  joined count, avg rating, review count).
- `GET /v1/users/:id/reviews` (paginated) · `POST /v1/sessions/:id/reviews`
  (review a co-participant; **only if the author checked in**; one per author/context).
- `GET /v1/people?role=host|player` → directory for the People screen.

**Spec 0010 — follow & saved**
- `PUT/DELETE /v1/users/:id/follow` (idempotent) · `GET /v1/me/following`.
- `PUT/DELETE /v1/sessions/:id/save` (idempotent) · the `savedOnly` filter in
  `GET /v1/sessions` reads this.

**Spec 0011 — check-in & results**
- `POST /v1/sessions/:id/participants/:pid/checkin` (host-only, idempotent —
  sets `checkedInAt`, repeat calls are no-ops).
- `POST /v1/sessions/:id/results` · `GET /v1/sessions/:id/results`.

**Spec 0012 — chat**
- `GET /v1/sessions/:id/messages?cursor=` (keyset history) ·
  `POST /v1/sessions/:id/messages` (REST fallback / send).
- `GET /v1/ws?token=` WebSocket: subscribe to a session topic, receive new
  messages. Ordering by server timestamp; client de-dupes by message id.
  Single instance now; Redis pub/sub when we run more than one API instance.
  Polling `GET messages` is the graceful degradation if WS drops.

**Idempotency convention:** state-changing POSTs accept an
`Idempotency-Key` header; the server stores `(key → result)` and replays the
stored result on retry (Stripe-style). PUT/DELETE follows are naturally
idempotent.

---

## 8. Authentication plan (Spec 0008)

- **AuthN:** iOS uses Google Sign-In and Sign in with Apple → sends the IdP
  identity token to the backend → backend **verifies the signature/audience**
  → upserts `User` + `AuthIdentity`.
- **Tokens:** short-lived **access JWT** (stateless, ~15 min, no DB lookup per
  request — preserves horizontal scalability) + **refresh token** (hashed in
  `RefreshToken`, rotated on use, revocable). This is the standard mitigation
  for JWT's "can't revoke" weakness.
- **iOS:** persist tokens in **Keychain** (not `UserDefaults`); `APIClient`
  already attaches `Authorization: Bearer`. Gate the app on
  `AuthSession.isAuthenticated` and drop the local `loggedIn` bool. Sign-out =
  clear Keychain + call `/auth/logout`.
- **AuthZ** stays server-enforced and unchanged (host-only operations already
  checked in `assertCanHostSession`).
- No passwords are stored; if email/password is ever added, hash with
  bcrypt/argon2 + per-user salt — never a fast hash.

---

## 9. Notification delivery worker (Spec 0013)

Today notifications are **persisted** but not delivered to devices. Evolve the
existing outbox-style persistence into delivery:

- A **background worker** drains pending `Notification` rows (or a dedicated job
  queue) and delivers via **APNs** (devices already registered in `PushDevice`).
- **At-least-once + idempotent:** dedupe by notification id so a retry never
  double-sends; respect `NotificationPreference`.
- **Retry with backoff**; after N failures move to a **dead-letter queue** and
  alert. Apply **back-pressure** toward the provider's rate limits.
- Start in-process (a simple polling worker) and graduate to Redis/BullMQ only
  if volume needs it — no broker required for MVP scale.

---

## 10. iOS integration plan

The biggest near-term win and lowest risk: connect the screens whose backend
**already exists**, before building any new backend.

- **Introduce a repository layer.** Define protocols
  (`SessionRepository`, `PeopleRepository`, `ChatRepository`,
  `SocialRepository`, …). Today's `DemoStore`/`Mock` becomes the **mock**
  implementation; add an **API** implementation backed by `APIClient`. A single
  feature flag (or env) selects mock vs. real, so the app keeps working
  throughout the migration.
- **Wire Phase-A features first** (auth, sessions, RSVP, lineup, cost, payment,
  notifications, devices, invites, settings) — these need no backend work, only
  an API repository + DTO→domain mapping (mapping already partly exists).
- **Contract sync:** `packages/shared` (Zod) is the source of truth. Keep the
  Swift DTOs mirroring it; optionally **generate Swift models from
  `/openapi.json`** later to stop hand-syncing.
- **Keep client-only** what should be client-only: onboarding, theme, language,
  calendar (EventKit), payment **QR rendering** (VietQR string is built locally;
  only the paid/unpaid *status* is server state).

---

## 11. Phased roadmap

Continues the MVP roadmap (which ended at Milestone 6: Private Beta). Each spec
follows `docs/specs/template.md` with `spec.md` + `tasks.md`.

| Phase | Work | New specs | Depends on |
|---|---|---|---|
| **A. Real data wiring** | iOS repository layer; connect auth/dev, sessions, RSVP, lineup, cost, payment, notifications, devices, invites, settings; add `GET /v1/sessions` feed + `feePerPlayerVnd` | 0007 | — |
| **B. Durable auth** | Google + Apple sign-in, refresh tokens, Keychain, sign-out | 0008 | A |
| **C. Social & engagement** | Profiles + reviews; follow + saved | 0009, 0010 | A, B |
| **D. Post-session loop** | Check-in + match results | 0011 | A, B |
| **E. Chat** | Persisted messages + WebSocket realtime | 0012 | A, B |
| **F. Delivery & hardening** | Notification worker (APNs + retry + DLQ); caching where measured; CI; staging/prod split | 0013 | A |

Suggested order: **A → B → (C, D in parallel) → E → F.** A and B de-risk
everything; chat (E) is the largest single piece and is deliberately last among
features.

---

## 12. Production-readiness delta

Against `docs/architecture/production-readiness.md`, the new items this plan
adds:

- Durable auth (OAuth + Apple) replacing dev login — **required before public
  release** (already flagged in the checklist).
- Notification **delivery worker with retry** — already flagged as pending.
- Per-feature acceptance criteria + Vitest coverage for each new spec.
- New migrations checked in; backward-compatible recipe for the two
  existing-table columns.
- Realtime layer documented (single-instance limit + Redis pub/sub path).
- iOS: services/view-models/models separation via the repository layer (matches
  the checklist's iOS guidance).

---

## 13. Risks & trade-offs

- **WebSocket statefulness** is the one thing that complicates horizontal
  scaling. Mitigation: single instance now; Redis pub/sub before scaling out;
  polling fallback always available.
- **Contract drift** between Swift DTOs and `packages/shared`. Mitigation:
  OpenAPI-generated Swift models once the surface stabilizes.
- **Replica lag / read-your-own-writes** if/when read replicas are added.
  Mitigation: route a user's reads to primary briefly after their write.
- **Over-building.** The biggest risk for a small app is adding Redis/queues/
  replicas before they're needed. Mitigation: every infra addition must be
  justified by a metric, not a hunch.

---

## 14. Immediate next steps

1. Approve this plan and the phase order.
2. Write **Spec 0007** (`docs/specs/0007-session-discovery/`) and the iOS
   repository-layer task list (Phase A).
3. Stand up the iOS API repositories behind a feature flag and migrate the
   already-supported screens off `DemoStore`.
4. Then Spec 0008 (durable auth) and proceed down the roadmap.

## Decisions (resolved)

- **Payments:** the **host confirms** receipt (keep the host-only payment
  endpoint). Cost/payment tracking is **opt-in per session** — the host enables
  it when creating the session (`costTrackingEnabled`); when off, the cost &
  payment UI is hidden entirely.
- **Reviews:** gated on **attendance** — only participants with `checkedInAt`
  set may review a session's people.
- **Map:** venue geolocation **is in scope** (`venueLat`/`venueLng` on Session).
- **Rollout:** **iOS-first.** `apps/web` parity is deferred.
