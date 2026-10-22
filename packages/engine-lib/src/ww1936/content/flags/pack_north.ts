// World War 1936 P6 — flags the Balkan and Nordic packs set or read
// (content lane K3). Declared here so the content checks know them.
export const FLAGS_PACK_NORTH: readonly string[] = [
  // nor_nordic_cooperation: the W3 AI turns fr_shared_research on for a faction leader with it.
  "nordic_shared_research",
  // nor_heavy_water: lane S raises the Vemork project bonus to +20 (country and world flag).
  "nor_heavy_water",
  // nor_defense_union / bal_neutral_bloc: who founded the bloc, and that it exists.
  "nor_union_founder",
  "nordic_union_formed",
  "bal_bloc_founder",
  "balkan_bloc_formed",
  // Set by lane W1's destroyDam (world flag <dam id>_destroyed); nor_heavy_water_raid reads it.
  "dam_vemork_destroyed",
];
