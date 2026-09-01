import SwiftUI

/// Shared client cache for people, alerts, follows, and saved sessions.
@MainActor
final class DemoStore: ObservableObject {
    @Published var hosts: [PersonProfile] = []
    @Published var players: [PersonProfile] = []
    @Published var notifications: [AppNotification] = []

    var unreadCount: Int { notifications.filter { !$0.isRead }.count }

    // MARK: People

    func loadPeople(api: APIClient, token: String?) async {
        guard let token else { return }
        do {
            let profiles = try await api.fetchPeople(token: token).people.map(PersonProfile.init(dto:))
            hosts = profiles.filter { $0.role == .host }
            players = profiles.filter { $0.role == .player }
        } catch {
            // keep current people if it can't load
        }
    }

    func person(id: String) -> PersonProfile? {
        hosts.first { $0.id == id } ?? players.first { $0.id == id }
    }

    /// Resolve a session participant to a People profile (matched by name) so it
    /// can be opened from a lineup; falls back to a fresh player profile.
    func profile(for player: Player) -> PersonProfile {
        players.first { $0.name == player.displayName }
            ?? hosts.first { $0.name == player.displayName }
            ?? PersonProfile(player: player, role: .player, activityCount: 0, reviews: [])
    }

    /// True when the profile is backed by the store (so a review can be saved).
    func canReview(_ profile: PersonProfile) -> Bool {
        person(id: profile.id) != nil
    }

    func addReview(_ review: Review, to personId: String) {
        if let i = hosts.firstIndex(where: { $0.id == personId }) {
            hosts[i].reviews.insert(review, at: 0)
        } else if let i = players.firstIndex(where: { $0.id == personId }) {
            players[i].reviews.insert(review, at: 0)
        }
    }

    // MARK: Alerts

    func loadNotifications(api: APIClient, token: String?) async {
        guard let token else { return }
        do {
            let response = try await api.fetchNotifications(token: token)
            notifications = response.notifications.map(AppNotification.init(dto:))
        } catch {
            // keep whatever is on screen if it can't load
        }
    }

    func markAllNotificationsRead(api: APIClient? = nil, token: String? = nil) {
        for index in notifications.indices { notifications[index].isRead = true }
        guard let api, let token else { return }
        Task {
            _ = try? await api.markAllNotificationsRead(token: token)
        }
    }

    func markRead(_ id: String, api: APIClient? = nil, token: String? = nil) {
        guard let index = notifications.firstIndex(where: { $0.id == id }) else { return }
        if !notifications[index].isRead {
            notifications[index].isRead = true
            guard let api, let token else { return }
            Task { _ = try? await api.markNotificationRead(token: token, id: id) }
        }
    }

    func toggleRead(_ id: String, api: APIClient? = nil, token: String? = nil) {
        guard let index = notifications.firstIndex(where: { $0.id == id }) else { return }
        notifications[index].isRead.toggle()
        let nowRead = notifications[index].isRead
        guard nowRead, let api, let token else { return }
        Task {
            _ = try? await api.markNotificationRead(token: token, id: id)
        }
    }

    func removeNotification(_ id: String) {
        notifications.removeAll { $0.id == id }
    }

    func notifyJoined(_ session: SessionSummary) {
        let item = AppNotification(
            id: "n-join-\(session.id)-\(notifications.count)",
            kind: .rsvp,
            title: "You're in!",
            message: "You joined \(session.title).",
            createdAt: Date(),
            isRead: false
        )
        notifications.insert(item, at: 0)
    }

    // MARK: Following

    @Published var following: Set<String> = []
    func isFollowing(_ id: String) -> Bool { following.contains(id) }

    func loadFollowing(api: APIClient, token: String?) async {
        guard let token else { return }
        do {
            following = Set(try await api.fetchFollowing(token: token).users.map(\.id))
        } catch {
        }
    }

    func toggleFollow(_ userId: String, api: APIClient, token: String?) async {
        let wasFollowing = following.contains(userId)
        if wasFollowing { following.remove(userId) } else { following.insert(userId) }
        guard let token else { return }
        do {
            if wasFollowing {
                try await api.unfollowUser(token: token, userId: userId)
            } else {
                try await api.followUser(token: token, userId: userId)
            }
        } catch {
            if wasFollowing { following.insert(userId) } else { following.remove(userId) }
        }
    }

    // MARK: Favourites (saved sessions)

    @Published var favorites: Set<String> = []
    func isFavorite(_ id: String) -> Bool { favorites.contains(id) }

    func loadSaved(api: APIClient, token: String?) async {
        guard let token else { return }
        do {
            let response = try await api.fetchSaved(token: token)
            favorites = Set(response.sessions.map(\.id))
        } catch {
            // keep current set if it can't load
        }
    }

    func toggleFavorite(_ id: String, api: APIClient, token: String?) async {
        let wasFavorite = favorites.contains(id)
        if wasFavorite { favorites.remove(id) } else { favorites.insert(id) } // optimistic
        guard let token else { return }
        do {
            if wasFavorite {
                try await api.unsaveSession(token: token, sessionId: id)
            } else {
                try await api.saveSession(token: token, sessionId: id)
            }
        } catch {
            if wasFavorite { favorites.insert(id) } else { favorites.remove(id) }
        }
    }

    // MARK: Check-in

    @Published var checkedIn: [String: Set<String>] = [:]
    func isCheckedIn(_ sessionId: String, _ participantId: String) -> Bool {
        checkedIn[sessionId]?.contains(participantId) ?? false
    }
    func toggleCheckIn(_ sessionId: String, _ participantId: String) {
        var set = checkedIn[sessionId] ?? []
        if set.contains(participantId) { set.remove(participantId) } else { set.insert(participantId) }
        checkedIn[sessionId] = set
    }

    // MARK: Match scores

    @Published var scores: [String: [MatchScore]] = [:]
    func addScore(label: String, scoreA: Int, scoreB: Int, to sessionId: String) {
        var list = scores[sessionId] ?? []
        list.append(MatchScore(id: "score-\(sessionId)-\(list.count)", label: label, scoreA: scoreA, scoreB: scoreB))
        scores[sessionId] = list
    }
}
