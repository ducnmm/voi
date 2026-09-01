import XCTest

@MainActor
class VoiUITestCase: XCTestCase {
    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    struct Account {
        let email: String
        let displayName: String

        static let host = Account(email: A11y.Seed.hostEmail, displayName: "Host")
        static let player = Account(email: A11y.Seed.playerEmail, displayName: "An")
        static let waitlisted = Account(email: A11y.Seed.waitlistedEmail, displayName: "Quan")
        static let unanswered = Account(email: A11y.Seed.unansweredEmail, displayName: "Vy")

        static func throwaway(_ tag: String) -> Account {
            Account(email: "e2e-\(tag)@example.com", displayName: "E2E \(tag)")
        }
    }

    func launchApp(
        autoLogin: Bool = true,
        skipOnboarding: Bool = true,
        reset: Bool = true,
        account: Account = .host,
        apiBaseURL: String? = nil
    ) {
        var args = [
            "-UITesting",
            "-UITestDisableAnimations",
            "-AppleLanguages", "(en)",
            "-AppleLocale", "en_US"
        ]
        if reset { args.append("-UITestReset") }
        if skipOnboarding { args.append("-UITestSkipOnboarding") }
        if autoLogin { args.append("-UITestAutoLogin") }
        app.launchArguments = args
        app.launchEnvironment["VOI_API_BASE_URL"] = apiBaseURL
            ?? ProcessInfo.processInfo.environment["VOI_API_BASE_URL"]
            ?? "http://127.0.0.1:43187/v1"
        app.launchEnvironment["VOI_UI_TEST_EMAIL"] = account.email
        app.launchEnvironment["VOI_UI_TEST_NAME"] = account.displayName
        if let invite = app.launchEnvironment["VOI_UI_TEST_INVITE"] {
            app.launchArguments.append(contentsOf: ["-UITestInviteToken", invite])
        }
        app.launch()
        dismissBlockingAlertIfPresent()
    }

    func waitForHome(timeout: TimeInterval = 25) {
        let sessionsTab = tabButton("Sessions")
        XCTAssertTrue(
            sessionsTab.waitForExistence(timeout: timeout),
            "Expected the Sessions tab after login. Last screen: \(app.debugDescription.prefix(2000))"
        )
        dismissBlockingAlertIfPresent()
    }

    func tapTab(_ name: String) {
        let tab = tabButton(name)
        XCTAssertTrue(tab.waitForExistence(timeout: 8), "Missing tab \(name)")
        tab.tap()
    }

    func tabButton(_ name: String) -> XCUIElement {
        let inBar = app.tabBars.buttons[name]
        if inBar.exists { return inBar }
        return app.buttons[name]
    }

    @discardableResult
    func waitFor(_ identifier: String, timeout: TimeInterval = 10) -> XCUIElement {
        let element = query(identifier)
        XCTAssertTrue(
            element.waitForExistence(timeout: timeout),
            "Timed out waiting for \(identifier)"
        )
        return element
    }

    func query(_ identifier: String) -> XCUIElement {
        let matching = app.descendants(matching: .any).matching(identifier: identifier)
        return matching.firstMatch
    }

    func tap(_ identifier: String, timeout: TimeInterval = 10) {
        let element = waitFor(identifier, timeout: timeout)
        reveal(element)
        element.tap()
    }

    func reveal(_ element: XCUIElement, swipes: Int = 8) {
        var remaining = swipes
        while !element.isHittable && remaining > 0 && element.exists {
            app.swipeUp()
            remaining -= 1
        }
    }

    func openSeedSession() {
        waitForHome()
        tapTab("Sessions")
        let card = query(A11y.Home.card(A11y.Seed.sessionId))
        if !card.waitForExistence(timeout: 12) {
            let byTitle = app.staticTexts[A11y.Seed.sessionTitle]
            XCTAssertTrue(
                byTitle.waitForExistence(timeout: 8),
                "Seed session \(A11y.Seed.sessionTitle) is not on the Sessions list"
            )
            byTitle.tap()
            return
        }
        reveal(card)
        card.tap()
        XCTAssertTrue(
            query(A11y.Session.join).waitForExistence(timeout: 12)
                || app.staticTexts["Your RSVP"].waitForExistence(timeout: 6),
            "Session detail did not open"
        )
    }

