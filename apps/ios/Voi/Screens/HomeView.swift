import SwiftUI

@MainActor
final class HomeViewModel: ObservableObject {
    private let apiClient: APIClient
    private let authSession: AuthSession
    private var hasBootstrapped = false

    @Published var sessions: [SessionSummary] = []
    @Published var apiStatus: String = "Offline"
    @Published var activeGroup: GroupSummary?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var filter = SessionFilter()
    @Published var searchText = ""
    @Published var showPast = false
    @Published var sortOrder: SortOrder = .date
    @Published var savedOnly = false

    var activeGroupName: String {
        activeGroup?.name ?? "Local Badminton"
    }

    // Always allowed: the create flow falls back to a local session offline.
    var canCreateSession: Bool { true }

    var currentPlayer: Player { authSession.currentPlayer }

    /// Sessions that have not finished yet, shown on the Sessions page.
    var upcomingSessions: [SessionSummary] {
        sessions
            .filter { $0.endsAt >= Date() }
            .sorted { $0.startsAt < $1.startsAt }
    }

    /// Sessions that have already finished, shown on the History page
    /// (most recent first).
    var pastSessions: [SessionSummary] {
        sessions
            .filter { $0.endsAt < Date() }
            .sorted { $0.startsAt > $1.startsAt }
    }

    /// Upcoming sessions narrowed by the active filter.
    var filteredUpcomingSessions: [SessionSummary] {
        upcomingSessions.filter(filter.matches)
    }

    /// Distinct venues among upcoming sessions, offered in the filter screen.
    var filterableVenues: [String] {
        Array(Set(upcomingSessions.map(\.venueName))).sorted()
    }

    /// Mock people for the People screens (reached by edge-swiping the list).
    var hosts: [PersonProfile] { Mock.hosts }
    var players: [PersonProfile] { Mock.players }

    init(apiClient: APIClient, authSession: AuthSession) {
        self.apiClient = apiClient
        self.authSession = authSession
    }

    func bootstrap() async {
        guard !hasBootstrapped else { return }
        hasBootstrapped = true
        await reload()
    }

    func reload() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let health = try await apiClient.health()
            apiStatus = health.status.capitalized

            try await ensureSignedIn()
            guard let token = authSession.token else {
                throw LocalAppError.missingSession
            }

            activeGroup = try await ensureGroup(token: token)

            // Discovery feed (Spec 0007). Past history uses scope=past.
            let feed = try await apiClient.sessionsFeed(
                token: token,
                scope: showPast ? "past" : "upcoming",
                skill: filter.skillLevels.count == 1 ? filter.skillLevels.first : nil,
                availableOnly: filter.availableOnly,
                savedOnly: savedOnly,
                sort: sortOrder.rawValue
            )
            sessions = feed.sessions
                .map { SessionSummary(dto: $0) }
                .sorted { $0.startsAt < $1.startsAt }
            errorMessage = nil
        } catch {
            apiStatus = "Offline"
            errorMessage = message(for: error)
        }
    }

    @discardableResult
    func createSession(_ draft: CreateSessionDraft) async throws -> SessionSummary {
        if activeGroup == nil || authSession.token == nil {
            await reload()
        }

        guard let token = authSession.token, let group = activeGroup else {
            throw LocalAppError.missingSession
        }

        do {
            let response = try await apiClient.createSession(
                token: token,
                groupId: group.id,
                request: draft.request
            )
            let summary = SessionSummary(dto: response.session, inviteUrl: response.inviteUrl)
            upsert(summary)

            if draft.repeatsWeekly {
                for week in 1...3 {
                    let copy = draft.shifted(byWeeks: week)
                    let extra = try await apiClient.createSession(
                        token: token,
                        groupId: group.id,
                        request: copy.request
                    )
                    upsert(SessionSummary(dto: extra.session, inviteUrl: extra.inviteUrl))
                }
            }
            return summary
        } catch {
            errorMessage = message(for: error)
            throw error
        }
    }

    private func upsert(_ session: SessionSummary) {
        sessions.removeAll { $0.id == session.id }
        sessions.append(session)
        sessions.sort { $0.startsAt < $1.startsAt }
        errorMessage = nil
    }

    private func makeLocalSession(from draft: CreateSessionDraft, weekOffset: Int = 0) -> SessionSummary {
        let offset = TimeInterval(weekOffset) * 7 * 24 * 60 * 60
        let id = "local-\(Int(Date().timeIntervalSince1970))-\(weekOffset)"
        let courts = (1...max(draft.courtCount, 1)).map { index in
            CourtLineup(id: "\(id)-court-\(index)", label: "Court \(index)", players: [])
        }
        return SessionSummary(
            id: id,
            hostUserId: authSession.currentPlayer.id,
            title: draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? draft.venueName : draft.title,
            startsAt: draft.startsAt.addingTimeInterval(offset),
            endsAt: draft.endsAt.addingTimeInterval(offset),
            venueName: draft.venueName,
            courtCount: draft.courtCount,
            maxPlayers: draft.maxPlayers,
            skillLevel: draft.skillLevel,
            feeTotalVnd: draft.feeTotalVnd,
            shuttlecockCostVnd: draft.shuttlecockCostVnd,
            fixedPricePerPlayerVnd: draft.fixedPricePerPlayerVnd,
            courts: courts,
            participants: [.joined(authSession.currentPlayer)],
            inviteUrl: "voi://invites/\(id)"
        )
    }

    private func ensureSignedIn() async throws {
        guard !authSession.isAuthenticated else { return }
        guard UITestLaunch.isEnabled else {
            throw LocalAppError.missingSession
        }
        let response = try await apiClient.devLogin(
            email: UITestLaunch.email,
            displayName: UITestLaunch.displayName
        )
        authSession.signIn(response: response)
    }

    private func ensureGroup(token: String) async throws -> GroupSummary {
        let groupsResponse = try await apiClient.groups(token: token)
        if let group = groupsResponse.groups.first {
            return group
        }

        let response = try await apiClient.createGroup(
            token: token,
            request: CreateGroupRequest(
                name: "Local Badminton",
                description: "Local development group",
                defaultVenueName: "Ky Hoa Badminton",
                defaultSkillLevel: .intermediate
            )
        )
        return response.group
    }

    private func message(for error: Error) -> String {
        if let apiError = error as? APIErrorResponse {
            return apiError.error.message
        }

        if let localizedError = error as? LocalizedError,
           let description = localizedError.errorDescription {
            return description
        }

        return "Could not reach the local Voi API."
    }
}

