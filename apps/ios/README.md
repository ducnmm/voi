# Voi iOS

SwiftUI source skeleton for the Voi iOS app.

## Current State

This folder contains the initial source structure and mock-data screens. A full Xcode project should be generated after Xcode is installed and selected on the development machine.

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

