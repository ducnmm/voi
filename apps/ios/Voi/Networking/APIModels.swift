import Foundation

struct UserProfile: Codable, Identifiable, Hashable {
    let id: String
    let email: String
    let displayName: String
    let avatarUrl: URL?
    let defaultSkillLevel: SkillLevel
}

struct DevLoginRequest: Codable {
    let email: String
    let displayName: String?
}

struct DevLoginResponse: Codable {
    let token: String
    let accessToken: String?
    let refreshToken: String?
    let user: UserProfile
}

struct GoogleLoginRequest: Codable {
    let idToken: String
}

struct GoogleAuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: UserProfile
}

struct RefreshRequest: Codable {
    let refreshToken: String
}

struct RefreshResponse: Codable {
    let accessToken: String
    let refreshToken: String
}

struct MeResponse: Codable {
    let user: UserProfile
}

struct OkResponse: Codable {
    let ok: Bool
}

struct GroupsResponse: Codable {
    let groups: [GroupSummary]
}

struct CreateGroupResponse: Codable {
    let group: GroupSummary
}

struct GroupSummary: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String?
    let defaultVenueName: String?
    let defaultSkillLevel: SkillLevel
    let currency: String
    let memberCount: Int
    let upcomingSessionCount: Int?
}

struct GroupDetailResponse: Codable {
    let group: GroupDetail
}

struct GroupDetail: Codable, Identifiable, Hashable {
    struct Member: Codable, Identifiable, Hashable {
        struct User: Codable, Identifiable, Hashable {
            let id: String
            let displayName: String
            let avatarUrl: URL?
            let defaultSkillLevel: SkillLevel
        }

        let id: String
        let role: String
        let user: User
    }

    struct SessionReference: Codable, Identifiable, Hashable {
        let id: String
        let title: String?
        let startsAt: String
        let endsAt: String
        let venueName: String
        let courtCount: Int
        let maxPlayers: Int
        let status: String
    }

    let id: String
    let name: String
    let description: String?
    let defaultVenueName: String?
    let defaultSkillLevel: SkillLevel
    let currency: String
    let members: [Member]
    let sessions: [SessionReference]
}

struct CreateGroupRequest: Codable {
    let name: String
    let description: String?
    let defaultVenueName: String?
    let defaultSkillLevel: SkillLevel
}

struct CreateSessionRequest: Codable {
    let title: String?
    let startsAt: String
    let endsAt: String
    let venueName: String
    let venueNote: String?
    let courtCount: Int
    let maxPlayers: Int?
    let feeTotalVnd: Int?
    let shuttlecockCostVnd: Int?
    let skillLevel: SkillLevel
    let visibility: String
    let costTrackingEnabled: Bool?
    let feePerPlayerVnd: Int?
    let venueLat: Double?
    let venueLng: Double?
    let imageUrls: [String]?
}

struct UpdateProfileRequest: Codable {
    let displayName: String?
    let avatarUrl: String?
    let defaultSkillLevel: SkillLevel?
}

struct NotificationPreferenceDTO: Codable {
    let remindersEnabled: Bool
    let statusChangesEnabled: Bool
    let waitlistEnabled: Bool
    let reminderLeadMinutes: Int
}

struct NotificationPreferenceResponse: Codable {
    let preference: NotificationPreferenceDTO
}

struct UpdateNotificationPreferenceRequest: Codable {
    let remindersEnabled: Bool?
    let statusChangesEnabled: Bool?
    let waitlistEnabled: Bool?
    let reminderLeadMinutes: Int?
}

struct InvitePreviewResponse: Codable {
    let invite: InvitePreview
}

struct InvitePreview: Codable {
    struct GroupRef: Codable {
        let id: String
        let name: String
    }

    let id: String
    let token: String
    let group: GroupRef?
    let session: SessionDTO?
}

struct AcceptInviteResponse: Codable {
    struct GroupRef: Codable {
        let id: String
        let name: String
    }

    let group: GroupRef
    let session: SessionDTO?
}

struct CreateSessionResponse: Codable {
    let session: SessionDTO
    let inviteUrl: String
}

struct SessionResponse: Codable {
    let session: SessionDTO
}

struct SessionsFeedResponse: Codable {
    let sessions: [SessionDTO]
    let nextCursor: String?
}

struct RsvpRequest: Codable {
    let status: String
}

struct RsvpResponse: Codable {
    let session: SessionDTO
    let promotedParticipantId: String?
}

struct PaymentRequest: Codable {
    let paymentStatus: String
}

