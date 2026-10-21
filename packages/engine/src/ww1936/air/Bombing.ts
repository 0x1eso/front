// World War 1936 P4: strategic bombing (P4 spec §14.8). Stub with the
// final signature (plan Task 1 Step 18); lane A2 (Task 8) writes the body
// (Buildings.damageBuilding applies the damage).
import type { WwAir } from "./WwAir";

/** Spec §14.8: the "bomb fatigue" war support line of a country, bp ≤ 0 (P3's dynamic lines). Stub: 0. */
export function bombFatigueBp(air: WwAir, smallID: number): number {
  void air;
  void smallID;
  return 0;
}