private enum LocalAppError: LocalizedError {
    case missingSession

    var errorDescription: String? {
        switch self {
        case .missingSession:
            "Local development session is not ready yet."
        }
    }
}

struct HomeView: View {
    @ObservedObject var viewModel: HomeViewModel
    @EnvironmentObject private var store: DemoStore
    @EnvironmentObject private var environment: AppEnvironment
    @State private var peopleSheet: PeopleSheet?
    @State private var screenWidth: CGFloat = 0
    @State private var showingFilter = false
    @State private var showingMap = false
    @State private var isCreatingSession = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: VoiSpacing.md) {
                    if viewModel.isLoading && viewModel.upcomingSessions.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 180)
                    } else {
                        if viewModel.filter.isActive && !viewModel.showPast {
                            FilterSummaryBar(
                                filter: viewModel.filter,
                                onClear: { viewModel.filter = SessionFilter() }
                            )
                        }

                        if displayedSessions.isEmpty {
                            emptyState
                        } else {
                            SessionListContent(
                                sessions: displayedSessions,
                                currentPlayer: viewModel.currentPlayer
                            )
                        }
                    }
                }
                .padding(VoiSpacing.lg)
            }
            .scrollIndicators(.hidden)
            .refreshable {
                await viewModel.reload()
            }
            .background(VoiColor.background)
            .background(widthReader)
            .simultaneousGesture(edgeSwipeGesture)
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Hosts") { peopleSheet = .hosts }
                        .accessibilityIdentifier(A11y.Home.hosts)
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Players") { peopleSheet = .players }
                        .accessibilityIdentifier(A11y.Home.players)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { isCreatingSession = true } label: {
                        Image(systemName: "plus.circle.fill")
                    }
                    .accessibilityLabel("Create event")
                    .accessibilityIdentifier(A11y.Home.create)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingFilter = true } label: {
                        Image(systemName: viewModel.filter.isActive
                            ? "line.3.horizontal.decrease.circle.fill"
                            : "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityLabel("Filter")
                    .accessibilityIdentifier(A11y.Home.filter)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingMap = true } label: {
                        Image(systemName: "map")
                    }
                    .accessibilityLabel("Map")
                    .accessibilityIdentifier(A11y.Home.map)
                }
            }
            .task {
                await viewModel.bootstrap()
                let api = environment.apiClient
                let token = environment.authSession.token
                await store.loadSaved(api: api, token: token)
                await store.loadPeople(api: api, token: token)
                await store.loadFollowing(api: api, token: token)
            }
            .sheet(isPresented: $showingFilter) {
                SessionFilterView(viewModel: viewModel)
                    .presentationDetents([.large, .medium])
                    .presentationDragIndicator(.visible)
            }
            .sheet(isPresented: $showingMap) {
                MapBrowseView(sessions: viewModel.upcomingSessions)
            }
            .sheet(isPresented: $isCreatingSession) {
                CreateSessionView(groupName: viewModel.activeGroupName) { draft in
                    try await viewModel.createSession(draft)
                }
            }
            .alert(
                "Voi API",
                isPresented: Binding(
                    get: { viewModel.errorMessage != nil },
                    set: { isPresented in
                        if !isPresented {
                            viewModel.errorMessage = nil
                        }
                    }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
        .overlay {
            if let kind = peopleSheet {
                PeopleScreen(
                    kind: kind == .hosts ? .hosts : .players,
                    people: kind == .hosts ? store.hosts : store.players,
                    originEdge: kind == .hosts ? .leading : .trailing,
                    onClose: { peopleSheet = nil }
                )
            }
        }
    }

    private var baseSessions: [SessionSummary] {
        let list = viewModel.showPast ? viewModel.pastSessions : viewModel.upcomingSessions
        return list.filter(viewModel.filter.matches)
    }

    private var displayedSessions: [SessionSummary] {
        var list = baseSessions

        let query = viewModel.searchText.trimmingCharacters(in: .whitespaces).lowercased()
        if !query.isEmpty {
            list = list.filter {
                $0.title.lowercased().contains(query) || $0.venueName.lowercased().contains(query)
            }
        }
        if viewModel.savedOnly {
            list = list.filter { store.isFavorite($0.id) }
        }

        switch viewModel.sortOrder {
        case .date: list.sort { $0.startsAt < $1.startsAt }
        case .price: list.sort { ($0.perPlayerCostVnd ?? 0) < ($1.perPlayerCostVnd ?? 0) }
        case .spots: list.sort { $0.availableSlots > $1.availableSlots }
        }
        return list
    }

    @ViewBuilder
    private var emptyState: some View {
        if !viewModel.searchText.isEmpty {
            EmptyStateCard(title: "No results", message: "No sessions match your search.", systemImage: "magnifyingglass")
        } else if viewModel.filter.isActive && !viewModel.showPast {
            NoMatchesView { viewModel.filter = SessionFilter() }
        } else if viewModel.showPast {
            EmptyStateCard(title: "No past sessions", message: "Finished sessions will show up here.", systemImage: "clock.arrow.circlepath")
        } else {
            EmptySessionsView(groupName: viewModel.activeGroupName)
        }
    }

    /// Captures the screen width so the gesture can recognise the right edge.
    private var widthReader: some View {
        GeometryReader { geo in
            Color.clear
                .onAppear { screenWidth = geo.size.width }
                .onChange(of: geo.size.width) { _, newValue in screenWidth = newValue }
        }
    }

    /// Swipe in from the left edge → Hosts; in from the right edge → Players.
    private var edgeSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 24)
            .onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                if value.startLocation.x < 40, value.translation.width > 60 {
                    peopleSheet = .hosts
                } else if screenWidth > 0,
                          value.startLocation.x > screenWidth - 40,
                          value.translation.width < -60 {
                    peopleSheet = .players
                }
            }
    }
}

