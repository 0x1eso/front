// World War 1936 P1: the pure integer rules the engine and the screens share
// (spec §4–§10). Products are floored step by step so every intermediate
// stays far below 2^53. P1's combat bridge is gone (P2 plan decision 12):
// the land war's rules live in CombatRules, MoveRules and SupplyRules.
import {
  BuildingId,
  CATEGORY_SLOTS,
  EQUIP_KEYS,
  EquipmentType,
  MINE_PCT_PER_LEVEL,
  RESOURCE_COUNT,
  RegionCategory,
  WW_CIV_OUTPUT,
  WW_MAX_CIVS_PER_PROJECT,
  WW_MAX_SLOTS,
  WW_MIL_OUTPUT_MILLI,
  WW_TRADE_UNITS_PER_CIV,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { daysFromCivil } from "./Calendar";
import { EQUIPMENT } from "./Equipment";
import type { LawEffects } from "./WwLaws";
import type { TechTotals } from "./WwTechs";

// ---- Buildings and construction (spec §4) ----

export function regionSlots(cat: RegionCategory, slotPct: number): number {
  return Math.floor((CATEGORY_SLOTS[cat] * (100 + slotPct)) / 100);
}

/** Consumer goods in milli-factories: (civ + mil) × percent. */
export function consumerGoodsMilli(
  civ: number,
  mil: number,
  cgPct: number,
): number {
  return (civ + mil) * cgPct * 10;
}

/** ww120: consumer goods take at most this share of the civilian factories. */
export const WW_GOODS_MAX_PCT = 50;
/** ww120: consumer goods and payments together take at most this share. */
export const WW_CLAIMS_MAX_PCT = 80;
/** ww120: construction keeps at least this share. */
export const WW_BUILD_FLOOR_PCT = 20;

/** The consumer goods the factories make: what is needed, up to half of them. */
export function goodsMilliOf(civ: number, cgMilli: number): number {
  return Math.min(cgMilli, civ * WW_GOODS_MAX_PCT * 10);
}

/** Percent of the consumer goods needed that the factories do not make. */
export function goodsShortPct(civ: number, cgMilli: number): number {
  if (cgMilli <= 0) return 0;
  return Math.floor(
    ((cgMilli - goodsMilliOf(civ, cgMilli)) * 100) / cgMilli,
  );
}

/** What construction always keeps: at least one factory on any land. */
export function buildFloorMilli(civ: number, hasLand: boolean): number {
  return Math.max(civ * WW_BUILD_FLOOR_PCT * 10, hasLand ? 1000 : 0);
}

/** The most a country pays a day, milli: 80 % of its factories less the goods. */
export function payRoomMilli(civ: number, cgMilli: number): number {
  return Math.max(
    0,
    civ * WW_CLAIMS_MAX_PCT * 10 - goodsMilliOf(civ, cgMilli),
  );
}

export interface CivSplit {
  /** What leaves the country today, milli (at most what is due). */
  paidMilli: number;
  /** ‰ of what is due that it pays. */
  payPm: number;
  /** What the construction queue gets, milli. */
  freeMilli: number;
}

/**
 * ww120 T2, T4, T10: who gets the civilian factories. Goods come first, then
 * what is due, and construction keeps its floor, so no claim ends a country's
 * building. What is short of goods costs stability (goodsShortPct), what is
 * short of payments scales every payment (payPm); neither stops a factory.
 */
export function civSplit(
  civ: number,
  cgMilli: number,
  dueMilli: number,
  receivedMilli: number,
  hasLand: boolean,
): CivSplit {
  const paidMilli = Math.min(dueMilli, payRoomMilli(civ, cgMilli));
  return {
    paidMilli,
    payPm: dueMilli <= 0 ? 1000 : Math.floor((paidMilli * 1000) / dueMilli),
    freeMilli: Math.max(
      civ * 1000 - goodsMilliOf(civ, cgMilli) - paidMilli + receivedMilli,
      buildFloorMilli(civ, hasLand),
    ),
  };
}

/** Milli-factories each queue entry gets, front first, at most 15 each. */
export function assignCivs(freeMilli: number, entries: number): number[] {
  const out: number[] = [];
  let left = Math.max(0, freeMilli);
  for (let i = 0; i < entries; i++) {
    const a = Math.min(WW_MAX_CIVS_PER_PROJECT * 1000, left);
    out.push(a);
    left -= a;
  }
  return out;
}

export interface SpeedInput {
  building: BuildingId;
  infra: number;
  /** The country's stats (P3 WwStats; its first keys are TechTotals). */
  tech: TechTotals;
  law: LawEffects;
  /**
   * P3 spec §3.4: the building's own construction stat
   * (civConstructionPct, milConstructionPct or infraConstructionPct).
   */
  buildingPct?: number;
}

export function projectSpeedPct(i: SpeedInput): number {
  return (
    10 * (i.infra - 1) +
    i.tech.constructionPct +
    (i.buildingPct ?? 0) +
    i.law.constructionPct +
    (i.building === "mil" ? i.law.milConstructionPct : 0) +
    // P2 plan decision 10: the techs' "−25% cost" as speed.
    (i.building === "fort" ? i.tech.fortConstructionPct : 0) +
    (i.building === "rail" ? i.tech.railConstructionPct : 0)
  );
}

/**
 * Buildings take 30% less time: the construction rate is 100 / 70 of the
 * old one (integer maths). The cost table (BUILDING_COST) stays as it is,
 * because repairs and bomb damage read it; repairs keep the old rate
 * (repairProgress).
 */
export const BUILD_RATE_NUM = 10;
export const BUILD_RATE_DEN = 7;

/** Construction milli-points a day for `assignedMilli` milli-factories. */
export function constructionProgress(
  assignedMilli: number,
  speedPct: number,
): number {
  return Math.floor(
    (assignedMilli *
      WW_CIV_OUTPUT *
      Math.max(0, 100 + speedPct) *
      BUILD_RATE_NUM) /
      (100 * BUILD_RATE_DEN),
  );
}

/** Repair milli-points a day: the construction rate before the 30% cut. */
export function repairProgress(
  assignedMilli: number,
  speedPct: number,
): number {
  return Math.floor(
    (assignedMilli * WW_CIV_OUTPUT * Math.max(0, 100 + speedPct)) / 100,
  );
}

/** Days until an entry finishes at `perDay`; -1 when it gets nothing (UI). */
export function constructionDaysLeft(
  costMilli: number,
  progressMilli: number,
  count: number,
  perDay: number,
): number {
  if (perDay <= 0) return -1;
  return Math.ceil((costMilli * count - progressMilli) / perDay);
}

// ---- Production (spec §8) ----

export const EFF_FLOOR_BP = 1000;
export const EFF_BASE_CAP_BP = 5000;
export const RETAIN_SAME_TYPE_BP = 8000;
export const RETAIN_FAMILY_BP = 5000;
export const RETAIN_OTHER_BP = 3000;
/** Output a line keeps with no resources at all (per mille). */
export const RES_FLOOR_PERMILLE = 200;

export function effCapBp(tech: TechTotals): number {
  return Math.min(10_000, EFF_BASE_CAP_BP + tech.effCapBp);
}

/** Owner request 2026-11-03: production lines reach their cap in 35 % of the old time (20 / 7). */
export const EFF_GROWTH_NUM = 20;
export const EFF_GROWTH_DEN = 7;

/**
 * One day of efficiency growth: +0.001 × (20 / 7) × cap² / eff (fractions), in
 * bp rounded to the nearest point. 10% → 50% takes about 168 days (it was 482).
 * `growthPct` (effGrowthPct) scales the day's gain.
 */
export function efficiencyGrowth(
  effBp: number,
  capBp: number,
  growthPct = 0,
): number {
  if (effBp >= capBp) return capBp;
  const e = Math.max(1, effBp);
  const per = 1000 * e * EFF_GROWTH_DEN;
  let gain = Math.max(
    1,
    Math.floor((capBp * capBp * EFF_GROWTH_NUM + Math.floor(per / 2)) / per),
  );
  // ww91 N4: the national growth key, a share of the day's gain, at least 1.
  if (growthPct !== 0) {
    gain = Math.max(1, Math.floor((gain * (100 + growthPct)) / 100));
  }
  return Math.min(capBp, effBp + gain);
}

/** New factories join at the floor and pull the average down. */
export function effAfterAdding(
  effBp: number,
  had: number,
  added: number,
): number {
  if (added <= 0) return effBp;
  return Math.floor((effBp * had + EFF_FLOOR_BP * added) / (had + added));
}

export function effAfterSwitch(
  effBp: number,
  from: EquipmentType,
  fromGen: number,
  to: EquipmentType,
  toGen: number,
  retentionBonusBp: number,
): number {
  if (from === to && fromGen === toGen) return effBp;
  const base =
    from === to
      ? RETAIN_SAME_TYPE_BP
      : EQUIPMENT[from].family === EQUIPMENT[to].family
        ? RETAIN_FAMILY_BP
        : RETAIN_OTHER_BP;
  const keep = Math.min(10_000, base + retentionBonusBp);
  return Math.max(EFF_FLOOR_BP, Math.floor((effBp * keep) / 10_000));
}

/** Industry milli-points a line makes in a day (spec §8.2). */
export function lineOutputMilli(
  factories: number,
  effBp: number,
  outputPct: number,
  fillPermille: number,
): number {
  const resFactor =
    RES_FLOOR_PERMILLE +
    Math.floor(((1000 - RES_FLOOR_PERMILLE) * fillPermille) / 1000);
  const base = Math.floor((factories * WW_MIL_OUTPUT_MILLI * effBp) / 10_000);
  const withBonus = Math.floor((base * Math.max(0, 100 + outputPct)) / 100);
  return Math.floor((withBonus * resFactor) / 1000);
}

export interface LineNeed {
  /** EQUIP_KEYS index. */
  key: number;
  /** Working factories. */
  factories: number;
  /**
   * P6 (pre-flight §0-10): resources per factory, RESOURCE_IDS order (a
   * design's modules); absent: the equipment table's.
   */
  per?: readonly number[];
}

export interface Allocation {
  /** Per line, per mille. */
  fill: number[];
  /** Per resource. */
  used: number[];
  /**
   * Per line, the resources (RESOURCE_IDS indices, in that order) there
   * was not enough of for its need — what the screens mark short on the
   * line.
   */
  short: number[][];
  /** P4: the fill ‰ of each extra demand (naval lines), in order. */
  extraFill: number[];
  /** P6 (plan decision 22): what the priority demand got, RESOURCE_IDS order. */
  preGot: number[];
}

/**
 * ww115 T8: one consumer's take. Its fill is measured first, by the
 * resource it can get least of, and it takes that share of every resource
 * (rounded up, which never passes what is left: the fill is floored). A
 * line held at 20 % by one resource leaves the rest of the others to the
 * lines below. Returns the fill ‰; `lacks` gets what the pool could not
 * cover in full.
 */
function takeAtFill(
  left: number[],
  used: number[],
  want: readonly number[],
  lacks: number[] | null,
): number {
  let f = 1000;
  for (let r = 0; r < RESOURCE_COUNT; r++) {
    if (want[r] <= 0) continue;
    f = Math.min(f, Math.floor((Math.max(0, left[r]) * 1000) / want[r]));
  }
  for (let r = 0; r < RESOURCE_COUNT; r++) {
    const need = want[r];
    if (need <= 0) continue;
    if (lacks !== null && left[r] < need) lacks.push(r);
    const give = Math.floor((need * f + 999) / 1000);
    left[r] -= give;
    used[r] += give;
  }
  return f;
}

/**
 * HOI4 allocation: lines in order take what they need (spec §7.3), each
 * at the fill it can reach (takeAtFill); P4 spec §5.2: then `extra` (naval
 * lines: resources a day each), in order, the same way.
 */
export function allocateResources(
  available: readonly number[],
  lines: readonly LineNeed[],
  extra: readonly (readonly number[])[] = [],
  pre: readonly number[] = [],
): Allocation {
  const left = available.slice(0, RESOURCE_COUNT);
  const used = new Array<number>(RESOURCE_COUNT).fill(0);
  const fill: number[] = [];
  const short: number[][] = [];
  // P6 (plan decision 22): uranium for the atomic project, coal for the
  // refineries and the energy, before any line.
  const preGot = new Array<number>(RESOURCE_COUNT).fill(0);
  for (let r = 0; r < RESOURCE_COUNT; r++) {
    const n = pre[r] ?? 0;
    if (n <= 0) continue;
    const give = Math.min(n, Math.max(0, left[r]));
    left[r] -= give;
    used[r] += give;
    preGot[r] = give;
  }
  const want = new Array<number>(RESOURCE_COUNT).fill(0);
  for (const line of lines) {
    const per = line.per ?? EQUIPMENT[EQUIP_KEYS[line.key][0]].resources;
    for (let r = 0; r < RESOURCE_COUNT; r++) {
      want[r] = (per[r] ?? 0) * line.factories;
    }
    const lacks: number[] = [];
    fill.push(takeAtFill(left, used, want, lacks));
    short.push(lacks);
  }
  const extraFill: number[] = [];
  for (const need of extra) {
    for (let r = 0; r < RESOURCE_COUNT; r++) want[r] = need[r] ?? 0;
    extraFill.push(takeAtFill(left, used, want, null));
  }
  return { fill, used, short, extraFill, preGot };
}

// ---- Resources (spec §7.1) ----

/**
 * w28 order: the deposit grows by the mines (+MINE_PCT_PER_LEVEL a working
 * level), then the infrastructure factor (one floor for both), then
 * control, then the extraction tech; each step rounds down. Synthetic
 * and alloy output are added after this, so no mine touches them.
 */
export function extraction(
  deposit: number,
  infra: number,
  controlPct: number,
  extractionPct: number,
  mineLevel = 0,
): number {
  const a = Math.floor(
    (deposit * (75 + 5 * infra) * (100 + MINE_PCT_PER_LEVEL * mineLevel)) /
      10000,
  );
  const b = Math.floor((a * controlPct) / 100);
  return Math.floor((b * (100 + extractionPct)) / 100);
}

/**
 * P3 spec §3.2 tradeCostPct: resource units a bought civilian factory brings
 * the buyer (8 at 0%), never below 0.
 */
export function tradeUnitsPerCiv(stats: { tradeCostPct: number }): number {
  return Math.max(
    0,
    Math.floor((WW_TRADE_UNITS_PER_CIV * (100 + stats.tradeCostPct)) / 100),
  );
}

/**
 * What a deal moving `units` a day (the seller's units) brings the buyer:
 * P3 tradeCostPct scales each bought factory's 8 (tradeUnitsPerCiv), and a
 * part-factory deal (P4 Task 15: the last factory may buy fewer than 8)
 * brings its share.
 */
export function tradeUnitsBought(
  units: number,
  stats: { tradeCostPct: number },
): number {
  return Math.floor(
    (Math.max(0, units) * tradeUnitsPerCiv(stats)) / WW_TRADE_UNITS_PER_CIV,
  );
}

export function exportCapacity(produced: number, exportPct: number): number {
  return Math.floor((produced * exportPct) / 100);
}

// ---- Manpower (spec §6) ----

/** Men a region can give: pop (thousands) × ratio% × law‰, then the bonus%. */
export function recruitableMen(
  popThousands: number,
  ratioPct: number,
  lawPermille: number,
  bonusPct: number,
): number {
  const base = Math.floor((popThousands * ratioPct * lawPermille) / 100);
  return Math.floor((base * (100 + bonusPct)) / 100);
}

/** Ten percent of the recruitable pool a year. */
export function manpowerRegrowth(recruitable: number): number {
  return Math.floor(recruitable / 3650);
}

/**
 * ww115 T7: men of the casualty debt that come back to the recruitable pool
 * today: 5 % of it a year (a new generation comes of age), at least one man
 * a day while any debt is left.
 */
export function casualtyRelease(debt: number): number {
  return debt <= 0 ? 0 : Math.floor((debt * 5 + 36_499) / 36_500);
}

// ---- Research (spec §9) ----

const DAY_1936 = daysFromCivil(1936, 1, 1);

/** Days since 1936-01-01 of 1 January of `year` (no date parsing: hot path). */
export function yearStartDay(year: number): number {
  return daysFromCivil(year, 1, 1) - DAY_1936;
}

/**
 * The ahead-of-time penalty, percent: +100% for the first year ahead of the
 * tech's year, prorated by day, then +AHEAD_LATE_PCT for each further year.
 * Research is cheap (WW_RESEARCH_COST_PM), so the steep part is what keeps a
 * major from running one line of late gear years early (ww83).
 */
export const AHEAD_LATE_PCT = 600;
export function aheadPct(techYear: number, day: number): number {
  const early = yearStartDay(techYear) - day;
  if (early <= 0) return 0;
  return early <= 365
    ? Math.floor((early * 100) / 365)
    : 100 + Math.floor(((early - 365) * AHEAD_LATE_PCT) / 365);
}

/** How early a day is for a tech's year, percent of a year: the scores' scale, not a cost. */
export function earlyPct(techYear: number, day: number): number {
  return Math.max(0, Math.floor(((yearStartDay(techYear) - day) * 100) / 365));
}

/** Milli-days a slot gains in a day. */
export function researchProgress(speedPct: number, ahead: number): number {
  return Math.floor((1000 * (100 + speedPct)) / (100 + ahead));
}

/**
 * Research overhaul (changes §1.1): the start slots plus the slots the
 * research_slot effects gave, at most WW_MAX_SLOTS. Factories, bombing and
 * occupation do not count.
 */
export function researchSlotCount(start: number, extra: number): number {
  return Math.max(0, Math.min(WW_MAX_SLOTS, start + extra));
}