    func dismissBlockingAlertIfPresent() {
        let alert = app.alerts.firstMatch
        guard alert.waitForExistence(timeout: 1) else { return }
        if alert.buttons["OK"].exists {
            alert.buttons["OK"].tap()
        } else if alert.buttons["Allow"].exists {
            alert.buttons["Allow"].tap()
        } else if alert.buttons["Don't Allow"].exists {
            alert.buttons["Don't Allow"].tap()
        }
    }

    func assertMissing(_ identifier: String, timeout: TimeInterval = 2, _ message: String? = nil) {
        let appeared = query(identifier).waitForExistence(timeout: timeout)
        XCTAssertFalse(appeared, message ?? "Did not expect \(identifier) to be visible")
    }

    func popToSessions() {
        if app.navigationBars.buttons["Back"].waitForExistence(timeout: 2) {
            app.navigationBars.buttons["Back"].tap()
        } else if app.navigationBars.buttons.firstMatch.exists {
            app.navigationBars.buttons.firstMatch.tap()
        }
        tapTab("Sessions")
    }

    @discardableResult
    func createSessionFromHome(title: String, venue: String = "E2E Court") -> String {
        waitForHome()
        tapTab("Sessions")
        tap(A11y.Home.create, timeout: 8)
        XCTAssertTrue(
            app.navigationBars["New Session"].waitForExistence(timeout: 8),
            "Create session sheet should open"
        )
        typeInto(A11y.Create.title, title)
        typeInto(A11y.Create.venue, venue)
        tap(A11y.Create.submit, timeout: 6)
        XCTAssertTrue(
            query(A11y.Home.create).waitForExistence(timeout: 12)
                || tabButton("Sessions").waitForExistence(timeout: 4),
            "Create sheet should dismiss"
        )
        let created = app.staticTexts[title]
        let createdButton = app.buttons[title]
        XCTAssertTrue(
            created.waitForExistence(timeout: 15) || createdButton.waitForExistence(timeout: 4),
            "Newly created session \(title) should appear on the Sessions feed"
        )
        return title
    }

    func openSession(titled title: String) {
        tapTab("Sessions")
        let text = app.staticTexts[title]
        let button = app.buttons[title]
        if text.waitForExistence(timeout: 12) {
            reveal(text)
            text.tap()
        } else {
            XCTAssertTrue(button.waitForExistence(timeout: 6), "Session \(title) is not on the list")
            reveal(button)
            button.tap()
        }
        XCTAssertTrue(
            query(A11y.Session.join).waitForExistence(timeout: 12)
                || app.staticTexts["Your RSVP"].waitForExistence(timeout: 6),
            "Session detail did not open for \(title)"
        )
    }

    func sendChatMessage(_ text: String) {
        let input = chatComposer()
        XCTAssertTrue(input.waitForExistence(timeout: 10), "Chat composer should exist")
        input.tap()
        input.typeText(text)
        let send = app.buttons[A11y.Chat.send].exists ? app.buttons[A11y.Chat.send] : app.buttons["Send"]
        XCTAssertTrue(send.waitForExistence(timeout: 6), "Chat send control should exist")
        send.tap()
        XCTAssertTrue(
            app.staticTexts[text].waitForExistence(timeout: 10),
            "Sent chat message should appear: \(text)"
        )
    }

    func chatComposer() -> XCUIElement {
        let identified = query(A11y.Chat.input)
        if identified.exists { return identified }
        if app.textViews[A11y.Chat.input].exists { return app.textViews[A11y.Chat.input] }
        if app.textFields[A11y.Chat.input].exists { return app.textFields[A11y.Chat.input] }
        if app.textViews["Message"].exists { return app.textViews["Message"] }
        return app.textFields["Message"]
    }

    func typeInto(_ identifier: String, _ text: String, replace: Bool = true) {
        let field = waitFor(identifier)
        field.tap()
        if replace, let value = field.value as? String, !value.isEmpty {
            let deletes = String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count + 8)
            field.typeText(deletes)
        }
        field.typeText(text)
    }
}
