import Foundation

// Mirrors lib/types.ts on the server. Timestamps stay ISO strings on the wire;
// `Format.date(_:)` parses them where a Date is needed.

enum TaxonGroup: String, Codable, CaseIterable, Identifiable {
    case butterfly, moth
    var id: String { rawValue }
    var plural: String { self == .butterfly ? "Butterflies" : "Moths" }
}

enum MatchLevel: String, Codable {
    case species, genus
    case offList = "off-list"
}

struct ChecklistItem: Codable, Identifiable, Hashable {
    let id: Int
    let inatTaxonId: Int
    let commonName: String
    let scientificName: String
    let group: TaxonGroup
    let family: String
    let thumbUrl: String?
}

struct ChecklistResponse: Decodable {
    let species: [ChecklistItem]
}

struct NearbySpecies: Decodable, Identifiable {
    let id: Int
    let inatTaxonId: Int
    let commonName: String
    let scientificName: String
    let group: TaxonGroup
    let family: String
    let thumbUrl: String?
    let nearbyCount: Int

    var item: ChecklistItem {
        ChecklistItem(id: id, inatTaxonId: inatTaxonId, commonName: commonName, scientificName: scientificName,
                      group: group, family: family, thumbUrl: thumbUrl)
    }
}

struct NearbyResponse: Decodable {
    let month: Int
    let monthName: String
    let radiusKm: Int
    let species: [NearbySpecies]
}

enum PlausibilityVerdict: String, Codable {
    case expected, possible, unusual, unknown
    case outOfArea = "out-of-area"
}

struct Candidate: Decodable, Identifiable {
    struct Match: Decodable {
        let speciesId: Int?
        let matchLevel: MatchLevel
        let commonName: String
        let scientificName: String
        let group: TaxonGroup?
        let family: String?
        let thumbUrl: String?
    }
    struct Plausibility: Decodable {
        let verdict: PlausibilityVerdict
        let note: String
    }

    let name: String
    let scientificName: String
    let inatTaxonId: Int?
    let confidence: Double
    let otherGroup: String?
    let match: Match
    let plausibility: Plausibility?

    var id: String { "\(match.speciesId.map(String.init) ?? scientificName)" }
}

struct IdentifyResponse: Decodable {
    let candidates: [Candidate]
    let placeLabel: String?
    let observedAt: String
    /// Subject-cropped photo (a `data:image/jpeg;base64,…` URL) the identifier analysed.
    let croppedPhoto: String?
}

struct LogItem: Codable, Identifiable, Hashable {
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
    let observedAt: String
    let inatObservationId: Int?
    let inatTaxonId: Int?
    let refPhotoUrl: String?
    let otherGroup: String?

    var onChecklist: Bool { speciesId != nil }
    var speciesKey: String { identifiedScientific.lowercased() }
}

enum CritterKind: String, Codable {
    case arthropod, critter
}

struct LogStats: Decodable {
    struct OtherGroup: Decodable, Identifiable {
        let group: String
        let species: Int
        let kind: CritterKind
        var id: String { group }
    }
    let totalButterflies: Int
    let totalMoths: Int
    let butterfliesSeen: Int
    let mothsSeen: Int
    let otherSpecies: Int
    let otherGroups: [OtherGroup]

    var speciesTotal: Int { butterfliesSeen + mothsSeen + otherSpecies }
}

struct LogResponse: Decodable {
    let log: [LogItem]
    let stats: LogStats
}

struct LogCreateResponse: Decodable {
    let sighting: Sighting
    let isNewSpecies: Bool
    let placeLabel: String?

    struct Sighting: Decodable {
        let id: String
        let observedAt: String
    }
}

struct UserResponse: Decodable {
    let code: String
    let created: Bool?
    let username: String?
    let nickname: String?
    let avatarUrl: String?
    let hasPassword: Bool
}

struct ProfileResponse: Decodable {
    let username: String?
    let nickname: String?
    let avatarUrl: String?
    let hasPassword: Bool
}

struct ProfilePatchResponse: Decodable {
    let username: String?
    let nickname: String?
    let hasPassword: Bool
}

