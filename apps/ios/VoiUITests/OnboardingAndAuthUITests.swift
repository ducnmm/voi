import XCTest

@MainActor
final class OnboardingAndAuthUITests: VoiUITestCase {
    func testOnboardingWalkthrough() {
        launchApp(autoLogin: false, skipOnboarding: false, reset: true)

        XCTAssertTrue(query(A11y.Onboarding.next).waitForExistence(timeout: 10))
        tap(A11y.Onboarding.next)
        tap(A11y.Onboarding.next)
        tap(A11y.Onboarding.getStarted)

        XCTAssertTrue(
            query(A11y.Login.google).waitForExistence(timeout: 8),
            "Onboarding should land on the login screen"
        )
        XCTAssertTrue(query(A11y.Login.dev).exists)
    }

    func testLoginScreenShowsGoogleButton() {
        launchApp(autoLogin: false, skipOnboarding: true, reset: true)

        let google = waitFor(A11y.Login.google, timeout: 10)
        XCTAssertTrue(google.exists)
        XCTAssertTrue(query(A11y.Login.dev).exists)
        XCTAssertFalse(tabButton("Sessions").exists)
    }

    func testDevLoginReachesSessions() {
        launchApp(autoLogin: false, skipOnboarding: true, reset: true)

        tap(A11y.Login.dev, timeout: 10)
        waitForHome()
        XCTAssertTrue(tabButton("Messages").exists)
        XCTAssertTrue(tabButton("Alerts").exists)
        XCTAssertTrue(tabButton("Profile").exists)
    }

    func testAutoLoginAndSignOut() {
        launchApp(autoLogin: true, skipOnboarding: true, reset: true)
        waitForHome()

        tapTab("Profile")
        tap(A11y.Profile.settings, timeout: 8)
        tap(A11y.Settings.signOut, timeout: 8)

        XCTAssertTrue(
            query(A11y.Login.google).waitForExistence(timeout: 10),
            "Sign out should return to the Google login screen"
        )
    }
}
