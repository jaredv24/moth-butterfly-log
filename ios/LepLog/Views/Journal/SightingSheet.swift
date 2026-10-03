import SwiftUI

/// Everything logged of one critter: every photo, with when and where. Works for
/// checklist species and off-list critters alike, in your log or a friend's.
struct SightingSheet: View {
    let sightings: [LogItem]
    var owned = true
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var zoom: PhotoRef?
    @State private var shareFor: LogItem?
    @State private var sentTo: String?
    @State private var changeFor: LogItem?
    @State private var deleteFor: LogItem?
    @State private var error: String?

    private var rows: [LogItem] { sightings.sorted { $0.observedAt > $1.observedAt } }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let head = rows.first {
                    VStack(alignment: .leading, spacing: 14) {
                        Button { zoom = PhotoRef(url: head.photoUrl) } label: {
                            Thumb(url: head.photoUrl, height: 240, corner: 16)
                        }
                        .buttonStyle(.plain)

                        header(head)

                        if let error { ErrorBanner(text: error) }

                        Divider()

                        if rows.count == 1 {
                            detail(rows[0], showPhoto: false)
                        } else {
                            Text("\(owned ? "Your sightings" : "Sightings") (\(rows.count))").font(.subheadline.weight(.semibold))
                            ForEach(rows) { detail($0, showPhoto: true) }
                        }

                        if let sentTo {
                            Button("Shared — open the chat") {
                                dismiss()
                                model.tab = .friends
                                model.friendsPath = [.chats, .chat(sentTo)]
                            }
                            .font(.subheadline.weight(.medium))
                        }
                    }
                    .padding()
                }
            }
            .paperBackground()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
        .presentationDetents([.large, .medium])
        .presentationDragIndicator(.visible)
        .lightbox($zoom)
        .sheet(item: $shareFor) { s in
            ShareSightingSheet(sighting: s) { userId in
                shareFor = nil
                sentTo = userId
            }
        }
        .sheet(item: $changeFor) { s in
            SpeciesPicker(title: "Change species") { sp in
                changeFor = nil
                Task {
                    do { try await model.changeSpecies(s, to: sp); dismiss() }
                    catch { self.error = "Couldn't update that sighting." }
                }
            }
        }
        .confirmationDialog("Delete this sighting?", isPresented: Binding(get: { deleteFor != nil }, set: { if !$0 { deleteFor = nil } }),
                            titleVisibility: .visible, presenting: deleteFor) { s in
            Button("Delete \(s.identifiedName)", role: .destructive) {
                Task {
                    do {
                        try await model.deleteSighting(s)
                        if rows.count <= 1 { dismiss() }
                    } catch { self.error = "Couldn't delete that sighting." }
                }
            }
        } message: { _ in
            Text("This can't be undone.")
        }
    }

    private func header(_ head: LogItem) -> some View {
        let showSci = !Format.sameName(head.identifiedName, head.identifiedScientific)
        let group = head.otherGroup ?? (head.onChecklist ? (owned ? "On your checklist" : "On the checklist") : nil)
        return VStack(alignment: .leading, spacing: 8) {
            Text(head.identifiedName).font(.title2.bold())
            if showSci || group != nil {
                HStack(spacing: 4) {
                    if showSci { Text(head.identifiedScientific).italic() }
                    if showSci && group != nil { Text("·") }
                    if let group { Text(group) }
                }
                .font(.subheadline).foregroundStyle(Color.inkSoft)
            }
            HStack(spacing: 10) {
                if let ref = head.refPhotoUrl {
                    Button { zoom = PhotoRef(url: INat.photo(ref) ?? ref) } label: { Thumb(url: ref, size: 54) }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Reference photo")
                }
                Link(destination: INat.taxon(id: head.inatTaxonId, scientific: head.identifiedScientific)) {
                    Label((head.refPhotoUrl != nil ? "Reference photo — " : "") + "View on iNaturalist", systemImage: "arrow.up.right")
                        .labelStyle(.titleOnly)
                }
                .font(.caption.weight(.medium))
            }
        }
    }

    private func detail(_ s: LogItem, showPhoto: Bool) -> some View {
        HStack(alignment: .top, spacing: 12) {
            if showPhoto {
                Button { zoom = PhotoRef(url: s.photoUrl) } label: { Thumb(url: s.photoUrl, size: 64) }
                    .buttonStyle(.plain)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(Format.day(s.observedAt)).font(.subheadline.weight(.medium))
                if let p = s.placeLabel {
                    Label(p, systemImage: "mappin.and.ellipse").font(.caption).foregroundStyle(Color.inkSoft)
                }
                HStack(spacing: 14) {
                    if let c = s.confidence { Text(Format.percent(c)).foregroundStyle(Color.inkSoft) }
                    if let o = s.inatObservationId { Link("iNaturalist ↗", destination: INat.observation(o)) }
                    if owned {
                        Button("Send to a friend") { sentTo = nil; shareFor = s }
                    }
                }
                .font(.caption.weight(.medium))
            }
            Spacer(minLength: 0)
            if owned {
                Menu {
                    Button("Change species", systemImage: "arrow.triangle.2.circlepath") { changeFor = s }
                    Button("Delete", systemImage: "trash", role: .destructive) { deleteFor = s }
                } label: {
                    Image(systemName: "ellipsis").frame(width: 32, height: 32).contentShape(Rectangle())
                }
                .foregroundStyle(Color.inkSoft)
                .accessibilityLabel("Sighting options")
            }
        }
    }
}
