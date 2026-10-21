// World War 1936 P6 (spec §3–§16, §21, §27.3): the depth phase's ids and
// constants. P6's foundation (plan Task 1 Step 1) fills this file; map v5
// (P6 plan Task 15, merged before it) needs its two world lists now.

// ---- World (spec §16) ----
export const LANDMARKS = [
  "lm_eiffel",
  "lm_westminster",
  "lm_kremlin",
  "lm_brandenburg",
  "lm_colosseum",
  "lm_liberty",
  "lm_empire_state",
  "lm_golden_gate",
  "lm_hagia_sophia",
  "lm_forbidden_city",
  "lm_himeji",
  "lm_christ_redeemer",
  "lm_taj_mahal",
] as const;
export type Landmark = (typeof LANDMARKS)[number];
export const DAMS = [
  "dam_hoover",
  "dam_grand_coulee",
  "dam_norris",
  "dam_dnipro",
  "dam_mohne",
  "dam_eder",
  "dam_kembs",
  "dam_galloway",
  "dam_vemork",
] as const;
export type Dam = (typeof DAMS)[number];
