import SwiftUI

/// Pick one of your own sightings to attach to a chat message.
struct AttachSightingSheet: View {
    let onPick: (String) -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        let all = (model.log?.log ?? []).sorted { $0.observedAt > $1.observedAt }
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let rows = q.isEmpty ? all : all.filter {
            $0.identifiedName.lowercased().contains(q) || $0.identifiedScientific.lowercased().contains(q)
        }
        NavigationStack {
            List(rows) { s in
                Button { onPick(s.id) } label: {
                    HStack(spacing: 12) {
                        Thumb(url: s.photoUrl, size: 48, corner: 8)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.identifiedName).font(.subheadline.weight(.semibold)).foregroundStyle(Color.ink)
                            Text((s.placeLabel.map { "\($0) · " } ?? "") + Format.day(s.observedAt))
                                .font(.caption).foregroundStyle(Color.inkSoft)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .overlay {
                if model.log == nil { ProgressView("Loading your log…") }
                else if all.isEmpty { ContentUnavailableView("Nothing logged yet", systemImage: "camera.viewfinder") }
                else if rows.isEmpty { ContentUnavailableView.search(text: query) }
            }
            .searchable(text: $query, prompt: "Search your log")
            .navigationTitle("Share a sighting")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Send one of your sightings to a mutual follower as a chat message.
struct ShareSightingSheet: View {
    let sighting: LogItem
    let onSent: (String) -> Void
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var mutuals: [Friend]?
    @State private var busy: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let error { Text(error).foregroundStyle(Color.danger) }
                    if mutuals == nil {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    } else if mutuals?.isEmpty == true {
                        Text("You can only message people you both follow. Follow each other on the Friends tab first.")
                            .foregroundStyle(Color.inkSoft)
                    }
                    ForEach(mutuals ?? []) { m in
                        Button { Task { await send(to: m.userId) } } label: {
                            HStack(spacing: 12) {
                                AvatarView(url: m.avatarUrl)
                                Text(m.name ?? "Someone").font(.body.weight(.semibold)).foregroundStyle(Color.ink)
                                Spacer()
                                Text(busy == m.userId ? "Sending…" : "Send").font(.subheadline.weight(.medium))
                            }
                        }
                        .disabled(busy != nil)
                    }
                } header: {
                    Text("\(sighting.identifiedName) · sends into a private chat").textCase(nil)
                }
            }
            .navigationTitle("Send to a friend")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .task { await load() }
        }
        .presentationDetents([.medium, .large])
    }

    private func load() async {
        guard let code = model.code else { return }
        let r: FriendsResponse? = try? await model.api.get("/api/friends", query: ["code": code])
        mutuals = r.map(Friend.merge)?.filter(\.mutual) ?? []
    }

    private func send(to userId: String) async {
        guard let code = model.code else { return }
        busy = userId
        error = nil
        do {
            let _: SendMessageResponse = try await model.api.send("/api/messages", body: ["code": code, "to": userId, "sightingId": sighting.id])
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            onSent(userId)
        } catch {
            self.error = error.localizedDescription
            busy = nil
        }
    }
}
