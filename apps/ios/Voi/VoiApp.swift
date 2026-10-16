import SwiftUI
import GoogleSignIn
import UserNotifications

@main
struct VoiApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var environment = AppEnvironment()
    @StateObject private var languageManager = LanguageManager()
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var store = DemoStore()
    @AppStorage("didOnboard") private var didOnboard = false
    @State private var loggedIn = false
    @State private var createAfterLogin = false

    init() {
        _ = UITestLaunch.bootstrap
    }

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
                                let access = environment.authSession.token
                                if let access, let deviceToken = PushDeviceStore.token {
                                    try? await environment.apiClient.unregisterDevice(
                                        token: access,
                                        deviceToken: deviceToken
                                    )
                                }
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
            .onOpenURL { url in
                if GIDSignIn.sharedInstance.handle(url) { return }
                handleDeepLink(url)
            }
            .onChange(of: loggedIn) { _, isIn in
                if isIn, createAfterLogin {
                    createAfterLogin = false
                    environment.openCreateSession = true
                }
            }
            .sheet(item: Binding(
                get: { environment.pendingInviteToken.map(InviteTokenPresentation.init(token:)) },
                set: { environment.pendingInviteToken = $0?.token }
            )) { item in
                InviteView(inviteToken: item.token) { session in
                    store.notifyJoined(session)
                }
                .environmentObject(environment)
                .environmentObject(store)
            }
            .onReceive(NotificationCenter.default.publisher(for: .voiDeviceToken)) { output in
                guard let deviceToken = output.object as? String,
                      let token = environment.authSession.token else { return }
                PushDeviceStore.token = deviceToken
                Task {
                    _ = try? await environment.apiClient.registerDevice(
                        token: token,
                        deviceToken: deviceToken,
                        appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
                    )
                }
            }
            .task {
                if UITestLaunch.autoLogin {
                    do {
                        let response = try await environment.apiClient.devLogin(
                            email: UITestLaunch.email,
                            displayName: UITestLaunch.displayName
                        )
                        environment.authSession.signIn(response: response)
                        loggedIn = true
                        await requestPushRegistration()
                    } catch {
                        // Stay on the login screen so tests can use the explicit button.
                    }
                } else if await environment.authSession.restore(using: environment.apiClient) {
                    loggedIn = true
                    await requestPushRegistration()
                }
                if let invite = UITestLaunch.inviteToken {
                    environment.pendingInviteToken = invite
                }
            }
            // Re-render the whole tree when the language changes so every
            // Text("...") re-resolves against the newly selected bundle.
            .id(languageManager.language)
            .fullScreenCover(isPresented: Binding(
                get: { UITestLaunch.skipOnboarding ? false : !didOnboard },
                set: { if !$0 { didOnboard = true } }
            )) {
                OnboardingView { didOnboard = true }
            }
        }
    }

    @MainActor
    private func requestPushRegistration() async {
        guard !UITestLaunch.isEnabled else { return }
        let granted = (try? await UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        guard granted else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    private func handleDeepLink(_ url: URL) {
        guard let link = VoiDeepLink.parse(url) else { return }
        switch link {
        case .createHost:
            if loggedIn {
                environment.openCreateSession = true
            } else {
                createAfterLogin = true
            }
        case .joinSession(let token), .joinGroup(let token):
            environment.pendingInviteToken = token
        }
    }
}

private struct InviteTokenPresentation: Identifiable {
    let token: String
    var id: String { token }
}
