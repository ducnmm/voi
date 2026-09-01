import XCTest

@MainActor
final class SessionsFeedUITests: VoiUITestCase {
    func testGroupChatOpensFromMessages() {
        launchApp()
        waitForHome()
        tapTab("Messages")
        tap(A11y.Messages.group(A11y.Seed.groupId), timeout: 10)
        XCTAssertTrue(
            query(A11y.Chat.screen).waitForExistence(timeout: 8)
                || query(A11y.Chat.input).waitForExistence(timeout: 4)
                || app.navigationBars["Tuesday Night Badminton"].waitForExistence(timeout: 4),
            "Group chat should open from the Messages tab"
        )
    }

    func testMessagesListsGroupAndSessionChats() {
        launchApp()
        waitForHome()
        tapTab("Messages")
        XCTAssertTrue(
            query(A11y.Messages.group(A11y.Seed.groupId)).waitForExistence(timeout: 10),
            "Messages should list the seed group chat"
        )
        XCTAssertTrue(
            query(A11y.Messages.session(A11y.Seed.sessionId)).waitForExistence(timeout: 8)
                || app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 4),
            "Messages should list the seed session chat"
        )
    }

    func testHomeCreateButtonOpensForm() {
        launchApp()
        waitForHome()
        tapTab("Sessions")
        tap(A11y.Home.create, timeout: 8)
        XCTAssertTrue(
            app.navigationBars["New Session"].waitForExistence(timeout: 8),
            "Home + should open the create session form"
        )
    }

    func testFeedShowsSeedSession() {
        launchApp()
        waitForHome()
        tapTab("Sessions")

        let card = query(A11y.Home.card(A11y.Seed.sessionId))
        XCTAssertTrue(
            card.waitForExistence(timeout: 15) || app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 4),
            "Expected the seeded Tuesday Night session on the home feed"
        )
        XCTAssertTrue(query(A11y.Home.filter).exists)
        XCTAssertTrue(query(A11y.Home.map).exists)
    }

    func testFilterPastSessionsAndMap() {
        launchApp()
        waitForHome()
        tapTab("Sessions")

        tap(A11y.Home.filter)
        tap(A11y.Filter.past, timeout: 6)
        tap(A11y.Filter.done, timeout: 6)

        let pastCard = query(A11y.Home.card(A11y.Seed.pastSessionId))
        XCTAssertTrue(
            pastCard.waitForExistence(timeout: 12)
                || app.staticTexts[A11y.Seed.pastSessionTitle].waitForExistence(timeout: 4),
            "Past filter should show Last Week Smash"
        )

        tap(A11y.Home.filter)
        tap(A11y.Filter.upcoming, timeout: 6)
        if query(A11y.Filter.available).exists {
            tap(A11y.Filter.available)
        }
        tap(A11y.Filter.done, timeout: 6)

        tap(A11y.Home.map)
        XCTAssertTrue(
            app.navigationBars["Nearby"].waitForExistence(timeout: 8)
                || query(A11y.Map.done).waitForExistence(timeout: 4),
            "Map browse should open"
        )
        if query(A11y.Map.done).exists {
            tap(A11y.Map.done)
        } else if app.buttons["Done"].exists {
            app.buttons["Done"].tap()
        }
    }
}
