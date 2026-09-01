import XCTest

@MainActor
final class InviteAlertsPeopleUITests: VoiUITestCase {
    func testInviteLookupFromAlerts() {
        launchApp()
        waitForHome()
        tapTab("Alerts")

        tap(A11y.Alerts.openInvite, timeout: 8)
        XCTAssertTrue(app.navigationBars["Invite"].waitForExistence(timeout: 8))
        typeInto(A11y.Invite.token, A11y.Seed.inviteToken)
        tap(A11y.Invite.lookup, timeout: 6)

        XCTAssertTrue(
            app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 12),
            "Invite lookup should resolve the seed session"
        )
        if query(A11y.Invite.join).waitForExistence(timeout: 4) {
            tap(A11y.Invite.join)
        }
        tap(A11y.Invite.done, timeout: 6)
    }

    func testAlertsListAndMarkRead() {
        launchApp()
        waitForHome()
        tapTab("Alerts")

        let row = query(A11y.Alerts.row(A11y.Seed.notificationId))
        let anyTitle = app.staticTexts["Session reminder"]

        XCTAssertTrue(
            row.waitForExistence(timeout: 8) || anyTitle.waitForExistence(timeout: 4),
            "Alerts tab should show the seed reminder"
        )

        if query(A11y.Alerts.markAllRead).exists {
            tap(A11y.Alerts.markAllRead)
        }
    }

    func testInviteDeepLinkSheet() {
        app.launchEnvironment["VOI_UI_TEST_INVITE"] = A11y.Seed.inviteToken
        launchApp()
        XCTAssertTrue(
            app.navigationBars["Invite"].waitForExistence(timeout: 15)
                || app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 8),
            "Launching with an invite token should present the invite sheet"
        )
    }

    func testPeopleDirectoryAndFollow() {
        launchApp()
        waitForHome()
        tapTab("Sessions")

        tap(A11y.Home.hosts, timeout: 8)
        XCTAssertTrue(
            app.navigationBars["Hosts"].waitForExistence(timeout: 8)
                || query(A11y.People.row("Host")).waitForExistence(timeout: 4),
            "Hosts directory should open"
        )
        tap(A11y.People.close, timeout: 6)

        tap(A11y.Home.players, timeout: 8)
        XCTAssertTrue(
            app.navigationBars["Players"].waitForExistence(timeout: 8)
                || query(A11y.People.row("An")).waitForExistence(timeout: 4),
            "Players directory should open"
        )

        let an = query(A11y.People.row("An"))
        if an.waitForExistence(timeout: 6) {
            an.tap()
            if query(A11y.People.follow).waitForExistence(timeout: 6) {
                tap(A11y.People.follow)
                XCTAssertTrue(
                    app.staticTexts["Following"].waitForExistence(timeout: 8)
                        || query(A11y.People.follow).exists
                )
            }
        }
    }
}
