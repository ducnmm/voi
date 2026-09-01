import SwiftUI

/// Identifies which People list a Sessions-screen edge swipe should present.
enum PeopleSheet: Identifiable, Hashable {
    case hosts
    case players

    var id: Int { self == .hosts ? 0 : 1 }
}

// MARK: - People list

/// The list of hosts or players. Hosted inside `PeopleScreen`, which handles the
/// slide-in/out; the close button mirrors the entry direction.
struct PeopleListView: View {
    enum Kind { case hosts, players }

    let kind: Kind
    let people: [PersonProfile]
    var backSymbol = "chevron.left"
    var onClose: () -> Void = {}

    var body: some View {
        ScrollView {
            LazyVStack(spacing: VoiSpacing.md) {
                ForEach(people) { person in
                    NavigationLink {
                        PersonDetailView(person: person)
                    } label: {
                        PersonRow(person: person)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier(A11y.People.row(person.name))
                    .accessibilityLabel(person.name)
                }
            }
            .padding(VoiSpacing.lg)
        }
        .background(VoiColor.background)
        .scrollIndicators(.hidden)
        .navigationTitle(kind == .hosts ? "Hosts" : "Players")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button(action: onClose) {
                    Image(systemName: backSymbol)
                }
                .accessibilityLabel("Close")
                .accessibilityIdentifier(A11y.People.close)
            }
        }
    }
}

/// Presents a People list as a screen that slides in from `originEdge` and is
/// dismissed by dragging back toward that same edge — so Hosts (opened from the
/// left) goes back to the left, and Players (from the right) goes back right.
struct PeopleScreen: View {
    let kind: PeopleListView.Kind
    let people: [PersonProfile]
    let originEdge: HorizontalEdge
    let onClose: () -> Void

    @State private var offsetX: CGFloat?

    var body: some View {
        GeometryReader { geo in
            let width = geo.size.width
            NavigationStack {
                PeopleListView(
                    kind: kind,
                    people: people,
                    backSymbol: originEdge == .leading ? "chevron.left" : "chevron.right",
                    onClose: { close(width) }
                )
                .simultaneousGesture(dragGesture(width))
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .background(VoiColor.background)
            .offset(x: offsetX ?? offscreen(width))
            .onAppear {
                withAnimation(.snappy(duration: 0.28)) { offsetX = 0 }
            }
        }
        .ignoresSafeArea()
    }

    private func offscreen(_ width: CGFloat) -> CGFloat {
        originEdge == .leading ? -width : width
    }

    private func close(_ width: CGFloat) {
        withAnimation(.snappy(duration: 0.28)) {
            offsetX = offscreen(width)
        } completion: {
            onClose()
        }
    }

    private func dragGesture(_ width: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 12)
            .onChanged { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                let translation = value.translation.width
                // Only allow dragging back toward the edge it came in from.
                offsetX = originEdge == .leading ? min(translation, 0) : max(translation, 0)
            }
            .onEnded { _ in
                if abs(offsetX ?? 0) > width * 0.3 {
                    close(width)
                } else {
                    withAnimation(.snappy(duration: 0.2)) { offsetX = 0 }
                }
            }
    }
}

private struct PersonRow: View {
    let person: PersonProfile

    var body: some View {
        HStack(spacing: VoiSpacing.md) {
            AvatarView(url: person.player.displayAvatarUrl, initials: person.initials, size: 48)

            VStack(alignment: .leading, spacing: VoiSpacing.xs) {
                Text(person.name)
                    .font(.headline)
                    .foregroundStyle(VoiColor.ink)
                Text(activityText)
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)
            }

            Spacer()

            RatingBadge(rating: person.averageRating, reviewCount: person.reviewCount)
        }
        .padding(VoiSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoiColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous)
                .stroke(VoiColor.line, lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))
    }

    private var activityText: String {
        let key = person.role == .host ? "%lld sessions hosted" : "%lld events joined"
        return String(format: NSLocalizedString(key, comment: "people activity count"), person.activityCount)
    }
}

// MARK: - Person detail

/// A host or player profile: headline stats and the reviews left for them.
struct PersonDetailView: View {
    let person: PersonProfile
    @EnvironmentObject private var store: DemoStore
    @EnvironmentObject private var environment: AppEnvironment
    @State private var reviewsList: [Review] = []

    /// Live profile from the store so a freshly written review shows at once.
    private var current: PersonProfile {
        store.person(id: person.id) ?? person
    }

