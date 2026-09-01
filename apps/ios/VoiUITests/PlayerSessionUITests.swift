import XCTest

@MainActor
final class PlayerSessionUITests: VoiUITestCase {
    func testNonHostSeesJoinOnly() {
        launchApp(account: .player)
        openSeedSession()

        XCTAssertTrue(query(A11y.Session.join).waitForExistence(timeout: 8))
        assertMissing(A11y.Session.maybe, timeout: 1, "Non-host must not see Maybe")
        assertMissing(A11y.Session.decline, timeout: 1, "Non-host must not see Can't go")

        tap(A11y.Session.more)
        XCTAssertFalse(
            app.buttons["Edit"].waitForExistence(timeout: 2)
                || query(A11y.Session.edit).waitForExistence(timeout: 1),
            "Non-host must not see Edit"
        )
        XCTAssertFalse(
            app.buttons["Cancel session"].waitForExistence(timeout: 1)
                || query(A11y.Session.cancel).waitForExistence(timeout: 1),
            "Non-host must not see Cancel session"
        )
        app.swipeDown()

        assertMissing(A11y.Session.lineupEdit, timeout: 1, "Non-host must not edit lineup")
        assertMissing(A11y.Session.attendance, timeout: 1, "Non-host must not see attendance")
    }

    func testUnansweredMemberCanJoinWithoutMaybe() {
        launchApp(account: .unanswered)
        openSeedSession()

        XCTAssertTrue(query(A11y.Session.join).waitForExistence(timeout: 8))
        assertMissing(A11y.Session.maybe, timeout: 1)
        assertMissing(A11y.Session.decline, timeout: 1)

        tap(A11y.Session.join)
        XCTAssertTrue(
            app.staticTexts["You're in for this session."].waitForExistence(timeout: 10)
                || app.staticTexts["Joined"].waitForExistence(timeout: 4)
                || app.staticTexts["On waitlist"].waitForExistence(timeout: 4),
            "Join should confirm the unanswered member"
        )
    }

    func testWaitlistedPlayerSeesWaitlistStatus() {
        launchApp(account: .waitlisted)
        openSeedSession()

        XCTAssertTrue(
            app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "waitlist"))
                .firstMatch.waitForExistence(timeout: 10)
                || app.staticTexts["On waitlist"].waitForExistence(timeout: 4),
            "Waitlisted player should see waitlist status"
        )
        assertMissing(A11y.Session.maybe, timeout: 1)
        assertMissing(A11y.Session.decline, timeout: 1)
    }

    func testPlayerCanSendSessionAndGroupChat() {
        launchApp(account: .player)
        waitForHome()
        tapTab("Messages")
        tap(A11y.Messages.group(A11y.Seed.groupId), timeout: 10)
        sendChatMessage("Player group ping")
        popToSessions()

        openSeedSession()
        tap(A11y.Session.chat)
        sendChatMessage("Player session ping")
    }
}
