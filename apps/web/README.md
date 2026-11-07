# Voi Web

Responsive Next.js client sharing the Fastify API and accounts with Voi iOS.
The visual system follows `apps/ios/Voi/Design/DesignTokens.swift`: green brand,
neutral surfaces, photo-first cards, rounded controls and light/dark appearance.

## Run locally

```sh
pnpm install
# Start the existing local Postgres and Redis services:
docker compose up -d postgres redis
pnpm db:generate
pnpm db:deploy
pnpm dev:api
pnpm dev:web
```

Web: http://localhost:43188. Default API proxy target: http://127.0.0.1:43187.
If the API's `.env` uses another port, set `VOI_API_ORIGIN` in `apps/web/.env.local`
to that origin. The browser calls `/api/v1`, so another device on the same network
can visit the Mac's LAN address without calling that device's own localhost.
Restart Next.js after changing proxy configuration.

## Google sign-in

- Create/configure a Google **Web application** OAuth client and authorize the web
  origins (localhost for local development, HTTPS domain for deployment).
- Web: `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<web-client-id>`.
- API: `GOOGLE_WEB_CLIENT_ID=<same-web-client-id>`; existing
  `GOOGLE_IOS_CLIENT_ID` continues to work for native login.
- Uses Google Identity Services and the existing `/auth/google` endpoint. Access
  tokens refresh through `/auth/refresh`; logout revokes the refresh token.
- Email-only development login is rendered only in development builds. No mock
  Google session is generated. A production build needs Google configured.

## Routes and functionality

- `/`: upcoming/past/saved discovery, search, skill/availability/sort filters.
- `/sessions/new`, `/sessions/:id`: create/edit/duplicate, four-week recurrence,
  photo gallery, map pin, calendar export, invitation/payment-reference QR, RSVP/waitlist,
  costs, host payment/check-in/lineup, results and attendee reviews.
- `/sessions/manage`: sessions hosted by the current user.
- `/map`: interactive map, real coordinate markers, session selection and directions.
- `/groups`, `/groups/:id`: create/view groups, member list, invitation links.
- `/invites/:token`: accept group/session invites, retaining the URL through login.
- `/messages`: group and session chat, REST history/pagination/send, WebSocket
  updates with periodic HTTP refresh when live transport is unavailable.
- `/notifications`: server-backed notification list and read state.
- `/people`, `/people/:id`: directory, stats, follows and reviews.
- `/profile`, `/settings`: profile/photo/skill edits, notification preferences,
  appearance, Vietnamese/English, reminder lead time, onboarding replay, logout
  and account deletion.
- Legacy `/find` and `/host` routes redirect to sessions/groups; mock venue
  marketplace data was removed.

## Deployment configuration

Use the normal Next.js Node server (`pnpm --filter @voi/web build` then
`pnpm --filter @voi/web start`). Set `VOI_API_ORIGIN` to a server-reachable API
origin **without `/v1`**; the proxy adds it. `NEXT_PUBLIC_API_BASE_URL` is optional
and overrides the browser API base when a direct API connection is required.
Direct connections require the API's `CORS_ORIGINS` to allow the web origin.
Configure the API's existing `PUBLIC_API_URL` for publicly reachable image uploads.
No hosting infrastructure is changed by this implementation.

## Checks

```sh
pnpm --filter @voi/shared build
pnpm --filter @voi/web typecheck
pnpm --filter @voi/web test
pnpm --filter @voi/web build
# Optional: with local API + web running; creates dedicated QA accounts/group
pnpm --filter @voi/web test:smoke
```

Browser checks should use a dedicated local QA account/group; do not run the seed
script against existing development data because it replaces its seeded group.

## Apple sign-in

Set `NEXT_PUBLIC_APPLE_CLIENT_ID` to a Web Services ID and
`NEXT_PUBLIC_APPLE_REDIRECT_URI` to a return URL registered in Apple Developer.
Set the same Services ID as `APPLE_WEB_CLIENT_ID` on the API and associate it with
the native app. The client checks OAuth state; the API checks signature,
issuer, expiry, an allowlist of native/web audiences, and the browser nonce.
Provider login cannot be exercised until those external credentials are configured.

## Map tiles

Leaflet loads public raster tiles with visible attribution. Production defaults to
standard OSM; development uses OSM Deutschland because the standard host is
unreachable on the current development network. Override `NEXT_PUBLIC_MAP_TILE_URL`
and `NEXT_PUBLIC_MAP_ATTRIBUTION` for a production provider. Observe its usage
policy; no bulk/offline tile downloading or paid provider is configured.
Venues without coordinates stay in the list and offer directions; no invented
coordinates are used. The create/edit form can place an actual venue pin.

## Responsive verification

Local browser QA exercised real iframe widths 320, 390, 768, 1024 and 1440px,
including mobile chat composer/back navigation, filter/share sheets, forms,
light/dark appearance, language persistence, weekly creation and map selection.
The development-only `/dev-preview?width=390&path=/` harness provides exact CSS
viewports. Large previews scale visually while retaining their original CSS
viewport width. This route returns 404 in production.

## UI regression checks

With the local API/web running and the dedicated `web-qa-20261026@example.com`
account already having a group and session:

```sh
pnpm --filter @voi/web exec playwright install chromium webkit
pnpm --filter @voi/web test:ui
```

The suite uses direct browser viewports in Chromium and WebKit rather than the
preview iframe. It measures compact navigation before/after scrolling and route
changes, Settings row alignment/centering, English/dark layouts, modal focus
return, focused chat with a reduced viewport, and scrollable logged-out sign-in.
GET responses are captured from the local API and cached within a run to keep
layout checks deterministic; the tests do not submit messages or alter preferences.
Screenshots/traces are under `apps/web/test-results`, with the HTML report in
`apps/web/playwright-report` (both ignored by Git). Browser emulation does not
replace a physical iPhone/native keyboard test.

The preview additionally accepts `height` (for example
`/dev-preview?width=390&height=568&path=/settings`) and fits both dimensions inside
the host window to prevent outer-page scrolling from misleading visual checks.
`/dev-preview/icons` provides a visual glyph audit. Both routes are disabled in
production.

## Platform differences

Calendar uses an `.ics` download rather than the native EventKit editor. Sharing
uses the browser share sheet where supported, with copy/QR fallback. Browser
notifications when the site is closed (Web Push) and installable PWA support are
not implemented; native APNs remains specific to iOS. In-app alerts and read state
use the same server API. Weekly repeat matches iOS: create the current session
and three subsequent weeks, with explicit recovery links after a partial failure.
Payment QR is a reference to show the host, not bank processing; guests cannot
mark themselves paid. This matches the current server's host-confirmation model.