    private func toggleFollow() async {
        await store.toggleFollow(
            current.player.id,
            api: environment.apiClient,
            token: environment.authSession.token
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: VoiSpacing.lg) {
                header
                reviews
            }
            .padding(VoiSpacing.lg)
        }
        .background(VoiColor.background)
        .navigationTitle(current.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.visible, for: .navigationBar)
        .task { await loadReviews() }
    }

    private func loadReviews() async {
        guard let token = environment.authSession.token else { return }
        do {
            reviewsList = try await environment.apiClient
                .fetchUserReviews(token: token, userId: current.player.id)
                .reviews
                .map(Review.init(dto:))
        } catch {
            // keep what's on screen if it can't load
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.lg) {
            HStack(spacing: VoiSpacing.md) {
                AvatarView(url: current.player.displayAvatarUrl, initials: current.initials, size: 64)
                VStack(alignment: .leading, spacing: VoiSpacing.xs) {
                    Text(current.name)
                        .font(.title3.bold())
                        .foregroundStyle(VoiColor.ink)
                    Text(current.role == .host ? "Host" : "Player")
                        .font(.subheadline)
                        .foregroundStyle(VoiColor.muted)
                }
                Spacer()
                if current.player.id != environment.authSession.currentPlayer.id {
                    Button { Task { await toggleFollow() } } label: {
                        Text(store.isFollowing(current.player.id) ? "Following" : "Follow")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, VoiSpacing.md)
                            .padding(.vertical, VoiSpacing.sm)
                            .background(store.isFollowing(current.player.id) ? VoiColor.court : VoiColor.court.opacity(0.14), in: Capsule())
                            .foregroundStyle(store.isFollowing(current.player.id) ? Color.white : VoiColor.court)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier(A11y.People.follow)
                }
            }

            HStack {
                stat(value: "\(current.activityCount)", label: current.role == .host ? "Hosted" : "Joined")
                Divider().frame(height: 32)
                stat(value: current.reviewCount == 0 ? "—" : String(format: "%.1f", current.averageRating), label: "Rating")
                Divider().frame(height: 32)
                stat(value: "\(current.reviewCount)", label: "Reviews")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    private func stat(value: String, label: LocalizedStringKey) -> some View {
        VStack(spacing: VoiSpacing.xs) {
            Text(value)
                .font(.title3.bold())
                .foregroundStyle(VoiColor.ink)
            Text(label)
                .font(.caption)
                .foregroundStyle(VoiColor.muted)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var reviews: some View {
        Text("Reviews")
            .font(.headline)
            .foregroundStyle(VoiColor.ink)
            .frame(maxWidth: .infinity, alignment: .leading)

        if reviewsList.isEmpty {
            Text("No reviews yet")
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .voiCard()
        } else {
            ForEach(reviewsList) { review in
                ReviewCard(review: review)
            }
        }
    }
}

private struct ReviewCard: View {
    let review: Review

    var body: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.sm) {
            HStack(spacing: VoiSpacing.sm) {
                AvatarView(url: review.author.displayAvatarUrl, initials: review.authorInitials, size: 32)
                Text(review.authorName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoiColor.ink)
                Spacer()
                StarRow(rating: review.rating)
            }

            Text(review.comment)
                .font(.subheadline)
                .foregroundStyle(VoiColor.ink)

            Text(review.date, style: .date)
                .font(.caption)
                .foregroundStyle(VoiColor.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }
}

// MARK: - Small components

private struct StarRow: View {
    let rating: Int

    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { index in
                Image(systemName: index <= rating ? "star.fill" : "star")
                    .font(.caption2)
                    .foregroundStyle(VoiColor.accent)
            }
        }
    }
}

private struct RatingBadge: View {
    let rating: Double
    let reviewCount: Int

    var body: some View {
        if reviewCount == 0 {
            Text("New")
                .font(.caption.weight(.semibold))
                .foregroundStyle(VoiColor.muted)
                .padding(.horizontal, VoiSpacing.sm)
                .padding(.vertical, VoiSpacing.xs)
                .background(VoiColor.background, in: Capsule())
        } else {
            HStack(spacing: VoiSpacing.xs) {
                Image(systemName: "star.fill")
                    .font(.caption2)
                    .foregroundStyle(VoiColor.accent)
                Text(String(format: "%.1f", rating))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(VoiColor.ink)
                Text("(\(reviewCount))")
                    .font(.caption)
                    .foregroundStyle(VoiColor.muted)
            }
        }
    }
}
