// World War 1936 P4 (plan decision 11): "is it a port now" is dynamic —
// a naval base that works (level ≥ 1 after bomb damage). P2's static
// ScenarioIndex.isPort stays the start data only.
import { effectiveLevel } from "../economy/Buildings";
import type { WorldWar } from "../WorldWar";

/** A region whose naval base works now (effective level ≥ 1). */
export function navalPort(ww: WorldWar, region: number): boolean {
  return effectiveLevel(ww.economy, region, "naval_base") >= 1;
}

/**
 * The working naval bases `owner` controls now, ascending. Control is the
 * land war's (`land.controller`, set the tick a region changes hands);
 * the economy's copy catches up on its next turn, so a port captured
 * this tick is already the captor's here.
 */
export function navalPortsOf(ww: WorldWar, owner: number): number[] {
  const out: number[] = [];
  if (owner === 0) return out;
  const ctl = ww.land.controller;
  for (const r of ww.scenario.landRegions) {
    if (ctl[r.id] === owner && navalPort(ww, r.id)) out.push(r.id);
  }
  return out;
}

/**
 * The best naval base `owner` controls: the highest working level, then
 * the smaller region id; 0 when it controls none.
 */
export function bestNavalBase(ww: WorldWar, owner: number): number {
  let best = 0;
  let bestLevel = 0;
  for (const r of navalPortsOf(ww, owner)) {
    const lv = effectiveLevel(ww.economy, r, "naval_base");
    if (lv > bestLevel) {
      best = r;
      bestLevel = lv;
    }
  }
  return best;
}
