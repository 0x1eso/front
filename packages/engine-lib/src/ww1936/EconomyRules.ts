// World War 1936 P1: the pure integer rules the engine and the screens share
// (spec §4–§10). Products are floored step by step so every intermediate
// stays far below 2^53; only the combat scales are floats, like the vanilla
// attack they multiply.
import {
  BuildingId,
  CATEGORY_SLOTS,
  EQUIP_KEYS,
  EquipmentType,
  RESOURCE_COUNT,
  RegionCategory,
  WW_CIV_OUTPUT,
  WW_LOSS_SCALE_PCT,
  WW_MAX_CIVS_PER_PROJECT,
  WW_MAX_SLOTS,
  WW_MEN_PER_INF_EQUIPMENT,
  WW_MIL_OUTPUT_MILLI,
  WwCombatStats,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayOfDate } from "./Calendar";
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

export function freeCivMilli(
  civ: number,
  cgMilli: number,
  paidCivs: number,
  receivedCivs: number,
): number {
  return Math.max(
    0,
    civ * 1000 - cgMilli - paidCivs * 1000 + receivedCivs * 1000,
  );
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
  tech: TechTotals;
  law: LawEffects;
}

export function projectSpeedPct(i: SpeedInput): number {
  return (
    10 * (i.infra - 1) +
    i.tech.constructionPct +
    i.law.constructionPct +
    (i.building === "mil" ? i.law.milConstructionPct : 0)
  );
}

/** Construction milli-points a day for `assignedMilli` milli-factories. */
export function constructionProgress(
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

/**
 * One day of HOI4 efficiency growth: +0.001 × cap² / eff (fractions), in bp
 * rounded to the nearest point. Flooring would lose half a point a day:
 * 10% → 50% would take 512 days instead of HOI4's 480 (rounded: 482).
 */
export function efficiencyGrowth(effBp: number, capBp: number): number {
  if (effBp >= capBp) return capBp;
  const e = Math.max(1, effBp);
  const gain = Math.max(1, Math.floor((capBp * capBp + 500 * e) / (1000 * e)));
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
}

export interface Allocation {
  /** Per line, per mille. */
  fill: number[];
  /** Per resource. */
  used: number[];
}

/** HOI4 allocation: lines in order take what they need (spec §7.3). */
export function allocateResources(
  available: readonly number[],
  lines: readonly LineNeed[],
): Allocation {
  const left = available.slice(0, RESOURCE_COUNT);
  const used = new Array<number>(RESOURCE_COUNT).fill(0);
  const fill: number[] = [];
  for (const line of lines) {
    const per = EQUIPMENT[EQUIP_KEYS[line.key][0]].resources;
    let f = 1000;
    for (let r = 0; r < RESOURCE_COUNT; r++) {
      const need = per[r] * line.factories;
      if (need === 0) continue;
      const give = Math.min(need, Math.max(0, left[r]));
      left[r] -= give;
      used[r] += give;
      f = Math.min(f, Math.floor((give * 1000) / need));
    }
    fill.push(f);
  }
  return { fill, used };
}

// ---- Resources (spec §7.1) ----

export function extraction(
  deposit: number,
  infra: number,
  controlPct: number,
  extractionPct: number,
): number {
  const a = Math.floor((deposit * (75 + 5 * infra)) / 100);
  const b = Math.floor((a * controlPct) / 100);
  return Math.floor((b * (100 + extractionPct)) / 100);
}

export function exportCapacity(produced: number, exportPct: number): number {
  return Math.floor((produced * exportPct) / 100);
}

// ---- Manpower and the troop bridge (spec §6) ----

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

export function trainCap(recruitable: number, trainPct: number): number {
  return Math.max(
    500,
    Math.floor((Math.floor(recruitable / 90) * (100 + trainPct)) / 100),
  );
}

export function recruitToday(
  manpower: number,
  infStock: number,
  cap: number,
): number {
  return Math.max(
    0,
    Math.min(manpower, infStock * WW_MEN_PER_INF_EQUIPMENT, cap),
  );
}

export function infEquipmentFor(men: number): number {
  return Math.ceil(men / WW_MEN_PER_INF_EQUIPMENT);
}

export function troopCapOf(
  troops: number,
  manpower: number,
  infStock: number,
): number {
  return troops + Math.min(manpower, infStock * WW_MEN_PER_INF_EQUIPMENT);
}

// ---- Research (spec §9) ----

export function yearStartDay(year: number): number {
  return dayOfDate(`${year}-01-01`);
}

/** +100% a year ahead of the tech's year, prorated by day. */
export function aheadPct(techYear: number, day: number): number {
  const start = yearStartDay(techYear);
  return day >= start ? 0 : Math.floor(((start - day) * 100) / 365);
}

/** Milli-days a slot gains in a day. */
export function researchProgress(speedPct: number, ahead: number): number {
  return Math.floor((1000 * (100 + speedPct)) / (100 + ahead));
}

export function researchSlotCount(major: boolean, factories: number): number {
  return Math.min(
    WW_MAX_SLOTS,
    (major ? 3 : 2) + (factories >= 50 ? 1 : 0) + (factories >= 100 ? 1 : 0),
  );
}

// ---- Combat bridge (spec §10) ----

/** Per mille of full coverage (stock against men × need per 100,000). */
export function coveragePermille(
  stock: number,
  troops: number,
  needPer100k: number,
): number {
  if (troops <= 0 || needPer100k <= 0) return 0;
  return Math.min(
    1000,
    Math.floor((stock * 100_000_000) / (troops * needPer100k)),
  );
}

/** 100 at an average generation 1 (×100), 130 at 2, 160 at 3. */
export function genBonusPct(avgGenX100: number): number {
  const g = Math.max(100, Math.min(300, avgGenX100));
  return 100 + Math.floor(((g - 100) * 30) / 100);
}

export interface CombatScales {
  attackerLoss: number;
  defenderLoss: number;
  attackerSpeed: number;
}

export function wwCombatScales(
  att: WwCombatStats,
  def: WwCombatStats,
): CombatScales {
  const scale = WW_LOSS_SCALE_PCT / 100;
  return {
    attackerLoss: ((100 + def.defensePct) / (100 + att.attackPct)) * scale,
    defenderLoss: ((100 + att.attackPct) / (100 + def.defensePct)) * scale,
    attackerSpeed: (100 + att.speedPct) / 100,
  };
}

// ---- Trade routes (spec §7.4); the engine and the screens share it ----

export interface TradeGraph {
  atWar(a: number, b: number): boolean;
  sameFaction(a: number, b: number): boolean;
  neighbours(c: number): readonly number[];
  seaZones(c: number): ReadonlySet<number>;
}

/** Same faction, a shared sea zone, or land through countries at peace with the buyer. */
export function tradeRouteOk(
  g: TradeGraph,
  buyer: number,
  seller: number,
): boolean {
  if (buyer === seller || g.atWar(buyer, seller)) return false;
  if (g.sameFaction(buyer, seller)) return true;
  const zb = g.seaZones(buyer);
  for (const z of g.seaZones(seller)) if (zb.has(z)) return true;
  const seen = new Set<number>([buyer]);
  const queue = [buyer];
  for (let i = 0; i < queue.length; i++) {
    for (const n of g.neighbours(queue[i])) {
      if (seen.has(n)) continue;
      if (n === seller) return true;
      seen.add(n);
      if (!g.atWar(buyer, n)) queue.push(n);
    }
  }
  return false;
}
