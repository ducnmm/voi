import XCTest

@MainActor
final class HostSessionActionsUITests: VoiUITestCase {
    func testHostEditsSessionVenue() {
        launchApp(account: .host)
        let title = uniqueTitle("E2E Edit")
        _ = createSessionFromHome(title: title, venue: "Old Court")
        openSession(titled: title)

        tap(A11y.Session.more)
        if query(A11y.Session.edit).waitForExistence(timeout: 4) {
            tap(A11y.Session.edit)
        } else {
            XCTAssertTrue(app.buttons["Edit"].waitForExistence(timeout: 4), "Host Edit action missing")
            app.buttons["Edit"].tap()
        }

        XCTAssertTrue(app.navigationBars["Edit session"].waitForExistence(timeout: 8))
        typeInto(A11y.Create.venue, "New E2E Court")
        tap(A11y.Create.submit, timeout: 6)

        XCTAssertTrue(
            app.staticTexts["New E2E Court"].waitForExistence(timeout: 12),
            "Edited venue should show on session detail"
        )
    }

    func testHostDuplicatesSession() {
        launchApp(account: .host)
        let source = uniqueTitle("E2E Dup")
        _ = createSessionFromHome(title: source)
        openSession(titled: source)

        tap(A11y.Session.more)
        if query(A11y.Session.duplicate).waitForExistence(timeout: 4) {
            tap(A11y.Session.duplicate)
        } else {
            XCTAssertTrue(
                app.buttons["Duplicate next week"].waitForExistence(timeout: 4),
                "Host Duplicate action missing"
            )
            app.buttons["Duplicate next week"].tap()
        }

        XCTAssertTrue(app.navigationBars["New Session"].waitForExistence(timeout: 8))
        tap(A11y.Create.submit, timeout: 8)

        if app.alerts.firstMatch.waitForExistence(timeout: 3) {
            let message = app.alerts.firstMatch.staticTexts.allElementsBoundByIndex
                .map(\.label)
                .joined(separator: " | ")
            XCTFail("Duplicate submit failed: \(message)")
            return
        }

        XCTAssertTrue(
            query(A11y.Session.join).waitForExistence(timeout: 10)
                || query(A11y.Session.more).waitForExistence(timeout: 4),
            "Duplicate form should dismiss after a successful submit"
        )
    }

    func testHostCancelsSession() {
        launchApp(account: .host)
        let title = uniqueTitle("E2E Cancel")
        _ = createSessionFromHome(title: title)
        openSession(titled: title)

        tap(A11y.Session.more)
        if query(A11y.Session.cancel).waitForExistence(timeout: 4) {
            tap(A11y.Session.cancel)
        } else {
            XCTAssertTrue(
                app.buttons["Cancel session"].waitForExistence(timeout: 4),
                "Host Cancel action missing"
            )
            app.buttons["Cancel session"].tap()
        }

        XCTAssertTrue(
            query(A11y.Session.cancelled).waitForExistence(timeout: 10)
                || app.staticTexts["This session was cancelled."].waitForExistence(timeout: 4),
            "Cancelled banner should appear"
        )
    }

    func testHostSendsGroupChat() {
        launchApp(account: .host)
        waitForHome()
        tapTab("Messages")
        tap(A11y.Messages.group(A11y.Seed.groupId), timeout: 10)
        sendChatMessage("Host group ping")
    }

    func testHostTogglesPlayerPayment() {
        launchApp(account: .host)
        openSeedSession()
        tap(A11y.Session.join)

        reveal(query(A11y.Session.cost))
        let anPay = query(A11y.Session.paymentRow("An"))
        XCTAssertTrue(
            anPay.waitForExistence(timeout: 8)
                || app.staticTexts["Cost split"].waitForExistence(timeout: 4),
            "Cost split with player payment rows should be visible to the host"
        )
        if anPay.waitForExistence(timeout: 4) {
            reveal(anPay)
            anPay.tap()
        }
    }

    private func uniqueTitle(_ prefix: String) -> String {
        "\(prefix) \(Int(Date().timeIntervalSince1970) % 100_000)"
    }
}
