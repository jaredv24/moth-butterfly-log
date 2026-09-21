import SwiftUI

/// Swaps between the code-entry screen and the main app, mirroring how
/// `useUserCode` gates the web app's pages on `code` being resolved.
struct RootView: View {
    @EnvironmentObject private var session: AppSession
    @State private var didAttemptRestore = false

    // Explicit init: private stored properties would otherwise make the
    // synthesized memberwise init private too, breaking `RootView()` from
    // LepLogApp.swift.
    init() {}

    var body: some View {
        Group {
            if let code = session.code {
                RootTabView(code: code)
            } else if didAttemptRestore {
                CodeEntryView()
            } else {
                ProgressView()
            }
        }
        .task {
            await session.restoreIfNeeded()
            didAttemptRestore = true
        }
    }
}
