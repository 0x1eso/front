// World War 1936 P4: strategic bombing (P4 spec §14.8). Stub with the
// final signature (plan Task 1 Step 18); lane A2 (Task 8) writes the body
// (Buildings.damageBuilding applies the damage).
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import type { WwAir } from "./WwAir";

/**
 * The regions of strategic region `sr` strategic bombing may pick, in id
 * order: never a no-strike region (engine-lib NoStrike; P6 pre-flight).
 * Lane A2's target choice and the AI read this. Final.
 */
export function bombableRegions(air: WwAir, sr: number): number[] {
  const sc = air.ww.scenario;
  const s = sc.sr(sr);
  if (s === undefined || s.kind !== "land") return [];
  return s.members.filter((r) => !isNoStrike(sc, r));
}

/** Spec §14.8: the "bomb fatigue" war support line of a country, bp ≤ 0 (P3's dynamic lines). Stub: 0. */
export function bombFatigueBp(air: WwAir, smallID: number): number {
  void air;
  void smallID;
  return 0;
}
