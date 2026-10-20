// World War 1936 P5 — flags the Italian content declares (spec §18.2,
// plan Task 13). ita_july_25 is in the foundation's FLAGS_P5_BASE; the
// world flag tripartite is P3's flags/base.ts.
import type { FlagId } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const FLAGS_ITA: FlagId[] = [
  // ita_axis_alignment: the course toward Berlin (doubles the AI weight of
  // the P3 event ita_rome_berlin_axis's acceptance).
  "ita_axis_course",
  // ita_stresa_revival: the course back to Stresa.
  "ita_stresa",
  // ita_mussolini_restrained: the vote failed; ita_western_reconciliation
  // stays closed.
  "restraint_failed",
];
