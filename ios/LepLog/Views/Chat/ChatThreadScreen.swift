import SwiftUI

struct ChatThreadScreen: View {
    let friendId: String
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @State private var data: ThreadResponse?
    @State private var state: LoadState = .loading
    @State private var text = ""
    @State private var sending = false
    @State private var attaching = false
    @FocusState private var focused: Bool

    enum LoadState { case loading, ready, error, forbidden }

    var body: some View {
        Group {
            if state == .forbidden {
                ContentUnavailableView("Can't message", systemImage: "bubble.left.and.exclamationmark.bubble.right",
                                       description: Text("You can only message people you both follow. If you were following each other, one of you has since unfollowed."))
            } else {
                messages
            }
        }
        .background(PaperBackground())
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Button { model.friendsPath.append(.friend(friendId)) } label: {
                    HStack(spacing: 8) {
                        AvatarView(url: data?.friend.avatarUrl, size: 28)
                        Text(data?.friend.name ?? "Chat").font(.headline).foregroundStyle(Color.ink).lineLimit(1)
                    }
                }
                .accessibilityHint("Opens their log")
            }
        }
        .safeAreaInset(edge: .bottom) {
            if state != .forbidden && state != .error { composer }
        }
        .sheet(isPresented: $attaching) {
            AttachSightingSheet { id in
                attaching = false
                Task { await post(sightingId: id) }
            }
        }
        .onAppear { model.openChatUserId = friendId }
        .onDisappear { if model.openChatUserId == friendId { model.openChatUserId = nil } }
        .task(id: scenePhase) {
            // New messages show up within a few seconds while the chat is open, like the website.
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(3))
            }
        }
    }

    private var messages: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 10) {
                    if state == .loading { ProgressView().padding(.top, 40) }
                    if state == .error { Text("Couldn't load this chat.").foregroundStyle(Color.inkSoft).padding(.top, 40) }
                    if state == .ready, data?.messages.isEmpty == true {
                        Text("No messages yet. Say hello, or share a sighting.")
                            .font(.subheadline).foregroundStyle(Color.inkSoft).padding(.top, 40)
                    }
                    ForEach(data?.messages ?? []) { m in
                        bubble(m).id(m.id)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: data?.messages.last?.id) { _, id in
                guard let id else { return }
                withAnimation { proxy.scrollTo(id, anchor: .bottom) }
            }
            .onChange(of: focused) { _, f in
                if f, let id = data?.messages.last?.id {
                    Task { try? await Task.sleep(for: .milliseconds(250)); withAnimation { proxy.scrollTo(id, anchor: .bottom) } }
                }
            }
        }
    }

    private func bubble(_ m: ChatMessage) -> some View {
        VStack(alignment: m.mine ? .trailing : .leading, spacing: 4) {
            if let s = m.sighting {
                Button {
                    if m.mine {
                        model.focusSightingId = s.id
                        model.tab = .journal
                    } else {
                        model.friendsPath.append(.friend(friendId, focus: s.id))
                    }
                } label: {
                    SharedSightingCard(sighting: s)
                }
                .buttonStyle(.plain)
            }
            if let body = m.body {
                Text(body)
                    .font(.body)
                    .foregroundStyle(m.mine ? Color.onBrand : Color.ink)
                    .padding(.horizontal, 13)
                    .padding(.vertical, 8)
                    .background(m.mine ? AnyShapeStyle(Color.brand) : AnyShapeStyle(Color.surface),
                                in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay {
                        if !m.mine { RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Color.line) }
                    }
                    .textSelection(.enabled)
            }
            Text(Format.clock(m.at)).font(.caption2).foregroundStyle(Color.inkSoft).padding(.horizontal, 4)
        }
        .frame(maxWidth: .infinity, alignment: m.mine ? .trailing : .leading)
        .padding(m.mine ? .leading : .trailing, 48)
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Button { attaching = true } label: {
                Image(systemName: "plus").font(.headline).frame(width: 38, height: 38)
            }
            .lepGlass(in: Circle(), interactive: true)
            .disabled(sending)
            .accessibilityLabel("Share a sighting")

            TextField("Message", text: $text, axis: .vertical)
                .lineLimit(1...5)
                .focused($focused)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .lepGlass(in: RoundedRectangle(cornerRadius: 20, style: .continuous))

            Button {
                Task { await post(body: text) }
            } label: {
                Image(systemName: "arrow.up").font(.headline.weight(.bold)).frame(width: 38, height: 38)
                    .foregroundStyle(Color.onBrand)
            }
            .lepGlass(in: Circle(), tint: canSend ? .brand : .inkSoft, interactive: true)
            .disabled(!canSend)
            .accessibilityLabel("Send")
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending }

    private func load() async {
        guard let code = model.code else { return }
        do {
            let r: ThreadResponse = try await model.api.get("/api/messages/thread", query: ["code": code, "friend": friendId])
            if r.messages != data?.messages || data == nil { data = r }
            state = .ready
            await model.refreshUnread()
        } catch let e as APIError where e.status == 403 {
            state = .forbidden
        } catch {
            if state == .loading { state = .error }
        }
    }

    private func post(body: String? = nil, sightingId: String? = nil) async {
        guard let code = model.code else { return }
        let trimmed = body?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard (trimmed?.isEmpty == false) || sightingId != nil else { return }
        sending = true
        defer { sending = false }
        do {
            let r: SendMessageResponse = try await model.api.send("/api/messages", body: [
                "code": code, "to": friendId, "body": trimmed, "sightingId": sightingId,
            ])
            if body != nil { text = "" }
            if var d = data {
                d = ThreadResponse(friend: d.friend, messages: d.messages + [r.message])
                data = d
            }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        } catch {
            // The text stays in the box to retry.
        }
    }
}

/// A sighting attached to a chat message.
struct SharedSightingCard: View {
    let sighting: SharedSighting

    var body: some View {
        HStack(spacing: 10) {
            Thumb(url: sighting.photoUrl, size: 56)
            VStack(alignment: .leading, spacing: 2) {
                Text(sighting.identifiedName).font(.subheadline.weight(.semibold)).foregroundStyle(Color.ink).lineLimit(1)
                Text((sighting.placeLabel.map { "\($0) · " } ?? "") + Format.day(sighting.observedAt))
                    .font(.caption).foregroundStyle(Color.inkSoft).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(8)
        .frame(width: 250)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Color.line))
    }
}