private struct EmptyStateCard: View {
    let title: LocalizedStringKey
    let message: LocalizedStringKey
    var systemImage: String = "calendar"

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(message)
        }
        .frame(maxWidth: .infinity, minHeight: 360)
    }
}

private struct EmptySessionsView: View {
    let groupName: String

    var body: some View {
        ContentUnavailableView {
            Label("No sessions yet", systemImage: "figure.badminton")
        } description: {
            Text("Tap + to create the first session for \(groupName).")
        }
        .frame(maxWidth: .infinity, minHeight: 400)
    }
}

/// Renders a list of sessions, each as a large card. Shared by the Sessions,
/// History and Manage-events screens.
struct SessionListContent: View {
    let sessions: [SessionSummary]
    let currentPlayer: Player

    var body: some View {
        ForEach(sessions) { session in
            NavigationLink {
                SessionDetailView(session: session, currentPlayer: currentPlayer)
            } label: {
                SessionCard(session: session)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier(A11y.Home.card(session.id))
            .accessibilityLabel(session.title)
        }
    }
}

// MARK: - Card

/// The session card: a tall cover photo with a photo-count badge, the key
/// details, player avatars and the open slots.
struct SessionCard: View {
    let session: SessionSummary

    var body: some View {
        SessionCardShell(photos: session.photos, imageHeight: 188, showsPhotoCount: true) {
            VStack(alignment: .leading, spacing: VoiSpacing.md) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: VoiSpacing.xs) {
                        Text(session.title)
                            .font(.title3.bold())
                            .foregroundStyle(VoiColor.ink)
                        Text(session.venueName)
                            .font(.subheadline)
                            .foregroundStyle(VoiColor.muted)
                    }

                    Spacer()

                    Text("\(session.joinedPlayerCount)/\(session.maxPlayers)")
                        .font(.headline)
                        .foregroundStyle(VoiColor.court)
                }

