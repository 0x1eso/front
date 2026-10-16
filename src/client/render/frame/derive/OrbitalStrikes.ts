/** Beams and blasts per strike: modest, never the whole screen (spec §6.5). */
export const MAX_ORBITAL_IMPACTS = 16;

/** Map points of this tick's orbital strike impacts, the first MAX_ORBITAL_IMPACTS of each strike. */
export function orbitalImpactPoints(
  strikes: readonly { impacts: readonly number[] }[],
  mapW: number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (const strike of strikes) {
    for (const tile of strike.impacts.slice(0, MAX_ORBITAL_IMPACTS)) {
      const x = tile % mapW;
      points.push({ x, y: (tile - x) / mapW });
    }
  }
  return points;
}