struct AvatarResponse: Decodable {
    let avatarUrl: String
}

// MARK: Friends

struct FriendsResponse: Decodable {
    struct Following: Decodable {
        let userId: String
        let name: String?
        let avatarUrl: String?
        let addedAt: String
        let sightingsCount: Int
        let speciesCount: Int
        let lastActiveAt: String?
        let mutual: Bool
    }
    struct Follower: Decodable {
        let userId: String
        let name: String?
        let avatarUrl: String?
        let followedAt: String
        let speciesCount: Int
        let lastActiveAt: String?
        let youFollowBack: Bool
    }
    let friendCode: String
    let username: String?
    let following: [Following]
    let followers: [Follower]
}

/// One person on the Friends list: someone you follow, who follows you, or both.
struct Friend: Identifiable, Hashable {
    let userId: String
    let name: String?
    let avatarUrl: String?
    let lastActiveAt: String?
    let speciesCount: Int
    var iFollow: Bool
    var followsMe: Bool

    var id: String { userId }
    var mutual: Bool { iFollow && followsMe }

    /// Merges both directions into one list: mutuals first, then people who follow you, then the rest.
    static func merge(_ r: FriendsResponse) -> [Friend] {
        var map: [String: Friend] = [:]
        for f in r.following {
            map[f.userId] = Friend(userId: f.userId, name: f.name, avatarUrl: f.avatarUrl, lastActiveAt: f.lastActiveAt,
                                   speciesCount: f.speciesCount, iFollow: true, followsMe: f.mutual)
        }
        for f in r.followers {
            if var cur = map[f.userId] {
                cur.followsMe = true
                cur.iFollow = cur.iFollow || f.youFollowBack
                map[f.userId] = cur
            } else {
                map[f.userId] = Friend(userId: f.userId, name: f.name, avatarUrl: f.avatarUrl, lastActiveAt: f.lastActiveAt,
                                       speciesCount: f.speciesCount, iFollow: f.youFollowBack, followsMe: true)
            }
        }
        func rank(_ p: Friend) -> Int { p.mutual ? 0 : p.followsMe ? 1 : 2 }
        return map.values.sorted {
            rank($0) != rank($1) ? rank($0) < rank($1) : ($0.name ?? "~").localizedCompare($1.name ?? "~") == .orderedAscending
        }
    }
}

struct FriendLogResponse: Decodable {
    struct FriendInfo: Decodable {
        let userId: String
        let name: String
        let avatarUrl: String?
        let mutual: Bool
    }
    let log: [LogItem]
    let stats: LogStats
    let friend: FriendInfo
}

// MARK: Messages

struct SharedSighting: Decodable, Hashable {
    let id: String
    let identifiedName: String
    let identifiedScientific: String
    let photoUrl: String
    let placeLabel: String?
    let observedAt: String
    let ownerUserId: String
}

struct ChatMessage: Decodable, Identifiable, Hashable {
    let id: String
    let body: String?
    let sighting: SharedSighting?
    let at: String
    let mine: Bool
}

struct ChatThreadSummary: Decodable, Identifiable {
    struct Last: Decodable {
        let preview: String
        let at: String
        let mine: Bool
    }
    let userId: String
    let name: String?
    let avatarUrl: String?
    let lastMessage: Last?
    let unread: Int
    var id: String { userId }
}

struct ThreadsResponse: Decodable {
    let threads: [ChatThreadSummary]
    let totalUnread: Int
}

struct ThreadResponse: Decodable {
    struct FriendInfo: Decodable {
        let userId: String
        let name: String?
        let avatarUrl: String?
    }
    let friend: FriendInfo
    let messages: [ChatMessage]
}

struct SendMessageResponse: Decodable {
    let message: ChatMessage
}

struct UnreadResponse: Decodable {
    let count: Int
}

// MARK: iNaturalist

struct InatStatus: Decodable {
    let configured: Bool
    let connected: Bool
    let username: String?
    let syncEnabled: Bool
    let unsyncedCount: Int
}

struct InatSyncResponse: Decodable {
    let synced: Int?
    let failed: Int?
    let remaining: Int?
}
