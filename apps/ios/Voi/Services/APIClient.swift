import Foundation

final class APIClient: @unchecked Sendable {
    let baseURL: URL
    let urlSession: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    /// Called once on 401 so the client can rotate the access token and retry.
    var tokenRefresher: (@Sendable () async throws -> String?)?

    init(baseURL: URL, urlSession: URLSession = .shared) {
        self.baseURL = baseURL
        self.urlSession = urlSession
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
    }

    func health() async throws -> HealthResponse {
        try await send(
            APIRequest<EmptyBody, HealthResponse>(
                method: .get,
                path: "health"
            )
        )
    }

    func devLogin(email: String, displayName: String?) async throws -> DevLoginResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "auth/dev",
                body: DevLoginRequest(email: email, displayName: displayName)
            )
        )
    }

    func googleLogin(idToken: String) async throws -> GoogleAuthResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "auth/google",
                body: GoogleLoginRequest(idToken: idToken)
            )
        )
    }

    func refreshSession(refreshToken: String) async throws -> RefreshResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "auth/refresh",
                body: RefreshRequest(refreshToken: refreshToken)
            )
        )
    }

    @discardableResult
    func logout(refreshToken: String) async throws -> OkResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "auth/logout",
                body: RefreshRequest(refreshToken: refreshToken)
            )
        )
    }

    func fetchMe(token: String) async throws -> MeResponse {
        try await send(
            APIRequest<EmptyBody, MeResponse>(
                method: .get,
                path: "me",
                token: token
            )
        )
    }

    func updateProfile(token: String, request: UpdateProfileRequest) async throws -> MeResponse {
        try await send(
            APIRequest(
                method: .patch,
                path: "me",
                body: request,
                token: token
            )
        )
    }

    func fetchNotificationPreferences(token: String) async throws -> NotificationPreferenceResponse {
        try await send(
            APIRequest<EmptyBody, NotificationPreferenceResponse>(
                method: .get,
                path: "notification-preferences",
                token: token
            )
        )
    }

    func updateNotificationPreferences(
        token: String,
        request: UpdateNotificationPreferenceRequest
    ) async throws -> NotificationPreferenceResponse {
        try await send(
            APIRequest(
                method: .put,
                path: "notification-preferences",
                body: request,
                token: token
            )
        )
    }

    func resolveInvite(token inviteToken: String) async throws -> InvitePreviewResponse {
        try await send(
            APIRequest<EmptyBody, InvitePreviewResponse>(
                method: .get,
                path: "invites/\(inviteToken)"
            )
        )
    }

    func acceptInvite(token: String, inviteToken: String) async throws -> AcceptInviteResponse {
        try await send(
            APIRequest<EmptyBody, AcceptInviteResponse>(
                method: .post,
                path: "invites/\(inviteToken)/accept",
                token: token
            )
        )
    }

    func groups(token: String) async throws -> GroupsResponse {
        try await send(
            APIRequest<EmptyBody, GroupsResponse>(
                method: .get,
                path: "groups",
                token: token
            )
        )
    }

    func createGroup(token: String, request: CreateGroupRequest) async throws -> CreateGroupResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "groups",
                body: request,
                token: token
            )
        )
    }

    func groupDetail(token: String, groupId: String) async throws -> GroupDetailResponse {
        try await send(
            APIRequest<EmptyBody, GroupDetailResponse>(
                method: .get,
                path: "groups/\(groupId)",
                token: token
            )
        )
    }

    func session(token: String, id: String) async throws -> SessionResponse {
        try await send(
            APIRequest<EmptyBody, SessionResponse>(
                method: .get,
                path: "sessions/\(id)",
                token: token
            )
        )
    }

    /// Session discovery feed. Query params mirror `SessionFeedQuerySchema`.
    func sessionsFeed(
        token: String,
        scope: String = "upcoming",
        skill: SkillLevel? = nil,
        venue: String? = nil,
        availableOnly: Bool = false,
        savedOnly: Bool = false,
        sort: String = "date",
        limit: Int = 50,
        cursor: String? = nil
    ) async throws -> SessionsFeedResponse {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "scope", value: scope),
            URLQueryItem(name: "sort", value: sort),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        if let skill {
            items.append(URLQueryItem(name: "skill", value: skill.rawValue))
        }
        if let venue, !venue.isEmpty {
            items.append(URLQueryItem(name: "venue", value: venue))
        }
        if availableOnly {
            items.append(URLQueryItem(name: "availableOnly", value: "true"))
        }
        if savedOnly {
            items.append(URLQueryItem(name: "savedOnly", value: "true"))
        }
        if let cursor {
            items.append(URLQueryItem(name: "cursor", value: cursor))
        }
        return try await send(
            APIRequest<EmptyBody, SessionsFeedResponse>(
                method: .get,
                path: "sessions",
                token: token,
                queryItems: items
            )
        )
    }

    func rsvp(token: String, sessionId: String, status: String) async throws -> RsvpResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "sessions/\(sessionId)/rsvp",
                body: RsvpRequest(status: status),
                token: token
            )
        )
    }

    func setLineup(token: String, sessionId: String, assignments: [LineupAssignment]) async throws -> SessionResponse {
        try await send(
            APIRequest(
                method: .put,
                path: "sessions/\(sessionId)/lineup",
                body: SetLineupRequest(assignments: assignments),
                token: token
            )
        )
    }

    func updateSession(token: String, sessionId: String, request: UpdateSessionRequest) async throws -> SessionResponse {
        try await send(
            APIRequest(
                method: .patch,
                path: "sessions/\(sessionId)",
                body: request,
                token: token
            )
        )
    }

    func cancelSession(token: String, sessionId: String) async throws -> SessionResponse {
        try await send(
            APIRequest<EmptyBody, SessionResponse>(
                method: .post,
                path: "sessions/\(sessionId)/cancel",
                token: token
            )
        )
    }

    func updatePayment(
        token: String,
        sessionId: String,
        participantId: String,
        status: String
    ) async throws -> SessionResponse {
        try await send(
            APIRequest(
                method: .patch,
                path: "sessions/\(sessionId)/participants/\(participantId)/payment",
                body: PaymentRequest(paymentStatus: status),
                token: token
            )
        )
    }

    func fetchMessages(token: String, sessionId: String) async throws -> ChatHistoryResponse {
        try await send(
            APIRequest<EmptyBody, ChatHistoryResponse>(
                method: .get,
                path: "sessions/\(sessionId)/messages",
                token: token
            )
        )
    }

    func sendMessage(token: String, sessionId: String, body: String) async throws -> ChatSendResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "sessions/\(sessionId)/messages",
                body: SendMessageRequest(body: body),
                token: token
            )
        )
    }

    func fetchGroupMessages(
        token: String,
        groupId: String,
        limit: Int = 30,
        before: String? = nil
    ) async throws -> ChatHistoryResponse {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(limit))
        ]
        if let before {
            items.append(URLQueryItem(name: "before", value: before))
        }
        return try await send(
            APIRequest<EmptyBody, ChatHistoryResponse>(
                method: .get,
                path: "groups/\(groupId)/messages",
                token: token,
                queryItems: items
            )
        )
    }

    func sendGroupMessage(token: String, groupId: String, body: String) async throws -> ChatSendResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "groups/\(groupId)/messages",
                body: SendMessageRequest(body: body),
                token: token
            )
        )
    }

    func checkIn(token: String, sessionId: String, participantId: String) async throws -> SessionResponse {
        try await send(
            APIRequest<EmptyBody, SessionResponse>(
                method: .post,
                path: "sessions/\(sessionId)/participants/\(participantId)/checkin",
                token: token
            )
        )
    }

    func uncheckIn(token: String, sessionId: String, participantId: String) async throws -> SessionResponse {
        try await send(
            APIRequest<EmptyBody, SessionResponse>(
                method: .delete,
                path: "sessions/\(sessionId)/participants/\(participantId)/checkin",
                token: token
            )
        )
    }

    func fetchResults(token: String, sessionId: String) async throws -> ResultsResponse {
        try await send(
            APIRequest<EmptyBody, ResultsResponse>(
                method: .get,
                path: "sessions/\(sessionId)/results",
                token: token
            )
        )
    }

    func addResult(token: String, sessionId: String, label: String, scoreA: Int, scoreB: Int) async throws -> ResultResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "sessions/\(sessionId)/results",
                body: CreateResultRequest(label: label, scoreA: scoreA, scoreB: scoreB),
                token: token
            )
        )
    }

    func fetchNotifications(token: String) async throws -> NotificationsResponse {
        try await send(
            APIRequest<EmptyBody, NotificationsResponse>(
                method: .get,
                path: "notifications",
                token: token
            )
        )
    }

    func registerDevice(token: String, deviceToken: String, appVersion: String?) async throws -> DeviceResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "devices",
                body: RegisterDeviceRequest(deviceToken: deviceToken, platform: "IOS", appVersion: appVersion),
                token: token
            )
        )
    }

    @discardableResult
    func unregisterDevice(token: String, deviceToken: String) async throws -> OkResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "devices/unregister",
                body: UnregisterDeviceRequest(deviceToken: deviceToken),
                token: token
            )
        )
    }

    func fetchSaved(token: String) async throws -> SessionsFeedResponse {
        try await send(
            APIRequest<EmptyBody, SessionsFeedResponse>(
                method: .get,
                path: "me/saved",
                token: token
            )
        )
    }

    @discardableResult
    func saveSession(token: String, sessionId: String) async throws -> SaveToggleResponse {
        try await send(
            APIRequest<EmptyBody, SaveToggleResponse>(
                method: .put,
                path: "sessions/\(sessionId)/save",
                token: token
            )
        )
    }

    @discardableResult
    func unsaveSession(token: String, sessionId: String) async throws -> SaveToggleResponse {
        try await send(
            APIRequest<EmptyBody, SaveToggleResponse>(
                method: .delete,
                path: "sessions/\(sessionId)/save",
                token: token
            )
        )
    }

    func fetchPeople(token: String) async throws -> PeopleResponse {
        try await send(
            APIRequest<EmptyBody, PeopleResponse>(method: .get, path: "people", token: token)
        )
    }

    func fetchFollowing(token: String) async throws -> FollowingUsersResponse {
        try await send(
            APIRequest<EmptyBody, FollowingUsersResponse>(method: .get, path: "me/following", token: token)
        )
    }

    @discardableResult
    func followUser(token: String, userId: String) async throws -> FollowToggleResponse {
        try await send(
            APIRequest<EmptyBody, FollowToggleResponse>(method: .put, path: "users/\(userId)/follow", token: token)
        )
    }

    @discardableResult
    func unfollowUser(token: String, userId: String) async throws -> FollowToggleResponse {
        try await send(
            APIRequest<EmptyBody, FollowToggleResponse>(method: .delete, path: "users/\(userId)/follow", token: token)
        )
    }

    func fetchUserReviews(token: String, userId: String) async throws -> UserReviewsResponse {
        try await send(
            APIRequest<EmptyBody, UserReviewsResponse>(
                method: .get,
                path: "users/\(userId)/reviews",
                token: token
            )
        )
    }

    @discardableResult
    func addReview(token: String, sessionId: String, subjectId: String, rating: Int, comment: String?) async throws -> ReviewWriteResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "sessions/\(sessionId)/reviews",
                body: CreateReviewRequest(subjectId: subjectId, rating: rating, comment: comment),
                token: token
            )
        )
    }

    func createSession(
        token: String,
        groupId: String,
        request: CreateSessionRequest
    ) async throws -> CreateSessionResponse {
        try await send(
            APIRequest(
                method: .post,
                path: "groups/\(groupId)/sessions",
                body: request,
                token: token
            )
        )
    }

    /// Upload a single image as multipart/form-data; returns its served URL.
    func uploadImage(token: String, data: Data, mimeType: String) async throws -> UploadResponse {
        let url = baseURL.appending(path: "uploads")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        request.setValue("application/json", forHTTPHeaderField: "accept")

        let boundary = "Boundary-\(UUID().uuidString)"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "content-type")

        let ext = mimeType == "image/png" ? "png" : "jpg"
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"cover.\(ext)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        request.httpBody = body

        let (respData, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            if let apiError = try? decoder.decode(APIErrorResponse.self, from: respData) {
                throw apiError
            }
            throw APIError.requestFailed
        }
        return try decoder.decode(UploadResponse.self, from: respData)
    }

    func markNotificationRead(token: String, id: String) async throws -> OkResponse {
        try await send(
            APIRequest<EmptyBody, OkResponse>(
                method: .post,
                path: "notifications/\(id)/read",
                token: token
            )
        )
    }

    func markAllNotificationsRead(token: String) async throws -> OkResponse {
        try await send(
            APIRequest<EmptyBody, OkResponse>(
                method: .post,
                path: "notifications/read-all",
                token: token
            )
        )
    }

    func deleteAccount(token: String) async throws -> OkResponse {
        try await send(
            APIRequest<EmptyBody, OkResponse>(
                method: .delete,
                path: "me",
                token: token
            )
        )
    }

    func send<Body: Encodable, Response: Decodable>(
        _ request: APIRequest<Body, Response>
    ) async throws -> Response {
        do {
            return try await sendOnce(request)
        } catch {
            guard isUnauthorized(error),
                  request.token != nil,
                  let refresher = tokenRefresher,
                  let newToken = try await refresher() else {
                throw error
            }
            return try await sendOnce(request.authenticated(with: newToken))
        }
    }

    private func sendOnce<Body: Encodable, Response: Decodable>(
        _ request: APIRequest<Body, Response>
    ) async throws -> Response {
        var components = URLComponents(
            url: baseURL.appending(path: request.path),
            resolvingAgainstBaseURL: false
        )
        if !request.queryItems.isEmpty {
            components?.queryItems = request.queryItems
        }
        guard let url = components?.url else {
            throw APIError.requestFailed
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "accept")

        if let token = request.token {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "authorization")
        }

        if let body = request.body {
            urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
            urlRequest.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await urlSession.data(for: urlRequest)

        guard let httpResponse = response as? HTTPURLResponse,
              (200..<300).contains(httpResponse.statusCode) else {
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            }
            if let apiError = try? decoder.decode(APIErrorResponse.self, from: data) {
                throw apiError
            }
            throw APIError.requestFailed
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func isUnauthorized(_ error: Error) -> Bool {
        if case APIError.unauthorized = error { return true }
        if let apiError = error as? APIErrorResponse, apiError.error.code == "UNAUTHORIZED" {
            return true
        }
        return false
    }
}

extension APIClient {
    /// Default local API from `docker-compose` / `pnpm dev` (`API_PORT=43187`).
    /// Override with the `VOI_API_BASE_URL` environment variable when needed
    /// (e.g. `http://localhost:43197/v1` on a machine where 43187 is taken).
    static let development = APIClient(
        baseURL: URL(
            string: ProcessInfo.processInfo.environment["VOI_API_BASE_URL"]
                ?? "http://localhost:43187/v1"
        )!
    )
}

struct HealthResponse: Codable {
    let status: String
    let service: String
}

enum APIError: Error {
    case requestFailed
    case unauthorized
}
