import SwiftUI

/// Landing screen for an invite link: resolves a token, shows the session, and
/// accepts membership + optional RSVP join.
struct InviteView: View {
    /// Pre-resolved session (demo / deep link that already fetched).
    var session: SessionSummary?
    /// Invite token from `voi://invites/{token}` or a pasted code.
    var inviteToken: String?
    var onJoined: ((SessionSummary) -> Void)?

    @EnvironmentObject private var environment: AppEnvironment
    @Environment(\.dismiss) private var dismiss

    @State private var resolvedSession: SessionSummary?
    @State private var tokenInput: String = ""
    @State private var isLoading = false
    @State private var isJoining = false
    @State private var errorMessage: String?
    @State private var joined = false

    init(
        session: SessionSummary? = nil,
        inviteToken: String? = nil,
        onJoined: ((SessionSummary) -> Void)? = nil
    ) {
        self.session = session
        self.inviteToken = inviteToken
        self.onJoined = onJoined
        _tokenInput = State(initialValue: inviteToken ?? "")
        _resolvedSession = State(initialValue: session)
    }

    private var displaySession: SessionSummary? {
        resolvedSession ?? session
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: VoiSpacing.lg) {
                    if let displaySession {
                        sessionContent(displaySession)
                    } else {
                        tokenEntry
                    }

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.subheadline)
                            .foregroundStyle(.red)
                    }
                }
                .padding(VoiSpacing.lg)
            }
            .background(VoiColor.background)
            .navigationTitle("Invite")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .accessibilityIdentifier(A11y.Invite.done)
                }
            }
            .task {
                if let inviteToken, resolvedSession == nil {
                    await resolve(token: inviteToken)
                }
            }
        }
    }

    private var tokenEntry: some View {
        VStack(alignment: .leading, spacing: VoiSpacing.md) {
            Text("Open invite")
                .font(.title3.bold())
            Text("Paste an invite token or open a voi://invites/… link.")
                .font(.subheadline)
                .foregroundStyle(VoiColor.muted)

            TextField("Invite token", text: $tokenInput)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(VoiSpacing.md)
                .background(VoiColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: VoiRadius.control, style: .continuous))
                .accessibilityIdentifier(A11y.Invite.token)

            Button {
                Task { await resolve(token: tokenInput.trimmingCharacters(in: .whitespacesAndNewlines)) }
            } label: {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, VoiSpacing.md)
                } else {
                    Text("Look up invite")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, VoiSpacing.md)
                        .background(VoiColor.court)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: VoiRadius.control, style: .continuous))
                }
            }
            .buttonStyle(.plain)
            .disabled(tokenInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
            .accessibilityIdentifier(A11y.Invite.lookup)
        }
    }

    @ViewBuilder
    private func sessionContent(_ session: SessionSummary) -> some View {
        SessionCoverImage(url: session.photos.first)
            .frame(height: 200)
            .frame(maxWidth: .infinity)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: VoiRadius.card, style: .continuous))

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

        Label(timeRange(for: session), systemImage: "clock")
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
            Task { await join(session) }
        } label: {
            if isJoining {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, VoiSpacing.md)
            } else {
                Label(
                    joined ? "Joined" : "Join",
                    systemImage: joined ? "checkmark.circle.fill" : "plus.circle.fill"
                )
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, VoiSpacing.md)
                .background(joined ? VoiColor.court : VoiColor.court.opacity(0.14))
                .foregroundStyle(joined ? Color.white : VoiColor.court)
                .clipShape(RoundedRectangle(cornerRadius: VoiRadius.control, style: .continuous))
            }
        }
        .buttonStyle(.plain)
        .disabled(joined || isJoining || session.isCancelled)
        .padding(.top, VoiSpacing.sm)
        .accessibilityIdentifier(A11y.Invite.join)
    }

    private func resolve(token: String) async {
        guard !token.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let response = try await environment.apiClient.resolveInvite(token: token)
            if let dto = response.invite.session {
                resolvedSession = SessionSummary(
                    dto: dto,
                    inviteUrl: "voi://invites/\(response.invite.token)"
                )
                tokenInput = response.invite.token
            } else if let group = response.invite.group {
                errorMessage = "Invite is for group “\(group.name)”. Open it after accepting to see sessions."
                // Still accept membership without a session card.
                resolvedSession = nil
            } else {
                errorMessage = "Invite has no session attached."
            }
        } catch {
            errorMessage = (error as? APIErrorResponse)?.error.message ?? "Invite not found or expired."
        }
    }

    private func join(_ session: SessionSummary) async {
        isJoining = true
        errorMessage = nil
        defer { isJoining = false }

        let token = tokenInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let authToken = environment.authSession.token else {
            errorMessage = "Sign in to accept this invite."
            return
        }

        do {
            // Accept group membership when we have a real invite token.
            if !token.isEmpty {
                _ = try await environment.apiClient.acceptInvite(token: authToken, inviteToken: token)
            }

            // RSVP join on the session.
            let response = try await environment.apiClient.rsvp(
                token: authToken,
                sessionId: session.id,
                status: "JOINED"
            )
            let updated = SessionSummary(dto: response.session, inviteUrl: session.inviteUrl)
            resolvedSession = updated
            joined = true
            onJoined?(updated)
        } catch {
            errorMessage = (error as? APIErrorResponse)?.error.message ?? "Could not join this session."
        }
    }

    private func timeRange(for session: SessionSummary) -> String {
        let day = DateFormatter()
        day.setLocalizedDateFormatFromTemplate("EEEdMMM")
        let time = DateFormatter()
        time.dateFormat = "HH:mm"
        return "\(day.string(from: session.startsAt)) · \(time.string(from: session.startsAt))-\(time.string(from: session.endsAt))"
    }
}
