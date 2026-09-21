import SwiftUI

@main
struct LepLogApp: App {
    @StateObject private var session = AppSession.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(.lepGreen)
        }
    }
}
