// World War 1936 P5 (spec §15.2, §19.7): where a civil war's breakaway side
// starts. Without a row the seed is the region farthest from the capital.
import type { CivilWarSeedDef } from "../types";

export const CIVIL_WAR_SEEDS: CivilWarSeedDef[] = [
  { tag: "FRA", ideology: "communist", group: "paris" },
];
