import SwiftUI

@MainActor
final class AppEnvironment: ObservableObject {
    let apiClient: APIClient
    let authSession: AuthSession

    init(apiClient: APIClient = .development, authSession: AuthSession? = nil) {
        self.apiClient = apiClient
        self.authSession = authSession ?? AuthSession()
    }
}
