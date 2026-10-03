import Foundation

/// Classifies the friendly group names the server stores for off-checklist critters
/// (lib/bug-groups.ts) into "other insects & arthropods" vs "other critters".
enum BugGroups {
    static let arthropodLabel = "Other insects & arthropods"
    static let critterLabel = "Other critters"

    private static let arthropods: Set<String> = [
        "Beetles", "Dragonflies & Damselflies", "Bees, Wasps & Ants", "True Bugs, Hoppers & Aphids",
        "Flies & Mosquitoes", "Grasshoppers, Crickets & Katydids", "Mantises", "Cockroaches & Termites",
        "Stick & Leaf Insects", "Lacewings & Antlions", "Mayflies", "Stoneflies", "Caddisflies", "Earwigs",
        "Thrips", "Barklice & Booklice", "Fleas", "Spiders", "Harvestmen", "Ticks", "Scorpions", "Millipedes",
        "Centipedes", "Horseshoe Crabs", "Crabs, Shrimp & Crayfish", "Woodlice & Pillbugs", "Other insects",
        "Other arachnids", "Other crustaceans", "Other bugs", "Other arthropods",
    ]

    static func kind(_ group: String) -> CritterKind {
        arthropods.contains(group) ? .arthropod : .critter
    }

    static func glyph(_ group: String) -> Glyph {
        let table: [(String, String)] = [
            ("Bees", "ant.fill"), ("Frogs", "lizard.fill"), ("Salamanders", "lizard.fill"), ("Lizards", "lizard.fill"),
            ("Snakes", "lizard.fill"), ("Reptiles", "lizard.fill"), ("Amphibians", "lizard.fill"), ("Crocodilians", "lizard.fill"),
            ("Turtles", "tortoise.fill"), ("Birds", "bird.fill"), ("Mammals", "hare.fill"), ("Fish", "fish.fill"),
            ("Snails", "fossil.shell.fill"), ("Mussels", "fossil.shell.fill"), ("Crabs", "drop.fill"),
        ]
        if let hit = table.first(where: { group.hasPrefix($0.0) }) { return .symbol(hit.1) }
        return .symbol(kind(group) == .arthropod ? "ladybug.fill" : "pawprint.fill")
    }

    /// Off-checklist sightings by group, split into the two tiers, biggest groups first.
    static func tiers(_ entries: [LogItem]) -> [(label: String, groups: [(name: String, rows: [LogItem])])] {
        var map: [String: [LogItem]] = [:]
        for e in entries where !e.onChecklist {
            map[e.otherGroup ?? critterLabel, default: []].append(e)
        }
        let groups = map.map { (name: $0.key, rows: $0.value) }.sorted { $0.rows.count > $1.rows.count }
        return [
            (arthropodLabel, groups.filter { kind($0.name) == .arthropod }),
            (critterLabel, groups.filter { kind($0.name) == .critter }),
        ].filter { !$0.1.isEmpty }
    }
}
