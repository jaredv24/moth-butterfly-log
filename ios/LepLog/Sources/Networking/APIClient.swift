import Foundation

enum APIError: Error, LocalizedError {
    case invalidResponse
    case server(status: Int, message: String?)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "The server sent back something unexpected."
        case .server(let status, let message):
            return message ?? "Server error (\(status))."
        case .decoding:
            return "Couldn't understand the server's response."
        case .transport(let error):
            return error.localizedDescription
        }
    }
}

private struct ErrorBody: Decodable { let error: String? }

/// Thin JSON client for the Lep Log backend (`app/api/*` in the Next.js app).
/// Every call takes the user's MOTH-XXXXXX code explicitly (as `?code=` or a
/// body field) rather than relying on browser cookies/session state, since
/// there's no browser here.
struct APIClient {
    static let shared = APIClient()

    private var baseURL: URL { APIConfig.shared.baseURL }

    private var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
        return decoder
    }

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        )!
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        return try await send(request)
    }

    func post<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        try await send(jsonRequest(path, method: "POST", body: body))
    }

    func patch<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        try await send(jsonRequest(path, method: "PATCH", body: body))
    }

    func delete<T: Decodable>(_ path: String, body: [String: Any]) async throws -> T {
        try await send(jsonRequest(path, method: "DELETE", body: body))
    }

    private func jsonRequest(_ path: String, method: String, body: [String: Any]) -> URLRequest {
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw APIError.transport(error)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = try? decoder.decode(ErrorBody.self, from: data).error
            throw APIError.server(status: http.statusCode, message: message)
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

extension JSONDecoder.DateDecodingStrategy {
    /// Postgres timestamps come back as ISO-8601 with fractional seconds
    /// (e.g. "2026-09-10T14:03:21.123Z"), which plain `.iso8601` rejects.
    static var iso8601WithFractionalSeconds: JSONDecoder.DateDecodingStrategy {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let withoutFraction = ISO8601DateFormatter()
        withoutFraction.formatOptions = [.withInternetDateTime]

        return .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = withFraction.date(from: string) { return date }
            if let date = withoutFraction.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO-8601 date: \(string)"
            )
        }
    }
}
