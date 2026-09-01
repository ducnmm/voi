import Foundation

/// Per-session room or the ongoing group room. Same message DTO either way.
enum ChatRoom: Hashable, Identifiable {
    case session(id: String, title: String)
    case group(id: String, title: String)

    var id: String {
        switch self {
        case .session(let id, _): return "session:\(id)"
        case .group(let id, _): return "group:\(id)"
        }
    }

    var title: String {
        switch self {
        case .session(_, let title), .group(_, let title):
            return title
        }
    }
}

/// Loads chat history over REST and streams new messages over a WebSocket.
@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []

    private var api: APIClient?
    private var authSession: AuthSession?
    private var room: ChatRoom?
    private var socket: URLSessionWebSocketTask?
    private var started = false

    var myId: String { authSession?.currentPlayer.id ?? "" }

    func configure(api: APIClient, authSession: AuthSession, room: ChatRoom) {
        self.api = api
        self.authSession = authSession
        self.room = room
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

    @discardableResult
    func send(_ text: String) async -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let api, let token = authSession?.token, let room else { return false }
        do {
            let response: ChatSendResponse
            switch room {
            case .session(let id, _):
                response = try await api.sendMessage(token: token, sessionId: id, body: trimmed)
            case .group(let id, _):
                response = try await api.sendGroupMessage(token: token, groupId: id, body: trimmed)
            }
            appendUnique(ChatMessage(dto: response.message))
            return true
        } catch {
            return false
        }
    }

    private func loadHistory() async {
        guard let api, let token = authSession?.token, let room else { return }
        do {
            let response: ChatHistoryResponse
            switch room {
            case .session(let id, _):
                response = try await api.fetchMessages(token: token, sessionId: id)
            case .group(let id, _):
                response = try await api.fetchGroupMessages(token: token, groupId: id)
            }
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
        guard started else { return }
        guard let api, let token = authSession?.token, let room,
              let url = Self.socketURL(base: api.baseURL, room: room, token: token) else { return }
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
                Task { @MainActor [weak self] in
                    try? await Task.sleep(for: .seconds(2))
                    self?.connect()
                }
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

    private static func socketURL(base: URL, room: ChatRoom, token: String) -> URL? {
        let folder: String
        let id: String
        switch room {
        case .session(let sessionId, _):
            folder = "sessions"
            id = sessionId
        case .group(let groupId, _):
            folder = "groups"
            id = groupId
        }
        let target = base.appending(path: "ws").appending(path: folder).appending(path: id)
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