                if session.status != .open {
                    StatusBadge(status: session.status)
                }

                HStack {
                    CapsuleLabel(String(format: NSLocalizedString("%lld courts", comment: "court count"), session.courtCount), systemImage: "rectangle.split.2x2")
                    CapsuleLabel(session.skillLevel.label, systemImage: "figure.badminton")
                    CapsuleLabel(session.dateLabel, systemImage: "calendar")
                }

                HStack {
                    Label(session.timeRange, systemImage: "clock")
                    Spacer()
                    Text(CurrencyFormatter.vnd(session.perPlayerCostVnd))
                        .fontWeight(.semibold)
                        .foregroundStyle(VoiColor.ink)
                }
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)

                Divider()

                HStack {
                    AvatarStack(players: session.joinedParticipants.map(\.player))
                    Spacer()
                    Text(session.slotsLabel)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(session.isFull ? VoiColor.accent : VoiColor.court)
                }
            }
        }
    }
}

// MARK: - Card chrome

/// Card chrome shared by the session cards: a flush cover photo on top, padded
/// content below, rounded corners, a hairline border and a soft shadow.
private struct SessionCardShell<Content: View>: View {
    let photos: [URL]
    let imageHeight: CGFloat
    var showsPhotoCount: Bool = false
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                SessionCoverImage(url: photos.first)
                    .frame(maxWidth: .infinity)
                    .frame(height: imageHeight)
                    .clipped()

                if showsPhotoCount && photos.count > 1 {
                    Label("\(photos.count)", systemImage: "photo.on.rectangle.angled")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, VoiSpacing.sm)
                        .padding(.vertical, VoiSpacing.xs)
                        .background(.black.opacity(0.45), in: Capsule())
                        .padding(VoiSpacing.sm)
                }
            }

            content()
                .padding(VoiSpacing.lg)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoiColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous)
                .stroke(VoiColor.line, lineWidth: 1)
        )
        .shadow(color: VoiColor.ink.opacity(0.06), radius: 8, x: 0, y: 2)
        .contentShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
    }
}

/// Loads a remote event photo, with an on-brand gradient placeholder while
/// loading or when offline so a card always has something to show.
struct SessionCoverImage: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            case .empty:
                placeholder.overlay(ProgressView().tint(.white))
            case .failure:
                placeholder
            @unknown default:
                placeholder
            }
        }
    }

    private var placeholder: some View {
        LinearGradient(
            colors: [VoiColor.court, VoiColor.accent],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .overlay(
            Image(systemName: "figure.badminton")
                .font(.system(size: 30, weight: .semibold))
                .foregroundStyle(.white.opacity(0.85))
        )
    }
}

/// Overlapping avatar circles for joined players, with a "+N" overflow chip.
private struct AvatarStack: View {
    let players: [Player]
    var maxShown: Int = 5

    var body: some View {
        let shown = Array(players.prefix(maxShown))
        let overflow = players.count - shown.count

        HStack(spacing: -10) {
            ForEach(shown) { player in
                AvatarView(url: player.displayAvatarUrl, initials: player.initials, size: 30)
                    .overlay(Circle().stroke(VoiColor.surface, lineWidth: 2))
            }

            if overflow > 0 {
                Circle()
                    .fill(VoiColor.background)
                    .frame(width: 30, height: 30)
                    .overlay(
                        Text("+\(overflow)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(VoiColor.muted)
                    )
                    .overlay(Circle().stroke(VoiColor.surface, lineWidth: 2))
            }
        }
    }
}

// MARK: - Filtering

/// Bar shown above the list when a filter is active: the active criteria as
/// chips (tap to edit) with a button to clear them.
private struct FilterSummaryBar: View {
    let filter: SessionFilter
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: VoiSpacing.sm) {
            Image(systemName: "line.3.horizontal.decrease")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(VoiColor.court)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: VoiSpacing.sm) {
                    ForEach(chipLabels, id: \.self) { label in
                        CapsuleLabel(label)
                    }
                }
            }

            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(VoiColor.muted)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, VoiSpacing.md)
        .padding(.vertical, VoiSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoiColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous)
                .stroke(VoiColor.line, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
    }

    private var chipLabels: [String] {
        var labels = SkillLevel.allCases
            .filter { filter.skillLevels.contains($0) }
            .map(\.label)
        labels += filter.venues.sorted()
        if filter.availableOnly {
            labels.append("Available")
        }
        return labels
    }
}

