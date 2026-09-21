import Foundation

/// Owns the signed-in MOTH-XXXXXX code, mirroring what `lib/useUserCode.ts`
/// does on the web: resolve a code against `POST /api/user` (creating one if
/// none is given), persist it, and handle the password-gate case for a log
/// that has a password set on a device that hasn't unlocked it before.
@MainActor
final class AppSession: ObservableObject {
    static let shared = AppSession()

    @Published private(set) var code: String?
    @Published private(set) var username: String?
    @Published private(set) var hasPassword = false
    @Published private(set) var isResolving = false
    @Published private(set) var pendingPasswordCode: String?
    @Published var errorMessage: String?

    private static let codeKey = "userCode"

    private init() {
        code = KeychainStore.read(forKey: Self.codeKey)
    }

    /// Re-validate a code saved from a previous launch. If the server no
    /// longer knows it (rare — e.g. wiped locally), the code entry screen
    /// takes over.
    func restoreIfNeeded() async {
        guard let saved = code else { return }
        await resolve(code: saved, password: nil)
    }

    func createNewLog() async {
        await resolve(code: nil, password: nil)
    }

    func logIn(code raw: String, password: String? = nil) async {
        await resolve(code: raw, password: password)
    }

    func signOut() {
        KeychainStore.delete(forKey: Self.codeKey)
        code = nil
        username = nil
        hasPassword = false
        pendingPasswordCode = nil
    }

    private func resolve(code inputCode: String?, password: String?) async {
        isResolving = true
        errorMessage = nil
        defer { isResolving = false }

        let normalized = inputCode?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        var body: [String: Any] = [:]
        if let normalized { body["code"] = normalized }
        if let password { body["password"] = password }

        do {
            let session: UserSession = try await APIClient.shared.post("/api/user", body: body)
            KeychainStore.save(session.code, forKey: Self.codeKey)
            code = session.code
            username = session.username
            hasPassword = session.hasPassword
            pendingPasswordCode = nil
        } catch let APIError.server(status, message) where status == 401 {
            pendingPasswordCode = normalized
            errorMessage = message ?? "This log is password-protected."
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Couldn't reach the server."
        }
    }
}
