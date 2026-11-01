// World War 1936 war overhaul (ww7, lane B): the depth bands of a region.
// A region falls band by band (design §3): it has `depth` bands, each one
// fought over again, and its control (and victory-point tile) changes only
// when the last one falls. Integer arithmetic only.

/** The least and the most bands a region has before the urban step. */
export const BAND_MIN = 1;
export const BAND_MAX_TILES = 4;
/** The most any region has (urban or a victory-point region included). */
export const BAND_MAX = 5;
/** Victory points from which a region is a city region (one more band). */
export const BAND_CITY_VP = 10;
/** Percent of its maximum org an occupier needs to attack the next band. */
export const BAND_ATTACK_ORG_PCT = 30;
/** Percent of the supply of the friendly region next door an occupier draws. */
export const BAND_OCCUPY_SUPPLY_PCT = 80;
/** Evict line (percent of max org) of a capture, and under an enveloping win. */
export const EVICT_ORG_PCT = 10;
export const EVICT_ORG_PCT_ENVELOP = 20;
/** Org percent a retreating-in-place defender gets back at once under a withdraw. */
export const BAND_WITHDRAW_ORG_PCT = 10;

/** ⌊√n⌋ of a non-negative integer, exactly (no float rounding at any size we meet). */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x--;
  while ((x + 1) * (x + 1) <= n) x++;
  return x;
}

/**
 * Design §3: depth d = clamp(1, 4, ⌊√tiles / 10⌋), one more for an urban
 * region or one worth ≥ 10 victory points, at most 5. ⌊√t / 10⌋ is
 * ⌊√⌊t / 100⌋⌋, so the whole of it is an integer root.
 */
export function regionDepth(tiles: number, urban: boolean, vp: number): number {
  const base = Math.min(
    BAND_MAX_TILES,
    Math.max(BAND_MIN, isqrt(Math.floor(tiles / 100))),
  );
  return Math.min(BAND_MAX, base + (urban || vp >= BAND_CITY_VP ? 1 : 0));
}

/**
 * Tiles (of the `n` in a region's spread order) the taker holds while the
 * region is in progress: the bands fallen plus the open battle's part of
 * the next one, `spreadBattlePm` ‰ (the spread cap) of the defenders' lost
 * org share `lostPm` ‰ of that band. One band and none fallen: exactly the
 * battle's own part, as before the bands.
 */
export function bandSpreadTiles(
  n: number,
  prog: number,
  depth: number,
  spreadBattlePm: number,
  lostPm: number,
): number {
  return Math.floor(
    (n * (prog * 1_000_000 + spreadBattlePm * lostPm)) /
      (Math.max(1, depth) * 1_000_000),
  );
}
