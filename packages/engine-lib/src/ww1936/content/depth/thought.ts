// World War 1936 military thought sliders (design §5.5): the start positions.
// Nine notches in THOUGHT_SLIDERS order (off_def, mob_fire, quant_qual |
// gun_carrier, raid_escort, battle_patrol | intercept_escort, strat_cas,
// tempo_preserve); negative = left end. Seven majors, then one row per AI
// leaning for every other country.
import type { StartThoughtDef } from "@openfront/engine-api/ww1936/ThoughtTypes";

export const START_THOUGHTS: readonly StartThoughtDef[] = [
  { tag: "DEU", pos: [-4, -6, 4, -2, -6, 3, 3, 6, -3] },
  { tag: "SUN", pos: [-2, 1, -7, -1, -3, 2, -2, 7, -2] },
  { tag: "GBR", pos: [2, 4, 3, -3, 6, -2, -5, -5, 3] },
  { tag: "FRA", pos: [6, 4, 1, -3, 2, -1, -2, 3, 4] },
  { tag: "USA", pos: [-1, 4, 4, 5, 3, 2, 4, -6, 2] },
  { tag: "ITA", pos: [-1, -2, -1, -4, -1, 2, 2, 4, -1] },
  { tag: "JPN", pos: [-6, -1, -3, 4, -1, -3, 4, 3, -4] },
  { tag: "@aggressor", pos: [-3, -3, 0, 0, -3, 0, 2, 4, -1] },
  { tag: "@democracy", pos: [3, 2, 2, 0, 3, 0, -2, 2, 2] },
  { tag: "@minor", pos: [2, 1, -3, 0, 0, 0, -2, 3, 1] },
];
