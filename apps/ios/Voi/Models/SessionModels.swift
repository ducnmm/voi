import CoreLocation
import SwiftUI

enum SkillLevel: String, Codable, CaseIterable, Identifiable {
    case beginner = "BEGINNER"
    case intermediate = "INTERMEDIATE"
    case advanced = "ADVANCED"
    case open = "OPEN"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .beginner: "Beginner"
        case .intermediate: "Intermediate"
        case .advanced: "Advanced"
        case .open: "Open"
        }
    }
}

enum RsvpStatus: String, Codable {
    case joined = "JOINED"
    case maybe = "MAYBE"
    case declined = "DECLINED"
    case waitlisted = "WAITLISTED"
    case cancelled = "CANCELLED"

    var label: String {
        switch self {
        case .joined: "Joined"
        case .maybe: "Maybe"
        case .declined: "Can't go"
        case .waitlisted: "Waitlisted"
        case .cancelled: "Cancelled"
        }
    }
}

enum PaymentStatus: String, Codable {
    case notRequired = "NOT_REQUIRED"
    case unpaid = "UNPAID"
    case paid = "PAID"
}

struct Player: Identifiable, Hashable {
    let id: String
    let displayName: String
    let skillLevel: SkillLevel
    var avatarUrl: URL? = nil

    var initials: String {
        String(displayName.prefix(1)).uppercased()
    }

    /// Avatar to display: the real URL if set, otherwise a deterministic mock
    /// portrait so every player shows a photo until the backend serves avatars.
    var displayAvatarUrl: URL? {
        avatarUrl ?? pravatar(id)
    }
}

struct Participant: Identifiable, Hashable {
    let id: String
    let player: Player
    var rsvpStatus: RsvpStatus
    var waitlistPosition: Int?
    var hasPaid: Bool
    var isCheckedIn: Bool = false
}

extension Participant {
    static func joined(_ player: Player, paid: Bool = false) -> Participant {
        Participant(id: "p-\(player.id)", player: player, rsvpStatus: .joined, waitlistPosition: nil, hasPaid: paid)
    }

    static func waitlisted(_ player: Player, position: Int) -> Participant {
        Participant(id: "p-\(player.id)", player: player, rsvpStatus: .waitlisted, waitlistPosition: position, hasPaid: false)
    }
}

struct CourtLineup: Identifiable, Hashable {
    let id: String
    let label: String
    var players: [Player]
}

struct SessionSummary: Identifiable, Hashable {
    let id: String
    var groupId: String? = nil
    /// Server host user id — used for host-only UI gates.
    var hostUserId: String = ""
    var title: String
    var startsAt: Date
    var endsAt: Date
    var venueName: String
    var courtCount: Int
    var maxPlayers: Int
    var skillLevel: SkillLevel
    var feeTotalVnd: Int?
    var shuttlecockCostVnd: Int?
    /// When set, every player pays this fixed amount (host-set price); otherwise
    /// the cost is split from the court + shuttlecock total.
    var fixedPricePerPlayerVnd: Int? = nil
    /// When false, hide payment tracking UI (server `costTrackingEnabled`).
    var costTrackingEnabled: Bool = true
    var venueLat: Double? = nil
    var venueLng: Double? = nil
    var courts: [CourtLineup]
    var participants: [Participant]
    /// Feed/invite payloads omit participant rows; counts then come from the server summary.
    var listedJoinedPlayerCount: Int? = nil
    var listedWaitlistCount: Int? = nil
    var inviteUrl: String?
    /// Event photos. When empty, `photos` falls back to deterministic mock images.
    var imageUrls: [URL] = []
    var isCancelled: Bool = false
}

// MARK: - Status

enum SessionStatus {
    case open, fillingUp, full, soon, ended, cancelled
}

extension SessionSummary {
    var status: SessionStatus {
        if isCancelled { return .cancelled }
        if endsAt < Date() { return .ended }
        if isFull { return .full }
        if availableSlots <= 2 { return .fillingUp }
        if startsAt.timeIntervalSinceNow <= 60 * 60 * 24 { return .soon }
        return .open
    }
}

// MARK: - Derived values

extension SessionSummary {
    var joinedParticipants: [Participant] {
        participants.filter { $0.rsvpStatus == .joined }
    }

    var joinedPlayerCount: Int {
        if participants.isEmpty, let listedJoinedPlayerCount {
            return listedJoinedPlayerCount
        }
        return joinedParticipants.count
    }

    var waitlist: [Participant] {
        participants
            .filter { $0.rsvpStatus == .waitlisted }
            .sorted { ($0.waitlistPosition ?? .max) < ($1.waitlistPosition ?? .max) }
    }

