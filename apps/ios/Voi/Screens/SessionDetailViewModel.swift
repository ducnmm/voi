import SwiftUI

@MainActor
final class SessionDetailViewModel: ObservableObject {
    @Published var session: SessionSummary
    @Published var results: [MatchScore] = []
    @Published var actionError: String?
    @Published var isRefreshing = false

    let currentPlayer: Player

    /// Host-only UI gates. Derived from server `hostUserId`, never defaulted true.
    var isHost: Bool {
        !session.hostUserId.isEmpty && session.hostUserId == currentPlayer.id
    }

    init(session: SessionSummary, currentPlayer: Player) {
        self.session = session
        self.currentPlayer = currentPlayer
    }

    private var api: APIClient?
    private var authSession: AuthSession?
    private var token: String? { authSession?.token }

    /// Supplies the API client + session once the environment is available
    /// (environment objects aren't accessible from the View's initializer).
    func configure(api: APIClient, authSession: AuthSession) {
        self.api = api
        self.authSession = authSession
    }

    var myStatus: RsvpStatus? {
        session.participants
            .first { $0.player.id == currentPlayer.id }?
            .rsvpStatus
    }

    var statusBanner: String {
        if session.isCancelled {
            return "This session was cancelled."
        }
        switch myStatus {
        case .joined:
            return "You're in for this session."
        case .waitlisted:
            if let position = session.participants.first(where: { $0.player.id == currentPlayer.id })?.waitlistPosition {
                return "You're #\(position) on the waitlist."
            }
            return "You're on the waitlist."
        case .maybe:
            return "You marked yourself as maybe."
        case .declined, .cancelled:
            return "You're not going."
        case .none:
            return session.isFull
                ? "Session is full — join to get on the waitlist."
                : "Tap Join to grab a spot."
        }
    }

    // MARK: - Load

