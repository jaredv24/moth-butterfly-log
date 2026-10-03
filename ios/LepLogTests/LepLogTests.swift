import CoreLocation
import XCTest
@testable import LepLog

final class CodesTests: XCTestCase {
    func testUserAndFriendCodes() {
        XCTAssertTrue(Codes.isUserCode("MOTH-7X2Q4A"))
        XCTAssertFalse(Codes.isUserCode("MOTH-7X2Q4"))
        XCTAssertFalse(Codes.isUserCode("MOTH-0X2Q4A"), "0 isn't in the alphabet")
        XCTAssertTrue(Codes.isFriendCode("PAL-7X2Q4A8B"))
        XCTAssertFalse(Codes.isFriendCode("PAL-7X2Q4A8"))
    }

    func testNormalize() {
        XCTAssertEqual(Codes.normalize("  moth-7x2 q4a\n"), "MOTH-7X2Q4A")
    }

    func testParseScannedLogLinkAndFriendCode() {
        XCTAssertEqual(Codes.parse("https://moth-butterfly-log.vercel.app/?code=MOTH-7X2Q4A"), .userCode("MOTH-7X2Q4A"))
        XCTAssertEqual(Codes.parse("pal-7x2q4a8b"), .friendCode("PAL-7X2Q4A8B"))
        XCTAssertNil(Codes.parse("hello"))
    }

    func testMasked() {
        XCTAssertEqual(Codes.masked("MOTH-7X2Q4A"), "MOTH-••••••")
        XCTAssertEqual(Codes.masked("PAL-7X2Q4A8B"), "PAL-••••••••")
    }
}

final class FormatTests: XCTestCase {
    func testParsesServerTimestamps() {
        XCTAssertNotNil(Format.date("2026-09-06T18:42:10.123Z"))
        XCTAssertNotNil(Format.date("2026-09-06T18:42:10Z"))
    }

    func testAgo() {
        let now = Format.date("2026-09-06T12:00:00.000Z")!
        XCTAssertEqual(Format.ago("2026-09-06T11:59:40.000Z", now: now), "now")
        XCTAssertEqual(Format.ago("2026-09-06T11:55:00.000Z", now: now), "5m")
        XCTAssertEqual(Format.ago("2026-09-06T09:00:00.000Z", now: now), "3h")
        XCTAssertEqual(Format.ago("2026-09-04T12:00:00.000Z", now: now), "2d")
    }

    func testActive() {
        let now = Format.date("2026-09-06T12:00:00.000Z")!
        XCTAssertEqual(Format.active(nil, now: now), "not opened the app yet")
        XCTAssertEqual(Format.active("2026-09-06T11:30:00.000Z", now: now), "active just now")
        XCTAssertEqual(Format.active("2026-09-05T11:00:00.000Z", now: now), "active yesterday")
    }

    func testInatPhotoSize() {
        XCTAssertEqual(INat.photo("https://static.inaturalist.org/photos/2582158/square.jpg"),
                       "https://static.inaturalist.org/photos/2582158/large.jpg")
        XCTAssertEqual(INat.photo("https://x.org/photos/1/medium.jpeg?123", size: "small"), "https://x.org/photos/1/small.jpeg?123")
    }
}

final class GroupingTests: XCTestCase {
    private func item(_ id: String, species: Int? = nil, group: String? = nil, lat: Double? = nil, lng: Double? = nil,
                      at: String = "2026-09-06T12:00:00.000Z") -> LogItem {
        LogItem(id: id, speciesId: species, identifiedName: id, identifiedScientific: id, confidence: nil,
                matchLevel: species == nil ? .offList : .species, photoUrl: "", placeLabel: nil, lat: lat, lng: lng,
                observedAt: at, inatObservationId: nil, inatTaxonId: nil, refPhotoUrl: nil, otherGroup: group)
    }

    func testTiersSplitArthropodsFromCritters() {
        let tiers = BugGroups.tiers([
            item("a", group: "Beetles"), item("b", group: "Beetles"), item("c", group: "Frogs & Toads"),
            item("d", species: 1), item("e"),
        ])
        XCTAssertEqual(tiers.map(\.label), [BugGroups.arthropodLabel, BugGroups.critterLabel])
        XCTAssertEqual(tiers[0].groups.map(\.name), ["Beetles"])
        XCTAssertEqual(Set(tiers[1].groups.map(\.name)), ["Frogs & Toads", "Other critters"])
    }

