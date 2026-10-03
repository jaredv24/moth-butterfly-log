import SwiftUI

@main
struct LepLogApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var model = AppModel()

    init() {
        // Sighting photos and checklist thumbnails: keep plenty on disk so lists scroll smoothly.
        URLCache.shared = URLCache(memoryCapacity: 64 << 20, diskCapacity: 512 << 20)
        PushManager.shared.configure(model: _model.wrappedValue)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(.brand)
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch model.phase {
            case .loading:
                Splash()
            case .locked(let code):
                PasswordGateView(code: code)
            case .offline(let message):
                OfflineView(message: message)
            case .ready:
                MainTabs()
            }
        }
        .task { await model.bootstrap() }
        .onOpenURL { model.handle(url: $0) }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.onForeground() } }
        }
        .sheet(item: Binding(
            get: { model.pendingCode.map(PendingCode.init) },
            set: { model.pendingCode = $0?.code }
        )) { p in
            SwitchLogSheet(initialCode: p.code)
        }
    }
}

private struct PendingCode: Identifiable {
    let code: String
    var id: String { code }
}

private struct Splash: View {
    var body: some View {
        ZStack {
            PaperBackground()
            VStack(spacing: 10) {
                GlyphImage(glyph: .butterfly).frame(width: 72, height: 72)
                Text("Lep Log").font(.largeTitle.bold()).foregroundStyle(Color.brand)
            }
        }
    }
}

private struct OfflineView: View {
    let message: String
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            PaperBackground()
            VStack(spacing: 14) {
                Image(systemName: "wifi.slash").font(.largeTitle).foregroundStyle(Color.inkSoft)
                Text("Can't reach Lep Log").font(.title3.bold())
                Text(message).font(.subheadline).foregroundStyle(Color.inkSoft).multilineTextAlignment(.center)
                Button("Try again") {
                    model.phase = .loading
                    Task { await model.bootstrap() }
                }
                .lepProminentButton()
            }
            .padding(32)
        }
    }
}

struct MainTabs: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.tab) {
            IdentifyScreen()
                .tabItem { Label("Identify", systemImage: "camera.viewfinder") }
                .tag(Tab.identify)
            JournalScreen()
                .tabItem { Label("Journal", systemImage: "book.closed") }
                .tag(Tab.journal)
            FriendsScreen()
                .tabItem { Label("Friends", systemImage: "person.2") }
                .tag(Tab.friends)
                .badge(model.unread)
            MapScreen()
                .tabItem { Label("Map", systemImage: "map") }
                .tag(Tab.map)
            ProfileScreen()
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .tag(Tab.profile)
        }
    }
}
