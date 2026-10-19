# Voi iOS

The primary Voi client, built natively with SwiftUI.

## Current State

SwiftUI primary client, largely wired to the real `/v1` API:

- **Auth:** Sign in with Apple and Google Sign-In, Keychain restore/refresh; dev login persists access token for local reloads.
- **Sessions:** feed (scope/sort/filters), create (including fixed price), detail refresh, RSVP, lineup, cancel/edit, cost split, host payment.
- **Social:** people, follow, saved sessions, reviews, check-in, match results, chat REST + WebSocket.
- **Invites:** resolve/accept token + `voi://invites/{token}` deep links.
- **Settings:** notification preferences synced to the API.

Still client-only / partial: weekly recurrence, player self-pay (host confirms on server), APNs device registration, notification read state.

API base URL resolution:

1. Process env `VOI_API_BASE_URL` (Xcode scheme / XCUITest)
2. On a physical device, Info.plist `VOIApiBaseURL`
3. Otherwise `http://localhost:43187/v1` (simulator)

## Device install

Simulator can hit the Mac's local API. A physical iPhone cannot.

1. Deploy the API (Railway) and put `https://<domain>/v1` in `Voi/Info.plist` → `VOIApiBaseURL`, then `xcodegen generate`.
2. Accept the Xcode license if prompted: `sudo xcodebuild -license`.
3. On the iPhone: Developer Mode, trust the computer, plug in via USB.
4. Xcode → scheme **Voi** → the connected device → Run. Team `6X8BZ996MA` (Duc Nguyen) is already set for automatic signing.
5. Sign in with Google (dev login is off in production).

Tapping the icon after a Run from Xcode uses the compiled `VOIApiBaseURL`, not scheme env vars.

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
