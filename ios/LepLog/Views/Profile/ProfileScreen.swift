import AuthenticationServices
import PhotosUI
import SwiftUI

struct ProfileScreen: View {
    @Environment(AppModel.self) private var model
    @State private var nameDraft = ""
    @State private var nickDraft = ""
    @State private var nameNote: String?
    @State private var nickNote: String?
    @State private var avatarItem: PhotosPickerItem?
    @State private var avatarBusy = false
    @State private var zoom: PhotoRef?
    @State private var switching = false
    @State private var newPassword = ""
    @State private var passwordNote: String?
    @State private var passwordBusy = false
    @FocusState private var field: Field?

    enum Field { case name, nick, password }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Your login code is the key to your log. There's no recovery if you lose it — save it somewhere safe.")
                        .font(.footnote).foregroundStyle(Color.inkSoft)
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                }

                photoSection
                nameSection
                NotificationsSection()

                Section {
                    RevealCodeCard(
                        label: "Your log code", value: model.code,
                        qrText: model.code.map { Config.productionURL.appending(queryItems: [URLQueryItem(name: "code", value: $0)]).absoluteString },
                        helpText: "Scan this with another phone's camera (or Lep Log's scanner) to open your log there.",
                        note: "Anyone with this code has full access to your log. Keep it private.",
                        autoHideSeconds: 30
                    )
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    Button("Open a different log…") { switching = true }
                } footer: {
                    Text("Switching changes which log this phone shows. Your current log stays safe under its own code.")
                }

                passwordSection
                InatSection()

                Section {
                    Link(destination: Config.productionURL) { Label("Open Lep Log on the web", systemImage: "safari") }
                } footer: {
                    Text("Lep Log \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                        .frame(maxWidth: .infinity)
                }
            }
            .paperBackground()
            .navigationTitle("Profile")
            .scrollDismissesKeyboard(.interactively)
            .task { await loadProfile() }
            .sheet(isPresented: $switching) { SwitchLogSheet(initialCode: "") }
            .lightbox($zoom)
            .onChange(of: avatarItem) { _, item in
                guard let item else { return }
                avatarItem = nil
                Task { await uploadAvatar(item) }
            }
        }
    }

    // MARK: Photo

    private var photoSection: some View {
        Section {
            HStack(spacing: 16) {
                Button { if let u = model.avatarUrl { zoom = PhotoRef(url: u) } } label: {
                    ZStack {
                        AvatarView(url: model.avatarUrl, size: 68)
                        if avatarBusy { ProgressView().frame(width: 68, height: 68).background(.ultraThinMaterial, in: Circle()) }
                    }
                }
                .buttonStyle(.plain)
                .disabled(model.avatarUrl == nil)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Photo").font(.subheadline.weight(.semibold))
                    Text("Shown to your friends.").font(.caption).foregroundStyle(Color.inkSoft)
                    HStack(spacing: 16) {
                        PhotosPicker(model.avatarUrl == nil ? "Upload" : "Change", selection: $avatarItem, matching: .images)
                        if model.avatarUrl != nil {
                            Button("Remove", role: .destructive) { Task { await removeAvatar() } }
                        }
                    }
                    .font(.subheadline.weight(.medium))
                    .buttonStyle(.borderless)
                    .disabled(avatarBusy)
                }
            }
        }
    }

    // MARK: Names

    private var nameSection: some View {
        Section {
            HStack {
                TextField("Profile name", text: $nameDraft)
                    .focused($field, equals: .name)
                    .textContentType(.nickname)
                    .submitLabel(.done)
                    .onSubmit { Task { await saveName() } }
                Button(nameNote == "saved" ? "Saved" : "Save") { Task { await saveName() } }
                    .disabled(nameDraft.trimmingCharacters(in: .whitespaces) == (model.username ?? ""))
                    .buttonStyle(.borderless)
            }
            if let n = nameNote, n != "saved" { Text(n).font(.footnote).foregroundStyle(Color.danger) }

            HStack {
                TextField("Nickname (optional)", text: $nickDraft)
                    .focused($field, equals: .nick)
                    .submitLabel(.done)
                    .onSubmit { Task { await saveNick() } }
                Button(nickNote == "saved" ? "Saved" : "Save") { Task { await saveNick() } }
                    .disabled(nickDraft.trimmingCharacters(in: .whitespaces) == (model.nickname ?? ""))
                    .buttonStyle(.borderless)
            }
            if let n = nickNote, n != "saved" { Text(n).font(.footnote).foregroundStyle(Color.danger) }
        } header: {
            Text("Profile name")
        } footer: {
            let name = nameDraft.trimmingCharacters(in: .whitespaces)
            let nick = nickDraft.trimmingCharacters(in: .whitespaces)
            Text(name.isEmpty ? "What friends see. Doesn't have to be unique."
                 : "Friends see **\(name)\(nick.isEmpty ? "" : " (\(nick))")**. The nickname is optional and shown in parentheses.")
        }
    }

    // MARK: Password

    private var passwordSection: some View {
        Section {
            SecureField(model.hasPassword ? "New password" : "Set a password", text: $newPassword)
                .focused($field, equals: .password)
                .textContentType(.newPassword)
            HStack {
                Button(model.hasPassword ? "Change" : "Set") { Task { await savePassword(remove: false) } }
                    .disabled(newPassword.count < 4 || passwordBusy)
                if model.hasPassword {
                    Spacer()
                    Button("Remove password", role: .destructive) { Task { await savePassword(remove: true) } }
                        .disabled(passwordBusy)
                }
            }
            .buttonStyle(.borderless)
            if let passwordNote { Text(passwordNote).font(.footnote).foregroundStyle(Color.brand) }
        } header: {
            HStack(spacing: 4) {
                Text("Password")
                if model.hasPassword { Text("· on").foregroundStyle(Color.brand) }
            }
        } footer: {
            Text("Optional. Asked only when your code is first used on a new device — never when opening the app on one you've already used.")
        }
    }

    // MARK: Actions

    private func loadProfile() async {
        nameDraft = model.username ?? ""
        nickDraft = model.nickname ?? ""
        guard let code = model.code, let p: ProfileResponse = try? await model.api.get("/api/user", query: ["code": code]) else { return }
        model.username = p.username
        model.nickname = p.nickname
        model.avatarUrl = p.avatarUrl
        model.hasPassword = p.hasPassword
        if field != .name { nameDraft = p.username ?? "" }
        if field != .nick { nickDraft = p.nickname ?? "" }
    }

    private func patch(_ body: [String: Any?]) async throws -> ProfilePatchResponse {
        guard let code = model.code else { throw APIError(status: 0, message: "No log open.") }
        var b = body
        b["code"] = code
        let r: ProfilePatchResponse = try await model.api.send("/api/user", method: "PATCH", body: b)
        model.username = r.username
        model.nickname = r.nickname
        model.hasPassword = r.hasPassword
        return r
    }

    private func saveName() async {
        nameNote = nil
        do {
            let r = try await patch(["username": nameDraft])
            nameDraft = r.username ?? ""
            nameNote = "saved"
            field = nil
            try? await Task.sleep(for: .seconds(2))
            if nameNote == "saved" { nameNote = nil }
        } catch {
            nameNote = error.localizedDescription
        }
    }

    private func saveNick() async {
        nickNote = nil
        do {
            let r = try await patch(["nickname": nickDraft])
            nickDraft = r.nickname ?? ""
            nickNote = "saved"
            field = nil
            try? await Task.sleep(for: .seconds(2))
            if nickNote == "saved" { nickNote = nil }
        } catch {
            nickNote = error.localizedDescription
        }
    }

    private func savePassword(remove: Bool) async {
        passwordBusy = true
        passwordNote = nil
        defer { passwordBusy = false }
        do {
            _ = try await patch(["password": remove ? "" : newPassword])
            newPassword = ""
            field = nil
            passwordNote = remove ? "Password removed." : "Password set."
        } catch {
            passwordNote = error.localizedDescription
        }
    }

    private func uploadAvatar(_ item: PhotosPickerItem) async {
        guard let code = model.code,
              let data = try? await item.loadTransferable(type: Data.self),
              let photo = PreparedPhoto.from(data: data, maxEdge: 768) else { return }
        avatarBusy = true
        defer { avatarBusy = false }
        if let r: AvatarResponse = try? await model.api.upload("/api/user/avatar", fields: ["code": code],
                                                               file: ("photo", photo.jpeg, "image/jpeg")) {
            model.avatarUrl = r.avatarUrl
        }
    }

    private func removeAvatar() async {
        guard let code = model.code else { return }
        avatarBusy = true
        defer { avatarBusy = false }
        let _: API.Empty? = try? await model.api.send("/api/user/avatar", method: "DELETE", body: ["code": code])
        model.avatarUrl = nil
    }
}

