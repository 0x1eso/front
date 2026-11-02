// World War 1936 air overhaul (ww8, design ww8-air-design.md §3–§6): the wing
// model's rules, the ones the engine and the screens share. Integer math only.
import {
  AIR_MISSION_TYPES,
  AirMission,
  AirRaidReport,
  AirType,
  PlaneStats,
  WING_INTERCEPT_MAX_STATION,
  WING_RTB_PCT,
  WING_STAGGER_TICKS,
  WW_AIR_FUEL_TICKS,
  WW_AIR_LUCK_MAX_PM,
  WW_AIR_LUCK_MIN_PM,
  WW_BOMB_CLASSES,
  WW_ESCORT_CUT_MAX_PM,
  WW_ROOKIE_XP,
  WW_WING_MAX_PLANES,
  WwBombClass,
} from "@openfront/engine-api/ww1936/AirTypes";
import type {
  BuildingId,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { casPoolCenti, casRoundHits } from "./AirRules";
import { PLANE_BASE } from "./PlaneStats";
import { idHash, wwRoll } from "./Roll";

/** wwRoll purposes: a zone's day luck on air losses; one bomb run's luck; who gets a kill. */
export const P_AIR_LUCK = idHash("air_luck");
export const P_AIR_BOMB = idHash("air_bomb");
export const P_AIR_KILL = idHash("air_kill");

// ---- The sortie cycle (design §3.5) ----

/** S and R by mission, ticks. Interception's S is its longest; paradrop is an army order. */
export const WING_CYCLE: Readonly<
  Record<AirMission, { readonly station: number; readonly rearm: number }>
> = {
  air_superiority: { station: 10, rearm: 5 },
  interception: { station: WING_INTERCEPT_MAX_STATION, rearm: 4 },
  cas: { station: 8, rearm: 6 },
  strategic_bombing: { station: 4, rearm: 12 },
  naval_strike: { station: 4, rearm: 8 },
  port_strike: { station: 4, rearm: 10 },
  naval_patrol: { station: 12, rearm: 5 },
  paradrop: { station: 0, rearm: 0 },
  air_supply: { station: 2, rearm: 8 },
  recon: { station: 8, rearm: 6 },
  escort: { station: 4, rearm: 12 },
};

/** One-way ticks (L): a day is 7.5 ticks, so a tick covers speed ÷ 7.5 km. */
export function legTicks(km: number, speedKmh: number): number {
  const d = Math.max(1, speedKmh) * 2;
  return Math.max(1, Math.floor((Math.floor(km) * 15 + d - 1) / d));
}

/** A ferry's ticks, at the same pace as a sortie's leg. */
export function ferryTicks(km: number, speedKmh: number): number {
  return legTicks(km, speedKmh);
}

/** R on a damaged base: × (1 + damage ‰ / 1000). */
export function rearmTicks(rearm: number, baseDamagePm: number): number {
  return rearm + Math.floor((rearm * baseDamagePm) / 1000);
}

/**
 * The cycle at half the range on generation 1's numbers (PLANE_BASE): the
 * reference distance. Fixed: techs do not move it.
 */
export function refCycle(type: AirType, mission: AirMission): number {
  const b = PLANE_BASE[type];
  const c = WING_CYCLE[mission];
  const leg = legTicks(Math.floor(b.rangeKm / 2), b.speedKmh);
  return 2 * leg + c.station + c.rearm;
}

/** Ticks on station a day at the reference distance, ×100. */
export function stationCentiPerDay(type: AirType, mission: AirMission): number {
  return Math.floor(
    (WING_CYCLE[mission].station * 750) / refCycle(type, mission),
  );
}

/** One delivery at the reference distance, in days of sorties, ×100. */
export function loadCenti(type: AirType, mission: AirMission): number {
  return Math.floor((refCycle(type, mission) * 200) / 15);
}

/** What one pulse (2 ticks on station) flies, milli-sorties: the invariant's unit. */
export function pulseMilli(
  flyMilli: number,
  type: AirType,
  mission: AirMission,
): number {
  const c = stationCentiPerDay(type, mission);
  return c <= 0 ? 0 : Math.floor((flyMilli * 200) / c);
}

/**
 * A sortie's fuel at take-off (noteFuelUse's milli). At the reference
 * distance a day's sorties burn about what one daily sortie used to.
 */
export function sortieFuelMilli(
  flyMilli: number,
  fuelPerSortieMilli: number,
  leg: number,
  station: number,
): number {
  const perSortie = Math.floor((flyMilli * fuelPerSortieMilli) / 1000);
  return Math.floor((perSortie * (2 * leg + station)) / WW_AIR_FUEL_TICKS);
}

/**
 * A first take-off's wait: wing id × WING_STAGGER_TICKS inside its cycle, so
 * that wings ordered together fly in waves and the zone stays covered.
 */
export function wingStaggerTicks(
  id: number,
  type: AirType,
  mission: AirMission,
): number {
  return (id * WING_STAGGER_TICKS) % refCycle(type, mission);
}

/**
 * Close air support a tick on station, centi-hits (design §3.6): the daily
 * pool shared over the day's ticks on station, so a day at the reference
 * distance hits what one daily sortie used to.
 */
export function casTickCenti(
  flyMilli: number,
  groundCenti: number,
  casPct: number,
  type: AirType,
): number {
  const c = stationCentiPerDay(type, "cas");
  if (c <= 0) return 0;
  return casRoundHits(
    Math.floor((casPoolCenti(flyMilli, groundCenti, casPct) * 750) / c),
  );
}

/**
 * What a bomber keeps of its air losses under escort, ‰ (design §3.7):
 * sweeping fighters over the zone count once, its own escort twice, against
 * the bombers on station; at parity the cut is at its most.
 */
export function escortKeepPm(
  coverMilli: number,
  directMilli: number,
  bomberMilli: number,
): number {
  if (bomberMilli <= 0) return 1000;
  const ratioPm = Math.floor(
    ((coverMilli + 2 * directMilli) * 1000) / bomberMilli,
  );
  return (
    1000 -
    Math.min(
      WW_ESCORT_CUT_MAX_PM,
      Math.floor((WW_ESCORT_CUT_MAX_PM * ratioPm) / 1000),
    )
  );
}

/** A zone's luck on air losses for a day, ‰ (design §3.6): two rolls, so a triangle around 1000. */
export function airLuckPm(seed: number, sr: number, day: number): number {
  const half = Math.floor((WW_AIR_LUCK_MAX_PM - WW_AIR_LUCK_MIN_PM) / 2) + 1;
  return (
    WW_AIR_LUCK_MIN_PM +
    (wwRoll(seed, P_AIR_LUCK, sr, day, 0) % half) +
    (wwRoll(seed, P_AIR_LUCK, sr, day, 1) % half)
  );
}

/** A wing's full strength. */
export function wingMaxPlanes(type: AirType): number {
  return WW_WING_MAX_PLANES[type];
}

/** Below WING_RTB_PCT of full strength: it skips sorties until refilled (design §6). */
export function wingUnderStrength(type: AirType, planes: number): boolean {
  return planes * 100 < wingMaxPlanes(type) * WING_RTB_PCT;
}

// ---- Bomb classes (design §5.1) ----

/**
 * A class's building weights. "auto" has none here: it is Bombing.ts's
 * BOMB_WEIGHTS (the old model's table). Fuel also weighs infra in a region
 * with oil (BOMB_FUEL_OIL_INFRA).
 */
export const BOMB_CLASS_WEIGHTS: Readonly<
  Record<WwBombClass, Readonly<Partial<Record<BuildingId, number>>>>
> = {
  auto: {},
  factories: { civ: 2, mil: 3, dock: 2 },
  rail: { rail: 3, supply_hub: 2, infra: 1 },
  port: { naval_base: 3, coastal_fort: 1 },
  fuel: { synthetic_refinery: 3, fuel_silo: 2 },
  city: { civ: 1, power_plant: 1 },
  airfield: { air_base: 3, radar: 2, anti_air: 2 },
};
export const BOMB_FUEL_OIL_INFRA = 2;

/** Whether a class has something to hit: `level` reads the region's buildings. */
export function bombClassHits(
  cls: WwBombClass,
  level: (b: BuildingId) => number,
  hasOil: boolean,
): boolean {
  if (cls === "auto") return true;
  if (cls === "fuel" && hasOil && level("infra") > 0) return true;
  const weights = BOMB_CLASS_WEIGHTS[cls];
  for (const b of Object.keys(weights) as BuildingId[]) {
    if (level(b) > 0) return true;
  }
  return false;
}

export const bombClassIndex = (cls: WwBombClass): number =>
  WW_BOMB_CLASSES.indexOf(cls);

// ---- The order judge the wing card and the engine share (design §3.3) ----

/** What wingOrderBlock reads of a wing_mission (the caller fills it, the same on both sides). */
export interface WingMissionAsk {
  order: "mission";
  type: AirType;
  mission: AirMission;
  carrier: boolean;
  /** The wing has a base (Wing.base > 0). */
  hasBase: boolean;
  /** Target 0 with no army and no escort: stand down. */
  standDown: boolean;
  /** What the target is. A followed army counts as its region; an escorted wing as its target. */
  targetKind: "land" | "sea" | "none";
  /** The land target is under the wing's side (its volunteer host's, for a volunteer wing). */
  ownLand: boolean;
  /** The land target's controller is at war with that side. */
  enemyLand: boolean;
  /** An army was named, and it is the sender's. */
  armyOk: boolean;
  armyNamed: boolean;
  /** An escort wing was named, and it is the sender's bomber wing with a bombing order. */
  escortOk: boolean;
  escortNamed: boolean;
  /** The bomb class (or the port strike) has something to hit in the target (bombClassHits). */
  bombable: boolean;
  /** Base center to the target's center (targetKm), and the wing's range (deploymentStats). */
  km: number;
  rangeKm: number;
}

/** What wingOrderBlock reads of a wing_base. */
export interface WingBaseAsk {
  order: "base";
  carrier: boolean;
  /** The region has an air_base level ≥ 1 or a ready field strip. */
  isBase: boolean;
  /** Under the wing's side. */
  ownSide: boolean;
  /** Free planes at that base now (capacity − use). */
  room: number;
  planes: number;
}

const BOMB_MISSIONS: ReadonlySet<AirMission> = new Set<AirMission>([
  "strategic_bombing",
  "port_strike",
]);

/**
 * Why a wing order is refused, null when it may go. Judged per wing: an
 * order naming many wings asks once for each. The sender's ownership of the
 * wings is checked before this (WwAir.issue).
 */
export function wingOrderBlock(
  a: WingMissionAsk | WingBaseAsk,
): WwOrderBlock | null {
  if (a.carrier) return "bad_air_mission";
  if (a.order === "base") {
    if (!a.isBase) return "no_air_base";
    if (!a.ownSide) return "not_controlled";
    if (a.room < a.planes) return "base_full";
    return null;
  }
  if (a.standDown) return null;
  if (
    a.mission === "paradrop" ||
    !AIR_MISSION_TYPES[a.mission].includes(a.type)
  ) {
    return "bad_air_mission";
  }
  if (!a.hasBase) return "no_air_base";
  if (a.armyNamed && !a.armyOk) return "bad_index";
  switch (a.mission) {
    case "escort":
      if (!a.escortNamed || !a.escortOk) return "bad_air_mission";
      if (a.km > a.rangeKm) return "escort_out_of_range";
      return null;
    case "air_superiority":
      if (a.targetKind === "none") return "bad_air_mission";
      break;
    case "interception":
      if (a.targetKind === "none") return "bad_air_mission";
      if (a.targetKind === "land" && !a.ownLand) return "not_controlled";
      break;
    case "recon":
    case "cas":
      if (a.targetKind !== "land") return "bad_air_mission";
      break;
    case "air_supply":
      if (a.targetKind !== "land") return "bad_air_mission";
      if (!a.ownLand) return "not_controlled";
      break;
    case "naval_strike":
    case "naval_patrol":
      if (a.targetKind !== "sea") return "bad_air_mission";
      break;
    default:
      if (BOMB_MISSIONS.has(a.mission)) {
        if (a.targetKind !== "land") return "bad_air_mission";
        if (!a.enemyLand) return "not_at_war";
        if (!a.bombable) return "no_bomb_target";
      }
  }
  if (a.km > a.rangeKm) return "out_of_range";
  return null;
}

// ---- Stubs: lane D (experience, design §6) ----

/** Experience tiers (design §6): the lower bounds of regular, veteran and elite, ‰. */
export const WING_XP_TIER_FROM = [200, 500, 800] as const;
export const WING_XP_MAX = 1000;
/** Per tier (rookie, regular, veteran, elite): air attack %, agility %, load %, air-combat loss ‰. */
const XP_ATK_PCT = [-15, 0, 10, 20] as const;
const XP_AGI_PCT = [-10, 0, 5, 10] as const;
const XP_LOAD_PCT = [-10, 0, 10, 20] as const;
const XP_LOSS_PM = [1100, 1000, 950, 900] as const;
/** An ace's bonus on top of the tier (SeaAirRules.ACE_STATS, same numbers). */
const ACE_ATK_PCT = 10;
const ACE_AGI_PCT = 5;
/** Experience gained (milli), start values: lane H tunes them. */
export const WING_XP_FIGHT_BASE = 2;
export const WING_XP_FIGHT_KILL_MILLI = 300;
export const WING_XP_CAS = 1;
export const WING_XP_DELIVERY = 6;
export const WING_XP_STATION = 1;
/** Resting at the rear lifts it to this at most, +1 every WING_XP_REST_DAYS days. */
export const WING_XP_REST_CAP = 300;
export const WING_XP_REST_DAYS = 5;

/** 0 rookie, 1 regular, 2 veteran, 3 elite. */
export function xpTier(xpMilli: number): number {
  return xpMilli >= WING_XP_TIER_FROM[2]
    ? 3
    : xpMilli >= WING_XP_TIER_FROM[1]
      ? 2
      : xpMilli >= WING_XP_TIER_FROM[0]
        ? 1
        : 0;
}

/** Stats with the experience and the ace applied (attack and agility only; the rest is untouched). */
export function wingXpStats(
  stats: PlaneStats,
  xpMilli: number,
  ace: boolean,
): PlaneStats {
  const t = xpTier(xpMilli);
  const atk = XP_ATK_PCT[t] + (ace ? ACE_ATK_PCT : 0);
  const agi = XP_AGI_PCT[t] + (ace ? ACE_AGI_PCT : 0);
  if (atk === 0 && agi === 0) return stats;
  return {
    ...stats,
    airAtk: Math.floor((stats.airAtk * (100 + atk)) / 100),
    agility: Math.floor((stats.agility * (100 + agi)) / 100),
  };
}

/** Load (bombs, CAS, naval) with the experience applied, ‰. */
export function wingXpLoadPm(xpMilli: number): number {
  return 1000 + XP_LOAD_PCT[xpTier(xpMilli)] * 10;
}

/** Air-combat losses taken with the experience applied, ‰. */
export function wingXpLossPm(xpMilli: number): number {
  return XP_LOSS_PM[xpTier(xpMilli)];
}

/** Experience after a refill dilutes it: the kept planes keep theirs, the added ones are rookies. */
export function xpAfterRefill(
  xpMilli: number,
  kept: number,
  added: number,
): number {
  const n = kept + added;
  if (added <= 0 || n <= 0) return xpMilli;
  return Math.floor((xpMilli * kept + WW_ROOKIE_XP * added) / n);
}

// ---- Lane C: the raid report's effect lines (design §5.2) ----

/** What raidEffectLines reads now, besides the report. Absent: not known to this viewer. */
export interface RaidEffectNow {
  railLevel?: number;
  railEffLevel?: number;
  hubCapacityPct?: number;
  railMovePct?: number;
  factoriesStopped?: number;
  fuelStockMilli?: number;
}

/** One line of a report card: a translation key and its parameters. */
export interface RaidEffectLine {
  key: string;
  params: Record<string, string | number>;
}

/**
 * The report's effect lines for its card (design §5.2): translation keys
 * `ww1936.raid_effect.*` with parameters, the ones that fit the bomb class
 * and are known to the viewer (`now` leaves a value out when not).
 */
export function raidEffectLines(
  report: AirRaidReport,
  now: RaidEffectNow,
): RaidEffectLine[] {
  const out: RaidEffectLine[] = [];
  const cls = WW_BOMB_CLASSES[report.cls] ?? "auto";
  const add = (key: string, params: Record<string, string | number>) =>
    out.push({ key: `ww1936.raid_effect.${key}`, params });
  if (
    (cls === "auto" || cls === "factories") &&
    now.factoriesStopped !== undefined &&
    now.factoriesStopped > 0
  ) {
    add("factories", { n: now.factoriesStopped });
  }
  if (cls === "rail") {
    if (
      now.railLevel !== undefined &&
      now.railEffLevel !== undefined &&
      now.railEffLevel < now.railLevel
    ) {
      add("rail_levels", { from: now.railLevel, to: now.railEffLevel });
    }
    if (now.hubCapacityPct !== undefined && now.hubCapacityPct < 100) {
      add("hub_capacity", { pct: 100 - now.hubCapacityPct });
    }
    if (now.railMovePct !== undefined && now.railMovePct < 100) {
      add("rail_move", { pct: 100 - now.railMovePct });
    }
  }
  if ((cls === "port" || report.shipsHit > 0) && report.shipsHit > 0) {
    add("ships", { n: report.shipsHit });
  }
  if (cls === "fuel" && report.fuelMilli > 0) {
    add("fuel", { n: Math.floor(report.fuelMilli / 1000) });
  }
  if (cls === "city" && report.wsBp > 0) {
    add("war_support", { pct: Math.max(1, Math.round(report.wsBp / 100)) });
  }
  if (cls === "airfield" && report.groundPlanes > 0) {
    add("ground_planes", { n: report.groundPlanes });
  }
  if (report.repairDays > 0) add("repair", { days: report.repairDays });
  return out;
}

/**
 * Days to mend a raid at today's repair pace: the cost (industry milli)
 * over what a day's repair gives, at least 1 when there is damage.
 */
export function raidRepairDays(costMilli: number, perDayMilli: number): number {
  if (costMilli <= 0) return 0;
  return Math.min(999, Math.ceil(costMilli / Math.max(1, perDayMilli)));
}
