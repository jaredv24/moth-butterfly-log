import SwiftUI

/// The North American butterfly & moth checklist, by family, with what you've ticked off
/// and what's flying near you this month.
struct ChecklistSections: View {
    let query: String
    @Environment(AppModel.self) private var model
    @AppStorage("lep.checklistGroup") private var group: TaxonGroup = .butterfly
    @AppStorage("lep.onlySeen") private var onlySeen = false
    @State private var nearby: NearbyResponse?
    @State private var nearbyState: NearbyState = .idle
    @State private var showAllNearby = false
    @State private var detail: ChecklistItem?

    enum NearbyState { case idle, loading, ready, unavailable }

    var body: some View {
        let seen = model.firstSeen
        let filtered = filter(seen: seen)
        let families = Dictionary(grouping: filtered, by: \.family)
            .sorted { $0.value.count != $1.value.count ? $0.value.count > $1.value.count : $0.key < $1.key }
        let seenCount = filtered.filter { seen[$0.id] != nil }.count

        Section {
            Picker("Group", selection: $group) {
                ForEach(TaxonGroup.allCases) { Text($0.plural).tag($0) }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())
        } header: {
            Text("A checklist to work through for butterflies & moths. Beetles, frogs, turtles and everything else are tracked in your Log — no checklist, just logged as you find them.")
                .font(.footnote).foregroundStyle(Color.inkSoft).textCase(nil).padding(.bottom, 6)
        }
        // Attached to this always-present section so they run once, not once per row.
        .sheet(item: $detail) { ChecklistDetail(item: $0) }
        .task { await model.loadChecklist() }
        .task { await loadNearby() }

        Section {
            Toggle("Only species I've logged", isOn: $onlySeen).tint(.brand)
        } footer: {
            Text("\(seenCount) of \(filtered.count) \(group.plural.lowercased()) logged\(query.isEmpty && !onlySeen ? "" : " (filtered)")")
        }

        if query.isEmpty { nearbySection(seen: seen) }

        if model.checklist.isEmpty {
            HStack { Spacer(); ProgressView("Loading checklist…"); Spacer() }.listRowBackground(Color.clear)
        } else if families.isEmpty {
            ContentUnavailableView.search(text: query).listRowBackground(Color.clear)
        }

        ForEach(families, id: \.key) { family, rows in
            Section(family) {
                ForEach(rows) { it in
                    Button { detail = it } label: { row(it, seen: seen[it.id]) }
                        .listRowBackground(seen[it.id] != nil ? Color.brand.opacity(0.08) : Color.surface)
                }
            }
        }
    }

    private func filter(seen: [Int: LogItem]) -> [ChecklistItem] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return model.checklist.filter { it in
            guard it.group == group else { return false }
            if onlySeen && seen[it.id] == nil { return false }
            guard !q.isEmpty else { return true }
            return it.commonName.lowercased().contains(q) || it.scientificName.lowercased().contains(q) || it.family.lowercased().contains(q)
        }
    }

    private func row(_ it: ChecklistItem, seen: LogItem?) -> some View {
        HStack(spacing: 12) {
            Thumb(url: it.thumbUrl, group: it.group, size: 48, corner: 8).opacity(seen == nil ? 0.85 : 1)
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    SpeciesName(common: it.commonName, scientific: it.scientificName)
                    if seen != nil {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.brand).accessibilityLabel("Logged")
                    }
                }
                if let seen { SeenBadge(placeLabel: seen.placeLabel, observedAt: seen.observedAt) }
            }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func nearbySection(seen: [Int: LogItem]) -> some View {
        switch nearbyState {
        case .loading:
            Section { Label("Checking what's flying near you…", systemImage: "location").font(.footnote).foregroundStyle(Color.inkSoft) }
        case .ready:
            if let nearby, !nearby.species.isEmpty {
                let list = showAllNearby ? nearby.species : Array(nearby.species.prefix(8))
                Section {
                    ForEach(list) { s in
                        Button { detail = s.item } label: {
                            HStack(spacing: 10) {
                                Thumb(url: s.thumbUrl, group: s.group, size: 36, corner: 6)
                                Text(s.commonName).font(.subheadline).foregroundStyle(Color.ink).lineLimit(1)
                                GlyphImage(glyph: s.group.glyph).frame(width: 14, height: 14)
                                Spacer()
                                if seen[s.id] != nil { Image(systemName: "checkmark").foregroundStyle(Color.brand) }
                            }
                        }
                        .listRowBackground(seen[s.id] != nil ? Color.brand.opacity(0.08) : Color.surface)
                    }
                    if nearby.species.count > 8 {
                        Button(showAllNearby ? "Show fewer" : "Show all \(nearby.species.count)") {
                            withAnimation { showAllNearby.toggle() }
                        }
                        .font(.footnote.weight(.medium))
                    }
                } header: {
                    HStack {
                        Text("Flying near you · \(nearby.monthName)")
                        Spacer()
                        Text("within \(nearby.radiusKm) km").textCase(nil)
                    }
                }
            }
        default:
            EmptyView()
        }
    }

    private func loadNearby() async {
        guard nearbyState == .idle else { return }
        nearbyState = .loading
        guard let c = await Location.shared.current(timeout: 8) else {
            nearbyState = .unavailable
            return
        }
        do {
            nearby = try await model.api.get("/api/nearby", query: ["lat": String(c.latitude), "lng": String(c.longitude)])
            nearbyState = .ready
        } catch {
            nearbyState = .unavailable
        }
    }
}

/// A checklist species: what it is, and every time you've logged it.
struct ChecklistDetail: View {
    let item: ChecklistItem
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var zoom: PhotoRef?

    var body: some View {
        let mine = (model.log?.log ?? []).filter { $0.speciesId == item.id }.sorted { $0.observedAt > $1.observedAt }
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top, spacing: 14) {
                        Button { zoom = item.thumbUrl.flatMap { INat.photo($0) }.map(PhotoRef.init) } label: {
                            Thumb(url: item.thumbUrl, group: item.group, size: 88, corner: 14)
                        }
                        .buttonStyle(.plain)
                        .disabled(item.thumbUrl == nil)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.commonName).font(.title3.bold())
                            if !Format.sameName(item.commonName, item.scientificName) {
                                Text(item.scientificName).font(.subheadline).italic().foregroundStyle(Color.inkSoft)
                            }
                            Text("\(item.family) · \(item.group.rawValue)").font(.caption).foregroundStyle(Color.inkSoft)
                            Link("View on iNaturalist ↗", destination: INat.taxon(id: item.inatTaxonId, scientific: item.scientificName))
                                .font(.caption.weight(.medium))
                        }
                    }

                    Text("Your sightings (\(mine.count))").font(.subheadline.weight(.semibold))
                    if mine.isEmpty {
                        Text("Not logged yet. Photograph one to check it off.").font(.subheadline).foregroundStyle(Color.inkSoft)
                    }
                    ForEach(mine) { s in
                        HStack(alignment: .top, spacing: 12) {
                            Button { zoom = PhotoRef(url: s.photoUrl) } label: { Thumb(url: s.photoUrl, size: 64) }
                                .buttonStyle(.plain)
                            VStack(alignment: .leading, spacing: 4) {
                                SeenBadge(placeLabel: s.placeLabel, observedAt: s.observedAt)
                                if let c = s.confidence {
                                    Text("\(Format.percent(c)) at ID time").font(.caption).foregroundStyle(Color.inkSoft)
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .paperBackground()
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .lightbox($zoom)
    }
}
