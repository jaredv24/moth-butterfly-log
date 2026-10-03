import SwiftUI

/// Searchable checklist picker for "none of these are right" and "change species".
struct SpeciesPicker: View {
    var title = "Pick the species"
    let onSelect: (ChecklistItem) -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var results: [ChecklistItem] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return [] }
        return Array(model.checklist.lazy.filter {
            $0.commonName.lowercased().contains(q) || $0.scientificName.lowercased().contains(q)
        }.prefix(40))
    }

    var body: some View {
        NavigationStack {
            List(results) { it in
                Button { onSelect(it) } label: {
                    HStack(spacing: 12) {
                        Thumb(url: it.thumbUrl, group: it.group, size: 44, corner: 8)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(it.commonName).font(.subheadline.weight(.medium)).foregroundStyle(Color.ink)
                            Text("\(it.scientificName) · \(it.family)").font(.caption).italic().foregroundStyle(Color.inkSoft)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .overlay {
                if model.checklist.isEmpty {
                    ProgressView("Loading checklist…")
                } else if query.trimmingCharacters(in: .whitespaces).isEmpty {
                    ContentUnavailableView("Search the checklist", systemImage: "magnifyingglass",
                                           description: Text("\(model.checklist.count) North American butterflies and moths."))
                } else if results.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search name…")
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .task { await model.loadChecklist() }
        }
    }
}