extension RsvpStatus {
    /// Server enum value for an RSVP action (waitlisting is server-assigned).
    var apiValue: String {
        switch self {
        case .joined: "JOINED"
        case .maybe: "MAYBE"
        case .declined: "DECLINED"
        case .waitlisted: "WAITLISTED"
        case .cancelled: "CANCELLED"
        }
    }
}

// MARK: - Chat

struct ChatAuthorDTO: Codable {
    let id: String
    let displayName: String
    let avatarUrl: URL?
    let defaultSkillLevel: SkillLevel?
}

struct ChatMessageDTO: Codable {
    let id: String
    let body: String
    let createdAt: String
    let author: ChatAuthorDTO
}

struct ChatHistoryResponse: Codable {
    let messages: [ChatMessageDTO]
    let olderCursor: String?
}

struct ChatSendResponse: Codable {
    let message: ChatMessageDTO
}

struct SendMessageRequest: Codable {
    let body: String
}

// MARK: - Match results

struct MatchResultDTO: Codable {
    let id: String
    let label: String
    let scoreA: Int
    let scoreB: Int
    let createdAt: String
}

struct ResultsResponse: Codable {
    let results: [MatchResultDTO]
}

struct ResultResponse: Codable {
    let result: MatchResultDTO
}

struct CreateResultRequest: Codable {
    let label: String
    let scoreA: Int
    let scoreB: Int
}

extension MatchScore {
    init(dto: MatchResultDTO) {
        self.init(id: dto.id, label: dto.label, scoreA: dto.scoreA, scoreB: dto.scoreB)
    }
}

// MARK: - Notifications

struct NotificationSessionDTO: Codable {
    let id: String
    let title: String?
    let startsAt: String
    let venueName: String
}

struct NotificationDTO: Codable {
    let id: String
    let type: String
    let createdAt: String
    let readAt: String?
    let session: NotificationSessionDTO?
}

struct NotificationsResponse: Codable {
    let notifications: [NotificationDTO]
}

extension AppNotification {
    /// The server stores a type + session; the client renders the text.
    init(dto: NotificationDTO) {
        let name = dto.session?.title ?? "your session"
        let kind: Kind
        let title: String
        let message: String
        switch dto.type {
        case "WAITLIST_PROMOTION":
            kind = .waitlist
            title = "You're in!"
            message = "A spot opened up in \(name)."
        case "SESSION_CANCELLED":
            kind = .cancellation
            title = "Session cancelled"
            message = "\(name) was cancelled."
        case "SESSION_CHANGED":
            kind = .reminder
            title = "Session updated"
            message = "\(name) was updated."
        default: // SESSION_REMINDER
            kind = .reminder
            title = "Session reminder"
            message = "\(name) is coming up."
        }
        self.init(
            id: dto.id,
            kind: kind,
            title: title,
            message: message,
            createdAt: APIDateFormatter.date(from: dto.createdAt),
            isRead: dto.readAt != nil,
            sessionId: dto.session?.id
        )
    }
}

// MARK: - Devices

struct RegisterDeviceRequest: Codable {
    let deviceToken: String
    let platform: String
    let appVersion: String?
}

struct UnregisterDeviceRequest: Codable {
    let deviceToken: String
}

struct DeviceDTO: Codable {
    let id: String
    let platform: String
    let appVersion: String?
}

struct DeviceResponse: Codable {
    let device: DeviceDTO
}

// MARK: - Saved sessions

struct SaveToggleResponse: Codable {
    let saved: Bool
}

// MARK: - Update session

struct UpdateSessionRequest: Codable {
    let title: String?
    let startsAt: String?
    let endsAt: String?
    let venueName: String?
    let courtCount: Int?
    let maxPlayers: Int?
    let feeTotalVnd: Int?
    let shuttlecockCostVnd: Int?
    let skillLevel: SkillLevel?
    let feePerPlayerVnd: Int?
    let imageUrls: [String]?
}

struct UploadResponse: Codable {
    let url: String
}

// MARK: - People & follow

struct PersonDTO: Codable {
    let id: String
    let displayName: String
    let avatarUrl: URL?
    let defaultSkillLevel: SkillLevel?
    let role: String
    let activityCount: Int
    let averageRating: Double?
    let reviewCount: Int
}

struct PeopleResponse: Codable {
    let people: [PersonDTO]
}

struct PersonSummaryDTO: Codable {
    let id: String
    let displayName: String
    let avatarUrl: URL?
    let defaultSkillLevel: SkillLevel?
}

struct FollowingUsersResponse: Codable {
    let users: [PersonSummaryDTO]
}

struct FollowToggleResponse: Codable {
    let following: Bool
}

