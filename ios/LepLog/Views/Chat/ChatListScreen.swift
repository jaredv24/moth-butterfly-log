import SwiftUI

struct ChatListScreen: View {
    @Environment(AppModel.self) private var model
    @State private var data: ThreadsResponse?
    @State private var failed = false

    var body: some View {
        List {
            if failed && data == nil {
                Text("Couldn't load messages.").foregroundStyle(Color.inkSoft)
            } else if let data, data.threads.isEmpty {
                ContentUnavailableView(
                    "No conversations yet", systemImage: "bubble.left.and.bubble.right",
                    description: Text("When you and a friend follow each other, a chat opens up here — start one from their profile on the Friends tab.")
                )
                .listRowBackground(Color.clear)
            } else if data == nil {
                HStack { Spacer(); ProgressView(); Spacer() }.listRowBackground(Color.clear)
            }
            ForEach(data?.threads ?? []) { t in
                NavigationLink(value: FriendsRoute.chat(t.userId)) {
                    HStack(spacing: 12) {
                        AvatarView(url: t.avatarUrl, size: 44)
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(t.name ?? "Someone").font(.body.weight(.semibold))
                                    .foregroundStyle(t.name == nil ? Color.inkSoft : Color.ink).lineLimit(1)
                                Spacer()
                                if let last = t.lastMessage {
                                    Text(Format.ago(last.at)).font(.caption2).foregroundStyle(Color.inkSoft)
                                }
                            }
                            lastLine(t)
                                .font(.subheadline.weight(t.unread > 0 ? .medium : .regular))
                                .foregroundStyle(t.unread > 0 ? Color.ink : Color.inkSoft)
                                .lineLimit(1)
                        }
                        if t.unread > 0 { CountBadge(count: t.unread) }
                    }
                }
                .listRowBackground(Color.surface)
            }
        }
        .listStyle(.insetGrouped)
        .paperBackground()
        .navigationTitle("Messages")
        .refreshable { await load() }
        .task {
            // Keep the list fresh while it's on screen, like the website's 20s poll.
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(20))
            }
        }
    }

    /// The server marks a shared sighting as "📷 Shared a sighting"; show it with an icon instead.
    private func lastLine(_ t: ChatThreadSummary) -> some View {
        guard let last = t.lastMessage else { return Text("No messages yet") }
        let prefix = last.mine ? "You: " : ""
        if last.preview.hasPrefix("📷") {
            let rest = last.preview.dropFirst().trimmingCharacters(in: .whitespaces)
            return Text(prefix) + Text(Image(systemName: "photo.fill")) + Text(" \(rest)")
        }
        return Text(prefix + last.preview)
    }

    private func load() async {
        guard let code = model.code else { return }
        do {
            data = try await model.api.get("/api/messages", query: ["code": code])
            failed = false
            model.unread = data?.totalUnread ?? model.unread
        } catch {
            failed = true
        }
    }
}
