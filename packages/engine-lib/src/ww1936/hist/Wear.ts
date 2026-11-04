// ww61: reliability wear of catalogue equipment (owner rule 8). Integer,
// deterministic and cheap: the holders call it where they already run
// (Sustain's daily attrition for a moving division, a wing's rearm).
export const BREAKDOWN_FLOOR_PM = 900;
export const BREAKDOWN_PPM_PER_PM = 25;

/** Wear, ppm of the holding per day moving (tanks) or per rearm (planes): 0.5 % at 70 % reliability, 0.175 % at 83 %, none from 90 %. */
export function breakdownPpm(relPm: number): number {
  return Math.max(0, BREAKDOWN_FLOOR_PM - relPm) * BREAKDOWN_PPM_PER_PM;
}

/** A deterministic pseudo-roll in [0, 1,000,000) from two integers (no randomness in the air layer). */
export function wearRoll(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) % 1_000_000;
}

/** Units lost out of `n` at `ppm`, the fraction settled by `roll`. */
export function wearLoss(n: number, ppm: number, roll: number): number {
  return Math.min(n, Math.floor((n * ppm + roll) / 1_000_000));
}
