# Voi Web

**Not in the current product path.** Voi is iOS-first (`apps/ios`). This Next.js
tree is leftover from an earlier experiment and is not the client to build or
ship.

It still talks to `apps/api` and `packages/shared` if you run it locally.

## Local Development

From the repository root:

```sh
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm --filter @voi/api dev   # API on http://localhost:43187
pnpm --filter @voi/web dev   # Web on http://localhost:43188
```

Set the API base URL by copying `.env.example` to `.env.local` if you run the API
somewhere other than the default `http://localhost:43187/v1`.

## Structure

- `src/app`: App Router routes (dashboard, group, session, invite).
- `src/components`: UI primitives and feature views.
- `src/lib`: API client, shared response types, auth context, formatting helpers.

## Auth

Authentication uses the API's development email login (`POST /auth/dev`). The token
is stored in `localStorage`. Sign in with Apple / OAuth comes later.

## Implemented

- Dev sign-in, group list and creation.
- Session creation, detail, RSVP (join / maybe / can't go) with waitlist.
- Host payment tracking and cost-per-player display.
- Read-only court lineup and shareable invite links.

## Next up

- Drag-and-drop lineup editing for hosts.
- Group join from invite links.
- Notification preferences UI.
