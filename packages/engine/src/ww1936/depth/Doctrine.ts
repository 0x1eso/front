// P6 lane D fills this file (plan Task 2): doctrine mastery, grand doctrines, sub-doctrines (spec §3).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { masteryGain } from "@openfront/engine-lib/ww1936/DoctrineRules";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwDepth } from "./WwDepth";

/** The country's depth day: mastery from yesterday's combat (spec §3.4). Stub: empties its tally. */
export function dailyDoctrine(d: WwDepth, id: number, day: number): void {
  d.dayTally.fill(0, id * 9, id * 9 + 9);
}

/** Spec §3.2–§3.3: the doctrine part of the country's stats. */
export function doctrineStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  return {};
}

/** doctrine_pick, subdoctrine_pick. */
export function issueDoctrine(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "doctrine_locked";
}

/** The doctrine_mastery effect (spec §1.4, §18.3). */
export function applyMasteryEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "doctrine_mastery" }>,
  actor: number,
): void {}

/**
 * Review E6: today's mastery gain per track so far, milli (spec §3.4
 * masteryGain of the day's tally and rsDoctrinePct); lane D may refine.
 */
export function doctrineGainMilli(d: WwDepth, id: number): number[] {
  const s = d.ww.economy.country(id)?.stats as
    | Partial<Record<WwStatKey, number>>
    | undefined;
  const pct = s?.rsDoctrinePct ?? 0;
  const out: number[] = [];
  for (let dom = 0; dom < 3; dom++) {
    const o = id * 9 + dom * 3;
    const t = d.dayTally;
    out.push(...masteryGain([t[o] ?? 0, t[o + 1] ?? 0, t[o + 2] ?? 0], pct));
  }
  return out;
}
