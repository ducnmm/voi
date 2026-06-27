import SwiftUI

struct RootView: View {
    @StateObject var homeViewModel: HomeViewModel
    let authSession: AuthSession
    let onSignOut: () -> Void
    @EnvironmentObject private var store: DemoStore

    var body: some View {
        // Bottom tab bar. On iOS 26 a standard TabView renders as the floating
        // Liquid Glass tab bar automatically; content scrolls underneath it.
        TabView {
            HomeView(viewModel: homeViewModel)
                .tabItem {
                    Label("Sessions", systemImage: "figure.badminton")
                }

            NotificationsView()
                .tabItem {
                    Label("Alerts", systemImage: "bell")
                }
                .badge(store.unreadCount)

            ProfileView(authSession: authSession, sessionsViewModel: homeViewModel, onSignOut: onSignOut)
                .tabItem {
                    Label("Profile", systemImage: "person")
                }
        }
        .tint(VoiColor.court)
    }
}
