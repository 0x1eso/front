// P6 lane D fills this file (plan Task 2): army groups and their field marshals (spec §4.3).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

export function dailyArmyGroups(d: WwDepth, id: number, day: number): void {}

/** ag_create … ag_auto. */
export function issueArmyGroup(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "group_full";
}

/** The army group an army belongs to, 0 none. */
export function groupOfArmy(d: WwDepth, armyId: number): number {
  return 0;
}
