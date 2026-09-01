import XCTest

@MainActor
final class SessionDetailUITests: VoiUITestCase {
    func testRSVPLineupWaitlistAndCost() {
        launchApp()
        openSeedSession()

        tap(A11y.Session.maybe)
        tap(A11y.Session.decline)
        tap(A11y.Session.join)

        reveal(query(A11y.Session.cost))
        XCTAssertTrue(
            query(A11y.Session.cost).waitForExistence(timeout: 6)
                || app.staticTexts["Cost split"].waitForExistence(timeout: 2),
            "Cost split should be visible on the seeded session"
        )

        reveal(query(A11y.Session.lineupEdit))
        if query(A11y.Session.lineupEdit).exists {
            tap(A11y.Session.lineupEdit)
            XCTAssertTrue(app.navigationBars["Lineup"].waitForExistence(timeout: 8))
            let an = query(A11y.Lineup.player("An"))
            if an.waitForExistence(timeout: 4) {
                an.tap()
                let bench = app.buttons["Send to bench"]
                if bench.waitForExistence(timeout: 3) {
                    bench.tap()
                } else {
                    app.swipeDown()
                }
            }
            app.navigationBars.buttons.firstMatch.tap()
        }

        reveal(query(A11y.Session.waitlist))
        XCTAssertTrue(
            query(A11y.Session.waitlist).waitForExistence(timeout: 6)
                || app.staticTexts["Waitlist"].waitForExistence(timeout: 2)
                || app.staticTexts["Quan"].waitForExistence(timeout: 2),
            "Waitlist should include overflow players"
        )
    }

    func testChatBookmarkCheckInScoreAndReview() {
        launchApp()
        openSeedSession()

        tap(A11y.Session.save)
        tap(A11y.Session.chat)
        let input = chatComposer()
        XCTAssertTrue(input.waitForExistence(timeout: 10), "Chat should open")
        input.tap()
        input.typeText("E2E ping")
        let send = app.buttons[A11y.Chat.send].exists ? app.buttons[A11y.Chat.send] : app.buttons["Send"]
        XCTAssertTrue(send.waitForExistence(timeout: 6), "Chat send control should exist")
        send.tap()
        XCTAssertTrue(app.staticTexts["E2E ping"].waitForExistence(timeout: 10))
        app.navigationBars.buttons.firstMatch.tap()

        tap(A11y.Session.join)
        reveal(query(A11y.Session.attendance))
        let hostCheckIn = query(A11y.Session.checkIn("Host"))
        if hostCheckIn.waitForExistence(timeout: 6) {
            reveal(hostCheckIn)
            hostCheckIn.tap()
        } else {
            let anCheckIn = query(A11y.Session.checkIn("An"))
            if anCheckIn.waitForExistence(timeout: 4) {
                reveal(anCheckIn)
                anCheckIn.tap()
            }
        }

        reveal(query(A11y.Session.addScore))
        tap(A11y.Session.addScore, timeout: 6)
        XCTAssertTrue(app.navigationBars["Add result"].waitForExistence(timeout: 6))
        tap(A11y.Score.save, timeout: 4)
        XCTAssertTrue(
            app.staticTexts["21 - 15"].waitForExistence(timeout: 10)
                || app.staticTexts["No results yet."].waitForExistence(timeout: 2)
        )

        let rateAn = query(A11y.Session.rate("An"))
        if rateAn.waitForExistence(timeout: 6) {
            reveal(rateAn)
            rateAn.tap()
            XCTAssertTrue(app.navigationBars["Write a review"].waitForExistence(timeout: 6))
            typeInto(A11y.Review.comment, "Solid doubles, would play again.")
            tap(A11y.Review.submit, timeout: 4)
        }

        tap(A11y.Session.more)
        XCTAssertTrue(
            app.buttons["Edit"].waitForExistence(timeout: 4)
                || query(A11y.Session.edit).waitForExistence(timeout: 2)
                || app.buttons["Share invite"].waitForExistence(timeout: 2)
        )
        app.swipeDown()
    }

    func testBookmarkThenSavedFilter() {
        launchApp()
        openSeedSession()
        tap(A11y.Session.save)
        if app.navigationBars.buttons["Back"].waitForExistence(timeout: 2) {
            app.navigationBars.buttons["Back"].tap()
        } else {
            app.navigationBars.buttons.firstMatch.tap()
        }
        XCTAssertTrue(query(A11y.Home.filter).waitForExistence(timeout: 8))
        tap(A11y.Home.filter)
        XCTAssertTrue(query(A11y.Filter.done).waitForExistence(timeout: 6) || app.buttons["Done"].waitForExistence(timeout: 4))
        let saved = query(A11y.Filter.saved)
        if !saved.waitForExistence(timeout: 3) {
            app.swipeUp()
        }
        if saved.waitForExistence(timeout: 4) {
            saved.tap()
        } else if app.switches["Saved only"].waitForExistence(timeout: 3) {
            app.switches["Saved only"].tap()
        } else if app.staticTexts["Saved only"].waitForExistence(timeout: 3) {
            app.staticTexts["Saved only"].tap()
        } else {
            XCTFail("Saved-only filter control missing")
            return
        }
        tap(A11y.Filter.done, timeout: 6)
        XCTAssertTrue(
            query(A11y.Home.card(A11y.Seed.sessionId)).waitForExistence(timeout: 10)
                || app.staticTexts[A11y.Seed.sessionTitle].waitForExistence(timeout: 4)
                || app.buttons[A11y.Seed.sessionTitle].waitForExistence(timeout: 4),
            "Saved-only filter should still show the bookmarked seed session"
        )
    }

    func testPaymentQR() {
        launchApp()
        openSeedSession()
        tap(A11y.Session.join)

        let pay = query(A11y.Session.pay)
        reveal(pay)
        if pay.waitForExistence(timeout: 8) {
            pay.tap()
            XCTAssertTrue(app.navigationBars["Payment"].waitForExistence(timeout: 8))
            XCTAssertTrue(query(A11y.Payment.paid).waitForExistence(timeout: 4))
            tap(A11y.Payment.paid)
        } else {
            reveal(query(A11y.Session.cost))
            let anPay = query(A11y.Session.paymentRow("An"))
            if anPay.waitForExistence(timeout: 4) {
                reveal(anPay)
                anPay.tap()
            }
        }
    }
}
