import SwiftUI
import GoogleSignIn

@MainActor
final class AuthSession: ObservableObject {
    @Published private(set) var token: String?
    @Published private(set) var currentUser: UserProfile?
    private(set) var refreshToken: String?
    private var refreshTask: Task<String, Error>?

    private enum Keys {
        static let access = "accessToken"
        static let refresh = "refreshToken"
    }

    init(currentUser: UserProfile? = nil) {
        self.currentUser = currentUser
        // Restore persisted tokens; the profile is fetched on launch via restore().
        token = KeychainStore.get(Keys.access)
        refreshToken = KeychainStore.get(Keys.refresh)
    }

    var isAuthenticated: Bool {
        token != nil && currentUser != nil
    }

    /// The player used for RSVP / host checks. Falls back to a mock
    /// "You" player only when no profile has been loaded yet.
    var currentPlayer: Player {
        guard let currentUser else { return Mock.you }
        return Player(
            id: currentUser.id,
            displayName: currentUser.displayName,
            skillLevel: currentUser.defaultSkillLevel,
            avatarUrl: currentUser.avatarUrl
        )
    }

    /// Dev login now returns the same access/refresh pair as Google when the
    /// API is current; older servers only send `token`.
    func signIn(response: DevLoginResponse) {
        let access = response.accessToken ?? response.token
        token = access
        refreshToken = response.refreshToken
        currentUser = response.user
        KeychainStore.set(access, for: Keys.access)
        KeychainStore.set(response.refreshToken, for: Keys.refresh)
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
            // Dev-login sessions have access only — clear if /me failed.
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

    /// Persist profile edits via `PATCH /me`, then update local state.
    @discardableResult
    func updateProfile(
        displayName: String,
        skillLevel: SkillLevel,
        using api: APIClient
    ) async throws -> UserProfile {
        guard let token else {
            throw APIError.requestFailed
        }
        let response = try await api.updateProfile(
            token: token,
            request: UpdateProfileRequest(
                displayName: displayName,
                avatarUrl: nil,
                defaultSkillLevel: skillLevel
            )
        )
        currentUser = response.user
        return response.user
    }

    /// Local-only fallback when offline (no token / API unreachable).
    func updateProfileLocally(displayName: String, skillLevel: SkillLevel) {
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
        GIDSignIn.sharedInstance.signOut()
    }

    /// Rotate the access token. Used by `APIClient` on 401.
    func refreshAccessToken(using api: APIClient) async throws -> String {
        if let refreshTask {
            return try await refreshTask.value
        }
        let task = Task { try await self.performRefresh(using: api) }
        refreshTask = task
        defer { refreshTask = nil }
        return try await task.value
    }

    private func performRefresh(using api: APIClient) async throws -> String {
        guard let refreshToken else {
            signOut()
            throw APIError.unauthorized
        }
        do {
            let refreshed = try await api.refreshSession(refreshToken: refreshToken)
            token = refreshed.accessToken
            self.refreshToken = refreshed.refreshToken
            KeychainStore.set(refreshed.accessToken, for: Keys.access)
            KeychainStore.set(refreshed.refreshToken, for: Keys.refresh)
            return refreshed.accessToken
        } catch {
            signOut()
            throw error
        }
    }
}
