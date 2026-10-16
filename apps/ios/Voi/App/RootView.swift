import SwiftUI

struct RootView: View {
    @StateObject var homeViewModel: HomeViewModel
    let authSession: AuthSession
    let onSignOut: () -> Void
    @EnvironmentObject private var store: DemoStore
    @EnvironmentObject private var environment: AppEnvironment

    var body: some View {
        tabHost
            .tint(VoiColor.court)
            .sheet(isPresented: Binding(
                get: { environment.openCreateSession },
                set: { environment.openCreateSession = $0 }
            )) {
                CreateSessionView(groupName: homeViewModel.activeGroupName) { draft in
                    try await homeViewModel.createSession(draft)
                }
            }
            .task(id: environment.openCreateSession) {
                if environment.openCreateSession {
                    await homeViewModel.reload()
                }
            }
            .task {
                await refreshBadges()
            }
            .task {
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(30))
                    await refreshBadges()
                }
            }
    }

    @ViewBuilder
    private var tabHost: some View {
        if #available(iOS 18.0, *) {
            TabView {
                Tab("Sessions", systemImage: "figure.badminton") {
                    HomeView(viewModel: homeViewModel)
                }
                Tab("Messages", systemImage: "bubble.left.and.bubble.right.fill") {
                    MessagesView()
                }
                .badge(store.unreadChatCount)
                Tab("Alerts", systemImage: "bell") {
                    NotificationsView()
                }
                .badge(store.unreadCount)
                Tab("Profile", systemImage: "person") {
                    ProfileView(
                        authSession: authSession,
                        sessionsViewModel: homeViewModel,
                        onSignOut: onSignOut
                    )
                }
            }
        } else {
            TabView {
                HomeView(viewModel: homeViewModel)
                    .tabItem { Label("Sessions", systemImage: "figure.badminton") }
                    .accessibilityIdentifier(A11y.Tab.sessions)

                MessagesView()
                    .tabItem {
                        Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                    }
                    .badge(store.unreadChatCount)
                    .accessibilityIdentifier(A11y.Tab.messages)

                NotificationsView()
                    .tabItem { Label("Alerts", systemImage: "bell") }
                    .badge(store.unreadCount)
                    .accessibilityIdentifier(A11y.Tab.alerts)

                ProfileView(
                    authSession: authSession,
                    sessionsViewModel: homeViewModel,
                    onSignOut: onSignOut
                )
                    .tabItem { Label("Profile", systemImage: "person") }
                    .accessibilityIdentifier(A11y.Tab.profile)
            }
        }
    }

    private func refreshBadges() async {
        await store.refreshBadges(
            api: environment.apiClient,
            token: environment.authSession.token
        )
    }
}
