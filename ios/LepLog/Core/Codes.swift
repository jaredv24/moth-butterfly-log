import Foundation

/// Mirrors lib/code.ts: MOTH- login codes and PAL- friend codes.
enum Codes {
    private static let alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

    static func normalize(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).uppercased().replacingOccurrences(of: " ", with: "")
    }

    static func isUserCode(_ code: String) -> Bool { matches(code, prefix: "MOTH-", length: 6) }
    static func isFriendCode(_ code: String) -> Bool { matches(code, prefix: "PAL-", length: 8) }

    private static func matches(_ code: String, prefix: String, length: Int) -> Bool {
        guard code.hasPrefix(prefix) else { return false }
        let rest = code.dropFirst(prefix.count)
        return rest.count == length && rest.allSatisfy { alphabet.contains($0) }
    }

    /// What a scanned QR (or pasted text) holds: the website's log QR is a link with `?code=MOTH-…`;
    /// the friend QR is the bare PAL- code.
    enum Scanned: Equatable {
        case userCode(String)
        case friendCode(String)
    }

    static func parse(_ text: String) -> Scanned? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let comps = URLComponents(string: t), let c = comps.queryItems?.first(where: { $0.name == "code" })?.value {
            let n = normalize(c)
            if isUserCode(n) { return .userCode(n) }
        }
        let n = normalize(t)
        if isUserCode(n) { return .userCode(n) }
        if isFriendCode(n) { return .friendCode(n) }
        return nil
    }

    /// "MOTH-••••••": the prefix stays, the secret part is dotted out.
    static func masked(_ code: String) -> String {
        guard let dash = code.firstIndex(of: "-") else { return String(repeating: "•", count: code.count) }
        let prefix = code[...dash]
        return prefix + String(repeating: "•", count: code.distance(from: code.index(after: dash), to: code.endIndex))
    }
}
