import Foundation

struct APIRequest<Body: Encodable, Response: Decodable> {
    let method: HTTPMethod
    let path: String
    let body: Body?
    let token: String?
    let queryItems: [URLQueryItem]

    init(
        method: HTTPMethod,
        path: String,
        body: Body? = nil,
        token: String? = nil,
        queryItems: [URLQueryItem] = []
    ) {
        self.method = method
        self.path = path
        self.body = body
        self.token = token
        self.queryItems = queryItems
    }

    func authenticated(with token: String) -> APIRequest<Body, Response> {
        APIRequest(method: method, path: path, body: body, token: token, queryItems: queryItems)
    }
}

struct EmptyBody: Encodable {}
