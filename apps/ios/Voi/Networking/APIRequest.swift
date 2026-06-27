import Foundation

struct APIRequest<Body: Encodable, Response: Decodable> {
    let method: HTTPMethod
    let path: String
    let body: Body?
    let token: String?

    init(
        method: HTTPMethod,
        path: String,
        body: Body? = nil,
        token: String? = nil
    ) {
        self.method = method
        self.path = path
        self.body = body
        self.token = token
    }
}

struct EmptyBody: Encodable {}
