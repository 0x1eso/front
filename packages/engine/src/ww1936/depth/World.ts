// P6 lane W1 fills this file (plan Task 7): the world devices' orders and common day (spec §16).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

export interface RegionStatus {
  /** Supply multiplier, ‰ (flood, scorch, nuke). */
  supplyPm: number;
  buildPct: number;
  moveCutPct: number;
  resourcePct: number;
}
const NEUTRAL: RegionStatus = {
  supplyPm: 1000,
  buildPct: 0,
  moveCutPct: 0,
  resourcePct: 0,
};

/** railgun_assign, railgun_return, harbor_deploy, scorch. */
export function issueWorld(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "railgun_limit";
}

/** Floods, harbours, the scorch queue, exhausted resources, dam dates. */
export function dayCommonWorld(d: WwDepth, day: number, tick: number): void {}

/** The region's flood / scorch / nuke status (read O(1) by P1 and P2). */
export function regionStatus(d: WwDepth, region: number): RegionStatus {
  return NEUTRAL;
}
