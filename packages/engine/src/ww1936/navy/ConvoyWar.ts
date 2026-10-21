// World War 1936 P4: convoy raiding, escorts and ASW (P4 spec §10.6).
// Stubs with the final signatures (plan Task 1 Step 18); lane C (Task 5)
// writes the bodies.
import type { WwNavy } from "./WwNavy";

/** A sea region's day of convoy war (dailySeaRegion, after supremacy). Stub: nothing. */
export function convoyWar(navy: WwNavy, sr: number, day: number): void {
  void navy;
  void sr;
  void day;
}

/**
 * The convoy loss rate ‰ of `owner` in sea region `sr` on the region's
 * last day (P5 lend-lease reads it): the state convoyWar writes
 * (SrNavyState.lossRate by side; WwNavy.lossRatePm).
 */
export function convoyLossPmOf(
  navy: WwNavy,
  owner: number,
  sr: number,
): number {
  const i = navy.scenario.srIdxOf(sr);
  return i < 0 ? 0 : navy.lossRatePm(i, owner);
}
