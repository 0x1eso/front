/** Midpoint of two x columns on a map that wraps at the date line: the
 * short way round, so a battle across the edge sits at the edge and not
 * mid-map. */
export function wrapMidX(a: number, b: number, width: number): number {
  if (Math.abs(a - b) * 2 <= width) return (a + b) / 2;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return ((lo + width + hi) / 2) % width;
}
