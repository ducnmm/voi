import XCTest

@MainActor
final class AccountLifecycleUITests: VoiUITestCase {
    func testDeleteThrowawayAccountReturnsToLogin() {
        let account = Account.throwaway("del\(Int(Date().timeIntervalSince1970) % 100_000)")
        launchApp(account: account)
        waitForHome()

        tapTab("Profile")
        tap(A11y.Profile.settings, timeout: 8)
        tap(A11y.Settings.deleteAccount, timeout: 8)

        let alert = app.alerts.firstMatch
        XCTAssertTrue(alert.waitForExistence(timeout: 6), "Delete confirmation should appear")
        if alert.buttons["Delete"].exists {
            alert.buttons["Delete"].tap()
        } else {
            alert.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Delete")).firstMatch.tap()
        }

        XCTAssertTrue(
            query(A11y.Login.google).waitForExistence(timeout: 12),
            "Deleting the account should return to login"
        )
    }
}
