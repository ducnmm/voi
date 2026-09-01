import XCTest

@MainActor
final class CreateSessionUITests: VoiUITestCase {
    func testCreateSessionFromProfile() {
        launchApp()
        waitForHome()
        tapTab("Profile")

        tap(A11y.Profile.createEvent, timeout: 8)
        XCTAssertTrue(
            app.navigationBars["New Session"].waitForExistence(timeout: 8),
            "Create session sheet should open"
        )

        let title = "E2E Rally \(Int(Date().timeIntervalSince1970) % 100_000)"
        typeInto(A11y.Create.title, title)
        typeInto(A11y.Create.venue, "E2E Court")

        tap(A11y.Create.submit, timeout: 6)

        XCTAssertTrue(
            app.navigationBars["Profile"].waitForExistence(timeout: 12)
                || tabButton("Profile").exists,
            "Create sheet should dismiss after a successful submit"
        )

        tapTab("Sessions")
        let created = app.staticTexts[title]
        let createdButton = app.buttons[title]
        XCTAssertTrue(
            created.waitForExistence(timeout: 15) || createdButton.waitForExistence(timeout: 4),
            "Newly created session should appear on the Sessions feed"
        )
    }

    func testManageEventsListsUpcoming() {
        launchApp()
        waitForHome()
        tapTab("Profile")
        tap(A11y.Profile.manageEvents, timeout: 8)
        XCTAssertTrue(
            app.navigationBars["Manage events"].waitForExistence(timeout: 8)
        )
        XCTAssertTrue(
            app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 10)
                || query(A11y.Home.card(A11y.Seed.sessionId)).waitForExistence(timeout: 4),
            "Manage events should list the seed session"
        )
    }
}
