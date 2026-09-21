import SwiftUI
import UIKit

struct ProfileView: View {
    @EnvironmentObject private var session: AppSession
    @ObservedObject private var apiConfig = APIConfig.shared
    let code: String

    // Explicit init: `apiConfig` being private would otherwise make the
    // synthesized memberwise init private too, breaking cross-file construction.
    init(code: String) {
        self.code = code
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Your log") {
                    LabeledContent("Code", value: code)
                    Button("Copy code") {
                        UIPasteboard.general.string = code
                    }
                }

                Section {
                    Button("Sign out", role: .destructive) {
                        session.signOut()
                    }
                } footer: {
                    Text("This just removes the code from this device — your log stays put. Use the code above to sign back in anywhere.")
                }

                Section {
                    TextField("API server", text: $apiConfig.baseURLString)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                } header: {
                    Text("Developer")
                } footer: {
                    Text("Where the app talks to the Lep Log backend. Defaults to \(APIConfig.defaultURLString) for the iOS Simulator; use your Mac's LAN IP (e.g. http://192.168.1.23:3000) to test on a physical device, or your deployed URL in production.")
                }
            }
            .navigationTitle("Profile")
        }
    }
}
