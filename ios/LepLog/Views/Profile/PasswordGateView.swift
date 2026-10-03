import SwiftUI

/// Shown only when a password-protected log is opened on a phone that hasn't unlocked it
/// before. After the right password the phone is trusted and this never appears again on it.
struct PasswordGateView: View {
    let code: String
    @Environment(AppModel.self) private var model
    @State private var password = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            PaperBackground()
            Card(padding: 20) {
                Image(systemName: "lock.fill").font(.title).foregroundStyle(Color.brand)
                Text("Log is password-protected").font(.title3.bold())
                Text("Enter the password to use **\(code)** on this phone. You'll only be asked once here.")
                    .font(.subheadline).foregroundStyle(Color.inkSoft)
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .focused($focused)
                    .submitLabel(.go)
                    .onSubmit(unlock)
                    .padding(12)
                    .background(Color.paper, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color.line))
                if let error { Text(error).font(.subheadline).foregroundStyle(Color.danger) }
                Button(action: unlock) {
                    Text(busy ? "Unlocking…" : "Unlock")
                }
                .buttonStyle(PillButtonStyle())
                .disabled(password.isEmpty || busy)
                Button("Use a different code") { Task { await model.abandonLockedCode() } }
                    .font(.footnote)
                    .foregroundStyle(Color.inkSoft)
                    .frame(maxWidth: .infinity)
            }
            .padding(24)
        }
        .onAppear { focused = true }
    }

    private func unlock() {
        guard !password.isEmpty, !busy else { return }
        busy = true
        error = nil
        Task {
            do {
                try await model.resolve(code: code, password: password)
                await model.bootstrap()
            } catch {
                self.error = error.localizedDescription
                busy = false
            }
        }
    }
}
