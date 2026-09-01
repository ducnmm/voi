import Foundation
import CoreLocation

/// Deterministic mock portrait avatar for a person (stable per seed), until the
/// backend serves real avatar URLs. Used as the fallback in `Player.displayAvatarUrl`.
func pravatar(_ seed: String) -> URL? {
    URL(string: "https://i.pravatar.cc/240?u=voi-\(seed)")
}

/// Single source of mock data for the app, modelled like real backend entities
/// so it maps cleanly onto a future API:
///
///   - `users`    — the people in the system. Hosts and players are the **same**
///                  `Player` records, referenced everywhere by id.
///   - `sessions` — events, whose participants/lineups are drawn from `users`.
///   - reviews    — written by a `Player` (the `author`) and attached to a
///                  host/player `PersonProfile`.
///
/// Because everything cross-references the same `Player` records, names and ids
/// stay consistent across the Sessions list, the People screens and reviews.
/// When wiring a real backend, replace each `static let` with a fetched payload.
enum Mock {

    // MARK: - Users

    static let an   = Player(id: "u-an",   displayName: "An",   skillLevel: .intermediate, avatarUrl: pravatar("an"))
    static let binh = Player(id: "u-binh", displayName: "Binh", skillLevel: .intermediate, avatarUrl: pravatar("binh"))
    static let chi  = Player(id: "u-chi",  displayName: "Chi",  skillLevel: .advanced,     avatarUrl: pravatar("chi"))
    static let duy  = Player(id: "u-duy",  displayName: "Duy",  skillLevel: .intermediate, avatarUrl: pravatar("duy"))
    static let hai  = Player(id: "u-hai",  displayName: "Hai",  skillLevel: .intermediate, avatarUrl: pravatar("hai"))
    static let linh = Player(id: "u-linh", displayName: "Linh", skillLevel: .intermediate, avatarUrl: pravatar("linh"))
    static let minh = Player(id: "u-minh", displayName: "Minh", skillLevel: .advanced,     avatarUrl: pravatar("minh"))
    static let tu   = Player(id: "u-tu",   displayName: "Tu",   skillLevel: .intermediate, avatarUrl: pravatar("tu"))
    static let quan = Player(id: "u-quan", displayName: "Quan", skillLevel: .intermediate, avatarUrl: pravatar("quan"))
    static let vy   = Player(id: "u-vy",   displayName: "Vy",   skillLevel: .beginner,     avatarUrl: pravatar("vy"))
    static let khoa = Player(id: "u-khoa", displayName: "Khoa", skillLevel: .beginner,     avatarUrl: pravatar("khoa"))
    static let nga  = Player(id: "u-nga",  displayName: "Nga",  skillLevel: .intermediate, avatarUrl: pravatar("nga"))

    /// The locally signed-in user.
    static let you = Player(id: "u-you", displayName: "You", skillLevel: .intermediate, avatarUrl: pravatar("you"))

    static let users: [Player] = [an, binh, chi, duy, hai, linh, minh, tu, quan, vy, khoa, nga]

    /// Mock map coordinate for a venue (Ho Chi Minh City area).
    static func venueCoordinate(_ venue: String) -> CLLocationCoordinate2D {
        switch venue {
        case "Ky Hoa Badminton": CLLocationCoordinate2D(latitude: 10.7626, longitude: 106.6710)
        case "Phu Tho Sports Center": CLLocationCoordinate2D(latitude: 10.7620, longitude: 106.6540)
        case "Hoa Lu Badminton": CLLocationCoordinate2D(latitude: 10.7872, longitude: 106.7040)
        default: CLLocationCoordinate2D(latitude: 10.7769, longitude: 106.7009)
        }
    }

    /// The signed-in user as a profile (used as the offline default).
    static let currentUserProfile = UserProfile(
        id: you.id,
        email: "you@example.com",
        displayName: you.displayName,
        avatarUrl: you.avatarUrl,
        defaultSkillLevel: you.skillLevel
    )

    // MARK: - Event photos

