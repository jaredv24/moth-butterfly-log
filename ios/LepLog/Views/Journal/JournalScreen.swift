import SwiftUI

struct JournalScreen: View {
    @Environment(AppModel.self) private var model
    @State private var query = ""
    @State private var sheet: SheetSightings?
    @State private var changeFor: LogItem?
    @State private var deleteFor: LogItem?
    @State private var error: String?
    @State private var zoom: PhotoRef?

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            List {
                Section {
                    Picker("Section", selection: $model.journalSection) {
                        ForEach(JournalSection.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                } footer: {
                    if model.journalSection == .log { summary }
                }

                if let error {
                    ErrorBanner(text: error).listRowBackground(Color.clear).listRowInsets(EdgeInsets())
                }

                switch model.journalSection {
                case .log: logContent
                case .checklist: ChecklistSections(query: query)
                }
            }
            .listStyle(.insetGrouped)
            .paperBackground()
            .navigationTitle("Journal")
            .searchable(text: $query, prompt: model.journalSection == .log ? "Search your log" : "Search name or family")
            .refreshable { await model.refreshLog() }
            .sheet(item: $sheet) { SightingSheet(sightings: $0.rows, owned: true) }
            .lightbox($zoom)
            .sheet(item: $changeFor) { s in
                SpeciesPicker(title: "Change species") { sp in
                    changeFor = nil
                    Task {
                        do { try await model.changeSpecies(s, to: sp) } catch { self.error = "Couldn't update that sighting." }
                    }
                }
            }
            .confirmationDialog("Delete this sighting?", isPresented: Binding(get: { deleteFor != nil }, set: { if !$0 { deleteFor = nil } }),
                                titleVisibility: .visible, presenting: deleteFor) { s in
                Button("Delete \(s.identifiedName)", role: .destructive) {
                    Task {
                        do { try await model.deleteSighting(s) } catch { self.error = "Couldn't delete that sighting." }
                    }
                }
            } message: { _ in Text("This can't be undone.") }
            // A shared chat card opens straight to that one sighting.
            .onChange(of: model.focusSightingId, initial: true) { _, id in
                guard let id, let s = model.log?.log.first(where: { $0.id == id }) else { return }
                model.focusSightingId = nil
                model.journalSection = .log
                sheet = SheetSightings(rows: [s])
            }
        }
    }

    private var summary: some View {
        Group {
            if let log = model.log {
                Text("Every critter you've identified — butterflies & moths tracked against a checklist, everything else logged and sorted by group. \(log.stats.speciesTotal) species · \(Format.plural(log.log.count, "sighting")).")
            }
        }
        .font(.footnote)
        .foregroundStyle(Color.inkSoft)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var logContent: some View {
        if let log = model.log {
            if query.isEmpty {
                Section {
                    LifeListCard(stats: log.stats, own: true)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }
            }
            let q = query.trimmingCharacters(in: .whitespaces).lowercased()
            let entries = q.isEmpty ? log.log : log.log.filter {
                $0.identifiedName.lowercased().contains(q) || $0.identifiedScientific.lowercased().contains(q)
                    || ($0.otherGroup?.lowercased().contains(q) ?? false)
            }
            if log.log.isEmpty {
                EmptyNote(text: "Nothing logged yet. Photograph anything from the Identify tab — a moth, a beetle, a frog, a turtle — and it's identified and sorted here.")
                    .listRowBackground(Color.clear).listRowInsets(EdgeInsets())
            } else if entries.isEmpty {
                ContentUnavailableView.search(text: query).listRowBackground(Color.clear)
            } else {
                LogSections(
                    entries: entries,
                    onOpen: { sheet = SheetSightings(rows: model.sightings(ofSpecies: $0.speciesKey)) },
                    onChange: { changeFor = $0 },
                    onDelete: { deleteFor = $0 },
                    onZoom: { zoom = PhotoRef(url: $0) }
                )
            }
        } else if let e = model.logError {
            ErrorBanner(text: "Couldn't load the log. \(e)").listRowBackground(Color.clear).listRowInsets(EdgeInsets())
        } else {
            HStack { Spacer(); ProgressView(); Spacer() }.listRowBackground(Color.clear)
        }
    }
}

struct SheetSightings: Identifiable {
    let rows: [LogItem]
    var id: String { rows.map(\.id).joined(separator: ",") }
}
