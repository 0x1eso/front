// World War 1936 P4: sorties, air combat and anti-air (P4 spec §14.2–
// §14.4). Stubs with the final signatures (plan Task 1 Step 18, pre-flight
// A7); lane A1 (Task 7) writes the bodies.
import type { PlaneStats } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwAir } from "./WwAir";

/** One group of planes in a duel: its numbers and how many fly, milli planes. */
export interface DuelPlanes {
  stats: PlaneStats;
  milli: number;
  /** The mission's weight on this group as a target (spec §14.3: ×1, ×2, ×3). */
  weight: number;
}

/** A zone's day of sorties, air combat, anti-air and superiority (then A2's effects). Stub: nothing. */
export function dailyAirZone(air: WwAir, sr: number, day: number): void {
  void air;
  void sr;
  void day;
}

/**
 * Spec §14.3: one air battle's losses the attackers inflict on the
 * defenders, milli planes (N2's carrier strikes, A2's paradrops call it).
 * Stub: 0.
 */
export function airDuelMilli(
  attackers: readonly DuelPlanes[],
  defenders: readonly DuelPlanes[],
  detPm: number,
): number {
  void attackers;
  void defenders;
  void detPm;
  return 0;
}
