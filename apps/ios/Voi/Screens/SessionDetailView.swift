import SwiftUI
import MapKit

struct SessionDetailView: View {
    @StateObject private var viewModel: SessionDetailViewModel
    @EnvironmentObject private var store: DemoStore
    @EnvironmentObject private var environment: AppEnvironment
    @State private var editing = false
    @State private var paying = false
    @State private var showingCalendar = false
    @State private var showingChat = false
    @State private var addingScore = false
    @State private var reviewSubject: Player?

    init(session: SessionSummary, currentPlayer: Player) {
        _viewModel = StateObject(
            wrappedValue: SessionDetailViewModel(session: session, currentPlayer: currentPlayer)
        )
    }

    private var session: SessionSummary { viewModel.session }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: VoiSpacing.lg) {
                if session.isCancelled {
                    cancelledBanner
                }
                gallery
                summary
                venueMap
                rsvpControls
                costSplit
                lineup
                attendance
                scoresSection
                ratePlayers
                waitlist
            }
            .padding(VoiSpacing.lg)
        }
        .background(VoiColor.background)
        .task {
            viewModel.configure(api: environment.apiClient, authSession: environment.authSession)
            await viewModel.loadResults()
        }
        .navigationTitle(session.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await store.toggleFavorite(session.id, api: environment.apiClient, token: environment.authSession.token) }
                } label: {
                    Image(systemName: store.isFavorite(session.id) ? "bookmark.fill" : "bookmark")
                }
                .accessibilityLabel("Save")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showingChat = true } label: {
                    Image(systemName: "bubble.left.and.bubble.right")
                }
                .accessibilityLabel("Chat")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    if let inviteUrl = session.inviteUrl, let url = URL(string: inviteUrl) {
                        ShareLink(item: url) {
                            Label("Share invite", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button { showingCalendar = true } label: {
                        Label("Add to Calendar", systemImage: "calendar.badge.plus")
                    }
                    if viewModel.isHost {
                        Divider()
                        Button { editing = true } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Button(role: .destructive) { Task { await viewModel.cancelSession() } } label: {
                            Label("Cancel session", systemImage: "xmark.octagon")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $editing) {
            CreateSessionView(groupName: session.venueName, editing: session) { draft in
                await viewModel.applyEdit(draft)
            }
        }
        .sheet(isPresented: $paying) {
            PaymentQRView(
                amount: viewModel.myUnpaidAmount ?? session.perPlayerCostVnd ?? 0,
                sessionTitle: session.title
            ) {
                viewModel.markPaid(viewModel.currentPlayer)
            }
        }
        .sheet(isPresented: $showingCalendar) {
            CalendarEditView(session: session)
        }
        .navigationDestination(isPresented: $showingChat) {
            ChatView(sessionId: session.id, sessionTitle: session.title)
        }
        .sheet(isPresented: $addingScore) {
            AddScoreView { label, scoreA, scoreB in
                Task { await viewModel.addScore(label: label, scoreA: scoreA, scoreB: scoreB) }
            }
        }
        .sheet(item: $reviewSubject) { player in
            WriteReviewView(personName: player.displayName) { rating, comment in
                Task { await viewModel.submitReview(subjectId: player.id, rating: rating, comment: comment) }
            }
        }
    }

    private var cancelledBanner: some View {
        Label("This session was cancelled.", systemImage: "xmark.octagon.fill")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.red)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(VoiSpacing.md)
            .background(Color.red.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }

    @ViewBuilder
    private var attendance: some View {
        if viewModel.isHost && !session.joinedParticipants.isEmpty {
            VStack(alignment: .leading, spacing: VoiSpacing.md) {
                Text("Attendance")
                    .font(.headline)
                ForEach(session.joinedParticipants) { participant in
                    Button {
                        Task { await viewModel.toggleCheckIn(participant) }
                    } label: {
                        HStack {
                            Image(systemName: participant.isCheckedIn ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(participant.isCheckedIn ? VoiColor.court : VoiColor.muted)
                            Text(participant.player.displayName)
                                .foregroundStyle(VoiColor.ink)
                            Spacer()
                            Text(participant.isCheckedIn ? "Checked in" : "Not yet")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(participant.isCheckedIn ? VoiColor.court : VoiColor.muted)
                        }
                        .font(.subheadline)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .voiCard()
        }
    }

    private var sessionScores: [MatchScore] { viewModel.results }

    @ViewBuilder
    private var ratePlayers: some View {
        let others = session.joinedParticipants.filter { $0.player.id != viewModel.currentPlayer.id }
        if viewModel.isAttendee && !others.isEmpty {
            VStack(alignment: .leading, spacing: VoiSpacing.md) {
                Text("Rate players")
                    .font(.headline)
                ForEach(others) { participant in
                    HStack {
                        AvatarView(url: participant.player.displayAvatarUrl, initials: participant.player.initials, size: 28)
                        Text(participant.player.displayName)
                            .foregroundStyle(VoiColor.ink)
                        Spacer()
                        Button("Rate") { reviewSubject = participant.player }
                            .font(.subheadline.weight(.medium))
                    }
                    .font(.subheadline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .voiCard()
        }
    }

    private var scoresSection: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            HStack {
                Text("Match results")
                    .font(.headline)
                Spacer()
                Button { addingScore = true } label: {
                    Label("Add", systemImage: "plus")
                        .font(.subheadline.weight(.medium))
                }
            }

            if sessionScores.isEmpty {
                Text("No results yet.")
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)
            } else {
                ForEach(sessionScores) { score in
                    HStack {
                        Text(score.label)
                            .foregroundStyle(VoiColor.muted)
                        Spacer()
                        Text("\(score.scoreA) - \(score.scoreB)")
                            .fontWeight(.semibold)
                            .foregroundStyle(VoiColor.ink)
                    }
                    .font(.subheadline)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    private var venueMap: some View {
        let coordinate = Mock.venueCoordinate(session.venueName)
        return VStack(alignment: .leading, spacing: VoiSpacing.md) {
            HStack {
                Label(session.venueName, systemImage: "mappin.and.ellipse")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(VoiColor.ink)
                Spacer()
                Button { openDirections(coordinate) } label: {
                    Label("Directions", systemImage: "location.fill")
                        .font(.subheadline.weight(.medium))
                }
            }
            Map(initialPosition: .region(MKCoordinateRegion(center: coordinate, latitudinalMeters: 700, longitudinalMeters: 700))) {
                Marker(session.venueName, coordinate: coordinate)
                    .tint(VoiColor.court)
            }
            .frame(height: 140)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .allowsHitTesting(false)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    private func openDirections(_ coordinate: CLLocationCoordinate2D) {
        let item = MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
        item.name = session.venueName
        item.openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDriving])
    }

    // MARK: - Gallery

    private var gallery: some View {
        TabView {
            ForEach(Array(session.photos.enumerated()), id: \.offset) { _, url in
                SessionCoverImage(url: url)
                    .frame(maxWidth: .infinity)
                    .clipped()
            }
        }
        .tabViewStyle(.page(indexDisplayMode: session.photos.count > 1 ? .always : .never))
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoiColor.line, lineWidth: 1)
        )
    }

    // MARK: - Summary

    private var summary: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            Text(session.venueName)
                .font(.title3.bold())

            HStack {
                CapsuleLabel("\(session.joinedPlayerCount)/\(session.maxPlayers) joined")
                CapsuleLabel("\(session.waitlistCount) waiting")
                CapsuleLabel(session.skillLevel.label, systemImage: "figure.badminton")
            }

            Label(timeRange, systemImage: "clock")
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    // MARK: - RSVP

    private var rsvpControls: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            Text("Your RSVP")
                .font(.headline)

            Text(viewModel.statusBanner)
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)

            // Primary join CTA.
            Button {
                Task { await viewModel.join() }
            } label: {
                Label(joinTitle, systemImage: joinIsActive ? "checkmark.circle.fill" : "plus.circle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, VoiSpacing.md)
                    .background(joinIsActive ? VoiColor.court : VoiColor.court.opacity(0.14))
                    .foregroundStyle(joinIsActive ? Color.white : VoiColor.court)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(session.isCancelled)

            HStack(spacing: VoiSpacing.sm) {
                RSVPButton(
                    title: "Maybe",
                    systemImage: "questionmark.circle.fill",
                    isActive: viewModel.myStatus == .maybe,
                    activeColor: VoiColor.accent
                ) {
                    Task { await viewModel.setMaybe() }
                }

                RSVPButton(
                    title: "Can't go",
                    systemImage: "xmark.circle.fill",
                    isActive: viewModel.myStatus == .declined,
                    activeColor: .red
                ) {
                    Task { await viewModel.decline() }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    private var joinIsActive: Bool {
        viewModel.myStatus == .joined || viewModel.myStatus == .waitlisted
    }

    private var joinTitle: LocalizedStringKey {
        if viewModel.myStatus == .joined { return "Joined" }
        if viewModel.myStatus == .waitlisted { return "On waitlist" }
        return session.isFull ? "Join waitlist" : "Join"
    }

    // MARK: - Cost split

    private var costSplit: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            HStack {
                Text("Cost split")
                    .font(.headline)
                Spacer()
                Text("\(session.paidCount)/\(session.joinedPlayerCount) paid")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoiColor.court)
            }

            if session.fixedPricePerPlayerVnd == nil {
                costRow("Court fee", session.feeTotalVnd)
                costRow("Shuttlecocks", session.shuttlecockCostVnd)
                Divider()
                costRow("Total", session.totalCostVnd)
            }

            HStack {
                Text("Per player")
                    .foregroundStyle(VoiColor.muted)
                Spacer()
                Text(CurrencyFormatter.vnd(session.perPlayerCostVnd))
                    .fontWeight(.semibold)
            }
            .font(.subheadline)

            if let owed = viewModel.myUnpaidAmount {
                Button { paying = true } label: {
                    Label("Pay \(CurrencyFormatter.vnd(owed))", systemImage: "qrcode")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, VoiSpacing.sm)
                        .background(VoiColor.court.opacity(0.14))
                        .foregroundStyle(VoiColor.court)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
                .buttonStyle(.plain)
            }

            if !session.joinedParticipants.isEmpty {
                Divider()
                ForEach(session.joinedParticipants) { participant in
                    Button {
                        Task { await viewModel.togglePayment(participant) }
                    } label: {
                        HStack {
                            Image(systemName: participant.hasPaid ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(participant.hasPaid ? VoiColor.court : VoiColor.muted)
                            Text(participant.player.displayName)
                                .foregroundStyle(VoiColor.ink)
                            Spacer()
                            Text(participant.hasPaid ? "Paid" : "Unpaid")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(participant.hasPaid ? VoiColor.court : VoiColor.muted)
                        }
                        .font(.subheadline)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    private func costRow(_ label: String, _ amount: Int?) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(VoiColor.muted)
            Spacer()
            Text(CurrencyFormatter.vnd(amount))
        }
        .font(.subheadline)
    }

    // MARK: - Lineup

    private var lineup: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            HStack {
                Text("Lineup")
                    .font(.headline)
                Spacer()
                if viewModel.isHost {
                    NavigationLink {
                        LineupBoardView(viewModel: viewModel)
                    } label: {
                        Label("Edit", systemImage: "slider.horizontal.3")
                            .font(.subheadline.weight(.medium))
                    }
                }
            }

            ForEach(session.courts) { court in
                VStack(alignment: .leading, spacing: VoiSpacing.sm) {
                    Text(court.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoiColor.court)

                    if court.players.isEmpty {
                        Text("No players assigned yet.")
                            .font(.caption)
                            .foregroundStyle(VoiColor.muted)
                    } else {
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: VoiSpacing.sm) {
                            ForEach(court.players) { player in
                                NavigationLink {
                                    PersonDetailView(person: store.profile(for: player))
                                } label: {
                                    PlayerSlot(player: player)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.top, VoiSpacing.sm)
            }

            if !session.benchPlayers.isEmpty {
                Divider()
                Text("Not assigned")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoiColor.muted)
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: VoiSpacing.sm) {
                    ForEach(session.benchPlayers) { player in
                        NavigationLink {
                            PersonDetailView(person: store.profile(for: player))
                        } label: {
                            PlayerSlot(player: player)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    // MARK: - Waitlist

    @ViewBuilder
    private var waitlist: some View {
        if !session.waitlist.isEmpty {
            VStack(alignment: .leading, spacing: VoiSpacing.md) {
                Text("Waitlist")
                    .font(.headline)

                ForEach(session.waitlist) { participant in
                    HStack {
                        Text("\(participant.waitlistPosition ?? 0)")
                            .font(.caption.weight(.bold))
                            .frame(width: 28, height: 28)
                            .background(VoiColor.background)
                            .clipShape(Circle())

                        Text(participant.player.displayName)
                        Spacer()
                        Text(participant.player.skillLevel.label)
                            .foregroundStyle(VoiColor.muted)
                    }
                    .font(.subheadline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .voiCard()
        }
    }

    private var timeRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE HH:mm"
        let end = DateFormatter()
        end.dateFormat = "HH:mm"
        return "\(formatter.string(from: session.startsAt)) - \(end.string(from: session.endsAt))"
    }
}

private struct RSVPButton: View {
    let title: String
    let systemImage: String
    let isActive: Bool
    let activeColor: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: VoiSpacing.xs) {
                Image(systemName: systemImage)
                    .font(.title3)
                Text(title)
                    .font(.caption.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, VoiSpacing.md)
            .background(isActive ? activeColor.opacity(0.16) : VoiColor.background)
            .foregroundStyle(isActive ? activeColor : VoiColor.muted)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(isActive ? activeColor : VoiColor.line, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct PlayerSlot: View {
    let player: Player

    var body: some View {
        HStack {
            AvatarView(url: player.displayAvatarUrl, initials: player.initials, size: 28)

            Text(player.displayName)
                .font(.subheadline.weight(.medium))
                .lineLimit(1)

            Spacer()
        }
        .padding(VoiSpacing.sm)
        .background(VoiColor.background)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
