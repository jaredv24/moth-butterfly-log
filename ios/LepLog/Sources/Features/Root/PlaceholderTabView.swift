import SwiftUI

/// Placeholder for a nav tab that isn't built natively yet. Keeps the app's
/// tab structure matching the web (Identify, Journal, Friends, Map, Profile)
/// so the shape of the app is right even while most of it is still stubs.
struct PlaceholderTabView: View {
    let title: String
    let systemImage: String
    let message: String

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            .navigationTitle(title)
        }
    }
}