extension PersonProfile {
    init(dto: PersonDTO) {
        self.init(
            player: Player(
                id: dto.id,
                displayName: dto.displayName,
                skillLevel: dto.defaultSkillLevel ?? .open,
                avatarUrl: dto.avatarUrl
            ),
            role: dto.role == "host" ? .host : .player,
            activityCount: dto.activityCount,
            reviews: [],
            ratingOverride: dto.averageRating,
            reviewCountOverride: dto.reviewCount
        )
    }
}

// MARK: - Reviews

struct ReviewDTO: Codable {
    let id: String
    let rating: Int
    let comment: String?
    let sessionId: String?
    let createdAt: String
    let author: PersonSummaryDTO
}

struct UserReviewsResponse: Codable {
    let reviews: [ReviewDTO]
}

struct ReviewWriteResponse: Codable {
    let review: ReviewDTO
}

struct CreateReviewRequest: Codable {
    let subjectId: String
    let rating: Int
    let comment: String?
}

extension Review {
    init(dto: ReviewDTO) {
        self.init(
            id: dto.id,
            author: Player(
                id: dto.author.id,
                displayName: dto.author.displayName,
                skillLevel: dto.author.defaultSkillLevel ?? .open,
                avatarUrl: dto.author.avatarUrl
            ),
            rating: dto.rating,
            comment: dto.comment ?? "",
            date: APIDateFormatter.date(from: dto.createdAt)
        )
    }
}

// MARK: - Lineup

struct LineupAssignment: Codable {
    let courtId: String
    let participantId: String
    let slotOrder: Int
}

struct SetLineupRequest: Codable {
    let assignments: [LineupAssignment]
}

extension ChatMessage {
    init(dto: ChatMessageDTO) {
        self.init(
            id: dto.id,
            author: Player(
                id: dto.author.id,
                displayName: dto.author.displayName,
                skillLevel: dto.author.defaultSkillLevel ?? .open,
                avatarUrl: dto.author.avatarUrl
            ),
            text: dto.body,
            date: APIDateFormatter.date(from: dto.createdAt)
        )
    }
}

struct SessionDTO: Codable, Identifiable, Hashable {
    struct Group: Codable, Identifiable, Hashable {
        let id: String
        let name: String
    }

    struct Summary: Codable, Hashable {
        let joinedPlayerCount: Int
        let waitlistCount: Int
        let availableSlots: Int
        let totalCostVnd: Int
        let perPlayerCostVnd: Int?
    }

    struct User: Codable, Identifiable, Hashable {
        let id: String
        let displayName: String
        let avatarUrl: URL?
        let defaultSkillLevel: SkillLevel?
    }

    struct Participant: Codable, Identifiable, Hashable {
        let id: String
        let userId: String
        let rsvpStatus: RsvpStatus
        let waitlistPosition: Int?
        let paymentStatus: PaymentStatus
        let joinedAt: String?
        let checkedInAt: String?
        let user: User
    }

    struct Court: Codable, Identifiable, Hashable {
        struct LineupSlot: Codable, Identifiable, Hashable {
            struct User: Codable, Identifiable, Hashable {
                let id: String
                let displayName: String
                let avatarUrl: URL?
            }

            let id: String
            let participantId: String
            let slotOrder: Int
            let user: User
        }

        let id: String
        let label: String
        let sortOrder: Int
        let lineupSlots: [LineupSlot]
    }

    let id: String
    let groupId: String
    let hostUserId: String
    let title: String?
    let startsAt: String
    let endsAt: String
    let venueName: String
    let venueNote: String?
    let imageUrls: [URL]?
    let courtCount: Int
    let maxPlayers: Int
    let feeTotalVnd: Int?
    let shuttlecockCostVnd: Int?
    let currency: String
    let skillLevel: SkillLevel
    let visibility: String
    let costTrackingEnabled: Bool?
    let feePerPlayerVnd: Int?
    let venueLat: Double?
    let venueLng: Double?
    let status: String
    let createdAt: String
    let updatedAt: String
    let group: Group
    let inviteUrlToken: String?
    let summary: Summary
    /// Omitted on the discovery feed (card payload). Present on session detail.
    let participants: [Participant]?
    let courts: [Court]?
}

struct APIEnvelope<T: Decodable>: Decodable {
    let value: T

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        value = try container.decode(T.self)
    }
}

struct APIErrorResponse: Decodable, Error {
    struct Payload: Decodable {
        let code: String
        let message: String
    }

    let error: Payload
}

enum APIDateFormatter {
    private static func makeFractionalFormatter() -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }

    private static func makeInternetFormatter() -> ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }

    static func date(from value: String) -> Date {
        makeFractionalFormatter().date(from: value)
            ?? makeInternetFormatter().date(from: value)
            ?? Date()
    }

    static func string(from date: Date) -> String {
        makeFractionalFormatter().string(from: date)
    }
}
