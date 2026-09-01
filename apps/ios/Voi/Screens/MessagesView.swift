import SwiftUI

@MainActor
final class MessagesViewModel: ObservableObject {
    @Published var groups: [GroupSummary] = []
    @Published var sessions: [SessionSummary] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    var isEmpty: Bool { groups.isEmpty && sessions.isEmpty }

    func reload(api: APIClient, token: String?) async {
        guard let token else { return }
        let showSpinner = isEmpty
        if showSpinner { isLoading = true }
        defer { isLoading = false }

        do {
            async let groupsRes = api.groups(token: token)
            async let upcomingRes = api.sessionsFeed(token: token, scope: "upcoming", limit: 50)
            async let pastRes = api.sessionsFeed(token: token, scope: "past", limit: 20)
            let (listed, upcoming, past) = try await (groupsRes, upcomingRes, pastRes)

            groups = listed.groups
            var seen = Set<String>()
            var combined: [SessionSummary] = []
            for dto in upcoming.sessions + past.sessions {
                let summary = SessionSummary(dto: dto)
                if seen.insert(summary.id).inserted {
                    combined.append(summary)
                }
            }
            let now = Date()
            sessions = combined.sorted { lhs, rhs in
                let lhsUpcoming = lhs.endsAt >= now
                let rhsUpcoming = rhs.endsAt >= now
                if lhsUpcoming != rhsUpcoming { return lhsUpcoming && !rhsUpcoming }
                if lhsUpcoming { return lhs.startsAt < rhs.startsAt }
                return lhs.startsAt > rhs.startsAt
            }
            errorMessage = nil
        } catch {
            errorMessage = (error as? APIErrorResponse)?.error.message ?? "Could not load chats."
        }
    }
}

struct MessagesView: View {
    @StateObject private var viewModel = MessagesViewModel()
    @EnvironmentObject private var environment: AppEnvironment
    @State private var opened: ChatRoom?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if viewModel.isEmpty {
                    ContentUnavailableView("No chats yet", systemImage: "bubble.left.and.bubble.right")
                        .accessibilityIdentifier(A11y.Messages.empty)
                } else {
                    inboxList
                }
            }
            .background(VoiColor.background)
            .navigationTitle("Messages")
            .accessibilityIdentifier(A11y.Messages.screen)
            .task { await reload() }
            .refreshable { await reload() }
            .alert(
                "Messages",
                isPresented: Binding(
                    get: { viewModel.errorMessage != nil },
                    set: { if !$0 { viewModel.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
            .navigationDestination(item: $opened) { room in
                ChatView(room: room)
            }
        }
    }

    private var inboxList: some View {
        List {
            if !viewModel.groups.isEmpty {
                Section("Groups") {
                    ForEach(viewModel.groups) { group in
                        Button {
                            opened = .group(id: group.id, title: group.name)
                        } label: {
                            inboxRow(
                                icon: "person.3.fill",
                                title: group.name,
                                subtitle: groupSubtitle(group)
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(EdgeInsets(
                            top: 6, leading: VoiSpacing.lg, bottom: 6, trailing: VoiSpacing.lg
                        ))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .accessibilityLabel("\(group.name) group chat")
                        .accessibilityIdentifier(A11y.Messages.group(group.id))
                    }
                }
            }

            if !viewModel.sessions.isEmpty {
                Section("Sessions") {
                    ForEach(viewModel.sessions) { session in
                        Button {
                            opened = .session(id: session.id, title: session.title)
                        } label: {
                            inboxRow(
                                icon: "figure.badminton",
                                title: session.title,
                                subtitle: "\(session.dateLabel) · \(session.venueName)",
                                ended: session.endsAt < Date()
                            )
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(EdgeInsets(
                            top: 6, leading: VoiSpacing.lg, bottom: 6, trailing: VoiSpacing.lg
                        ))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                        .accessibilityLabel("\(session.title) session chat")
                        .accessibilityIdentifier(A11y.Messages.session(session.id))
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private func inboxRow(
        icon: String,
        title: String,
        subtitle: String,
        ended: Bool = false
    ) -> some View {
        HStack(spacing: VoiSpacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(VoiColor.court)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoiColor.ink)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(VoiColor.muted)
                    .lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(VoiColor.muted)
        }
        .voiCard()
        .opacity(ended ? 0.7 : 1)
    }

    private func groupSubtitle(_ group: GroupSummary) -> String {
        let members = "\(group.memberCount) members"
        if let upcoming = group.upcomingSessionCount, upcoming > 0 {
            return "\(members) · \(upcoming) upcoming"
        }
        return members
    }

    private func reload() async {
        await viewModel.reload(
            api: environment.apiClient,
            token: environment.authSession.token
        )
    }
}
