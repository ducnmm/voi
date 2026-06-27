import Foundation

/// Loads chat history over REST and streams new messages over a WebSocket.
@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []

    private var api: APIClient?
    private var authSession: AuthSession?
    private var sessionId = ""
    private var socket: URLSessionWebSocketTask?
    private var started = false

    var myId: String { authSession?.currentPlayer.id ?? "" }

    func configure(api: APIClient, authSession: AuthSession, sessionId: String) {
        self.api = api
        self.authSession = authSession
        self.sessionId = sessionId
    }

    func start() async {
        guard !started else { return }
        started = true
        await loadHistory()
        connect()
    }

    func stop() {
        socket?.cancel(with: .goingAway, reason: nil)
        socket = nil
        started = false
    }

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let api, let token = authSession?.token else { return }
        do {
            let response = try await api.sendMessage(token: token, sessionId: sessionId, body: trimmed)
            appendUnique(ChatMessage(dto: response.message))
        } catch {
            // dropped while offline; the user can retry
        }
    }

    private func loadHistory() async {
        guard let api, let token = authSession?.token else { return }
        do {
            let response = try await api.fetchMessages(token: token, sessionId: sessionId)
            messages = response.messages.map(ChatMessage.init(dto:))
        } catch {
            // keep whatever is on screen if history can't load
        }
    }

    private func appendUnique(_ message: ChatMessage) {
        guard !messages.contains(where: { $0.id == message.id }) else { return }
        messages.append(message)
        messages.sort { $0.date < $1.date }
    }

    private func connect() {
        guard let api, let token = authSession?.token,
              let url = Self.socketURL(base: api.baseURL, sessionId: sessionId, token: token) else { return }
        let task = URLSession.shared.webSocketTask(with: url)
        socket = task
        task.resume()
        receive()
    }

    private func receive() {
        socket?.receive { [weak self] result in
            // The receive callback runs off the main actor; hop back on for any
            // state access and to continue the loop.
            switch result {
            case .success(let message):
                if case let .string(text) = message {
                    Task { @MainActor [weak self] in
                        self?.handle(text)
                        self?.receive()
                    }
                } else {
                    Task { @MainActor [weak self] in self?.receive() }
                }
            case .failure:
                break // socket closed; loop ends
            }
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let frame = try? JSONDecoder().decode(ChatFrame.self, from: data),
              frame.type == "message",
              let dto = frame.message else { return }
        appendUnique(ChatMessage(dto: dto))
    }

    private static func socketURL(base: URL, sessionId: String, token: String) -> URL? {
        let target = base.appendingPathComponent("ws/sessions/\(sessionId)")
        var components = URLComponents(url: target, resolvingAgainstBaseURL: false)
        components?.scheme = (base.scheme == "https") ? "wss" : "ws"
        components?.queryItems = [URLQueryItem(name: "token", value: token)]
        return components?.url
    }
}

private struct ChatFrame: Decodable {
    let type: String
    let message: ChatMessageDTO?
}
