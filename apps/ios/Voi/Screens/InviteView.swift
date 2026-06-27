import SwiftUI

/// Landing screen for an invite link: shows the session and a big Join button.
struct InviteView: View {
    let session: SessionSummary
    let onJoin: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var joined = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: VoiSpacing.lg) {
                    SessionCoverImage(url: session.photos.first)
                        .frame(height: 200)
                        .frame(maxWidth: .infinity)
                        .clipped()
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                    Text("You're invited to")
                        .font(.subheadline)
                        .foregroundStyle(VoiColor.muted)

                    Text(session.title)
                        .font(.title2.bold())
                        .foregroundStyle(VoiColor.ink)

                    HStack {
                        CapsuleLabel(session.venueName, systemImage: "mappin.and.ellipse")
                        CapsuleLabel(session.skillLevel.label, systemImage: "figure.badminton")
                    }

                    Label(timeRange, systemImage: "clock")
                        .font(.subheadline)
                        .foregroundStyle(VoiColor.muted)

                    HStack {
                        Text("\(session.joinedPlayerCount)/\(session.maxPlayers) joined")
                        Spacer()
                        Text(CurrencyFormatter.vnd(session.perPlayerCostVnd))
                            .fontWeight(.semibold)
                    }
                    .font(.subheadline)
                    .foregroundStyle(VoiColor.ink)

                    Button {
                        joined = true
                        onJoin()
                    } label: {
                        Label(joined ? "Joined" : "Join", systemImage: joined ? "checkmark.circle.fill" : "plus.circle.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, VoiSpacing.md)
                            .background(joined ? VoiColor.court : VoiColor.court.opacity(0.14))
                            .foregroundStyle(joined ? Color.white : VoiColor.court)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, VoiSpacing.sm)
                }
                .padding(VoiSpacing.lg)
            }
            .background(VoiColor.background)
            .navigationTitle("Invite")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var timeRange: String {
        let day = DateFormatter()
        day.setLocalizedDateFormatFromTemplate("EEEdMMM")
        let time = DateFormatter()
        time.dateFormat = "HH:mm"
        return "\(day.string(from: session.startsAt)) · \(time.string(from: session.startsAt))-\(time.string(from: session.endsAt))"
    }
}
