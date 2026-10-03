import SwiftUI

/// A friend's log, read-only: their life list, sightings, and map.
struct FriendLogScreen: View {
    let friendId: String
    var focusSightingId: String?
    @Environment(AppModel.self) private var model
    @State private var data: FriendLogResponse?
    @State private var state: LoadState = .loading
    @State private var section: Section = .log
    @State private var sheet: SheetSightings?
    @State private var zoom: PhotoRef?
    @State private var focused = false

    enum LoadState { case loading, ready, error, forbidden }
    enum Section: String, CaseIterable { case log = "Log", map = "Map" }

    var body: some View {
        Group {
            if state == .forbidden {
                ContentUnavailableView("Not following", systemImage: "person.crop.circle.badge.xmark",
                                       description: Text("You're not following this person, or they removed their code."))
            } else if section == .map, let data {
                VStack(spacing: 0) {
                    picker.padding()
                    SightingsMap(log: data.log, emptyHint: "\(data.friend.name) hasn't logged anything with a location.") { s in
                        sheet = SheetSightings(rows: data.log.filter { $0.speciesKey == s.speciesKey })
                    }
                }
            } else {
                list
            }
        }
        .background(PaperBackground())
        .navigationTitle(data?.friend.name ?? "Friend")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if data?.friend.mutual == true {
                ToolbarItem(placement: .primaryAction) {
                    Button("Message", systemImage: "bubble.left") { model.friendsPath.append(.chat(friendId)) }
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $sheet) { SightingSheet(sightings: $0.rows, owned: false) }
        .lightbox($zoom)
    }

    private var picker: some View {
        Picker("View", selection: $section) {
            ForEach(Section.allCases, id: \.self) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)
    }

    private var list: some View {
        List {
            SwiftUI.Section {
                HStack(spacing: 14) {
                    Button { if let u = data?.friend.avatarUrl { zoom = PhotoRef(url: u) } } label: {
                        AvatarView(url: data?.friend.avatarUrl, size: 56)
                    }
                    .buttonStyle(.plain)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(data?.friend.name ?? "Friend").font(.title2.bold())
                        Text(state == .ready ? "\(data?.stats.speciesTotal ?? 0) species · read-only"
                             : state == .error ? "Couldn't load this log." : "Loading…")
                            .font(.subheadline).foregroundStyle(Color.inkSoft)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            if let data {
                SwiftUI.Section {
                    LifeListCard(stats: data.stats, own: false)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }
                SwiftUI.Section { picker.listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
                if data.log.isEmpty {
                    EmptyNote(text: "Nothing logged here yet.").listRowBackground(Color.clear).listRowInsets(EdgeInsets())
                } else {
                    LogSections(
                        entries: data.log,
                        owned: false,
                        onOpen: { s in sheet = SheetSightings(rows: data.log.filter { $0.speciesKey == s.speciesKey }) },
                        onZoom: { zoom = PhotoRef(url: $0) }
                    )
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func load() async {
        guard let code = model.code else { return }
        do {
            let r: FriendLogResponse = try await model.api.get("/api/friends/log", query: ["code": code, "friend": friendId])
            data = r
            state = .ready
            if !focused, let id = focusSightingId, let s = r.log.first(where: { $0.id == id }) {
                focused = true
                sheet = SheetSightings(rows: [s])
            }
        } catch let e as APIError where e.status == 403 {
            state = .forbidden
        } catch {
            if data == nil { state = .error }
        }
    }
}
