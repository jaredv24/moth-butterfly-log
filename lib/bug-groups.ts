/**
 * Friendly grouping for non-Lepidoptera insects (and the odd arachnid), used
 * for the "other bugs" side list. Keyed by taxonomic order.
 */
const ORDER_GROUPS: Record<string, string> = {
  Coleoptera: "Beetles",
  Odonata: "Dragonflies & Damselflies",
  Hymenoptera: "Bees, Wasps & Ants",
  Hemiptera: "True Bugs, Hoppers & Aphids",
  Diptera: "Flies & Mosquitoes",
  Orthoptera: "Grasshoppers, Crickets & Katydids",
  Mantodea: "Mantises",
  Blattodea: "Cockroaches & Termites",
  Phasmatodea: "Stick & Leaf Insects",
  Phasmida: "Stick & Leaf Insects",
  Neuroptera: "Lacewings & Antlions",
  Ephemeroptera: "Mayflies",
  Plecoptera: "Stoneflies",
  Trichoptera: "Caddisflies",
  Dermaptera: "Earwigs",
  Thysanoptera: "Thrips",
  Psocodea: "Barklice & Booklice",
  Siphonaptera: "Fleas",
  Araneae: "Spiders",
  Opiliones: "Harvestmen",
  Ixodida: "Ticks",
  Scorpiones: "Scorpions",
  Julida: "Millipedes",
  Spirobolida: "Millipedes",
  Scolopendromorpha: "Centipedes",
  Xiphosura: "Horseshoe Crabs",
  Xiphosurida: "Horseshoe Crabs",
  Decapoda: "Crabs, Shrimp & Crayfish",
  Isopoda: "Woodlice & Pillbugs",
  Stylommatophora: "Snails & Slugs",
  Architaenioglossa: "Snails & Slugs",
};

export function bugGroupFor(order: string | null | undefined): string {
  if (!order) return "Other bugs";
  return ORDER_GROUPS[order] ?? "Other critters";
}

/** Emoji for a friendly group name (falls back to a generic bug). */
export function bugGroupEmoji(group: string): string {
  if (group.startsWith("Beetles")) return "🪲";
  if (group.startsWith("Dragonflies")) return "🪰";
  if (group.startsWith("Bees")) return "🐝";
  if (group.startsWith("Flies")) return "🪰";
  if (group.startsWith("Grasshoppers")) return "🦗";
  if (group.startsWith("Mantises")) return "🦗";
  if (group.startsWith("Spiders")) return "🕷️";
  if (group.startsWith("Scorpions")) return "🦂";
  if (group.startsWith("Cockroaches")) return "🪳";
  return "🐛";
}
