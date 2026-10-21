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

/** Yesterday's convoy loss rate ‰ of `owner` in sea region `sr` (P5 lend-lease reads it). Stub: 0. */
export function convoyLossPmOf(
  navy: WwNavy,
  owner: number,
  sr: number,
): number {
  void navy;
  void owner;
  void sr;
  return 0;
}
