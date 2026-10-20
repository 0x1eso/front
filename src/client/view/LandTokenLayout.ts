// World War 1936 P2: where the army tokens stand on the map and what a tap
// hits (spec §15.2, §15.3, §15.9). STUB: Task 7 writes the bodies; the
// signatures are final.
import type { WwLandView } from "./WwLandView";

export interface TokenPlacement {
  army: number;
  /** World position in tiles (fractional), after the fan-out of tokens sharing a region. */
  x: number;
  y: number;
  /** 0: full token, 1: number chip, 2: dot (spec §15.2 LOD). */
  lod: number;
}

/** Where every token is drawn at `tick` and `zoom` (screen px per tile). */
export function layoutTokens(
  view: WwLandView,
  tick: number,
  zoom: number,
): TokenPlacement[] {
  return [];
}

/**
 * The army under a tap at world (wx, wy) within `radiusTiles` (24 screen px,
 * spec §15.9); with several there, the one after `current` (spec §15.3-1).
 */
export function hitToken(
  placements: readonly TokenPlacement[],
  wx: number,
  wy: number,
  radiusTiles: number,
  current: number | null,
): number | null {
  return null;
}

/** Where battle markers stand (tap targets of the battle card). */
export function battleMarkers(
  view: WwLandView,
): { region: number; x: number; y: number }[] {
  return [];
}
