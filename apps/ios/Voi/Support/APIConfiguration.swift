import Foundation

enum APIConfiguration {
    static var baseURL: URL {
        if let url = parse(ProcessInfo.processInfo.environment["VOI_API_BASE_URL"]) {
            return url
        }
        #if !targetEnvironment(simulator)
        if let url = parse(Bundle.main.object(forInfoDictionaryKey: "VOIApiBaseURL") as? String) {
            return url
        }
        #endif
        return URL(string: "http://localhost:43187/v1")!
    }

    private static func parse(_ raw: String?) -> URL? {
        guard let raw else { return nil }
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        return URL(string: trimmed)
    }
}
