import SwiftUI

/// Open a different log by its MOTH- code (typed, scanned, or from a link), with its password if it has one.
struct SwitchLogSheet: View {
    let initialCode: String
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var password = ""
    @State private var needsPassword = false
    @State private var busy = false
    @State private var error: String?
    @State private var scanning = false
    @State private var createdNote: String?
    @FocusState private var passwordFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField("MOTH-XXXXXX", text: $code)
                            .font(.body.monospaced())
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                        if CodeScanner.isAvailable {
                            Button { scanning = true } label: { Image(systemName: "qrcode.viewfinder") }
                                .buttonStyle(.borderless)
                                .accessibilityLabel("Scan a log code")
                        }
                    }
                    if needsPassword {
                        SecureField("Password for that log", text: $password)
                            .textContentType(.password)
                            .focused($passwordFocused)
                    }
                } footer: {
                    Text(needsPassword ? "That log is password-protected. You'll only be asked once on this phone."
                         : "Switching changes which log this phone shows. Your current log (\(model.code ?? "")) stays safe under its own code — note it down first if you haven't.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(Color.danger) }
                }
                if let createdNote {
                    Section { Text(createdNote).foregroundStyle(Color.brand) }
                }
            }
            .navigationTitle("Open a log")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if createdNote != nil {
                        Button("Done") { dismiss() }
                    } else {
                        Button(busy ? "Opening…" : "Open") { Task { await open() } }
                            .disabled(code.trimmingCharacters(in: .whitespaces).isEmpty || (needsPassword && password.isEmpty) || busy)
                    }
                }
            }
            .sheet(isPresented: $scanning) {
                CodeScanner { scanned in
                    if case .userCode(let c) = scanned { code = c } else { error = "That's a friend code — add it on the Friends tab." }
                }
            }
            .onAppear { if code.isEmpty { code = initialCode } }
        }
        .presentationDetents([.medium])
    }

    private func open() async {
        let c = Codes.normalize(code)
        guard Codes.isUserCode(c) else {
            error = "That doesn't look like a MOTH-XXXXXX code."
            return
        }
        guard c != model.code else { dismiss(); return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            let created = try await model.resolve(code: c, password: needsPassword ? password : nil)
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            // A code no one has used yet starts a new empty log; say so rather than silently showing nothing.
            if created { createdNote = "New empty log created for \(c)." } else { dismiss() }
        } catch let e as APIError where e.needsPassword {
            if needsPassword { error = e.message }
            needsPassword = true
            passwordFocused = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}
