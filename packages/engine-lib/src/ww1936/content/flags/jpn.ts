// World War 1936 P5 — flags the Japanese content declares. It also reads
// tripartite, northern_road_closed and can_create_faction (P3 flags/base.ts)
// and sets talks_continue (FLAGS_P5_BASE).
import type { FlagId } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const FLAGS_JPN: FlagId[] = [
  // jpn_hawaii_operation done: the Hull note can come (spec §19.2 #23).
  "jpn_hawaii_started",
  // jpn_demand_indochina_access taken once (north, 1940).
  "jpn_indochina_north",
  // jpn_demand_indochina_access taken twice (south, 1941): no third time.
  "jpn_indochina_south",
];
