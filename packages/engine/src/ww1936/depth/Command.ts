// P6 lane D fills this file (plan Task 2): command power, officer corps, traits, field marshals, medals, reinforcement (spec §4).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  ArmyDepthMods,
  LandModQuery,
  NEUTRAL_ARMY_MODS,
  WwDepth,
} from "./WwDepth";

export function dailyCommand(d: WwDepth, id: number, day: number): void {}

/** army_spirit_pick, trait_assign, promote_fm, medal_award, army_priority. */
export function issueCommand(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "no_cp";
}

/**
 * Spec §18.2 (pre-flight §0-2): the army's field marshal (half skill,
 * traits) and command bp (officer corps, medal, decryption against its
 * enemies) — values D stores on the owner's day, read O(1) per division
 * and round. The general traits' lines are CombatRules.divisionMods'.
 */
export function commandLandMods(d: WwDepth, q: LandModQuery): ArmyDepthMods {
  return NEUTRAL_ARMY_MODS;
}

/** Spec §4.2 trickster: the readiness cut `victim`'s enemies' tricksters impose at `region`, bp ≤ 0. */
export function tricksterCutBp(
  d: WwDepth,
  victim: number,
  region: number,
): number {
  return 0;
}

/** Spec §4.6: the order P2 reinforces the country's divisions in. Stub: row order (P2's). */
export function reinforceOrder(d: WwDepth, id: number): number[] {
  const t = d.ww.land.divisions;
  return d.ww.land.rowsOf(id).map((r) => t.id[r]);
}

/** Spec §4.4: the officer corps' stats. */
export function spiritStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  return {};
}

/** Spec §8.8: a skirmisher general of `observer` in contact with `target`. */
export function skirmisherContact(
  d: WwDepth,
  observer: number,
  target: number,
): boolean {
  return false;
}

/** Spec §4.5: a medal's division experience gain, percent, for the army. */
export function medalXpPct(d: WwDepth, armyId: number): number {
  return 0;
}