/// Shown when an active filter matches no upcoming sessions.
private struct NoMatchesView: View {
    let onClear: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            Text("No events match your filters")
                .font(.headline)
                .foregroundStyle(VoiColor.ink)
            Text("Try removing some filters to see more events.")
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)
            Button("Clear filters", action: onClear)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(VoiColor.court)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }
}

/// Filter screen presented from the Sessions list. Edits the bound filter live,
/// so the list updates underneath as criteria are toggled.
struct SessionFilterView: View {
    @ObservedObject var viewModel: HomeViewModel
    @Environment(\.dismiss) private var dismiss

    private var filter: SessionFilter { viewModel.filter }

    var body: some View {
        NavigationStack {
            List {
                Section("Show") {
                    row(title: "Upcoming", isOn: !viewModel.showPast, identifier: A11y.Filter.upcoming) { viewModel.showPast = false }
                    row(title: "Past", isOn: viewModel.showPast, identifier: A11y.Filter.past) { viewModel.showPast = true }
                }

                Section("Availability") {
                    Toggle("Only show available", isOn: $viewModel.filter.availableOnly)
                        .tint(VoiColor.court)
                        .accessibilityIdentifier(A11y.Filter.available)
                    Toggle("Saved only", isOn: $viewModel.savedOnly)
                        .tint(VoiColor.court)
                        .accessibilityIdentifier(A11y.Filter.saved)
                }

                Section("Skill level") {
                    ForEach(SkillLevel.allCases) { level in
                        row(title: level.label, isOn: filter.skillLevels.contains(level)) {
                            toggleSkill(level)
                        }
                    }
                }

                if !viewModel.filterableVenues.isEmpty {
                    Section("Venue") {
                        ForEach(viewModel.filterableVenues, id: \.self) { venue in
                            row(title: venue, isOn: filter.venues.contains(venue)) {
                                toggleVenue(venue)
                            }
                        }
                    }
                }

                Section("Sort by") {
                    Picker("Sort", selection: $viewModel.sortOrder) {
                        ForEach(SortOrder.allCases) { order in
                            Text(order.label).tag(order)
                        }
                    }
                    .pickerStyle(.menu)
                }

                if viewModel.filter.isActive || !viewModel.searchText.isEmpty || viewModel.savedOnly {
                    Section {
                        Button("Clear filters", role: .destructive) {
                            viewModel.filter = SessionFilter()
                            viewModel.searchText = ""
                            viewModel.savedOnly = false
                        }
                        .accessibilityIdentifier(A11y.Filter.clear)
                    }
                }
            }
            .searchable(text: $viewModel.searchText, prompt: "Search sessions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        Task {
                            await viewModel.reload()
                            dismiss()
                        }
                    }
                    .accessibilityIdentifier(A11y.Filter.done)
                }
            }
            .onDisappear {
                Task { await viewModel.reload() }
            }
        }
    }

    private func row(title: String, isOn: Bool, identifier: String? = nil, toggle: @escaping () -> Void) -> some View {
        Button(action: toggle) {
            HStack {
                Text(LocalizedStringKey(title))
                    .foregroundStyle(VoiColor.ink)
                Spacer()
                if isOn {
                    Image(systemName: "checkmark")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoiColor.court)
                }
            }
        }
        .accessibilityIdentifier(identifier ?? "filter.row.\(title)")
    }

    private func toggleSkill(_ level: SkillLevel) {
        if viewModel.filter.skillLevels.contains(level) {
            viewModel.filter.skillLevels.remove(level)
        } else {
            viewModel.filter.skillLevels.insert(level)
        }
    }

    private func toggleVenue(_ venue: String) {
        if viewModel.filter.venues.contains(venue) {
            viewModel.filter.venues.remove(venue)
        } else {
            viewModel.filter.venues.insert(venue)
        }
    }
}