    func testMapSpotsGroupNearbySightings() {
        let spots = MapSpot.group([
            item("a", lat: 30.26721, lng: -97.74311),
            item("b", lat: 30.26724, lng: -97.74309), // same ~11 m spot
            item("c", lat: 30.3, lng: -97.7),
            item("d"),
        ])
        XCTAssertEqual(spots.count, 2)
        XCTAssertEqual(spots[0].sightings.count, 2)
    }

    func testFriendMergeRanksMutualsFirst() throws {
        let json = """
        {"friendCode":"PAL-22222222","username":null,
         "following":[{"userId":"b","name":"Bea","avatarUrl":null,"addedAt":"x","sightingsCount":1,"speciesCount":1,"lastActiveAt":null,"mutual":false},
                      {"userId":"m","name":"Max","avatarUrl":null,"addedAt":"x","sightingsCount":1,"speciesCount":1,"lastActiveAt":null,"mutual":true}],
         "followers":[{"userId":"m","name":"Max","avatarUrl":null,"followedAt":"x","speciesCount":1,"lastActiveAt":null,"youFollowBack":true},
                      {"userId":"f","name":"Fay","avatarUrl":null,"followedAt":"x","speciesCount":1,"lastActiveAt":null,"youFollowBack":false}]}
        """
        let r = try JSONDecoder().decode(FriendsResponse.self, from: Data(json.utf8))
        let merged = Friend.merge(r)
        XCTAssertEqual(merged.map(\.userId), ["m", "f", "b"])
        XCTAssertTrue(merged[0].mutual)
        XCTAssertFalse(merged[1].iFollow)
    }
}

final class DecodingTests: XCTestCase {
    func testIdentifyResponse() throws {
        let json = """
        {"candidates":[{"name":"Monarch","scientificName":"Danaus plexippus","inatTaxonId":48662,"confidence":0.91,"otherGroup":null,
          "match":{"speciesId":12,"matchLevel":"species","commonName":"Monarch","scientificName":"Danaus plexippus","group":"butterfly","family":"Nymphalidae","thumbUrl":null},
          "plausibility":{"verdict":"out-of-area","note":"Rarely recorded near here in September"}}],
         "placeLabel":"Austin, Texas","observedAt":"2026-09-06T12:00:00.000Z","croppedPhoto":null}
        """
        let r = try JSONDecoder().decode(IdentifyResponse.self, from: Data(json.utf8))
        XCTAssertEqual(r.candidates.first?.plausibility?.verdict, .outOfArea)
        XCTAssertEqual(r.candidates.first?.match.group, .butterfly)
    }

    func testLogResponseOffList() throws {
        let json = """
        {"log":[{"id":"s1","speciesId":null,"identifiedName":"Eastern Box Turtle","identifiedScientific":"Terrapene carolina","confidence":0.8,
          "matchLevel":"off-list","photoUrl":"https://x/p.jpg","placeLabel":null,"lat":null,"lng":null,"observedAt":"2026-09-06T12:00:00.000Z",
          "inatObservationId":null,"inatTaxonId":39853,"refPhotoUrl":null,"otherGroup":"Turtles & Tortoises"}],
         "stats":{"totalButterflies":700,"totalMoths":989,"butterfliesSeen":0,"mothsSeen":0,"otherSpecies":1,
          "otherGroups":[{"group":"Turtles & Tortoises","species":1,"kind":"critter"}]}}
        """
        let r = try JSONDecoder().decode(LogResponse.self, from: Data(json.utf8))
        XCTAssertEqual(r.log.first?.matchLevel, .offList)
        XCTAssertEqual(r.stats.speciesTotal, 1)
    }

    func testDataURLDecode() {
        let data = PreparedPhoto.decodeDataURL("data:image/jpeg;base64,\(Data("hi".utf8).base64EncodedString())")
        XCTAssertEqual(data, Data("hi".utf8))
        XCTAssertNil(PreparedPhoto.decodeDataURL(nil))
    }
}
