import SwiftUI

/// The log as list sections: butterflies & moths first, then every other critter by group.
/// Used for your own journal (with edit actions) and read-only for a friend's.
struct LogSections: View {
    let entries: [LogItem]
    var owned = true
    var onOpen: (LogItem) -> Void
    var onChange: ((LogItem) -> Void)? = nil
    var onDelete: ((LogItem) -> Void)? = nil
    /// Tapping a thumbnail opens the photo full screen (the parent owns the viewer).
    var onZoom: (String) -> Void

    var body: some View {
        let sorted = entries.sorted { $0.observedAt > $1.observedAt }
        let onList = sorted.filter(\.onChecklist)

        if !onList.isEmpty {
            Section {
                ForEach(onList) { row($0, dashed: false) }
            } header: {
                header("Butterflies & moths", count: onList.count, glyph: .butterfly)
            }
        }
        ForEach(BugGroups.tiers(sorted), id: \.label) { tier in
            ForEach(tier.groups, id: \.name) { g in
                Section {
                    ForEach(g.rows) { row($0, dashed: true) }
                } header: {
                    VStack(alignment: .leading, spacing: 2) {
                        if g.name == tier.groups.first?.name {
                            Text(tier.label).font(.caption.weight(.semibold)).foregroundStyle(Color.inkSoft).textCase(nil)
                        }
                        header(g.name, count: g.rows.count, glyph: BugGroups.glyph(g.name))
                    }
                }
            }
        }
    }

    private func header(_ title: String, count: Int, glyph: Glyph) -> some View {
        HStack(spacing: 6) {
            GlyphImage(glyph: glyph, color: .brand).frame(width: 15, height: 15)
            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(Color.ink)
            Text("· \(count)").font(.subheadline).foregroundStyle(Color.inkSoft)
        }
        .textCase(nil)
    }

    private func row(_ e: LogItem, dashed: Bool) -> some View {
        HStack(spacing: 12) {
            Thumb(url: e.photoUrl, size: 68)
                .onTapGesture { onZoom(e.photoUrl) }
                .accessibilityAddTraits(.isButton)
                .accessibilityLabel("View photo")
            VStack(alignment: .leading, spacing: 6) {
                SpeciesName(common: e.identifiedName, scientific: e.identifiedScientific)
                SeenBadge(placeLabel: e.placeLabel, observedAt: e.observedAt)
            }
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
        .onTapGesture { onOpen(e) }
        .listRowBackground(Color.surface)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if owned, let onDelete {
                Button("Delete", systemImage: "trash", role: .destructive) { onDelete(e) }
            }
            if owned, let onChange {
                Button("Change", systemImage: "arrow.triangle.2.circlepath") { onChange(e) }.tint(.brand)
            }
        }
        .contextMenu {
            Link(destination: INat.link(for: e)) { Label("View on iNaturalist", systemImage: "safari") }
            if owned, let onChange {
                Button("Change species", systemImage: "arrow.triangle.2.circlepath") { onChange(e) }
            }
            if owned, let onDelete {
                Button("Delete", systemImage: "trash", role: .destructive) { onDelete(e) }
            }
        }
    }
}
