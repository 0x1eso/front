// World War 1936 P3: political power and the country's political day
// (spec §4.1, §5.2, §5.4, §5.5, §6.1, §9.1). STUB: lane P (Task 4) writes
// the bodies; the signatures are final.
import type { WwPolitics } from "./WwPolitics";

/** The country's political day. Stub: the stats only. */
export function dailyPower(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  pol.recomputeStats(id);
}

/** Pays a cost in PP; false (nothing paid) when short or negative. */
export function payPp(pol: WwPolitics, id: number, pp: number): boolean {
  const c = pol.country(id);
  if (c === null || c.ppMilli < 0 || c.ppMilli < pp * 1000) return false;
  c.ppMilli -= pp * 1000;
  return true;
}
