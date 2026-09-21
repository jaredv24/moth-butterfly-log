import Foundation

enum CritterKind: Equatable {
    case arthropod, critter
}

/// Friendly-group -> kind lookup, mirroring `GROUP_KIND` in the web app's
/// `lib/bug-groups.ts`. The server already picks the friendly group name
/// (e.g. "Beetles") for off-checklist sightings; this just buckets those
/// names into the same two display tiers the web log uses.
enum BugGroups {
    private static let arthropodGroups: Set<String> = [
        "Beetles", "Dragonflies & Damselflies", "Bees, Wasps & Ants",
        "True Bugs, Hoppers & Aphids", "Flies & Mosquitoes",
        "Grasshoppers, Crickets & Katydids", "Mantises", "Cockroaches & Termites",
        "Stick & Leaf Insects", "Lacewings & Antlions", "Mayflies", "Stoneflies",
        "Caddisflies", "Earwigs", "Thrips", "Barklice & Booklice", "Fleas",
        "Spiders", "Harvestmen", "Ticks", "Scorpions", "Millipedes", "Centipedes",
        "Horseshoe Crabs", "Crabs, Shrimp & Crayfish", "Woodlice & Pillbugs",
        "Other insects", "Other arachnids", "Other crustaceans",
        "Other bugs", "Other arthropods",
    ]

    /// Everything not in the arthropod set falls back to "critter" — same
    /// default the web's `GROUP_KIND.get(groupName) ?? "critter"` uses.
    static func kind(for group: String) -> CritterKind {
        arthropodGroups.contains(group) ? .arthropod : .critter
    }
}
