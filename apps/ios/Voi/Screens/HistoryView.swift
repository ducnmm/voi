import SwiftUI

/// Left page of the home pager: sessions that have already finished.
struct HistoryView: View {
    @ObservedObject var viewModel: HomeViewModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: VoiSpacing.md) {
                    if viewModel.pastSessions.isEmpty {
                        EmptyHistoryView()
                    } else {
                        SessionListContent(
                            sessions: viewModel.pastSessions,
                            currentPlayer: viewModel.currentPlayer
                        )
                    }
                }
                .padding(VoiSpacing.lg)
            }
            .background(VoiColor.background)
            .scrollIndicators(.hidden)
            .hardBottomScrollEdge()
            .navigationTitle("History")
            .refreshable {
                await viewModel.reload()
            }
        }
    }
}

private struct EmptyHistoryView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            Text("No past sessions")
                .font(.headline)
                .foregroundStyle(VoiColor.ink)

            Text("Finished sessions will show up here.")
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .voiCard()
    }
}
