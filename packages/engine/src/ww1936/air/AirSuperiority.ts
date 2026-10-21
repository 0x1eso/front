// World War 1936 P4: air superiority and the land war's penalties (P4 spec
// §12.1 radar, §14.5, §14.6). Stubs with the final signatures (plan Task 1
// Step 18); lane A1 (Task 7) writes the bodies (O(1) reads of what the
// zone's day stored: pre-flight D).
import type { WwAir } from "./WwAir";

/** Spec §12.1: `side`'s radar detection bonus over zone `sr`, ‰. Stub: 0. */
export function radarPmAt(air: WwAir, side: number, sr: number): number {
  void air;
  void side;
  void sr;
  return 0;
}

/** Spec §14.6: a division's attack and defense cut in `region` (WwAir.airPenaltyBp). Stub: 0. */
export function airPenaltyFor(
  air: WwAir,
  region: number,
  side: number,
  divAirAtk: number,
): number {
  void air;
  void region;
  void side;
  void divAirAtk;
  return 0;
}

/** Spec §14.6: movement into `region` under enemy superiority, ‰ (WwAir.airMoveFactorPm). Stub: 1000. */
export function airMoveFactorFor(
  air: WwAir,
  region: number,
  side: number,
): number {
  void air;
  void region;
  void side;
  return 1000;
}
