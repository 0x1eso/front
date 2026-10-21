// World War 1936 P4: fleet movement over the sea graph (P4 spec §7.3).
// Stubs with the final signatures (plan Task 1 Step 18); lane N1 (Task 3)
// writes the bodies.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Fleet, WwNavy } from "./WwNavy";

/** Every moving fleet, by fleet id (spec §2.2-6 ④). Stub: nothing. */
export function stepFleets(navy: WwNavy, tick: number): void {
  void navy;
  void tick;
}

/** Sends `f` toward the nearest of `toZones` (seaPath). Stub: null, no move. */
export function startFleetMove(
  navy: WwNavy,
  f: Fleet,
  toZones: readonly number[],
  tick: number,
): WwOrderBlock | null {
  void navy;
  void f;
  void toZones;
  void tick;
  return null;
}