    /// Deterministic placeholder photos (1...6) for an event, stable per id, so
    /// an event always shows the same set until the backend serves real images.
    static func imageUrls(seed: String) -> [URL] {
        let hash = seed.utf8.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1) }
        let count = Int(hash % 6) + 1 // 1...6
        return (0..<count).compactMap {
            URL(string: "https://picsum.photos/seed/voi-\(seed)-\($0)/900/600")
        }
    }

    // MARK: - Sessions (offline demo)

    static let sessions: [SessionSummary] = [tuesdayNight, sundayRally, fridaySmash, lastWeekSocial]

    /// Full session with a waitlist and a host-set price.
    static let tuesdayNight: SessionSummary = {
        let joined = [an, binh, chi, duy, hai, linh, minh, tu]
        var participants = joined.enumerated().map { Participant.joined($1, paid: $0 % 2 == 0) }
        participants.append(.waitlisted(quan, position: 1))
        participants.append(.waitlisted(vy, position: 2))

        return SessionSummary(
            id: "s-tuesday",
            hostUserId: you.id,
            title: "Tuesday Night Badminton",
            startsAt: Date().addingTimeInterval(60 * 60 * 6),
            endsAt: Date().addingTimeInterval(60 * 60 * 8),
            venueName: "Ky Hoa Badminton",
            courtCount: 2,
            maxPlayers: 8,
            skillLevel: .intermediate,
            feeTotalVnd: nil,
            shuttlecockCostVnd: nil,
            fixedPricePerPlayerVnd: 80_000,
            courts: [
                CourtLineup(id: "s-tuesday-c1", label: "Court 1", players: Array(joined.prefix(4))),
                CourtLineup(id: "s-tuesday-c2", label: "Court 2", players: Array(joined.suffix(4)))
            ],
            participants: participants,
            inviteUrl: "voi://invites/s-tuesday"
        )
    }()

    /// Open session with free slots, host-set price.
    static let sundayRally: SessionSummary = {
        let joined = [khoa, nga, duy, linh, quan]
        let participants = joined.map { Participant.joined($0) }

        return SessionSummary(
            id: "s-sunday",
            hostUserId: you.id,
            title: "Sunday Morning Rally",
            startsAt: Date().addingTimeInterval(60 * 60 * 24 * 4),
            endsAt: Date().addingTimeInterval(60 * 60 * 24 * 4 + 60 * 60 * 2),
            venueName: "Phu Tho Sports Center",
            courtCount: 3,
            maxPlayers: 12,
            skillLevel: .open,
            feeTotalVnd: nil,
            shuttlecockCostVnd: nil,
            fixedPricePerPlayerVnd: 50_000,
            courts: [
                CourtLineup(id: "s-sunday-a", label: "Court A", players: [khoa, nga]),
                CourtLineup(id: "s-sunday-b", label: "Court B", players: []),
                CourtLineup(id: "s-sunday-c", label: "Court C", players: [])
            ],
            participants: participants,
            inviteUrl: "voi://invites/s-sunday"
        )
    }()

    /// Small beginner session that splits the court + shuttle cost instead of a
    /// fixed price (the other pricing mode).
    static let fridaySmash: SessionSummary = {
        let joined = [vy, khoa, hai, tu]
        let participants = joined.map { Participant.joined($0) }

        return SessionSummary(
            id: "s-friday",
            hostUserId: you.id,
            title: "Friday Smash",
            startsAt: Date().addingTimeInterval(60 * 60 * 24 * 3),
            endsAt: Date().addingTimeInterval(60 * 60 * 24 * 3 + 60 * 60 * 2),
            venueName: "Hoa Lu Badminton",
            courtCount: 1,
            maxPlayers: 8,
            skillLevel: .beginner,
            feeTotalVnd: 120_000,
            shuttlecockCostVnd: 30_000,
            courts: [
                CourtLineup(id: "s-friday-c1", label: "Court 1", players: joined)
            ],
            participants: participants,
            inviteUrl: "voi://invites/s-friday"
        )
    }()

    /// A finished session, used to populate the History page in demo mode.
    static let lastWeekSocial: SessionSummary = {
        let joined = [an, binh, chi, duy]
        let participants = joined.map { Participant.joined($0, paid: true) }

        return SessionSummary(
            id: "s-last-week",
            hostUserId: you.id,
            title: "Last Week Social",
            startsAt: Date().addingTimeInterval(-60 * 60 * 24 * 7),
            endsAt: Date().addingTimeInterval(-60 * 60 * 24 * 7 + 60 * 60 * 2),
            venueName: "Ky Hoa Badminton",
            courtCount: 1,
            maxPlayers: 8,
            skillLevel: .intermediate,
            feeTotalVnd: nil,
            shuttlecockCostVnd: nil,
            fixedPricePerPlayerVnd: 60_000,
            courts: [
                CourtLineup(id: "s-last-week-c1", label: "Court 1", players: joined)
            ],
            participants: participants,
            inviteUrl: nil
        )
    }()

    // MARK: - People (hosts & players)

    private static func review(_ id: String, by author: Player, _ rating: Int, _ comment: String, daysAgo: Double) -> Review {
        Review(id: id, author: author, rating: rating, comment: comment, date: Date().addingTimeInterval(-86_400 * daysAgo))
    }

    static let hosts: [PersonProfile] = [
        PersonProfile(player: minh, role: .host, activityCount: 24, reviews: [
            review("rv-minh-1", by: an, 5, "Tổ chức rất chuyên nghiệp, sân đẹp.", daysAgo: 3),
            review("rv-minh-2", by: linh, 4, "Vui, đúng giờ. Sẽ tham gia lại.", daysAgo: 10),
            review("rv-minh-3", by: tu, 5, "Host nhiệt tình, chia cặp hợp lý.", daysAgo: 20),
        ]),
        PersonProfile(player: chi, role: .host, activityCount: 15, reviews: [
            review("rv-chi-1", by: binh, 5, "Buổi tập chất lượng, nhiều người giỏi.", daysAgo: 5),
            review("rv-chi-2", by: nga, 4, "Sân hơi xa nhưng tổ chức tốt.", daysAgo: 14),
        ]),
        PersonProfile(player: tu, role: .host, activityCount: 8, reviews: [
            review("rv-tu-1", by: khoa, 5, "Thân thiện với người mới.", daysAgo: 2),
        ]),
        PersonProfile(player: linh, role: .host, activityCount: 31, reviews: [
            review("rv-linh-1", by: duy, 5, "Một trong những host tốt nhất.", daysAgo: 1),
            review("rv-linh-2", by: vy, 5, "Luôn đúng giờ và vui vẻ.", daysAgo: 8),
            review("rv-linh-3", by: quan, 4, "Giá hợp lý, sẽ quay lại.", daysAgo: 25),
        ]),
    ]

    static let players: [PersonProfile] = [
        PersonProfile(player: an, role: .player, activityCount: 42, reviews: [
            review("rv-an-1", by: minh, 5, "Đánh hay, tinh thần tốt.", daysAgo: 4),
            review("rv-an-2", by: chi, 4, "Chơi fair-play.", daysAgo: 12),
        ]),
        PersonProfile(player: binh, role: .player, activityCount: 28, reviews: [
            review("rv-binh-1", by: linh, 4, "Nhiệt tình, hòa đồng.", daysAgo: 6),
        ]),
        PersonProfile(player: khoa, role: .player, activityCount: 12, reviews: [
            review("rv-khoa-1", by: tu, 5, "Người mới nhưng rất cố gắng.", daysAgo: 9),
        ]),
        PersonProfile(player: nga, role: .player, activityCount: 19, reviews: [
            review("rv-nga-1", by: an, 5, "Phản xạ tốt, đánh đôi ăn ý.", daysAgo: 7),
            review("rv-nga-2", by: binh, 5, "Luôn vui vẻ.", daysAgo: 18),
        ]),
        PersonProfile(player: vy, role: .player, activityCount: 5, reviews: []),
    ]
}