    /// Re-fetch the session from the server so detail always shows fresh state.
    func refresh() async {
        guard let api else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            guard let token else { return }
            let response = try await api.session(token: token, id: session.id)
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            // Keep the list snapshot if refresh fails (offline / local demo ids).
        }
    }

    // MARK: - RSVP

    func join() async { await setRSVP(.joined) }
    func setMaybe() async { await setRSVP(.maybe) }
    func decline() async { await setRSVP(.declined) }

    private func setRSVP(_ status: RsvpStatus) async {
        let previous = session
        session.setRSVP(status, for: currentPlayer) // optimistic
        guard let api, let token else { return }
        do {
            let response = try await api.rsvp(
                token: token,
                sessionId: session.id,
                status: status.apiValue
            )
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            session = previous
            actionError = Self.message(for: error, fallback: "Could not update RSVP.")
        }
    }

    // MARK: - Cost split

    /// Host toggles paid/unpaid for a participant.
    func togglePayment(_ participant: Participant) async {
        guard isHost else {
            actionError = "Only the host can mark payment status."
            return
        }
        let previous = session
        let nextPaid = !participant.hasPaid
        session.togglePayment(participantId: participant.id) // optimistic
        guard let api, let token else { return }
        do {
            let response = try await api.updatePayment(
                token: token,
                sessionId: session.id,
                participantId: participant.id,
                status: nextPaid ? "PAID" : "UNPAID"
            )
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            session = previous
            actionError = Self.message(for: error, fallback: "Could not update payment.")
        }
    }

    /// Player self-mark after scanning VietQR. Server only allows hosts today —
    /// if the current user is host, update via API; otherwise show a clear note.
    func markPaid(_ player: Player) async {
        guard let participant = session.participants.first(where: { $0.player.id == player.id }),
              !participant.hasPaid else { return }

        if isHost {
            await togglePayment(participant)
            return
        }

        return
    }

    // MARK: - Check-in (host)

    func toggleCheckIn(_ participant: Participant) async {
        guard isHost else {
            actionError = "Only the host can manage attendance."
            return
        }
        let previous = session
        let wasCheckedIn = participant.isCheckedIn
        setCheckedIn(participant.id, !wasCheckedIn) // optimistic
        guard let api, let token else { return }
        do {
            let response = wasCheckedIn
                ? try await api.uncheckIn(token: token, sessionId: session.id, participantId: participant.id)
                : try await api.checkIn(token: token, sessionId: session.id, participantId: participant.id)
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            session = previous
            actionError = Self.message(for: error, fallback: "Could not update check-in.")
        }
    }

    private func setCheckedIn(_ participantId: String, _ value: Bool) {
        guard let index = session.participants.firstIndex(where: { $0.id == participantId }) else { return }
        session.participants[index].isCheckedIn = value
    }

    // MARK: - Match results

    func loadResults() async {
        guard let api else { return }
        do {
            guard let token else { return }
            let response = try await api.fetchResults(token: token, sessionId: session.id)
            results = response.results.map(MatchScore.init(dto:))
        } catch {
        }
    }

    func addScore(label: String, scoreA: Int, scoreB: Int) async {
        guard let api, let token else { return }
        do {
            let response = try await api.addResult(
                token: token,
                sessionId: session.id,
                label: label,
                scoreA: scoreA,
                scoreB: scoreB
            )
            results.append(MatchScore(dto: response.result))
            actionError = nil
        } catch {
            actionError = Self.message(for: error, fallback: "Could not save match result.")
        }
    }

    // MARK: - Reviews (rate co-participants you attended with)

    /// True when the current user is a checked-in participant — only then may
    /// they review the others (the server enforces this too).
    var isAttendee: Bool {
        session.participants.first { $0.player.id == currentPlayer.id }?.isCheckedIn ?? false
    }

    func submitReview(subjectId: String, rating: Int, comment: String) async {
        guard let api, let token else { return }
        do {
            _ = try await api.addReview(
                token: token,
                sessionId: session.id,
                subjectId: subjectId,
                rating: rating,
                comment: comment.isEmpty ? nil : comment
            )
            actionError = nil
        } catch {
            actionError = Self.message(for: error, fallback: "Could not submit review.")
        }
    }

    // MARK: - Host actions

    func cancelSession() async {
        guard isHost else {
            actionError = "Only the host can cancel this session."
            return
        }
        let previous = session
        session.isCancelled = true // optimistic
        guard let api, let token else { return }
        do {
            let response = try await api.cancelSession(token: token, sessionId: session.id)
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            session = previous
            actionError = Self.message(for: error, fallback: "Could not cancel session.")
        }
    }

    func applyEdit(_ draft: CreateSessionDraft) async {
        guard isHost else {
            actionError = "Only the host can edit this session."
            return
        }
        let previous = session
        let trimmed = draft.title.trimmingCharacters(in: .whitespacesAndNewlines)
        session.title = trimmed.isEmpty ? draft.venueName : trimmed
        session.venueName = draft.venueName
        session.startsAt = draft.startsAt
        session.endsAt = draft.endsAt
        session.courtCount = draft.courtCount
        session.maxPlayers = draft.maxPlayers
        session.skillLevel = draft.skillLevel
        session.fixedPricePerPlayerVnd = draft.fixedPricePerPlayerVnd
        session.feeTotalVnd = draft.fixedPricePerPlayerVnd == nil ? draft.feeTotalVnd : nil
        session.shuttlecockCostVnd = draft.fixedPricePerPlayerVnd == nil ? draft.shuttlecockCostVnd : nil

        guard let api, let token else { return }
        do {
            let response = try await api.updateSession(
                token: token,
                sessionId: session.id,
                request: draft.updateRequest
            )
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            session = previous
            actionError = Self.message(for: error, fallback: "Could not save session changes.")
        }
    }

    var myUnpaidAmount: Int? {
        guard session.costTrackingEnabled else { return nil }
        guard let participant = session.participants.first(where: { $0.player.id == currentPlayer.id }),
              participant.rsvpStatus == .joined, !participant.hasPaid else { return nil }
        return session.perPlayerCostVnd
    }

    // MARK: - Lineup board

    func assign(_ player: Player, to court: CourtLineup) async {
        guard isHost else { return }
        let previous = session
        session.assign(playerId: player.id, toCourt: court.id) // optimistic
        await saveLineup(previous: previous)
    }

    func bench(_ player: Player) async {
        guard isHost else { return }
        let previous = session
        session.removeFromCourts(playerId: player.id) // optimistic
        await saveLineup(previous: previous)
    }

    private func saveLineup(previous: SessionSummary) async {
        guard let api, let token else { return }
        do {
            let response = try await api.setLineup(
                token: token,
                sessionId: session.id,
                assignments: currentLineupAssignments()
            )
            session = SessionSummary(dto: response.session)
            actionError = nil
        } catch {
            session = previous
            actionError = Self.message(for: error, fallback: "Could not save lineup.")
        }
    }

    private func currentLineupAssignments() -> [LineupAssignment] {
        var assignments: [LineupAssignment] = []
        for court in session.courts {
            for (index, player) in court.players.enumerated() {
                guard let participant = session.participants.first(where: { $0.player.id == player.id })
                else { continue }
                assignments.append(
                    LineupAssignment(courtId: court.id, participantId: participant.id, slotOrder: index + 1)
                )
            }
        }
        return assignments
    }

    private static func message(for error: Error, fallback: String) -> String {
        if let apiError = error as? APIErrorResponse {
            return apiError.error.message
        }
        return fallback
    }
}
