# Voi iOS

The primary Voi client, built natively with SwiftUI.

## Current State

SwiftUI primary client, largely wired to the real `/v1` API:

- **Auth:** Google Sign-In + Keychain restore/refresh; dev login persists access token for local reloads.
- **Sessions:** feed (scope/sort/filters), create (including fixed price), detail refresh, RSVP, lineup, cancel/edit, cost split, host payment.
- **Social:** people, follow, saved sessions, reviews, check-in, match results, chat REST + WebSocket.
- **Invites:** resolve/accept token + `voi://invites/{token}` deep links.
- **Settings:** notification preferences synced to the API.

Still client-only / partial: weekly recurrence, player self-pay (host confirms on server), APNs device registration, notification read state, Apple Sign-In.

Default API base: `http://localhost:43187/v1` (override with env `VOI_API_BASE_URL`).

## End-to-end tests

UI tests live in `VoiUITests` and use **XCUITest**. They talk to the real local API
(dev login, no Google sheet) via launch arguments `-UITesting` / `-UITestAutoLogin`.

From the repository root, with Docker running:

```sh
pnpm test:e2e:ios
```

CI (`ios-e2e` on GitHub Actions) runs a **smoke** subset on pull requests and the **full** suite on `main`. Locally:

```sh
E2E_SUITE=smoke pnpm test:e2e:ios
E2E_SUITE=full  pnpm test:e2e:ios
```

Or from `apps/ios` after the API is already up:

```sh
xcodegen generate
xcodebuild test -project Voi.xcodeproj -scheme Voi \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -parallel-testing-enabled NO
```

## Intended Setup

- iOS 17+
- SwiftUI
- Native navigation
- API client targeting the custom Voi backend

## Source Layout

- `VoiApp.swift`: app entry point.
- `Design`: typography, colors, spacing helpers.
- `Models`: product models used by early screens.
- `Services`: API client.
- `Screens`: SwiftUI screens.

## Project Generation

`project.yml` is included for XcodeGen. After installing Xcode and XcodeGen:

```sh
cd apps/ios
xcodegen generate
open Voi.xcodeproj
```
