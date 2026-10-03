import SwiftUI

struct MapScreen: View {
    @Environment(AppModel.self) private var model
    @State private var sheet: SheetSightings?

    var body: some View {
        NavigationStack {
            Group {
                if let log = model.log?.log {
                    SightingsMap(
                        log: log,
                        emptyHint: "Sightings show here once they have a location — allow location access, or identify geotagged photos."
                    ) { s in
                        sheet = SheetSightings(rows: model.sightings(ofSpecies: s.speciesKey))
                    }
                } else if model.logError != nil {
                    ContentUnavailableView("Couldn't load your sightings", systemImage: "exclamationmark.triangle")
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text("Map").font(.headline)
                        if let subtitle { Text(subtitle).font(.caption2).foregroundStyle(Color.inkSoft) }
                    }
                }
            }
            .sheet(item: $sheet) { SightingSheet(sightings: $0.rows, owned: true) }
        }
    }

    private var subtitle: String? {
        guard let log = model.log?.log else { return nil }
        let spots = MapSpot.group(log).count
        let without = log.filter { $0.lat == nil }.count
        guard spots > 0 else { return nil }
        return Format.plural(spots, "location") + (without > 0 ? " · \(without) without a location" : "")
    }
}