    var waitlistCount: Int {
        if participants.isEmpty, let listedWaitlistCount {
            return listedWaitlistCount
        }
        return waitlist.count
    }

    var paidCount: Int { joinedParticipants.filter { $0.hasPaid }.count }

    var availableSlots: Int {
        max(maxPlayers - joinedPlayerCount, 0)
    }

    var isFull: Bool { joinedPlayerCount >= maxPlayers }

    /// Joined players that are not yet placed on any court.
    var benchPlayers: [Player] {
        let assigned = Set(courts.flatMap { $0.players.map(\.id) })
        return joinedParticipants
            .map(\.player)
            .filter { !assigned.contains($0.id) }
    }

    var totalCostVnd: Int {
        if let fixedPricePerPlayerVnd {
            return fixedPricePerPlayerVnd * joinedPlayerCount
        }
        return (feeTotalVnd ?? 0) + (shuttlecockCostVnd ?? 0)
    }

    var perPlayerCostVnd: Int? {
        if let fixedPricePerPlayerVnd { return fixedPricePerPlayerVnd }
        guard joinedPlayerCount > 0 else { return nil }
        return Int(ceil(Double(totalCostVnd) / Double(joinedPlayerCount)))
    }

    /// Map pin for the venue. Prefers server lat/lng; falls back to mock coords.
    var mapCoordinate: CLLocationCoordinate2D {
        if let venueLat, let venueLng {
            return CLLocationCoordinate2D(latitude: venueLat, longitude: venueLng)
        }
        return Mock.venueCoordinate(venueName)
    }
}

// MARK: - Display helpers

extension SessionSummary {
    /// Photos to show in the UI. Falls back to deterministic mock images so a
    /// card always has at least one photo until the backend serves real ones.
    var photos: [URL] {
        imageUrls.isEmpty ? Mock.imageUrls(seed: id) : imageUrls
    }

    /// "07:00-09:00"
    var timeRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return "\(formatter.string(from: startsAt))-\(formatter.string(from: endsAt))"
    }

    /// Localised weekday + day + month, e.g. "Sat, 28 Jun" / "Th 7, 28 thg 6".
    var dateLabel: String {
        let formatter = DateFormatter()
        formatter.locale = .appLanguage
        formatter.setLocalizedDateFormatFromTemplate("EEEdMMM")
        return formatter.string(from: startsAt)
    }

    /// "3 slots left" or "Full" — shown on the card.
    var slotsLabel: String {
        if isFull {
            return NSLocalizedString("Full", comment: "session is full")
        }
        return String(
            format: NSLocalizedString("%lld slots left", comment: "available slots"),
            availableSlots
        )
    }
}

// MARK: - Filtering

/// Criteria used to narrow the Sessions list. An empty filter matches everything.
struct SessionFilter: Equatable {
    var skillLevels: Set<SkillLevel> = []
    var venues: Set<String> = []
    var availableOnly = false

    var isActive: Bool {
        !skillLevels.isEmpty || !venues.isEmpty || availableOnly
    }

    func matches(_ session: SessionSummary) -> Bool {
        if !skillLevels.isEmpty, !skillLevels.contains(session.skillLevel) { return false }
        if !venues.isEmpty, !venues.contains(session.venueName) { return false }
        if availableOnly, session.isFull { return false }
        return true
    }
}

// MARK: - Chat & scores

struct ChatMessage: Identifiable, Hashable {
    let id: String
    let author: Player
    let text: String
    let date: Date
}

struct MatchScore: Identifiable, Hashable {
    let id: String
    let label: String
    let scoreA: Int
    let scoreB: Int
}

enum SortOrder: String, CaseIterable, Identifiable {
    case date, price, spots
    var id: String { rawValue }
    var label: LocalizedStringKey {
        switch self {
        case .date: "Date"
        case .price: "Price"
        case .spots: "Open spots"
        }
    }
}

// MARK: - People

/// A rating + comment left by one `Player` (the author) for a host or player.
struct Review: Identifiable, Hashable {
    let id: String
    let author: Player
    let rating: Int        // 1...5
    let comment: String
    let date: Date

    var authorName: String { author.displayName }
    var authorInitials: String { author.initials }
}

/// A host or player profile shown on the People screens. Wraps the underlying
/// `Player` so names/ids stay consistent with sessions and reviews.
struct PersonProfile: Identifiable, Hashable {
    enum Role { case host, player }

    let player: Player
    let role: Role
    /// Sessions hosted (for a host) or events joined (for a player).
    let activityCount: Int
    var reviews: [Review]
    /// Server-supplied stats (used by the directory, where reviews aren't loaded).
    var ratingOverride: Double? = nil
    var reviewCountOverride: Int? = nil

