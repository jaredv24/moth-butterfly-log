import Foundation

enum Format {
    private static let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let isoNoFraction = ISO8601DateFormatter()

    static func date(_ s: String) -> Date? {
        iso.date(from: s) ?? isoNoFraction.date(from: s)
    }

    static func isoString(_ d: Date) -> String { iso.string(from: d) }

    /// "Sep 6, 2026"
    static func day(_ s: String) -> String {
        date(s)?.formatted(.dateTime.month(.abbreviated).day().year()) ?? ""
    }

    /// "7:42 PM"
    static func clock(_ s: String) -> String {
        date(s)?.formatted(date: .omitted, time: .shortened) ?? ""
    }

    /// Chat list timestamps: now, 5m, 3h, 2d, then "Sep 6".
    static func ago(_ s: String, now: Date = .now) -> String {
        guard let d = date(s) else { return "" }
        let mins = Int(now.timeIntervalSince(d) / 60)
        if mins < 1 { return "now" }
        if mins < 60 { return "\(mins)m" }
        let h = mins / 60
        if h < 24 { return "\(h)h" }
        let days = h / 24
        if days < 7 { return "\(days)d" }
        return d.formatted(.dateTime.month(.abbreviated).day())
    }

    /// Friends list: "active 3h ago".
    static func active(_ s: String?, now: Date = .now) -> String {
        guard let s, let d = date(s) else { return "not opened the app yet" }
        let mins = Int(now.timeIntervalSince(d) / 60)
        if mins < 60 { return "active just now" }
        let hours = mins / 60
        if hours < 24 { return "active \(hours)h ago" }
        let days = hours / 24
        if days == 1 { return "active yesterday" }
        if days < 30 { return "active \(days)d ago" }
        return "active \(days / 30)mo ago"
    }

    static func percent(_ confidence: Double) -> String { "\(Int((confidence * 100).rounded()))% match" }

    /// iNaturalist names species that have no common name by their scientific name.
    static func sameName(_ a: String, _ b: String) -> Bool {
        a.trimmingCharacters(in: .whitespaces).lowercased() == b.trimmingCharacters(in: .whitespaces).lowercased()
    }

    static func plural(_ n: Int, _ word: String) -> String { "\(n) \(word)\(n == 1 ? "" : "s")" }
}

enum INat {
    static let base = URL(string: "https://www.inaturalist.org")!

    /// iNaturalist photo URLs end in a size segment (square 75px … large 1024px); swap it.
    static func photo(_ url: String?, size: String = "large") -> String? {
        guard let url else { return nil }
        guard let re = try? NSRegularExpression(pattern: "/(square|small|medium|large|original)\\.([a-zA-Z]+)(\\?.*)?$") else { return url }
        let range = NSRange(url.startIndex..., in: url)
        return re.stringByReplacingMatches(in: url, range: range, withTemplate: "/\(size).$2$3")
    }

    static func taxon(id: Int?, scientific: String) -> URL {
        if let id { return base.appending(path: "taxa/\(id)") }
        var c = URLComponents(url: base.appending(path: "taxa/search"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "q", value: scientific)]
        return c.url!
    }

    static func observation(_ id: Int) -> URL { base.appending(path: "observations/\(id)") }
    static func person(_ login: String) -> URL { base.appending(path: "people/\(login)") }

    /// Best link for a sighting: the synced observation, else the species page, else a name search.
    static func link(for s: LogItem) -> URL {
        if let o = s.inatObservationId { return observation(o) }
        return taxon(id: s.inatTaxonId, scientific: s.identifiedScientific)
    }
}
