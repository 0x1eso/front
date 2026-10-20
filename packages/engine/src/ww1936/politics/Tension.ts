// World War 1936 P3: world tension (spec §14.1). Integers, bp.
import type { WwPolitics } from "./WwPolitics";

const MAX_BP = 10_000;

/** Spec §14.1: every 10th day, world tension and every country's share −1 bp. */
export function dailyTension(pol: WwPolitics, day: number): void {
  if (day % 10 !== 0) return;
  let changed = false;
  if (pol.wtBp > 0) {
    pol.wtBp--;
    changed = true;
  }
  for (let i = 1; i < pol.threatBp.length; i++) {
    if (pol.threatBp[i] > 0) {
      pol.threatBp[i]--;
      changed = true;
    }
  }
  if (changed) pol.markGlobal();
}

/**
 * World tension and the actor's own generated tension (spec §14.1), bp; may
 * be negative. `by` 0: the world's value only.
 */
export function addTension(pol: WwPolitics, by: number, bp: number): void {
  if (bp === 0) return;
  pol.wtBp = Math.max(0, Math.min(MAX_BP, pol.wtBp + bp));
  if (by > 0 && by < pol.threatBp.length) {
    pol.threatBp[by] = Math.max(0, Math.min(MAX_BP, pol.threatBp[by] + bp));
  }
  pol.markGlobal();
}

/** Spec §14.1: a base value, bp, with the actor's tensionPct (never below 0). */
export function scaledTension(pol: WwPolitics, by: number, bp: number): number {
  const pct = pol.stats(by).tensionPct;
  return Math.max(0, Math.floor((bp * (100 + pct)) / 100));
}
