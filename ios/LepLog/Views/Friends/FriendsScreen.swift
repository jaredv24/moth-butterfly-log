import SwiftUI

struct FriendsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var data: FriendsResponse?
    @State private var friends: [Friend] = []
    @State private var loadError = false
    @State private var input = ""
    @State private var busy = false
    @State private var message: String?
    @State private var scanning = false
    @State private var unfollowing: Friend?

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.friendsPath) {
            List {
                Section {
                    NavigationLink(value: FriendsRoute.chats) {
                        HStack {
                            Label("Messages", systemImage: "bubble.left.and.bubble.right")
                            Spacer()
                            if model.unread > 0 { CountBadge(count: model.unread) }
                        }
                    }
                    if model.username == nil, !(data?.followers.isEmpty ?? true) {
                        Button { model.tab = .profile } label: {
                            Label("Set a display name so friends know it's you", systemImage: "person.text.rectangle")
                        }
                        .foregroundStyle(Color.brand)
                    }
                } footer: {
                    Text("People you follow and people who follow you. When you follow each other it's **mutual** — you can chat, and both see everything the other has logged, including where.")
                }

                Section("Friends\(friends.isEmpty ? "" : " (\(friends.count))")") {
                    if loadError {
                        Text("Couldn't load your friends.").foregroundStyle(Color.inkSoft)
                    } else if data != nil, friends.isEmpty {
                        Text("No friends yet. Share your friend code, or add someone's below.").foregroundStyle(Color.inkSoft)
                    } else if data == nil {
                        HStack { Spacer(); ProgressView(); Spacer() }
                    }
                    ForEach(friends) { f in row(f) }
                }
                .listRowBackground(Color.surface)

                Section {
                    HStack(spacing: 8) {
                        TextField("PAL-XXXXXXXX", text: $input)
                            .font(.body.monospaced())
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .submitLabel(.done)
                            .onSubmit { Task { await follow(input) } }
                        if CodeScanner.isAvailable {
                            Button { scanning = true } label: { Image(systemName: "qrcode.viewfinder") }
                                .accessibilityLabel("Scan a friend code")
                        }
                        Button(busy ? "…" : "Add") { Task { await follow(input) } }
                            .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.borderless)
                    if let message { Text(message).font(.footnote).foregroundStyle(Color.brand) }
                } header: {
                    Text("Add a friend")
                }
                .listRowBackground(Color.surface)

                Section {
                    RevealCodeCard(label: "Your friend code", value: data?.friendCode,
                                   note: "Different from your MOTH- login code; grants read-only access only.")
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                    if let code = data?.friendCode {
                        ShareLink(item: "Follow my Lep Log! My friend code is \(code)") {
                            Label("Share friend code", systemImage: "square.and.arrow.up")
                        }
                        .listRowBackground(Color.clear)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .paperBackground()
            .navigationTitle("Friends")
            .refreshable { await load() }
            .task { await load() }
            .navigationDestination(for: FriendsRoute.self) { route in
                switch route {
                case .friend(let id, let focus): FriendLogScreen(friendId: id, focusSightingId: focus)
                case .chats: ChatListScreen()
                case .chat(let id): ChatThreadScreen(friendId: id)
                }
            }
            .sheet(isPresented: $scanning) {
                CodeScanner { scanned in
                    if case .friendCode(let c) = scanned { Task { await follow(c) } }
                    else { message = "That's a log code, not a friend code." }
                }
            }
            .confirmationDialog("Stop following?", isPresented: Binding(get: { unfollowing != nil }, set: { if !$0 { unfollowing = nil } }),
                                titleVisibility: .visible, presenting: unfollowing) { f in
                Button("Unfollow \(f.name ?? "this person")", role: .destructive) { Task { await unfollow(f) } }
            }
        }
    }

    private func row(_ f: Friend) -> some View {
        let content = HStack(spacing: 12) {
            AvatarView(url: f.avatarUrl)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(f.name ?? "Someone (no name set)")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(f.name == nil ? Color.inkSoft : Color.ink)
                        .lineLimit(1)
                    if f.mutual { Chip(text: "mutual", color: .brand, fill: Color.brand.opacity(0.15)) }
                }
                Text(f.iFollow ? "\(f.speciesCount) species · \(Format.active(f.lastActiveAt))" : "follows you")
                    .font(.caption).foregroundStyle(Color.inkSoft)
            }
            Spacer(minLength: 0)
            if f.followsMe && !f.iFollow {
                Button("Follow back") { Task { await followBack(f) } }
                    .buttonStyle(.bordered).tint(.brand).controlSize(.small)
            }
        }

        return Group {
            if f.iFollow {
                NavigationLink(value: FriendsRoute.friend(f.userId)) { content }
            } else {
                content
            }
        }
        .swipeActions {
            if f.iFollow {
                Button("Unfollow", role: .destructive) { unfollowing = f }
            }
            if f.mutual {
                Button("Message", systemImage: "bubble.left") { model.friendsPath.append(.chat(f.userId)) }.tint(.brand)
            }
        }
        .contextMenu {
            if f.mutual {
                Button("Message", systemImage: "bubble.left") { model.friendsPath.append(.chat(f.userId)) }
            }
            if f.iFollow {
                Button("Unfollow", systemImage: "person.badge.minus", role: .destructive) { unfollowing = f }
            }
        }
    }

    private func load() async {
        guard let code = model.code else { return }
        do {
            let r: FriendsResponse = try await model.api.get("/api/friends", query: ["code": code])
            data = r
            friends = Friend.merge(r)
            loadError = false
        } catch {
            loadError = data == nil
        }
        await model.refreshUnread()
    }

    private func follow(_ raw: String) async {
        guard let code = model.code else { return }
        let friendCode = Codes.normalize(raw)
        guard !friendCode.isEmpty else { return }
        busy = true
        message = nil
        defer { busy = false }
        do {
            let _: API.Empty = try await model.api.send("/api/friends", body: ["code": code, "friendCode": friendCode])
            input = ""
            message = "Added."
            await load()
        } catch {
            message = error.localizedDescription
        }
    }

    private func followBack(_ f: Friend) async {
        guard let code = model.code else { return }
        let _: API.Empty? = try? await model.api.send("/api/friends/follow-back", body: ["code": code, "followerUserId": f.userId])
        await load()
    }

    private func unfollow(_ f: Friend) async {
        guard let code = model.code else { return }
        let _: API.Empty? = try? await model.api.send("/api/friends", method: "DELETE", body: ["code": code, "friendUserId": f.userId])
        await load()
    }
}
