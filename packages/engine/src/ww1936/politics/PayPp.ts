// World War 1936 P3: paying political power (spec §4.1). A leaf module:
// decisions, factions, advisors, treaties and war goals pay with it
// without importing the political day (Power.ts), which closed an import
// cycle Factions → Power → Ideology → Factions (P3 Task 17).
import type { WwPolitics } from "./WwPolitics";

/** Pays a cost in PP; false (nothing paid) when short or negative. */
export function payPp(pol: WwPolitics, id: number, pp: number): boolean {
  const c = pol.country(id);
  if (c === null || c.ppMilli < 0 || c.ppMilli < pp * 1000) return false;
  c.ppMilli -= pp * 1000;
  return true;
}
