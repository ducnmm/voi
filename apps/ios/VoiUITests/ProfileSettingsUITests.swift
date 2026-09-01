import XCTest

@MainActor
final class ProfileSettingsUITests: VoiUITestCase {
    func testEditProfileAndNotificationSettings() {
        launchApp()
        waitForHome()
        tapTab("Profile")

        XCTAssertTrue(app.navigationBars["Profile"].waitForExistence(timeout: 8))
        XCTAssertTrue(query(A11y.Profile.displayName).waitForExistence(timeout: 6))
        tap(A11y.Profile.save, timeout: 6)
        dismissBlockingAlertIfPresent()

        tap(A11y.Profile.settings, timeout: 8)
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 8))

        if query(A11y.Settings.reminders).waitForExistence(timeout: 6) {
            tap(A11y.Settings.reminders)
            tap(A11y.Settings.statusChanges)
            tap(A11y.Settings.waitlist)
        }

        XCTAssertTrue(query(A11y.Settings.signOut).exists)
        XCTAssertTrue(app.staticTexts["English"].exists || app.buttons["English"].exists || app.staticTexts["Language"].exists)
    }
}
