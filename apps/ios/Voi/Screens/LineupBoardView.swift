import SwiftUI

struct LineupBoardView: View {
    @ObservedObject var viewModel: SessionDetailViewModel

    private var session: SessionSummary { viewModel.session }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: VoiSpacing.lg) {
                Text("Tap a player to move them between courts or the bench.")
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)

                ForEach(session.courts) { court in
                    courtCard(court)
                }

                benchCard
            }
            .padding(VoiSpacing.lg)
        }
        .background(VoiColor.background)
        .navigationTitle("Lineup")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func courtCard(_ court: CourtLineup) -> some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            HStack {
                Text(court.label)
                    .font(.headline)
                    .foregroundStyle(VoiColor.court)
                Spacer()
                Text("\(court.players.count)/4")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(court.players.count >= 4 ? VoiColor.accent : VoiColor.muted)
            }

            if court.players.isEmpty {
                Text("Empty court")
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)
            } else {
                ForEach(court.players) { player in
                    PlayerRow(player: player, trailingIcon: "ellipsis.circle") {
                        moveMenu(for: player, excluding: court.id)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    private var benchCard: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            Text("Bench")
                .font(.headline)

            if session.benchPlayers.isEmpty {
                Text("Everyone is assigned to a court.")
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.muted)
            } else {
                ForEach(session.benchPlayers) { player in
                    PlayerRow(player: player, trailingIcon: "plus.circle") {
                        assignMenu(for: player)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }

    @ViewBuilder
    private func moveMenu(for player: Player, excluding courtId: String) -> some View {
        ForEach(session.courts.filter { $0.id != courtId }) { target in
            Button("Move to \(target.label)") {
                Task { await viewModel.assign(player, to: target) }
            }
        }
        Button("Send to bench", role: .destructive) {
            Task { await viewModel.bench(player) }
        }
    }

    @ViewBuilder
    private func assignMenu(for player: Player) -> some View {
        ForEach(session.courts) { target in
            Button("Assign to \(target.label)") {
                Task { await viewModel.assign(player, to: target) }
            }
        }
    }
}

private struct PlayerRow<MenuContent: View>: View {
    let player: Player
    let trailingIcon: String
    @ViewBuilder let menu: () -> MenuContent

    var body: some View {
        Menu {
            menu()
        } label: {
            HStack {
                AvatarView(url: player.displayAvatarUrl, initials: player.initials, size: 32)

                VStack(alignment: .leading, spacing: 0) {
                    Text(player.displayName)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(VoiColor.ink)
                    Text(player.skillLevel.label)
                        .font(.caption)
                        .foregroundStyle(VoiColor.muted)
                }

                Spacer()

                Image(systemName: trailingIcon)
                    .foregroundStyle(VoiColor.muted)
            }
            .padding(VoiSpacing.sm)
            .background(VoiColor.background)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
    }
}
