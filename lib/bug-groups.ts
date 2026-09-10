/**
 * Friendly grouping for anything that isn't on the butterfly/moth checklist —
 * other insects & arthropods on one side, other critters (herps, and the odd
 * bird/mammal/fish) on the other. Keyed by taxonomic order, with a class-level
 * fallback for vertebrates.
 */

export type CritterKind = "arthropod" | "critter";

type Group = { group: string; kind: CritterKind };

const ORDER_GROUPS: Record<string, Group> = {
  // --- insects & other arthropods ---
  Coleoptera: { group: "Beetles", kind: "arthropod" },
  Odonata: { group: "Dragonflies & Damselflies", kind: "arthropod" },
  Hymenoptera: { group: "Bees, Wasps & Ants", kind: "arthropod" },
  Hemiptera: { group: "True Bugs, Hoppers & Aphids", kind: "arthropod" },
  Diptera: { group: "Flies & Mosquitoes", kind: "arthropod" },
  Orthoptera: { group: "Grasshoppers, Crickets & Katydids", kind: "arthropod" },
  Mantodea: { group: "Mantises", kind: "arthropod" },
  Blattodea: { group: "Cockroaches & Termites", kind: "arthropod" },
  Phasmatodea: { group: "Stick & Leaf Insects", kind: "arthropod" },
  Phasmida: { group: "Stick & Leaf Insects", kind: "arthropod" },
  Neuroptera: { group: "Lacewings & Antlions", kind: "arthropod" },
  Ephemeroptera: { group: "Mayflies", kind: "arthropod" },
  Plecoptera: { group: "Stoneflies", kind: "arthropod" },
  Trichoptera: { group: "Caddisflies", kind: "arthropod" },
  Dermaptera: { group: "Earwigs", kind: "arthropod" },
  Thysanoptera: { group: "Thrips", kind: "arthropod" },
  Psocodea: { group: "Barklice & Booklice", kind: "arthropod" },
  Siphonaptera: { group: "Fleas", kind: "arthropod" },
  Araneae: { group: "Spiders", kind: "arthropod" },
  Opiliones: { group: "Harvestmen", kind: "arthropod" },
  Ixodida: { group: "Ticks", kind: "arthropod" },
  Scorpiones: { group: "Scorpions", kind: "arthropod" },
  Julida: { group: "Millipedes", kind: "arthropod" },
  Spirobolida: { group: "Millipedes", kind: "arthropod" },
  Scolopendromorpha: { group: "Centipedes", kind: "arthropod" },
  Xiphosura: { group: "Horseshoe Crabs", kind: "arthropod" },
  Xiphosurida: { group: "Horseshoe Crabs", kind: "arthropod" },
  Decapoda: { group: "Crabs, Shrimp & Crayfish", kind: "arthropod" },
  Isopoda: { group: "Woodlice & Pillbugs", kind: "arthropod" },
  // --- molluscs (grouped with the critters) ---
  Stylommatophora: { group: "Snails & Slugs", kind: "critter" },
  Architaenioglossa: { group: "Snails & Slugs", kind: "critter" },
  // --- amphibians & reptiles ---
  Anura: { group: "Frogs & Toads", kind: "critter" },
  Caudata: { group: "Salamanders & Newts", kind: "critter" },
  Gymnophiona: { group: "Caecilians", kind: "critter" },
  Testudines: { group: "Turtles & Tortoises", kind: "critter" },
  Squamata: { group: "Lizards & Snakes", kind: "critter" },
  Crocodylia: { group: "Crocodilians", kind: "critter" },
  Rhynchocephalia: { group: "Tuatara", kind: "critter" },
};

/** Coarser fallback when the order isn't mapped (mostly vertebrates). */
const CLASS_GROUPS: Record<string, Group> = {
  Amphibia: { group: "Amphibians", kind: "critter" },
  Reptilia: { group: "Reptiles", kind: "critter" },
  Aves: { group: "Birds", kind: "critter" },
  Mammalia: { group: "Mammals", kind: "critter" },
  Actinopterygii: { group: "Fish", kind: "critter" },
  Chondrichthyes: { group: "Fish", kind: "critter" },
  Gastropoda: { group: "Snails & Slugs", kind: "critter" },
  Bivalvia: { group: "Mussels & Clams", kind: "critter" },
  Insecta: { group: "Other insects", kind: "arthropod" },
  Arachnida: { group: "Other arachnids", kind: "arthropod" },
  Malacostraca: { group: "Other crustaceans", kind: "arthropod" },
  Diplopoda: { group: "Millipedes", kind: "arthropod" },
  Chilopoda: { group: "Centipedes", kind: "arthropod" },
};

const FALLBACK: Group = { group: "Other critters", kind: "critter" };

/** All friendly names we might store, so a stored name can be classified back. */
const GROUP_KIND = new Map<string, CritterKind>([
  ...Object.values(ORDER_GROUPS).map((g) => [g.group, g.kind] as const),
  ...Object.values(CLASS_GROUPS).map((g) => [g.group, g.kind] as const),
  ["Other critters", "critter"],
  ["Other bugs", "arthropod"], // legacy name from before the split
  ["Other arthropods", "arthropod"],
]);

function resolve(
  order: string | null | undefined,
  taxonClass: string | null | undefined,
): Group {
  if (order && ORDER_GROUPS[order]) return ORDER_GROUPS[order];
  if (taxonClass && CLASS_GROUPS[taxonClass]) return CLASS_GROUPS[taxonClass];
  return FALLBACK;
}

/** Friendly group name for an off-checklist critter. */
export function bugGroupFor(
  order: string | null | undefined,
  taxonClass?: string | null,
): string {
  return resolve(order, taxonClass).group;
}

/** Is a group "other insects & arthropods" or "other critters"? */
export function critterKind(
  order: string | null | undefined,
  taxonClass?: string | null,
): CritterKind {
  return resolve(order, taxonClass).kind;
}

/** Classify a group by its stored friendly name (for log stats). */
export function groupKind(groupName: string): CritterKind {
  return GROUP_KIND.get(groupName) ?? "critter";
}

/** Emoji for a friendly group name. */
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
  if (group.startsWith("Frogs")) return "🐸";
  if (group.startsWith("Turtles")) return "🐢";
  if (group.startsWith("Lizards")) return "🦎";
  if (group.startsWith("Salamanders")) return "🦎";
  if (group.startsWith("Snakes")) return "🐍";
  if (group.startsWith("Birds")) return "🐦";
  if (group.startsWith("Mammals")) return "🐿️";
  if (group.startsWith("Fish")) return "🐟";
  if (group.startsWith("Snails")) return "🐌";
  return "🐛";
}
