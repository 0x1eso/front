// P6 lane I fills this file (plan Task 5): intelligence operations (spec §8.5).
// The foundation's stub: final signatures, neutral answers.
import type { IntelOperation } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { opSuccessPm } from "@openfront/engine-lib/ww1936/IntelRules";
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

/**
 * Review E6: an operation's success chance, ‰ (spec §8.5 opSuccessPm).
 * The foundation's body: the owner's network on the target and its
 * operatives' average skill, no civil department or counter-intelligence
 * known; lane I refines it.
 */
export function operationSuccessPm(
  d: WwDepth,
  id: number,
  op: { target: number; operatives: readonly number[] },
): number {
  const ops = d.country(id)?.intel.operatives ?? [];
  let skill = 0;
  let n = 0;
  for (const uid of op.operatives) {
    const o = ops.find((x) => x.uid === uid);
    if (o === undefined) continue;
    skill += o.skill;
    n++;
  }
  const avgSkillMilli = n === 0 ? 1000 : Math.floor((skill * 1000) / n);
  return opSuccessPm(d.netPm(id, op.target), avgSkillMilli, false, 0);
}
