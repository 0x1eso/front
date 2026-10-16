/**
 * Airport sortie dots (spec 14c): one small dot above an airport per sortie
 * it can still fly. A sortie in use sits in the unit's missileTimerQueue
 * until its cooldown ends, the same data the reload bar reads.
 */

/** Dots drawn at most, so a high-level airport doesn't spread across the map. */
export const SORTIE_DOTS_MAX = 8;
/** Dot size and gap, in tiles. */
export const SORTIE_DOT_SIZE = 1.6;
export const SORTIE_DOT_STEP = 2.4;

/** Sorties an airport of `level` can still fly with `reloading` of them in use. */
export function sortiesLeft(level: number, reloading: number): number {
  return Math.max(0, level - reloading);
}

/**
 * Tile x of each dot's centre for `count` dots centred over an airport at
 * tile column `x` (the airport's centre is x + 0.5).
 */
export function sortieDotCentersX(x: number, count: number): number[] {
  const n = Math.min(count, SORTIE_DOTS_MAX);
  const centers: number[] = [];
  for (let i = 0; i < n; i++) {
    centers.push(x + 0.5 + (i - (n - 1) / 2) * SORTIE_DOT_STEP);
  }
  return centers;
}
