// World War 1936 P4: what the sorties do (P4 spec §14.7, §14.9, §14.10):
// close air support, naval and port strikes, naval patrols, air supply.
// Stubs with the final signatures (plan Task 1 Step 18); lane A2 (Task 8)
// writes the bodies.
import type { WwAir } from "./WwAir";

/** A zone's day of mission effects (after A1's combat, the same call). Stub: nothing. */
export function airMissionEffects(air: WwAir, sr: number, day: number): void {
  void air;
  void sr;
  void day;
}

/** Spec §14.7: `side`'s close air support hits a round in the battle of `battleRegion`, centi (the hooks). Stub: 0. */
export function casHitsFor(
  air: WwAir,
  battleRegion: number,
  side: number,
): number {
  void air;
  void battleRegion;
  void side;
  return 0;
}

/** Spec §14.10: air supply into `region` for `side`, milli a day (the hooks). Stub: 0. */
export function airSupplyAt(air: WwAir, region: number, side: number): number {
  void air;
  void region;
  void side;
  return 0;
}
