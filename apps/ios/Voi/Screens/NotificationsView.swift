import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var store: DemoStore
    @EnvironmentObject private var environment: AppEnvironment
    @State private var showingInvite = false
    @State private var openedSession: SessionSummary?

    var body: some View {
        NavigationStack {
            Group {
                if store.notifications.isEmpty {
                    ContentUnavailableView("You're all caught up.", systemImage: "bell.slash")
                        .accessibilityIdentifier(A11y.Alerts.empty)
                } else {
                    List {
                        ForEach(store.notifications) { notification in
                            NotificationRow(notification: notification)
                                .accessibilityIdentifier(A11y.Alerts.row(notification.id))
                                .listRowInsets(EdgeInsets(top: 6, leading: VoiSpacing.lg, bottom: 6, trailing: VoiSpacing.lg))
                                .listRowSeparator(.hidden)
                                .listRowBackground(Color.clear)
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    store.markRead(
                                        notification.id,
                                        api: environment.apiClient,
                                        token: environment.authSession.token
                                    )
                                    Task { await openSession(notification.sessionId) }
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        store.removeNotification(notification.id)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .swipeActions(edge: .leading) {
                                    Button {
                                        store.toggleRead(notification.id)
                                    } label: {
                                        Label(notification.isRead ? "Unread" : "Read",
                                              systemImage: notification.isRead ? "envelope.badge" : "envelope.open")
                                    }
                                    .tint(VoiColor.court)
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(VoiColor.background)
            .task {
                await store.loadNotifications(
                    api: environment.apiClient,
                    token: environment.authSession.token
                )
            }
            .navigationTitle("Alerts")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showingInvite = true } label: {
                        Image(systemName: "envelope.open")
                    }
                    .accessibilityLabel("Open invite")
                    .accessibilityIdentifier(A11y.Alerts.openInvite)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if store.unreadCount > 0 {
                        Button("Mark all read") {
                            store.markAllNotificationsRead(
                                api: environment.apiClient,
                                token: environment.authSession.token
                            )
                        }
                            .font(.subheadline)
                            .accessibilityIdentifier(A11y.Alerts.markAllRead)
                    }
                }
            }
            .sheet(isPresented: $showingInvite) {
                InviteView { session in
                    store.notifyJoined(session)
                }
            }
            .navigationDestination(item: $openedSession) { session in
                SessionDetailView(
                    session: session,
                    currentPlayer: environment.authSession.currentPlayer
                )
            }
        }
    }

    private func openSession(_ sessionId: String?) async {
        guard let sessionId else { return }
        do {
            guard let token = environment.authSession.token else { return }
            let response = try await environment.apiClient.session(token: token, id: sessionId)
            openedSession = SessionSummary(dto: response.session)
        } catch {
            // stay on the alerts list if the session is gone
        }
    }
}

private struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: VoiSpacing.md) {
            Image(systemName: notification.kind.systemImage)
                .font(.title3)
                .foregroundStyle(notification.kind.tint)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: VoiSpacing.xs) {
                HStack {
                    Text(notification.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoiColor.ink)
                    Spacer()
                    Text(notification.relativeTime)
                        .font(.caption)
                        .foregroundStyle(VoiColor.muted)
                }

                Text(notification.message)
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !notification.isRead {
                Circle()
                    .fill(VoiColor.accent)
                    .frame(width: 8, height: 8)
                    .padding(.top, VoiSpacing.xs)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
        .opacity(notification.isRead ? 0.7 : 1)
    }
}
