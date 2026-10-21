// P6 lane I fills this file (plan Task 5): intelligence operations (spec §8.5).
// The foundation's stub: final signatures, neutral answers.
import type { IntelOperation } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

export function startOperation(
  d: WwDepth,
  id: number,
  op: IntelOperation,
  target: number,
  operatives: readonly number[],
  tick: number,
): WwOrderBlock | null {
  return "op_unavailable";
}

export function dailyOperations(d: WwDepth, id: number, day: number): void {}

/** op_collaboration's cut of the target's surrender line, percentage points. */
export function collabCutPp(d: WwDepth, id: number): number {
  return 0;
}

/** support_resistance / op_uprising: the resistance target added in an occupied region, percentage points. */
export function intelResistancePp(d: WwDepth, region: number): number {
  return 0;
}
