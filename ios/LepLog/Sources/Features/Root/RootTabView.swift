import SwiftUI

struct RootTabView: View {
    let code: String

    var body: some View {
        TabView {
            PlaceholderTabView(
                title: "Identify",
                systemImage: "camera",
                message: "Photograph a moth or butterfly to identify it — coming soon."
            )
            .tabItem { Label("Identify", systemImage: "camera") }

            JournalView(code: code)
                .tabItem { Label("Journal", systemImage: "book") }

            PlaceholderTabView(
                title: "Friends",
                systemImage: "person.2",
                message: "Follow friends and see their logs — coming soon."
            )
            .tabItem { Label("Friends", systemImage: "person.2") }

            PlaceholderTabView(
                title: "Map",
                systemImage: "map",
                message: "See all your sightings on a map — coming soon."
            )
            .tabItem { Label("Map", systemImage: "map") }

            ProfileView(code: code)
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
        }
    }
}
