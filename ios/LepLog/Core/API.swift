import Foundation

struct APIError: LocalizedError {
    let status: Int
    let message: String
    /// The server's `needsPassword` flag: this log is password-protected and this phone isn't trusted yet.
    var needsPassword = false
    var errorDescription: String? { message }
}

private struct ErrorBody: Decodable {
    let error: String?
    let needsPassword: Bool?
}

/// Talks to the same JSON API the website uses. The website's device-trust cookie
/// (`lep_device`, set by /api/user) is kept by URLSession's shared cookie storage, so a
/// password-protected log only asks once per phone, same as in the browser.
final class API {
    static let shared = API()

    private let session: URLSession
    private let decoder = JSONDecoder()

    init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = .shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        config.timeoutIntervalForRequest = 90 // a cold BioCLIP identify can take ~40s
        session = URLSession(configuration: config)
    }

    func url(_ path: String, query: [String: String?] = [:]) -> URL {
        var c = URLComponents(url: URL(string: path, relativeTo: Config.baseURL)!.absoluteURL, resolvingAgainstBaseURL: false)!
        let items = query.compactMap { k, v in v.map { URLQueryItem(name: k, value: $0) } }
        if !items.isEmpty { c.queryItems = items.sorted { $0.name < $1.name } }
        return c.url!
    }

    func get<T: Decodable>(_ path: String, query: [String: String?] = [:]) async throws -> T {
        try await run(URLRequest(url: url(path, query: query)))
    }

    /// `body` is any JSON-serializable dictionary; nil values are left out.
    func send<T: Decodable>(_ path: String, method: String = "POST", body: [String: Any?]) async throws -> T {
        var req = URLRequest(url: url(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })
        return try await run(req)
    }

    /// Multipart upload (photos). Text fields with nil values are left out.
    func upload<T: Decodable>(_ path: String, fields: [String: String?], file: (name: String, data: Data, mime: String)) async throws -> T {
        let boundary = "lep-\(UUID().uuidString)"
        var body = Data()
        func line(_ s: String) { body.append(Data((s + "\r\n").utf8)) }
        for (k, v) in fields {
            guard let v else { continue }
            line("--\(boundary)")
            line("Content-Disposition: form-data; name=\"\(k)\"")
            line("")
            line(v)
        }
        line("--\(boundary)")
        line("Content-Disposition: form-data; name=\"\(file.name)\"; filename=\"photo.jpg\"")
        line("Content-Type: \(file.mime)")
        line("")
        body.append(file.data)
        line("")
        line("--\(boundary)--")

        var req = URLRequest(url: url(path))
        req.httpMethod = "POST"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "content-type")
        req.httpBody = body
        return try await run(req)
    }

    /// Fire-and-forget GET (warming the identify service).
    func ping(_ path: String) {
        Task.detached { [session] in _ = try? await session.data(from: self.url(path)) }
    }

    private func run<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let err = try? decoder.decode(ErrorBody.self, from: data)
            throw APIError(
                status: status,
                message: err?.error ?? (status == 0 ? "Can't reach the server." : "Something went wrong (\(status))."),
                needsPassword: err?.needsPassword ?? false
            )
        }
        if T.self == Empty.self { return Empty() as! T }
        return try decoder.decode(T.self, from: data)
    }

    struct Empty: Decodable {}
}
