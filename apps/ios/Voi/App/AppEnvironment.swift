import SwiftUI

@MainActor
final class AppEnvironment: ObservableObject {
    let apiClient: APIClient
    let authSession: AuthSession

    init(apiClient: APIClient? = nil, authSession: AuthSession? = nil) {
        let session = authSession ?? AuthSession()
        let client = apiClient ?? .development
        client.tokenRefresher = { [weak session, weak client] in
            guard let session, let client else { return nil }
            return try await session.refreshAccessToken(using: client)
        }
        self.apiClient = client
        self.authSession = session
    }
}
