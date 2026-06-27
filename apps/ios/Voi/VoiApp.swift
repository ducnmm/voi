import SwiftUI
import GoogleSignIn

@main
struct VoiApp: App {
    @StateObject private var environment = AppEnvironment()
    @StateObject private var languageManager = LanguageManager()
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var store = DemoStore()
    @AppStorage("didOnboard") private var didOnboard = false
    @State private var loggedIn = false

    var body: some Scene {
        WindowGroup {
            Group {
                if loggedIn {
                    RootView(
                        homeViewModel: HomeViewModel(
                            apiClient: environment.apiClient,
                            authSession: environment.authSession
                        ),
                        authSession: environment.authSession,
                        onSignOut: {
                            Task {
                                if let refreshToken = environment.authSession.refreshToken {
                                    try? await environment.apiClient.logout(refreshToken: refreshToken)
                                }
                                environment.authSession.signOut()
                                withAnimation { loggedIn = false }
                            }
                        }
                    )
                } else {
                    LoginView {
                        withAnimation { loggedIn = true }
                    }
                }
            }
            .environmentObject(environment)
            .environmentObject(languageManager)
            .environmentObject(themeManager)
            .environmentObject(store)
            .environment(\.locale, languageManager.locale)
            .preferredColorScheme(themeManager.theme.colorScheme)
            .onOpenURL { GIDSignIn.sharedInstance.handle($0) }
            .task {
                // Restore a persisted session on launch (Keychain → /me).
                if await environment.authSession.restore(using: environment.apiClient) {
                    loggedIn = true
                }
            }
            // Re-render the whole tree when the language changes so every
            // Text("...") re-resolves against the newly selected bundle.
            .id(languageManager.language)
            .fullScreenCover(isPresented: Binding(
                get: { !didOnboard },
                set: { if !$0 { didOnboard = true } }
            )) {
                OnboardingView { didOnboard = true }
            }
        }
    }
}
