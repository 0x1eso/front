// World War 1936 P4: bomb damage repairs (P4 spec §14.8). ww120 T1, T3: each
// area, the country's part of a strategic region, mends with its own crew, so
// repairs read no free civilian factory: they run at none, and the queue never
// waits for them. What the queue leaves unused goes to the worst-hit area.
import {
  BUILDING_COST,
  BUILDING_IDS,
  BuildingId,
  WW_MAX_CIVS_PER_PROJECT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  projectSpeedPct,
  repairCrewMilli,
  repairProgress,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { effectiveBuildings, repairBuilding } from "./Buildings";
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

const MENDED_FIRST: readonly BuildingId[] = [
  "rail",
  "power_plant",
  "dam",
  "civ",
  "mil",
  "dock",
];

/** BUILDING_IDS indexes in the order a crew mends: what the rest depends on first. */
export const REPAIR_ORDER: readonly number[] = [
  ...MENDED_FIRST,
  ...BUILDING_IDS.filter((b) => !MENDED_FIRST.includes(b)),
].map((b) => BUILDING_IDS.indexOf(b));

const REPAIR_RANK: readonly number[] = BUILDING_IDS.map((_, bi) =>
  REPAIR_ORDER.indexOf(bi),
);

/** A region's working civilian factories in hundredths, as refreshTotals sums them. */
function civ100Of(econ: WwEconomy, region: number): number {
  return effectiveBuildings(econ, region, "civ") * econ.controlPct(region);
}

/** The crew of `smallID`'s part of the strategic region around `region`, milli. */
export function areaCrewOf(
  econ: WwEconomy,
  smallID: number,
  region: number,
): number {
  const sr = econ.scenario.regionSr(region);
  let civ100 = 0;
  for (const r of econ.regionsOf(smallID)) {
    if (econ.scenario.regionSr(r) === sr) civ100 += civ100Of(econ, r);
  }
  return repairCrewMilli(Math.floor(civ100 / 100));
}

interface Area {
  sr: number;
  /** Damaged cells, region × BUILDING_IDS.length + building. */
  cells: number[];
  damage: number;
  civ100: number;
}

/** `smallID`'s areas with damage, by strategic region id. */
function damagedAreas(econ: WwEconomy, smallID: number): Area[] {
  const sc = econ.scenario;
  const n = BUILDING_IDS.length;
  const regions = econ.regionsOf(smallID);
  const areas = new Map<number, Area>();
  for (const r of regions) {
    for (let bi = 0; bi < n; bi++) {
      const i = r * n + bi;
      if (econ.damage[i] <= 0) continue;
      const sr = sc.regionSr(r);
      let a = areas.get(sr);
      if (a === undefined) {
        a = { sr, cells: [], damage: 0, civ100: 0 };
        areas.set(sr, a);
      }
      a.cells.push(i);
      a.damage += econ.damage[i];
    }
  }
  if (areas.size === 0) return [];
  for (const r of regions) {
    const a = areas.get(sc.regionSr(r));
    if (a !== undefined) a.civ100 += civ100Of(econ, r);
  }
  return [...areas.values()].sort((x, y) => x.sr - y.sr);
}

/** `budget` milli mend the area's cells, most important first, 15 factories each at most. */
function mendArea(
  econ: WwEconomy,
  ce: CountryEconomy,
  a: Area,
  budget: number,
): void {
  const n = BUILDING_IDS.length;
  const law = ce.law();
  const cells = a.cells.sort(
    (x, y) => REPAIR_RANK[x % n] - REPAIR_RANK[y % n] || x - y,
  );
  let left = budget;
  for (const i of cells) {
    if (left <= 0) break;
    const r = Math.floor(i / n);
    const b = BUILDING_IDS[i % n];
    const given = Math.min(WW_MAX_CIVS_PER_PROJECT * 1000, left);
    left -= given;
    const speed = projectSpeedPct({
      building: b,
      infra: econ.infraEff[r],
      tech: ce.stats,
      law,
      buildingPct: buildingSpeedPct(ce, b),
    });
    econ.repair[i] += repairProgress(given, speed);
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

/**
 * The country turn's repairs, after construction (spec §14.8, §16.1): every
 * damaged area mends with its crew at P1's construction speed; every 1,000 of
 * damage (one building, or one level) is mended when its cost is reached, the
 * progress past it rolls on. `spareMilli`, the factories the queue left
 * unused, joins the crew of the area with the most damage.
 */
export function stepRepairs(
  econ: WwEconomy,
  ce: CountryEconomy,
  spareMilli: number,
): void {
  const areas = damagedAreas(econ, ce.smallID);
  if (areas.length === 0) return;
  let worst = areas[0];
  for (const a of areas) if (a.damage > worst.damage) worst = a;
  for (const a of areas) {
    const crew = repairCrewMilli(Math.floor(a.civ100 / 100));
    mendArea(econ, ce, a, a === worst ? crew + spareMilli : crew);
  }
}
