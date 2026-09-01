import Foundation
import UIKit

/// Launch-argument hooks used only by XCUITest. Production launches never set `-UITesting`.
enum UITestLaunch {
    static var isEnabled: Bool {
        ProcessInfo.processInfo.arguments.contains("-UITesting")
    }

    static var skipOnboarding: Bool {
        ProcessInfo.processInfo.arguments.contains("-UITestSkipOnboarding")
    }

    static var autoLogin: Bool {
        ProcessInfo.processInfo.arguments.contains("-UITestAutoLogin")
    }

    static var reset: Bool {
        ProcessInfo.processInfo.arguments.contains("-UITestReset")
    }

    static var disableAnimations: Bool {
        ProcessInfo.processInfo.arguments.contains("-UITestDisableAnimations")
    }

    static var email: String {
        ProcessInfo.processInfo.environment["VOI_UI_TEST_EMAIL"] ?? "host@example.com"
    }

    static var displayName: String {
        ProcessInfo.processInfo.environment["VOI_UI_TEST_NAME"] ?? "Host"
    }

    static var inviteToken: String? {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: "-UITestInviteToken"),
              args.indices.contains(index + 1) else { return nil }
        let value = args[index + 1]
        return value.isEmpty ? nil : value
    }

    /// Runs at module load so UserDefaults are ready before `@AppStorage` initializes.
    static let bootstrap: Void = {
        prepareIfNeeded()
    }()

    /// Clears persisted client state and pins English/light so assertions stay stable.
    static func prepareIfNeeded() {
        guard isEnabled else { return }

        if disableAnimations {
            UIView.setAnimationsEnabled(false)
        }

        if reset {
            UserDefaults.standard.removeObject(forKey: "didOnboard")
            UserDefaults.standard.set("en", forKey: "appLanguage")
            UserDefaults.standard.set("light", forKey: "appTheme")
            KeychainStore.set(nil, for: "accessToken")
            KeychainStore.set(nil, for: "refreshToken")
        }

        if skipOnboarding {
            UserDefaults.standard.set(true, forKey: "didOnboard")
        }
    }
}
