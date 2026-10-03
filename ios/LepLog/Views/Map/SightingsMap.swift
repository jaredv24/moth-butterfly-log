import MapKit
import SwiftUI

/// Sightings that share a spot (~11 m) become one pin.
struct MapSpot: Identifiable, Equatable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let sightings: [LogItem]

    static func group(_ log: [LogItem]) -> [MapSpot] {
        var order: [String] = []
        var groups: [String: [LogItem]] = [:]
        for s in log {
            guard let lat = s.lat, let lng = s.lng else { continue }
            let key = String(format: "%.4f,%.4f", lat, lng)
            if groups[key] == nil { order.append(key) }
            groups[key, default: []].append(s)
        }
        return order.map { key in
            let rows = groups[key]!.sorted { $0.observedAt > $1.observedAt }
            return MapSpot(id: key, coordinate: CLLocationCoordinate2D(latitude: rows[0].lat!, longitude: rows[0].lng!), sightings: rows)
        }
    }

    static func == (a: MapSpot, b: MapSpot) -> Bool { a.id == b.id && a.sightings == b.sightings }
}

struct SightingsMap: View {
    let log: [LogItem]
    var emptyHint = "Sightings show here once they have a location."
    let onOpen: (LogItem) -> Void

    @State private var position: MapCameraPosition = .automatic
    @State private var selected: String?

    private var spots: [MapSpot] { MapSpot.group(log) }

    var body: some View {
        let spots = spots
        if spots.isEmpty {
            ContentUnavailableView("No locations yet", systemImage: "map", description: Text(emptyHint))
        } else {
            Map(position: $position, selection: $selected) {
                ForEach(spots) { spot in
                    Annotation(spot.sightings[0].identifiedName, coordinate: spot.coordinate, anchor: .bottom) {
                        Pin(spot: spot, selected: selected == spot.id)
                    }
                    .tag(spot.id)
                    .annotationTitles(.hidden)
                }
                UserAnnotation()
            }
            .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
            .mapControls {
                MapUserLocationButton()
                MapCompass()
                MapScaleView()
            }
            .safeAreaInset(edge: .bottom) {
                if let spot = spots.first(where: { $0.id == selected }) {
                    SpotCard(spot: spot, onOpen: onOpen) { withAnimation { selected = nil } }
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.snappy, value: selected)
            .onChange(of: log.count) { position = .automatic }
        }
    }
}

private struct Pin: View {
    let spot: MapSpot
    let selected: Bool

    var body: some View {
        let size: CGFloat = selected ? 52 : 40
        ZStack(alignment: .topTrailing) {
            Thumb(url: spot.sightings[0].photoUrl, size: size, corner: size / 2)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2.5))
                .shadow(color: .black.opacity(0.25), radius: 3, y: 1)
            if spot.sightings.count > 1 {
                Text("\(spot.sightings.count)")
                    .font(.caption2.bold())
                    .foregroundStyle(Color.onBrand)
                    .padding(.horizontal, 5)
                    .frame(minWidth: 18, minHeight: 18)
                    .background(Color.brand, in: Capsule())
                    .offset(x: 6, y: -4)
            }
        }
        .animation(.snappy, value: selected)
    }
}

/// The selected spot's sightings, floating over the map.
private struct SpotCard: View {
    let spot: MapSpot
    let onOpen: (LogItem) -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(spot.sightings[0].placeLabel ?? "This spot").font(.subheadline.weight(.semibold)).lineLimit(1)
                Spacer()
                Button(action: onClose) { Image(systemName: "xmark.circle.fill").font(.title3) }
                    .foregroundStyle(Color.inkSoft)
                    .accessibilityLabel("Close")
            }
            ScrollView(.vertical) {
                VStack(spacing: 8) {
                    ForEach(spot.sightings) { s in
                        Button { onOpen(s) } label: {
                            HStack(spacing: 10) {
                                Thumb(url: s.photoUrl, size: 44, corner: 8)
                                VStack(alignment: .leading, spacing: 2) {
                                    SpeciesName(common: s.identifiedName, scientific: s.identifiedScientific)
                                    Text(Format.day(s.observedAt)).font(.caption2).foregroundStyle(Color.inkSoft)
                                }
                                Spacer(minLength: 0)
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(Color.inkSoft)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(maxHeight: 200)
            .fixedSize(horizontal: false, vertical: spot.sightings.count < 4)
        }
        .padding(14)
        .lepGlass(in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}
