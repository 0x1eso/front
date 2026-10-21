// World War 1936 P4 (plan decision 40): the map taps of the navy and the
// air layers; P2's WwLandController asks it first (plan Task 12 writes it).
import type { SeaAirSelection } from "./SeaAirSelection";

export class WwSeaAirController {
  constructor(readonly selection: SeaAirSelection) {}

  /** A tap at tile (x, y): true when the navy or the air layer took it. Stub: never. */
  handleTap(x: number, y: number): boolean {
    void x;
    void y;
    return false;
  }
}
