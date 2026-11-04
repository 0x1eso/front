// World War 1936 historical catalogue: the integer helpers the conversions
// share. Exact operations only (+ - * / floor), so every client agrees.

/** Floor of the square root of a non-negative integer (Newton, integers only). */
export function isqrt(n: number): number {
  if (!(n > 0)) return 0;
  const v = Math.floor(n);
  let x = v;
  let y = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(v / x)) / 2);
  }
  return x;
}

export const clampInt = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

/** Rounds half away from zero to an integer (inputs are never NaN). */
export function roundInt(v: number): number {
  return v < 0 ? -Math.floor(-v + 0.5) : Math.floor(v + 0.5);
}

/** A piecewise-linear table: ascending x, integer-rounded interpolation. */
export type Table = readonly (readonly [x: number, y: number])[];
export function interp(t: Table, x: number): number {
  if (x <= t[0][0]) return t[0][1];
  const last = t[t.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < t.length; i++) {
    const [x1, y1] = t[i];
    if (x <= x1) {
      const [x0, y0] = t[i - 1];
      return roundInt(y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
    }
  }
  return last[1];
}

/**
 * Compresses a ratio to a percent around 100: `ratioPm` is the weapon's
 * strength over the reference's, in per mille (1000 = equal); `kPct` how much
 * of the difference is kept (35 keeps 35 %). Used where the spread between
 * real weapons must stay small (infantry weapons and guns, +-10-20 %).
 */
export function compressPct(
  ratioPm: number,
  kPct: number,
  lo: number,
  hi: number,
): number {
  return clampInt(roundInt(100 + ((ratioPm - 1000) * kPct) / 1000), lo, hi);
}

/** Resource vector in RESOURCE_IDS order from a partial record. */
export function resVec(
  ids: readonly string[],
  r: Readonly<Record<string, number>>,
): number[] {
  return ids.map((id) => r[id] ?? 0);
}
