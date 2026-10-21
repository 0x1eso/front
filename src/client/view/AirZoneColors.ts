// World War 1936 P4: the sea and air layers' colour tables, RGBA by
// strategic-region index (spec §18.2; plan Task 11). RegionBorderPass
// uploads them as a 256 × 2 texture: row 0 these colours, row 1 the flag
// bytes below. The renderer rebuilds them only when a view moved (a
// zone's day arrived), into arrays it keeps.
import type { WwAirView } from "./WwAirView";
import type { WwNavyView } from "./WwNavyView";

/** Entries in a layer table (strategic-region indices 0..255; the 1936 map has 246). */
export const LAYER_TABLE_SIZE = 256;
/** Fill alpha (of 255) of a zone someone holds. */
export const LAYER_FILL_ALPHA = 110;
/** Flag bit: my convoys were sunk here yesterday (the zone blinks). */
export const LAYER_FLAG_CONVOY_LOSS = 1;

type Rgb = readonly [number, number, number];

/** 0 ‰ end of both ramps: an enemy holds the zone. */
export const RAMP_ENEMY: Rgb = [214, 52, 40];
/** 500 ‰: contested. */
export const RAMP_CONTESTED: Rgb = [236, 226, 196];
/** 1000 ‰ end of the sea ramp: my side's supremacy (blue). */
export const RAMP_SEA_MINE: Rgb = [40, 110, 200];
/** 1000 ‰ end of the air ramp: my side's superiority (green). */
export const RAMP_AIR_MINE: Rgb = [52, 168, 72];

/**
 * Writes the ramp colour of `pm` (0..1000) at `out[o..o+3]`: the enemy's
 * red at 0, the contested light colour at 500, `mine` at 1000; alpha
 * LAYER_FILL_ALPHA.
 */
export function rampColor(
  pm: number,
  mine: Rgb,
  out: Uint8Array,
  o: number,
): void {
  const t = Math.max(0, Math.min(1000, pm)) / 1000;
  const a = t < 0.5 ? RAMP_ENEMY : RAMP_CONTESTED;
  const b = t < 0.5 ? RAMP_CONTESTED : mine;
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  for (let c = 0; c < 3; c++) {
    out[o + c] = Math.round(a[c] + (b[c] - a[c]) * k);
  }
  out[o + 3] = LAYER_FILL_ALPHA;
}

/**
 * Sea layer: my side's supremacy by sea region (256 × 4 bytes) on the blue
 * ↔ red ramp. A region the view has no day for, or where no side has
 * power, stays transparent. `out` is cleared and reused when given.
 */
export function seaLayerColors(
  view: WwNavyView,
  out: Uint8Array = new Uint8Array(LAYER_TABLE_SIZE * 4),
): Uint8Array {
  out.fill(0);
  for (const s of view.seaRegions.values()) {
    let held = false;
    for (const [, pm] of s.sup) if (pm > 0) held = true;
    if (!held) continue;
    const idx = view.scenario.srIdxOf(s.sr);
    if (idx < 0 || idx >= LAYER_TABLE_SIZE) continue;
    rampColor(view.mySupremacy(s.sr), RAMP_SEA_MINE, out, idx * 4);
  }
  return out;
}

/**
 * Air layer: my side's superiority by air zone (256 × 4 bytes) on the green
 * ↔ red ramp. A zone the view has no day for, or where no side holds any
 * superiority, stays transparent. `out` is cleared and reused when given.
 */
export function airLayerColors(
  view: WwAirView,
  out: Uint8Array = new Uint8Array(LAYER_TABLE_SIZE * 4),
): Uint8Array {
  out.fill(0);
  for (const z of view.zones.values()) {
    let held = false;
    for (const s of z.sides) if (s.supPm > 0) held = true;
    if (!held) continue;
    const idx = view.scenario.srIdxOf(z.sr);
    if (idx < 0 || idx >= LAYER_TABLE_SIZE) continue;
    rampColor(view.mySuperiority(z.sr), RAMP_AIR_MINE, out, idx * 4);
  }
  return out;
}

/**
 * Sea layer flags by strategic-region index (256 bytes):
 * LAYER_FLAG_CONVOY_LOSS where my convoys were sunk yesterday (spec §18.2:
 * the loss zones blink). `out` is cleared and reused when given.
 */
export function seaLayerFlags(
  view: WwNavyView,
  out: Uint8Array = new Uint8Array(LAYER_TABLE_SIZE),
): Uint8Array {
  out.fill(0);
  const me = view.mySmallID();
  for (const s of view.seaRegions.values()) {
    let lost = false;
    for (const [id, milli] of s.convoyLoss) {
      if (id === me && milli > 0) lost = true;
    }
    if (!lost) continue;
    const idx = view.scenario.srIdxOf(s.sr);
    if (idx >= 0 && idx < LAYER_TABLE_SIZE) out[idx] |= LAYER_FLAG_CONVOY_LOSS;
  }
  return out;
}