/// Native push for messages, set per phone.
private struct NotificationsSection: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @State private var status: UNAuthorizationStatus = .notDetermined
    @AppStorage("lep.pushOff") private var turnedOff = false

    var body: some View {
        Section {
            switch status {
            case .denied:
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(url) }
                }
            default:
                Toggle("Message notifications", isOn: Binding(
                    get: { status == .authorized && !turnedOff },
                    set: { on in Task { await set(on) } }
                ))
                .tint(.brand)
            }
        } header: {
            Text("Notifications")
        } footer: {
            Text(status == .denied
                 ? "Notifications are off for Lep Log in Settings. Turn them on there, then come back."
                 : "A notification and an app-icon badge when a friend messages you, even when the app is closed.")
        }
        .task(id: scenePhase) { status = await PushManager.shared.status() }
    }

    private func set(_ on: Bool) async {
        if on {
            turnedOff = false
            if status == .notDetermined { await PushManager.shared.requestPermission() }
            else { await PushManager.shared.registerIfAuthorized() }
        } else {
            turnedOff = true
            await PushManager.shared.unregister()
        }
        status = await PushManager.shared.status()
    }
}

/// Post sightings to iNaturalist. Hidden until iNaturalist sign-in is set up on the server.
private struct InatSection: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuth
    @State private var status: InatStatus?
    @State private var busy = false
    @State private var note: String?

    var body: some View {
        if let status, status.configured {
            Section {
                if !status.connected {
                    Button("Connect iNaturalist") { Task { await connect() } }.disabled(busy)
                } else {
                    if let u = status.username {
                        LabeledContent("Connected as") { Link("@\(u)", destination: INat.person(u)) }
                    }
                    Toggle("Auto-post new sightings", isOn: Binding(
                        get: { status.syncEnabled },
                        set: { on in Task { await post("toggle", extra: ["enabled": on]) } }
                    ))
                    .tint(.brand)
                    .disabled(busy)
                    if status.unsyncedCount > 0 {
                        Button(busy ? "Pushing…" : "Push \(Format.plural(status.unsyncedCount, "sighting")) to iNaturalist") {
                            Task { await post("sync") }
                        }
                        .disabled(busy)
                    }
                    Button("Disconnect", role: .destructive) { Task { await post("disconnect") } }.disabled(busy)
                }
                if let note { Text(note).font(.footnote).foregroundStyle(Color.brand) }
            } header: {
                Text("iNaturalist")
            } footer: {
                if !status.connected {
                    Text("Post your sightings as observations to your iNaturalist account. They become public iNaturalist records (locations of sensitive species are auto-obscured).")
                }
            }
        } else {
            Color.clear.frame(height: 0).listRowBackground(Color.clear).task { await refresh() }
        }
    }

    private func refresh() async {
        guard let code = model.code else { return }
        status = try? await model.api.get("/api/inat/status", query: ["code": code])
    }

    private func connect() async {
        guard let code = model.code else { return }
        busy = true
        defer { busy = false }
        note = nil
        do {
            let url = model.api.url("/api/inat/connect", query: ["code": code, "app": "1"])
            let callback = try await webAuth.authenticate(using: url, callbackURLScheme: Config.callbackScheme,
                                                          preferredBrowserSession: .ephemeral)
            let q = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
            let result = q.first { $0.name == "inat" }?.value
            let user = q.first { $0.name == "user" }?.value
            note = result == "connected" ? "Connected to iNaturalist as @\(user ?? "")."
                : result == "denied" ? "iNaturalist authorization was cancelled."
                : "Couldn't connect to iNaturalist — try again."
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            // closed the sheet
        } catch {
            note = "Couldn't connect to iNaturalist — try again."
        }
        await refresh()
    }

    private func post(_ action: String, extra: [String: Any?] = [:]) async {
        guard let code = model.code else { return }
        busy = true
        note = nil
        defer { busy = false }
        do {
            var body: [String: Any?] = ["code": code, "action": action]
            body.merge(extra) { $1 }
            let r: InatSyncResponse = try await model.api.send("/api/inat", body: body)
            if action == "sync" {
                let synced = r.synced ?? 0
                note = "Pushed \(Format.plural(synced, "sighting"))"
                    + ((r.failed ?? 0) > 0 ? ", \(r.failed!) failed" : "")
                    + ((r.remaining ?? 0) > 0 ? ", \(r.remaining!) more syncing in the background" : "")
            }
        } catch {
            note = error.localizedDescription
        }
        await refresh()
    }
}
