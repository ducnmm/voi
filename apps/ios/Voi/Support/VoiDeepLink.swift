import Foundation

/// Three shareable entry points: host a session, join a session, join a group.
enum VoiDeepLink: Equatable, Hashable, Identifiable {
    case createHost
    case joinSession(token: String)
    case joinGroup(token: String)

    var id: String {
        switch self {
        case .createHost: return "create"
        case .joinSession(let token): return "session:\(token)"
        case .joinGroup(let token): return "group:\(token)"
        }
    }

    var url: URL {
        switch self {
        case .createHost:
            return URL(string: "voi://create")!
        case .joinSession(let token):
            return URL(string: "voi://join/session/\(token)")!
        case .joinGroup(let token):
            return URL(string: "voi://join/group/\(token)")!
        }
    }

    var inviteToken: String? {
        switch self {
        case .createHost: return nil
        case .joinSession(let token), .joinGroup(let token): return token
        }
    }

    static func parse(_ url: URL) -> VoiDeepLink? {
        let parts = url.pathComponents.filter { $0 != "/" }
        let host = (url.host ?? "").lowercased()

        if host == "create" && parts.isEmpty { return .createHost }
        if parts.count == 1, parts[0].lowercased() == "create" { return .createHost }

        if host == "join", parts.count >= 2 {
            let token = parts[1]
            guard !token.isEmpty else { return nil }
            switch parts[0].lowercased() {
            case "session": return .joinSession(token: token)
            case "group": return .joinGroup(token: token)
            default: break
            }
        }

        if parts.count >= 3, parts[0].lowercased() == "join" {
            let token = parts[2]
            guard !token.isEmpty else { return nil }
            switch parts[1].lowercased() {
            case "session": return .joinSession(token: token)
            case "group": return .joinGroup(token: token)
            default: break
            }
        }

        // Legacy `voi://invites/{token}` and `https://…/invites/{token}`.
        if host == "invites", let token = parts.first, !token.isEmpty {
            return .joinSession(token: token)
        }
        if parts.count >= 2, parts[parts.count - 2].lowercased() == "invites",
           let token = parts.last, !token.isEmpty {
            return .joinSession(token: token)
        }

        return nil
    }
}
