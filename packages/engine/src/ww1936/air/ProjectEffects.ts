// World War 1936 P6 T1b (navy/air half): the two electronics projects in
// P4's air and sea war (P6 spec §9.3 table; plan Step 15). The proximity
// fuze makes a country's anti-air hit planes ×1.5 — its ships' AA, its
// regions' anti-air guns and its divisions' AA. The cavity magnetron adds
// 100‰ a level to its radar stations' detection and lifts the air radar
// module's naval patrol from ×1.3 to ×1.5. (The fuze's artillery +5% is
// WwDepth.statsPart's; the magnetron's microwave ship radar and air radar
// detection are DesignRules'.)
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwDepth } from "../depth/WwDepth";

const FUZE = SPECIAL_PROJECTS.indexOf("sp_proximity_fuze");
const MAGNETRON = SPECIAL_PROJECTS.indexOf("sp_cavity_magnetron");

/** Spec §9.3: the proximity fuze's anti-air damage, %. */
export const FUZE_AA_PCT = 150;
/** Spec §9.3: the magnetron's radar station detection, ‰ a level. */
export const MAGNETRON_RADAR_PM = 100;
/** DS_RADAR planes' naval patrol, % (with the magnetron). */
export const RADAR_PATROL_PCT = 130;
export const RADAR_PATROL_MAGNETRON_PCT = 150;

/** `owner`'s anti-air damage on planes, % of P4's (150 with the fuze). */
export function fuzeAaPct(d: WwDepth, owner: number): number {
  return owner > 0 && d.projectDone(owner, FUZE) ? FUZE_AA_PCT : 100;
}

/** `v` × `owner`'s fuze factor. */
export function withFuze(d: WwDepth, owner: number, v: number): number {
  const pct = fuzeAaPct(d, owner);
  return pct === 100 ? v : Math.floor((v * pct) / 100);
}

/** `owner` finished the cavity magnetron. */
export function hasMagnetron(d: WwDepth, owner: number): boolean {
  return owner > 0 && d.projectDone(owner, MAGNETRON);
}
