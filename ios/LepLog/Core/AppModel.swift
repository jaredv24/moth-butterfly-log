import Foundation
import Observation
import UserNotifications

enum Tab: Hashable {
    case identify, journal, friends, map, profile
}

enum JournalSection: String, CaseIterable, Identifiable {
    case log = "Log", checklist = "Checklist"
    var id: String { rawValue }
}

enum FriendsRoute: Hashable {
    /// A friend's log, optionally opened to one sighting (from a shared chat card).
    case friend(String, focus: String? = nil)
    case chats
    case chat(String)
}

/// Everything the screens share: whose log this is, the log itself, the checklist, unread messages.
@MainActor
@Observable
final class AppModel {
    enum Phase: Equatable {
        case loading
        /// This log has a password and this phone hasn't unlocked it yet.
        case locked(code: String)
        case ready
        /// Couldn't reach the server on launch and there's no code saved yet.
        case offline(String)
    }

    var phase: Phase = .loading
    var code: String?
    var username: String?
    var nickname: String?
    var avatarUrl: String?
    var hasPassword = false

    var log: LogResponse?
    var logError: String?
    var checklist: [ChecklistItem] = []
    var unread = 0

    var tab: Tab = .identify
    var journalSection: JournalSection = .log
    var friendsPath: [FriendsRoute] = []
    /// A sighting to open in the journal (from a shared chat card).
    var focusSightingId: String?
    /// A log code opened from a link or QR, waiting for the person to confirm switching.
    var pendingCode: String?
    /// The chat on screen right now, so its own notifications don't banner over it.
    var openChatUserId: String?

    let api = API.shared
    private let codeKey = "user-code"

    var displayName: String? {
        let u = username?.trimmingCharacters(in: .whitespaces).nilIfEmpty
        let n = nickname?.trimmingCharacters(in: .whitespaces).nilIfEmpty
        if let u, let n { return "\(u) (\(n))" }
        return u ?? n
    }

    /// Sightings for a species (by scientific name), newest first.
    func sightings(ofSpecies key: String) -> [LogItem] {
        (log?.log ?? []).filter { $0.speciesKey == key.lowercased() }.sorted { $0.observedAt > $1.observedAt }
    }

    /// Checklist species id → earliest sighting of it.
    var firstSeen: [Int: LogItem] {
        var m: [Int: LogItem] = [:]
        for e in log?.log ?? [] {
            guard let id = e.speciesId else { continue }
            if let cur = m[id], cur.observedAt <= e.observedAt { continue }
            m[id] = e
        }
        return m
    }

    // MARK: Session

    func bootstrap() async {
        let stored = Keychain.get(codeKey)
        do {
            try await resolve(code: stored, password: nil)
        } catch let e as APIError where e.needsPassword {
            phase = .locked(code: stored ?? "")
        } catch {
            if let stored {
                // Offline with a known log: show what we can, retry on the next foreground.
                code = stored
                phase = .ready
            } else {
                phase = .offline(error.localizedDescription)
            }
        }
        guard phase == .ready else { return }
        api.ping("/api/identify/warm")
        async let a: Void = refreshLog()
        async let b: Void = loadChecklist()
        async let c: Void = refreshUnread()
        _ = await (a, b, c)
        await PushManager.shared.registerIfAuthorized()
    }

    /// Creates a new log (no code), opens an existing one, or unlocks a password-protected one.
    /// Returns whether a brand-new empty log was created.
    @discardableResult
    func resolve(code raw: String?, password: String?) async throws -> Bool {
        let r: UserResponse = try await api.send("/api/user", body: [
            "code": raw.map(Codes.normalize),
            "password": password,
        ])
        let switching = code != nil && code != r.code
        if switching { await PushManager.shared.unregister() }
        Keychain.set(r.code, for: codeKey)
        code = r.code
        username = r.username
        nickname = r.nickname
        avatarUrl = r.avatarUrl
        hasPassword = r.hasPassword
        phase = .ready
        if switching {
            log = nil
            unread = 0
            friendsPath = []
            await refreshLog()
            await refreshUnread()
            await PushManager.shared.registerIfAuthorized()
        }
        return r.created ?? false
    }

    /// From the lock screen: forget the locked code and start over with a fresh log.
    func abandonLockedCode() async {
        Keychain.set(nil, for: codeKey)
        phase = .loading
        await bootstrap()
    }

    func onForeground() async {
        guard phase == .ready else {
            if case .offline = phase { await bootstrap() }
            return
        }
        async let a: Void = refreshLog()
        async let b: Void = refreshUnread()
        _ = await (a, b)
        if checklist.isEmpty { await loadChecklist() }
    }

    // MARK: Data

    func refreshLog() async {
        guard let code else { return }
        do {
            log = try await api.get("/api/log", query: ["code": code])
            logError = nil
        } catch {
            logError = error.localizedDescription
        }
    }

    func loadChecklist() async {
        guard checklist.isEmpty else { return }
        if let r: ChecklistResponse = try? await api.get("/api/checklist") { checklist = r.species }
    }

    func refreshUnread() async {
        guard let code else { return }
        if let r: UnreadResponse = try? await api.get("/api/messages/unread", query: ["code": code]) {
            unread = r.count
            try? await UNUserNotificationCenter.current().setBadgeCount(r.count)
        }
    }

    func deleteSighting(_ s: LogItem) async throws {
        guard let code else { return }
        let _: API.Empty = try await api.send("/api/log", method: "DELETE", body: ["code": code, "sightingId": s.id])
        await refreshLog()
    }

    func changeSpecies(_ s: LogItem, to sp: ChecklistItem) async throws {
        guard let code else { return }
        let _: API.Empty = try await api.send("/api/log", method: "PATCH", body: [
            "code": code, "sightingId": s.id, "speciesId": sp.id, "name": sp.commonName, "scientificName": sp.scientificName,
        ])
        await refreshLog()
    }

    // MARK: Links

    /// `/chat/<userId>` (from a notification) or a log link with `?code=MOTH-…`.
    func handle(path: String) {
        if path.hasPrefix("/chat/") {
            let id = String(path.dropFirst("/chat/".count))
            tab = .friends
            friendsPath = [.chats, .chat(id)]
        } else if path.hasPrefix("/chat") {
            tab = .friends
            friendsPath = [.chats]
        }
    }

    /// A log link (the website's "open your log on another phone" QR) asks before switching.
    func handle(url: URL) {
        if case .userCode(let c)? = Codes.parse(url.absoluteString), c != code { pendingCode = c }
    }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
