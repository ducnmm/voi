import SwiftUI

struct AppNotification: Identifiable, Hashable {
    enum Kind: Hashable {
        case reminder
        case rsvp
        case waitlist
        case payment
        case cancellation

        var systemImage: String {
            switch self {
            case .reminder: "clock.badge"
            case .rsvp: "person.crop.circle.badge.checkmark"
            case .waitlist: "arrow.up.circle"
            case .payment: "banknote"
            case .cancellation: "xmark.octagon"
            }
        }

        var tint: Color {
            switch self {
            case .reminder: VoiColor.court
            case .rsvp: VoiColor.court
            case .waitlist: VoiColor.accent
            case .payment: VoiColor.accent
            case .cancellation: .red
            }
        }
    }

    let id: String
    let kind: Kind
    let title: String
    let message: String
    let createdAt: Date
    var isRead: Bool

    var relativeTime: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: createdAt, relativeTo: Date())
    }
}

extension AppNotification {
    static let samples: [AppNotification] = [
        AppNotification(
            id: "n1",
            kind: .reminder,
            title: "Tonight at 18:00",
            message: "Tuesday Night Badminton starts in 6 hours at Ky Hoa Badminton.",
            createdAt: Date().addingTimeInterval(-60 * 30),
            isRead: false
        ),
        AppNotification(
            id: "n2",
            kind: .waitlist,
            title: "You're in!",
            message: "A spot opened up and you were promoted from the waitlist for Sunday Morning Rally.",
            createdAt: Date().addingTimeInterval(-60 * 60 * 3),
            isRead: false
        ),
        AppNotification(
            id: "n3",
            kind: .rsvp,
            title: "Chi joined",
            message: "Chi is now in for Tuesday Night Badminton.",
            createdAt: Date().addingTimeInterval(-60 * 60 * 8),
            isRead: true
        ),
        AppNotification(
            id: "n4",
            kind: .payment,
            title: "Payment reminder",
            message: "30.000 VND still owed for Friday Smash. Tap to mark as paid.",
            createdAt: Date().addingTimeInterval(-60 * 60 * 26),
            isRead: true
        ),
        AppNotification(
            id: "n5",
            kind: .cancellation,
            title: "Session moved",
            message: "Sunday Morning Rally now starts 30 minutes later.",
            createdAt: Date().addingTimeInterval(-60 * 60 * 50),
            isRead: true
        )
    ]
}
