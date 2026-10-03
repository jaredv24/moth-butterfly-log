import CoreLocation
import Foundation
import Observation
import UIKit

/// Photo → identify → confirm → logged. Same steps and API calls as the website's Identify page.
@MainActor
@Observable
final class IdentifyFlow {
    enum Step: Equatable {
        case idle, identifying, results, logging, done
    }

    struct Done {
        let name: String
        let scientific: String
        let placeLabel: String?
        let observedAt: String
        let isNewSpecies: Bool
        let checklisted: Bool
        let otherGroup: String?
    }

    var step: Step = .idle
    var error: String?
    var photo: PreparedPhoto?
    var preview: UIImage?
    var cropped = false
    var locating = false
    var candidates: [Candidate] = []
    var placeLabel: String?
    var observedAt: String?
    var done: Done?

    private let api = API.shared

    func reset() {
        step = .idle
        error = nil
        photo = nil
        preview = nil
        cropped = false
        locating = false
        candidates = []
        placeLabel = nil
        observedAt = nil
        done = nil
    }

    func identify(_ prepared: PreparedPhoto) async {
        reset()
        var p = prepared
        photo = p
        preview = p.image
        step = .identifying

        // No GPS in the photo: use where we are now, as a regional prior for the identifier.
        if p.coordinate == nil {
            locating = true
            p.coordinate = await Location.shared.current(timeout: 3)
            locating = false
            photo = p
        }

        do {
            let r: IdentifyResponse = try await api.upload("/api/identify", fields: [
                "lat": p.coordinate.map { String($0.latitude) },
                "lng": p.coordinate.map { String($0.longitude) },
                "observedAt": p.takenAt.map(Format.isoString),
            ], file: ("photo", p.jpeg, "image/jpeg"))
            candidates = r.candidates
            placeLabel = r.placeLabel
            observedAt = r.observedAt
            // The identifier crops to the subject; that crop becomes the sighting photo.
            if let crop = PreparedPhoto.decodeDataURL(r.croppedPhoto), UIImage(data: crop) != nil {
                photo?.jpeg = crop
                preview = UIImage(data: crop)
                cropped = true
            }
            step = .results
        } catch {
            self.error = error.localizedDescription
            step = .idle
        }
    }

    func confirm(_ c: Candidate, code: String) async -> Bool {
        await log(code: code, name: c.match.commonName, scientific: c.match.scientificName, speciesId: c.match.speciesId,
                  matchLevel: c.match.matchLevel, confidence: c.confidence, inatTaxonId: c.inatTaxonId,
                  thumbUrl: c.match.thumbUrl, otherGroup: c.otherGroup)
    }

    func confirm(_ s: ChecklistItem, code: String) async -> Bool {
        await log(code: code, name: s.commonName, scientific: s.scientificName, speciesId: s.id, matchLevel: .species,
                  confidence: nil, inatTaxonId: s.inatTaxonId, thumbUrl: nil, otherGroup: nil)
    }

    private func log(code: String, name: String, scientific: String, speciesId: Int?, matchLevel: MatchLevel,
                     confidence: Double?, inatTaxonId: Int?, thumbUrl: String?, otherGroup: String?) async -> Bool {
        guard let photo else { return false }
        step = .logging
        error = nil
        do {
            let r: LogCreateResponse = try await api.upload("/api/log", fields: [
                "code": code,
                "name": name,
                "scientificName": scientific,
                "matchLevel": matchLevel.rawValue,
                "speciesId": speciesId.map(String.init),
                "confidence": confidence.map { String($0) },
                "inatTaxonId": inatTaxonId.map(String.init),
                "thumbUrl": thumbUrl,
                "otherGroup": otherGroup,
                "lat": photo.coordinate.map { String($0.latitude) },
                "lng": photo.coordinate.map { String($0.longitude) },
                "observedAt": photo.takenAt.map(Format.isoString),
            ], file: ("photo", photo.jpeg, "image/jpeg"))
            done = Done(name: name, scientific: scientific, placeLabel: r.placeLabel, observedAt: r.sighting.observedAt,
                        isNewSpecies: r.isNewSpecies, checklisted: speciesId != nil, otherGroup: otherGroup)
            step = .done
            return true
        } catch {
            self.error = error.localizedDescription
            step = .results
            return false
        }
    }
}
