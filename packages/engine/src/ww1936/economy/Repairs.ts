// World War 1936 P4: bomb damage repairs (P4 spec §14.8). On the country
// turn, before the construction queue (HOI4: repairs come first), the
// free civilian factories mend every damaged building of the regions the
// country controls; what they use is gone from the queue that day.
import {
  BUILDING_COST,
  BUILDING_IDS,
  BuildingId,
  WW_MAX_CIVS_PER_PROJECT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  constructionProgress,
  projectSpeedPct,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { repairBuilding } from "./Buildings";
import { buildingSpeedPct } from "./Construction";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/** Spec §14.8 (my judgement): a repair costs 30% of the building. */
export const REPAIR_COST_PCT = 30;

/** Industry milli that mend `damageMilli` of a building (1,000 = one whole building). */
export function repairCostMilli(b: BuildingId, damageMilli: number): number {
  return Math.floor(
    (BUILDING_COST[b] * 1000 * REPAIR_COST_PCT * damageMilli) / 100_000,
  );
}

/**
 * The country turn's repairs, before construction (spec §14.8, §16.1):
 * the damaged regions in id order, each building in BUILDING_IDS order,
 * take up to 15 free civilian factories at P1's construction speed;
 * every 1,000 of damage (one building, or one level) is mended when its
 * cost is reached, the progress past it rolls on. The factories used are
 * taken off totals.freeCivMilli, which the queue reads next.
 */
export function stepRepairs(
  econ: WwEconomy,
  ce: CountryEconomy,
  day: number,
): void {
  void day;
  let free = ce.totals.freeCivMilli;
  if (free <= 0) return;
  const law = ce.law();
  const n = BUILDING_IDS.length;
  for (const r of econ.regionsOf(ce.smallID)) {
    if (free <= 0) break;
    for (let bi = 0; bi < n && free > 0; bi++) {
      const i = r * n + bi;
      if (econ.damage[i] <= 0) continue;
      const b = BUILDING_IDS[bi];
      const given = Math.min(WW_MAX_CIVS_PER_PROJECT * 1000, free);
      free -= given;
      const speed = projectSpeedPct({
        building: b,
        infra: econ.infraEff[r],
        tech: ce.stats,
        law,
        buildingPct: buildingSpeedPct(ce, b),
      });
      econ.repair[i] += constructionProgress(given, speed);
      // Lane U: the region card shows the repair's progress.
      econ.markRegionDirty(r);
      // The top 1,000 first: a whole building works again soonest.
      while (econ.damage[i] > 0) {
        const chunk = Math.min(1000, econ.damage[i]);
        const cost = repairCostMilli(b, chunk);
        if (econ.repair[i] < cost) break;
        econ.repair[i] -= cost;
        repairBuilding(econ, r, b, chunk);
      }
      if (econ.damage[i] <= 0) econ.repair[i] = 0;
    }
  }
  ce.totals.freeCivMilli = free;
}
