// World War 1936 P4: where the fleet tokens go on the map and which one a
// tap hits (plan Task 11 writes the bodies; the foundation fixes the shapes).
import type { WwNavyView } from "./WwNavyView";

/** One token on the map: the fleet, its tile position and its radius in tiles. */
export interface TokenSlot {
  fleet: number;
  x: number;
  y: number;
  radius: number;
}

/** The tokens to draw this frame (lane R). Stub: none. */
export function layoutFleets(
  view: WwNavyView,
  tick: number,
  alpha: number,
  zoom: number,
): TokenSlot[] {
  void view;
  void tick;
  void alpha;
  void zoom;
  return [];
}

/** The fleet under a tap at tile (x, y), 0 when none (lane R). Stub: 0. */
export function hitFleet(
  slots: readonly TokenSlot[],
  x: number,
  y: number,
): number {
  void slots;
  void x;
  void y;
  return 0;
}
