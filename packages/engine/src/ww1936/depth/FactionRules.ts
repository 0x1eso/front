// P6 lane W3 fills this file (plan Task 9): faction rules, goals and shared research (spec §14).
// The foundation's stub: final signatures, neutral answers.
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

export function sharedResearchPct(
  d: WwDepth,
  id: number,
  tech: WwTechId,
): number {
  return 0;
}

export function sharedIntel(d: WwDepth, a: number, b: number): boolean {
  return false;
}

/** The leader's ideology lock refuses the joiner. */
export function ideologyLocked(
  d: WwDepth,
  leader: number,
  joiner: number,
): boolean {
  return false;
}

export function ruleOn(d: WwDepth, faction: number, rule: number): boolean {
  return false;
}
