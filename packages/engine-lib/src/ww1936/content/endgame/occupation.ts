// World War 1936 P5 (spec §17.2, §19.7): the occupation law the historical AI
// uses for an occupier and a legal owner, before its general rule. Rows are
// read in order; a row whose `until` has passed no longer applies, so the
// second Danish row takes over after the takeover of 1943-08-29
// (deu_denmark_takeover).
import type { OccupationDefaultDef } from "../types";

export const OCCUPATION_DEFAULTS: OccupationDefaultDef[] = [
  { by: "DEU", of: "DNK", law: "occ_civil", until: "1943-08-29" },
  { by: "DEU", of: "DNK", law: "occ_martial" },
  { by: "DEU", of: "NLD", law: "occ_civil" },
  { by: "DEU", of: "NOR", law: "occ_civil" },
  { by: "DEU", of: "BEL", law: "occ_military" },
  { by: "DEU", of: "FRA", law: "occ_military" },
  { by: "DEU", of: "POL", law: "occ_martial" },
  { by: "DEU", of: "SUN", law: "occ_martial" },
  { by: "DEU", of: "YUG", law: "occ_martial" },
  { by: "DEU", of: "GRC", law: "occ_military" },
  { by: "ITA", of: "GRC", law: "occ_military" },
  { by: "JPN", of: "CHN", law: "occ_military" },
];
