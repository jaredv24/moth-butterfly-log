import Foundation

enum MatchLevel: String, Codable {
    case species
    case genus
    case offList = "off-list"
}

/// Mirrors `LogItem` in the web app's `lib/types.ts` — the wire shape of
/// `GET /api/log` and `GET /api/friends/log`.
struct LogItem: Codable, Identifiable, Equatable {
    let id: String
    let speciesId: Int?
    let identifiedName: String
    let identifiedScientific: String
    let confidence: Double?
    let matchLevel: MatchLevel
    let photoUrl: String
    let placeLabel: String?
    let lat: Double?
    let lng: Double?
    /** the photo's date (EXIF / user-set) */
    let observedAt: Date
    /** when the sighting was actually uploaded — independent of `observedAt` */
    let createdAt: Date
    let inatObservationId: Int?
    let inatTaxonId: Int?
    let refPhotoUrl: String?
    let otherGroup: String?

    /// `photoUrl` is relative for local-dev uploads (e.g. "/uploads/x.jpg")
    /// and absolute for Vercel Blob in production — resolve against the
    /// configured API host either way.
    func photoURL(base: URL) -> URL? {
        if photoUrl.hasPrefix("http://") || photoUrl.hasPrefix("https://") {
            return URL(string: photoUrl)
        }
        return URL(string: photoUrl, relativeTo: base)
    }
}

struct OtherGroupStat: Codable, Identifiable {
    var id: String { group }
    let group: String
    let species: Int
    let kind: String
}

struct LogStats: Codable {
    let totalButterflies: Int
    let totalMoths: Int
    let butterfliesSeen: Int
    let mothsSeen: Int
    let otherSpecies: Int
    let otherGroups: [OtherGroupStat]
}

struct LogResponse: Codable {
    let log: [LogItem]
    let stats: LogStats
}

struct OkResponse: Decodable {
    let ok: Bool
}
