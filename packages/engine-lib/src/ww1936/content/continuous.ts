// World War 1936 P6 — the continuous focuses (spec §12): names and icons
// only, in CONTINUOUS_FOCUSES order. Their stats are engine-lib
// CFOCUS_STATS (DepthRules), the rules W3's ContinuousFocus. Texts:
// ww1936.cf.<id>, ww1936.cf_desc.<id>. The names avoid the "… Effort"
// wording of the original game (Originality). Data only (ContentPurity).
import type { ContinuousFocus } from "@openfront/engine-api/ww1936/DepthTypes";

export const CONTINUOUS_FOCUS_TABLE: readonly {
  readonly id: ContinuousFocus;
  readonly icon: string;
}[] = [
  { id: "cf_industry", icon: "factory" },
  { id: "cf_construction", icon: "road" },
  { id: "cf_research", icon: "flask" },
  { id: "cf_political", icon: "ballot" },
  { id: "cf_stability", icon: "dove" },
  { id: "cf_war_effort", icon: "megaphone" },
  { id: "cf_army", icon: "infantry" },
  { id: "cf_navy_air", icon: "ship" },
];
