// P6 lane W1 (plan Task 7): landmarks (spec §16.3).
//
// The country controlling a landmark's region has its stats (from its
// completion date: the Golden Gate opens 1937-05-27); the legal owner who
// lost control pays stability −2% a landmark meanwhile. The stats are a
// dynamic line of the depth part (plan decision 24): the foundation's
// control hook marks both countries, and the common day marks the
// controller on a completion date.
import type { Landmark } from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  LANDMARK_FROM,
  LANDMARK_STATS,
  LOST_LANDMARK_STABILITY_BP,
} from "@openfront/engine-lib/ww1936/WorldRules";
import type { WwDepth } from "./WwDepth";

/** LANDMARK_FROM as day indexes. */
const LANDMARK_FROM_DAY = new Map<Landmark, number>(
  (Object.entries(LANDMARK_FROM) as [Landmark, string][]).map(([lm, iso]) => [
    lm,
    dayOfDate(iso),
  ]),
);

/** Whether the landmark stands on `day` (built before the game, or by its date). */
export function landmarkStands(lm: Landmark, day: number): boolean {
  return day >= (LANDMARK_FROM_DAY.get(lm) ?? -Infinity);
}

export function landmarkStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  const out: Partial<Record<WwStatKey, number>> = {};
  const sc = d.ww.scenario;
  if (sc.landmarkRegion.size === 0) return out;
  const ctl = d.ww.land.controller;
  const legal = d.ww.politics.legalOwner;
  const day = Math.max(0, d.lastCommonDay);
  for (const [lm, region] of sc.landmarkRegion) {
    if (!landmarkStands(lm, day)) continue;
    const c = ctl[region] ?? 0;
    if (c === id) {
      for (const [k, v] of Object.entries(LANDMARK_STATS[lm])) {
        const key = k as WwStatKey;
        out[key] = (out[key] ?? 0) + (v ?? 0);
      }
    } else if ((legal[region] ?? 0) === id) {
      out.stabilityBp = (out.stabilityBp ?? 0) + LOST_LANDMARK_STABILITY_BP;
    }
  }
  return out;
}

/** The common day: a landmark completed today reaches its controller's stats. */
export function landmarkDates(d: WwDepth, day: number): void {
  const sc = d.ww.scenario;
  for (const [lm, from] of LANDMARK_FROM_DAY) {
    if (from !== day) continue;
    const region = sc.landmarkRegion.get(lm);
    if (region === undefined) continue;
    const c = d.ww.land.controller[region] ?? 0;
    const legal = d.ww.politics.legalOwner[region] ?? 0;
    if (c > 0) d.markStats(c);
    if (legal > 0 && legal !== c) d.markStats(legal);
  }
}
