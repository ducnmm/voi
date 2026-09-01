import Foundation

/// Accessibility identifiers shared by the app and the XCUITest target.
enum A11y {
    enum Onboarding {
        static let next = "onboarding.next"
        static let getStarted = "onboarding.getStarted"
    }

    enum Login {
        static let google = "login.google"
        static let dev = "login.dev"
    }

    enum Tab {
        static let sessions = "tab.sessions"
        static let messages = "tab.messages"
        static let alerts = "tab.alerts"
        static let profile = "tab.profile"
    }

    enum Home {
        static let filter = "home.filter"
        static let map = "home.map"
        static let create = "home.create"
        static let hosts = "home.hosts"
        static let players = "home.players"
        static func card(_ id: String) -> String { "session.card.\(id)" }
    }

    enum Messages {
        static let screen = "messages.screen"
        static let empty = "messages.empty"
        static func group(_ id: String) -> String { "messages.group.\(id)" }
        static func session(_ id: String) -> String { "messages.session.\(id)" }
    }

    enum Filter {
        static let upcoming = "filter.upcoming"
        static let past = "filter.past"
        static let done = "filter.done"
        static let clear = "filter.clear"
        static let available = "filter.available"
        static let saved = "filter.saved"
    }

    enum Map {
        static let done = "map.done"
        static let screen = "map.screen"
    }

    enum Session {
        static let save = "session.save"
        static let chat = "session.chat"
        static let more = "session.more"
        static let join = "session.rsvp.join"
        static let maybe = "session.rsvp.maybe"
        static let decline = "session.rsvp.decline"
        static let pay = "session.pay"
        static let lineupEdit = "session.lineup.edit"
        static let addScore = "session.score.add"
        static let share = "session.share"
        static let edit = "session.edit"
        static let duplicate = "session.duplicate"
        static let cancel = "session.cancel"
        static let cancelled = "session.cancelled"
        static let calendar = "session.calendar"
        static let cost = "session.cost"
        static let waitlist = "session.waitlist"
        static let attendance = "session.attendance"
        static func checkIn(_ name: String) -> String { "session.checkin.\(name)" }
        static func rate(_ name: String) -> String { "session.rate.\(name)" }
        static func paymentRow(_ name: String) -> String { "session.payment.\(name)" }
        static func courtPlayer(_ name: String) -> String { "session.player.\(name)" }
    }

    enum Chat {
        static let input = "chat.input"
        static let send = "chat.send"
        static let screen = "chat.screen"
    }

    enum Create {
        static let title = "create.title"
        static let venue = "create.venue"
        static let submit = "create.submit"
        static let cancel = "create.cancel"
    }

    enum Profile {
        static let createEvent = "profile.createEvent"
        static let manageEvents = "profile.manageEvents"
        static let displayName = "profile.displayName"
        static let save = "profile.save"
        static let settings = "profile.settings"
    }

    enum Settings {
        static let reminders = "settings.reminders"
        static let statusChanges = "settings.statusChanges"
        static let waitlist = "settings.waitlist"
        static let signOut = "settings.signOut"
        static let deleteAccount = "settings.deleteAccount"
    }

    enum Alerts {
        static let openInvite = "alerts.openInvite"
        static let markAllRead = "alerts.markAllRead"
        static let empty = "alerts.empty"
        static func row(_ id: String) -> String { "alerts.row.\(id)" }
    }

    enum Invite {
        static let token = "invite.token"
        static let lookup = "invite.lookup"
        static let join = "invite.join"
        static let done = "invite.done"
    }

    enum Payment {
        static let paid = "payment.paid"
        static let cancel = "payment.cancel"
        static let amount = "payment.amount"
    }

    enum People {
        static let close = "people.close"
        static let follow = "people.follow"
        static func row(_ name: String) -> String { "people.row.\(name)" }
    }

    enum Lineup {
        static func player(_ name: String) -> String { "lineup.player.\(name)" }
    }

    enum Score {
        static let label = "score.label"
        static let save = "score.save"
        static let cancel = "score.cancel"
    }

    enum Review {
        static let comment = "review.comment"
        static let submit = "review.submit"
        static let cancel = "review.cancel"
        static func star(_ n: Int) -> String { "review.star.\(n)" }
    }

    enum Seed {
        static let groupId = "seed-group-tuesday-night"
        static let sessionId = "seed-session-tuesday-night"
        static let pastSessionId = "seed-session-last-week"
        static let groupOnlySessionId = "seed-session-group-only"
        static let sessionTitle = "Tuesday Night Badminton"
        static let pastSessionTitle = "Last Week Smash"
        static let groupOnlyTitle = "Members Only Smash"
        static let inviteToken = "seed-tuesday-night"
        static let groupOnlyInviteToken = "seed-group-only"
        static let notificationId = "seed-notification-reminder"
        static let hostEmail = "host@example.com"
        static let playerEmail = "an@example.com"
        static let waitlistedEmail = "quan@example.com"
        static let unansweredEmail = "vy@example.com"
    }
}