    var id: String { "\(role == .host ? "host" : "player")-\(player.id)" }
    var name: String { player.displayName }
    var initials: String { player.initials }

    var reviewCount: Int { reviewCountOverride ?? reviews.count }

    var averageRating: Double {
        if let ratingOverride { return ratingOverride }
        guard !reviews.isEmpty else { return 0 }
        return Double(reviews.map(\.rating).reduce(0, +)) / Double(reviews.count)
    }
}

// MARK: - Mock mutations (client-side, no backend)

extension SessionSummary {
    /// Apply an RSVP for a player, creating the participant if needed, then
    /// re-balance joined vs. waitlist against capacity.
    mutating func setRSVP(_ status: RsvpStatus, for player: Player) {
        if let index = participants.firstIndex(where: { $0.player.id == player.id }) {
            participants[index].rsvpStatus = status
            if status != .waitlisted {
                participants[index].waitlistPosition = nil
            }
        } else {
            participants.append(
                Participant(
                    id: "me-\(player.id)",
                    player: player,
                    rsvpStatus: status,
                    waitlistPosition: nil,
                    hasPaid: false
                )
            )
        }
        normalizeRoster()
    }

    mutating func togglePayment(participantId: String) {
        guard let index = participants.firstIndex(where: { $0.id == participantId }) else { return }
        participants[index].hasPaid.toggle()
    }

    mutating func assign(playerId: String, toCourt courtId: String) {
        removeFromCourts(playerId: playerId)
        guard
            let player = participants.first(where: { $0.player.id == playerId })?.player,
            let courtIndex = courts.firstIndex(where: { $0.id == courtId })
        else { return }
        courts[courtIndex].players.append(player)
    }

    mutating func removeFromCourts(playerId: String) {
        for index in courts.indices {
            courts[index].players.removeAll { $0.id == playerId }
        }
    }

    /// Keep joined count within capacity, promote the waitlist into open
    /// slots, renumber the waitlist, and drop unjoined players from courts.
    private mutating func normalizeRoster() {
        var joined = participants.filter { $0.rsvpStatus == .joined }
        var waitlisted = participants
            .filter { $0.rsvpStatus == .waitlisted }
            .sorted { ($0.waitlistPosition ?? .max) < ($1.waitlistPosition ?? .max) }
        let others = participants.filter {
            $0.rsvpStatus != .joined && $0.rsvpStatus != .waitlisted
        }

        while joined.count > maxPlayers {
            waitlisted.insert(joined.removeLast(), at: 0)
        }
        while joined.count < maxPlayers, !waitlisted.isEmpty {
            waitlisted[0].rsvpStatus = .joined
            waitlisted[0].waitlistPosition = nil
            joined.append(waitlisted.removeFirst())
        }

        for index in joined.indices {
            joined[index].rsvpStatus = .joined
            joined[index].waitlistPosition = nil
        }
        for index in waitlisted.indices {
            waitlisted[index].rsvpStatus = .waitlisted
            waitlisted[index].waitlistPosition = index + 1
        }

        participants = joined + waitlisted + others

        let joinedIds = Set(joined.map { $0.player.id })
        for index in courts.indices {
            courts[index].players.removeAll { !joinedIds.contains($0.id) }
        }
    }
}

// MARK: - DTO mapping

extension SessionSummary {
    init(dto: SessionDTO, inviteUrl: String? = nil) {
        let mappedParticipants = (dto.participants ?? []).map(Participant.init(dto:))
        let playersByParticipantId = Dictionary(
            uniqueKeysWithValues: mappedParticipants.map { ($0.id, $0.player) }
        )

        id = dto.id
        groupId = dto.groupId
        hostUserId = dto.hostUserId
        title = dto.title?.isEmpty == false ? dto.title! : dto.venueName
        startsAt = APIDateFormatter.date(from: dto.startsAt)
        endsAt = APIDateFormatter.date(from: dto.endsAt)
        venueName = dto.venueName
        courtCount = dto.courtCount
        maxPlayers = dto.maxPlayers
        skillLevel = dto.skillLevel
        feeTotalVnd = dto.feeTotalVnd
        shuttlecockCostVnd = dto.shuttlecockCostVnd
        // Fixed price from server; prefer explicit feePerPlayerVnd over recomputing.
        fixedPricePerPlayerVnd = dto.feePerPlayerVnd
        costTrackingEnabled = dto.costTrackingEnabled ?? true
        venueLat = dto.venueLat
        venueLng = dto.venueLng
        participants = mappedParticipants
        listedJoinedPlayerCount = dto.summary.joinedPlayerCount
        listedWaitlistCount = dto.summary.waitlistCount
        courts = (dto.courts ?? [])
            .sorted { $0.sortOrder < $1.sortOrder }
            .map { court in
                CourtLineup(
                    id: court.id,
                    label: court.label,
                    players: court.lineupSlots
                        .sorted { $0.slotOrder < $1.slotOrder }
                        .map { slot in
                            playersByParticipantId[slot.participantId]
                                ?? Player(
                                    id: slot.user.id,
                                    displayName: slot.user.displayName,
                                    skillLevel: .open,
                                    avatarUrl: slot.user.avatarUrl
                                )
                        }
                )
            }
        self.inviteUrl = inviteUrl ?? dto.inviteUrlToken.map { "voi://invites/\($0)" }
        imageUrls = dto.imageUrls ?? []
        isCancelled = dto.status == "CANCELLED"
    }
}

