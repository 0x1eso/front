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
 * The best naval base `owner` controls: the highest working level, then
 * the smaller region id; 0 when it controls none.
 */
export function bestNavalBase(ww: WorldWar, owner: number): number {
  let best = 0;
  let bestLevel = 0;
  for (const r of ww.economy.regionsOf(owner)) {
    const lv = effectiveLevel(ww.economy, r, "naval_base");
    if (lv > bestLevel) {
      best = r;
      bestLevel = lv;
    }
  }
  return best;
}
