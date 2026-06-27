import SwiftUI

@MainActor
final class AuthSession: ObservableObject {
    @Published private(set) var token: String?
    @Published private(set) var currentUser: UserProfile?
    private(set) var refreshToken: String?

    private enum Keys {
        static let access = "accessToken"
        static let refresh = "refreshToken"
    }

    init(currentUser: UserProfile? = Mock.currentUserProfile) {
        self.currentUser = currentUser
        // Restore persisted tokens; the profile is fetched on launch via restore().
        token = KeychainStore.get(Keys.access)
        refreshToken = KeychainStore.get(Keys.refresh)
    }

    var isAuthenticated: Bool {
        token != nil && currentUser != nil
    }

    /// The player used for local RSVP interactions. Falls back to a mock
    /// "You" player when no profile has been loaded yet.
    var currentPlayer: Player {
        guard let currentUser else { return Mock.you }
        return Player(
            id: currentUser.id,
            displayName: currentUser.displayName,
            skillLevel: currentUser.defaultSkillLevel,
            avatarUrl: currentUser.avatarUrl
        )
    }

    func signIn(response: DevLoginResponse) {
        token = response.token
        currentUser = response.user
    }

    /// Real sign-in with a Google-issued token pair; persists to the Keychain.
    func signIn(google response: GoogleAuthResponse) {
        token = response.accessToken
        refreshToken = response.refreshToken
        currentUser = response.user
        KeychainStore.set(response.accessToken, for: Keys.access)
        KeychainStore.set(response.refreshToken, for: Keys.refresh)
    }

    /// On launch: if tokens were persisted, load the profile (refreshing the
    /// access token if it has expired). Returns whether a session was restored.
    func restore(using api: APIClient) async -> Bool {
        guard let token else { return false }
        do {
            currentUser = try await api.fetchMe(token: token).user
            return true
        } catch {
            return await refreshAndLoad(using: api)
        }
    }

    private func refreshAndLoad(using api: APIClient) async -> Bool {
        guard let refreshToken else {
            signOut()
            return false
        }
        do {
            let refreshed = try await api.refreshSession(refreshToken: refreshToken)
            token = refreshed.accessToken
            self.refreshToken = refreshed.refreshToken
            KeychainStore.set(refreshed.accessToken, for: Keys.access)
            KeychainStore.set(refreshed.refreshToken, for: Keys.refresh)
            currentUser = try await api.fetchMe(token: refreshed.accessToken).user
            return true
        } catch {
            signOut()
            return false
        }
    }

    /// Local-only profile edit used by the Profile screen.
    func updateProfile(displayName: String, skillLevel: SkillLevel) {
        let base = currentUser ?? Mock.currentUserProfile
        currentUser = UserProfile(
            id: base.id,
            email: base.email,
            displayName: displayName,
            avatarUrl: base.avatarUrl,
            defaultSkillLevel: skillLevel
        )
    }

    func signOut() {
        token = nil
        refreshToken = nil
        currentUser = nil
        KeychainStore.set(nil, for: Keys.access)
        KeychainStore.set(nil, for: Keys.refresh)
    }
}