extension Participant {
    init(dto: SessionDTO.Participant) {
        id = dto.id
        player = Player(
            id: dto.user.id,
            displayName: dto.user.displayName,
            skillLevel: dto.user.defaultSkillLevel ?? .open,
            avatarUrl: dto.user.avatarUrl
        )
        rsvpStatus = dto.rsvpStatus
        waitlistPosition = dto.waitlistPosition
        hasPaid = dto.paymentStatus == .paid
        isCheckedIn = dto.checkedInAt != nil
    }
}

// MARK: - Create draft

struct CreateSessionDraft {
    let title: String
    let venueName: String
    let startsAt: Date
    let endsAt: Date
    let courtCount: Int
    let maxPlayers: Int
    let feeTotalVnd: Int
    let shuttlecockCostVnd: Int
    let skillLevel: SkillLevel
    let fixedPricePerPlayerVnd: Int?
    var repeatsWeekly: Bool = false
    var imageUrls: [String] = []

    func shifted(byWeeks weeks: Int) -> CreateSessionDraft {
        let offset = TimeInterval(weeks * 7 * 24 * 60 * 60)
        return CreateSessionDraft(
            title: title,
            venueName: venueName,
            startsAt: startsAt.addingTimeInterval(offset),
            endsAt: endsAt.addingTimeInterval(offset),
            courtCount: courtCount,
            maxPlayers: maxPlayers,
            feeTotalVnd: feeTotalVnd,
            shuttlecockCostVnd: shuttlecockCostVnd,
            skillLevel: skillLevel,
            fixedPricePerPlayerVnd: fixedPricePerPlayerVnd,
            repeatsWeekly: false,
            imageUrls: imageUrls
        )
    }

    var request: CreateSessionRequest {
        let fixed = fixedPricePerPlayerVnd
        return CreateSessionRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : title,
            startsAt: APIDateFormatter.string(from: startsAt),
            endsAt: APIDateFormatter.string(from: endsAt),
            venueName: venueName,
            venueNote: nil,
            courtCount: courtCount,
            maxPlayers: maxPlayers,
            // When fixed price is set, omit split fees so the server uses feePerPlayerVnd.
            feeTotalVnd: fixed == nil ? feeTotalVnd : nil,
            shuttlecockCostVnd: fixed == nil ? shuttlecockCostVnd : nil,
            skillLevel: skillLevel,
            visibility: "PRIVATE_LINK",
            costTrackingEnabled: true,
            feePerPlayerVnd: fixed,
            venueLat: nil,
            venueLng: nil,
            imageUrls: imageUrls
        )
    }

    var updateRequest: UpdateSessionRequest {
        let fixed = fixedPricePerPlayerVnd
        return UpdateSessionRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : title,
            startsAt: APIDateFormatter.string(from: startsAt),
            endsAt: APIDateFormatter.string(from: endsAt),
            venueName: venueName,
            courtCount: courtCount,
            maxPlayers: maxPlayers,
            feeTotalVnd: fixed == nil ? feeTotalVnd : nil,
            shuttlecockCostVnd: fixed == nil ? shuttlecockCostVnd : nil,
            skillLevel: skillLevel,
            feePerPlayerVnd: fixed,
            imageUrls: imageUrls
        )
    }
}

enum CurrencyFormatter {
    static func vnd(_ amount: Int?) -> String {
        guard let amount else {
            return "Not set"
        }

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "VND"
        formatter.maximumFractionDigits = 0
        formatter.locale = Locale(identifier: "vi_VN")
        return formatter.string(from: NSNumber(value: amount)) ?? "\(amount) VND"
    }
}
