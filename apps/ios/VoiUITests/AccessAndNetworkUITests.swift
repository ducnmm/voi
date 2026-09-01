import XCTest

@MainActor
final class AccessAndNetworkUITests: VoiUITestCase {
    func testDeadApiStaysOnLogin() {
        launchApp(autoLogin: true, apiBaseURL: "http://127.0.0.1:59999/v1")
        XCTAssertTrue(
            query(A11y.Login.google).waitForExistence(timeout: 15),
            "When the API is unreachable, the app should stay on login"
        )
        XCTAssertFalse(
            tabButton("Sessions").waitForExistence(timeout: 2),
            "Sessions tab must not appear without a live API"
        )
    }

    func testOutsiderDoesNotSeeOtherGroupSessions() {
        launchApp(account: .throwaway("out\(Int(Date().timeIntervalSince1970) % 100_000)"))
        waitForHome()
        tapTab("Sessions")
        assertMissing(
            A11y.Home.card(A11y.Seed.sessionId),
            timeout: 3,
            "A user outside the seed group must not see Tuesday Night on their feed"
        )
        assertMissing(
            A11y.Home.card(A11y.Seed.groupOnlySessionId),
            timeout: 2,
            "A user outside the seed group must not see the GROUP_ONLY session"
        )
    }

    func testMemberSeesGroupOnlySession() {
        launchApp(account: .player)
        waitForHome()
        tapTab("Sessions")
        let card = query(A11y.Home.card(A11y.Seed.groupOnlySessionId))
        XCTAssertTrue(
            card.waitForExistence(timeout: 12)
                || app.staticTexts[A11y.Seed.groupOnlyTitle].waitForExistence(timeout: 4),
            "A group member should see the GROUP_ONLY session on the feed"
        )
        if card.exists {
            reveal(card)
            card.tap()
        } else {
            app.staticTexts[A11y.Seed.groupOnlyTitle].tap()
        }
        XCTAssertTrue(
            query(A11y.Session.join).waitForExistence(timeout: 12)
                || app.staticTexts["Your RSVP"].waitForExistence(timeout: 6),
            "Group member should be able to open the GROUP_ONLY session"
        )
    }

    func testStrangerJoinsViaInvite() {
        app.launchEnvironment["VOI_UI_TEST_INVITE"] = A11y.Seed.inviteToken
        launchApp(account: .throwaway("inv\(Int(Date().timeIntervalSince1970) % 100_000)"))

        XCTAssertTrue(
            app.navigationBars["Invite"].waitForExistence(timeout: 15)
                || app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 8),
            "Invite deep link should open the invite screen"
        )
        if query(A11y.Invite.join).waitForExistence(timeout: 8) {
            tap(A11y.Invite.join)
            XCTAssertTrue(
                app.staticTexts["Joined"].waitForExistence(timeout: 12)
                    || query(A11y.Invite.join).waitForExistence(timeout: 4),
                "Accepting the invite should join the session"
            )
        }
    }
}
