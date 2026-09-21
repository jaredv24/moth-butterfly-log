import SwiftUI

/// First-run screen: start a fresh log or paste in an existing MOTH-XXXXXX
/// code from another device. Mirrors the code-entry flow `useUserCode.ts`
/// drives on the web (including the password-gate follow-up).
struct CodeEntryView: View {
    @EnvironmentObject private var session: AppSession
    @State private var codeInput = ""
    @State private var passwordInput = ""

    // Explicit init: private stored properties would otherwise make the
    // synthesized memberwise init private too, breaking `CodeEntryView()`
    // from RootView.swift.
    init() {}

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 8) {
                Text("🦋")
                    .font(.system(size: 56))
                Text("Lep Log")
                    .font(.largeTitle.bold())
                Text("Photograph a moth or butterfly and check it off your life list.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let pending = session.pendingPasswordCode {
                passwordPrompt(for: pending)
            } else {
                codeEntry
            }

            if let error = session.errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }

            Spacer()
            Spacer()
        }
        .padding(24)
    }

    private var codeEntry: some View {
        VStack(spacing: 12) {
            TextField("MOTH-XXXXXX", text: $codeInput)
                .textFieldStyle(.roundedBorder)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()

            Button {
                Task { await session.logIn(code: codeInput) }
            } label: {
                Text(session.isResolving ? "Checking…" : "Use this code")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(codeInput.trimmingCharacters(in: .whitespaces).isEmpty || session.isResolving)

            Button("Start a new log") {
                Task { await session.createNewLog() }
            }
            .disabled(session.isResolving)
        }
    }

    private func passwordPrompt(for code: String) -> some View {
        VStack(spacing: 12) {
            Text("That log (\(code)) is password-protected.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            SecureField("Password", text: $passwordInput)
                .textFieldStyle(.roundedBorder)

            Button {
                Task { await session.logIn(code: code, password: passwordInput) }
            } label: {
                Text(session.isResolving ? "Checking…" : "Unlock")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(passwordInput.isEmpty || session.isResolving)
        }
    }
}
