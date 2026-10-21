// World War 1936 P4: missions and engagements (P4 spec §8.1, §8.2, §9.1).
// Stubs with the final signatures (plan Task 1 Step 18); lane N1 (Task 3)
// writes the bodies.
import type { Fleet, WwNavy } from "./WwNavy";

/**
 * A sea region's engagements (after spotting, supremacy and the convoy
 * war): newly spotted enemy fleets → startNavalBattle (N2). Stub: nothing.
 */
export function engageRegion(navy: WwNavy, sr: number, tick: number): void {
  void navy;
  void sr;
  void tick;
}

/**
 * Spec §8.1: a fleet's search or supremacy factor ‰ by its mission (moving
 * fleets 200 / 250; atStation: on its station or, for a strike force,
 * sortied). Stub: 0.
 */
export function missionPm(
  f: Fleet,
  kind: "search" | "sup",
  atStation: boolean,
): number {
  void f;
  void kind;
  void atStation;
  return 0;
}
