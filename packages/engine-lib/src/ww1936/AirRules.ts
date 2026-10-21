// World War 1936 P4: air war rules (P4 spec §13.3, §14): range, sortie
// efficiency, detection, air combat losses, air superiority and its land
// battle penalty, close air support, strategic bombing, anti-air and the
// deployment judge the zone card and the engine share.
import {
  AIR_MISSION_TYPES,
  AirMission,
  AirType,
  AirZoneData,
  LAND_ZONE_MISSIONS,
  SEA_ZONE_MISSIONS,
  WW_AA_CUT_MAX_PCT,
  WW_AIR_LOSS_K,
  WW_AIR_MOVE_PER_PM,
  WW_AIR_PENALTY_BONUS_MAX_BP,
  WW_AIR_PENALTY_BP_PER_PM,
  WW_AIR_PENALTY_MAX_BP,
  WW_BOMB_POINTS_PER_BUILDING,
  WW_CAS_HIT_SCALE_PM,
  WW_MAX_DEPLOYMENTS,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  Weather,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Spec §13.3: 1000 up to half the range, falling to 750 at the range; 0 beyond. */
export function rangeEffPm(km: number, rangeKm: number): number {
  if (km > rangeKm) return 0;
  if (km * 2 <= rangeKm) return 1000;
  return 1000 - Math.floor((250 * (2 * km - rangeKm)) / rangeKm);
}

/** Spec §14.2: the weather's share of the sorties, ‰. */
export const WEATHER_SORTIE_PM: Readonly<Record<Weather, number>> = {
  clear: 1000,
  rain: 800,
  mud: 900,
  snow: 700,
  frozen: 500,
  heat: 1000,
};

/** Spec §14.2. airSupPm: our superiority yesterday, null for superiority and interception. */
export function sortieEffPm(
  weatherPm: number,
  fuelPm: number,
  rangePm: number,
  baseDamagePm: number,
  airSupPm: number | null,
): number {
  let e = Math.floor((weatherPm * fuelPm) / 1000);
  e = Math.floor((e * rangePm) / 1000);
  e = Math.floor((e * (1000 - baseDamagePm)) / 1000);
  if (airSupPm !== null) {
    e = Math.floor((e * (300 + Math.floor((700 * airSupPm) / 1000))) / 1000);
  }
  return e;
}

/** Spec §14.3: a side's detection ‰ in a zone. */
export function detectionPm(
  radarPm: number,
  ownLand: boolean,
  airDetectPct: number,
  doctrinePm: number,
): number {
  return Math.min(
    1000,
    300 + radarPm + (ownLand ? 100 : 0) + airDetectPct * 10 + doctrinePm,
  );
}

/** Spec §14.3: the agility factor of two average agilities, ‰. */
export function agilityFactorPm(mine: number, theirs: number): number {
  return clamp(1000 + 10 * (mine - theirs), 500, 1500);
}

/**
 * Spec §14.3: losses inflicted, milli planes: KP × detection / (avg
 * defense × 28). 500 v 500 1936 fighters, detection 300 → 8035.
 */
export function airLossesMilli(
  killPowerCenti: number,
  detPm: number,
  avgDefCenti: number,
): number {
  if (avgDefCenti <= 0) return 0;
  return Math.floor((killPowerCenti * detPm) / (avgDefCenti * WW_AIR_LOSS_K));
}

/** Spec §14.5: a side's air superiority in a zone, ‰. */
export function airSupPm(mine: number, enemies: number): number {
  return mine <= 0 ? 0 : Math.floor((mine * 1000) / (mine + enemies));
}

/**
 * Spec §14.6: −(enemy superiority − 500) × 7 bp, at most −35%, cut by
 * the division's anti-air × 1.5% (at most 70%).
 */
export function airPenaltyBp(enemySupPm: number, divAirAtk: number): number {
  const raw = Math.min(
    WW_AIR_PENALTY_MAX_BP,
    Math.max(0, enemySupPm - 500) * WW_AIR_PENALTY_BP_PER_PM,
  );
  const cut = Math.min(WW_AA_CUT_MAX_PCT, Math.floor((divAirAtk * 3) / 2));
  const v = Math.floor((raw * (100 - cut)) / 100);
  return v === 0 ? 0 : -v;
}

/** Spec §14.6: movement into an enemy-held sky, ‰ (at most −30%). */
export function airMoveFactorPm(enemySupPm: number): number {
  return (
    1000 -
    Math.floor((Math.max(0, enemySupPm - 500) * WW_AIR_MOVE_PER_PM) / 1000)
  );
}

/**
 * Spec §14.6 with the enemy's battlefield support: the cut, bp ≤ 0, of the
 * worst enemy superiority with that enemy's bonus `bonusPp` (supPenaltyPp:
 * +100 bp a point, up to −40% in all), less the division's anti-air. With
 * no bonus it is airPenaltyBp. The engine's hook and the battle card both
 * call it.
 */
export function airGroundPenaltyBp(
  enemySupPm: number,
  bonusPp: number,
  divAirAtk: number,
): number {
  if (bonusPp <= 0) return airPenaltyBp(enemySupPm, divAirAtk);
  const base = Math.min(
    WW_AIR_PENALTY_MAX_BP,
    Math.max(0, enemySupPm - 500) * WW_AIR_PENALTY_BP_PER_PM,
  );
  if (base === 0) return 0;
  const raw = Math.min(WW_AIR_PENALTY_BONUS_MAX_BP, base + bonusPp * 100);
  const cut = Math.min(WW_AA_CUT_MAX_PCT, Math.floor((divAirAtk * 3) / 2));
  const v = Math.floor((raw * (100 - cut)) / 100);
  return v === 0 ? 0 : -v;
}

/**
 * Spec §14.6 from a zone's view data (what the screens get): the cut of
 * `side`'s division with air attack `divAirAtk` fighting under that zone.
 */
export function zoneAirPenaltyBp(
  zone: Pick<AirZoneData, "enemySky"> | undefined,
  side: number,
  divAirAtk: number,
): number {
  const e = zone?.enemySky?.find((x) => x.side === side);
  if (e === undefined || e.enemySupPm <= 500) return 0;
  return airGroundPenaltyBp(e.enemySupPm, e.bonusPp, divAirAtk);
}

/** Spec §14.6 from a zone's view data: `side`'s movement into that zone, ‰. */
export function zoneAirMoveFactorPm(
  zone: Pick<AirZoneData, "enemySky"> | undefined,
  side: number,
): number {
  const e = zone?.enemySky?.find((x) => x.side === side);
  return e === undefined || e.enemySupPm <= 500
    ? 1000
    : airMoveFactorPm(e.enemySupPm);
}

/** Spec §14.7: the daily CAS pool, centi-hits: sorties × ground × mods × 300‰. sortiesMilli in milli planes. */
export function casPoolCenti(
  sortiesMilli: number,
  groundCenti: number,
  modsPct: number,
): number {
  const raw = Math.floor((sortiesMilli * groundCenti) / 1000);
  return Math.floor(
    (Math.floor((raw * (100 + modsPct)) / 100) * WW_CAS_HIT_SCALE_PM) / 1000,
  );
}

/** A tick's share of a daily pool as HOI4-hour hits: pool × 2 / 15 / 1.829. */
export function casRoundHits(dailyPoolCenti: number): number {
  return Math.floor((dailyPoolCenti * 2 * 1000) / (15 * WW_ROUND_HOUR_MILLI));
}

/** Spec §14.8: building damage milli from bomb points (4,000 = one building), AA cut ≤ 40%. */
export function bombDamageMilli(
  points: number,
  aaLevel: number,
  takenPct: number,
): number {
  const afterAa = Math.floor(
    (points * (1000 - Math.min(400, 80 * aaLevel))) / 1000,
  );
  return Math.floor(
    (Math.floor((afterAa * (100 + takenPct)) / 100) * 1000) /
      WW_BOMB_POINTS_PER_BUILDING,
  );
}

/** Spec §14.4 land AA: ‰ of the attacking sorties shot down a day. */
export function aaLossPm(
  aaLevel: number,
  divAirAtkSum: number,
  aaPct: number,
  cas: boolean,
): number {
  return Math.floor(
    ((aaLevel * 3 + (cas ? Math.floor(divAirAtkSum / 100) : 0)) *
      (100 + aaPct)) /
      100,
  );
}

export interface DeployAsk {
  sr: number;
  srKind: "land" | "sea";
  type: AirType;
  mission: AirMission;
  count: number;
  have: number;
  deploymentsUsed: number;
  anyBaseInRange: boolean;
}

/** The judge the zone card and the engine share (spec §13.2, §14.1). */
export function airDeployBlock(a: DeployAsk): WwOrderBlock | null {
  const allowed = a.srKind === "sea" ? SEA_ZONE_MISSIONS : LAND_ZONE_MISSIONS;
  if (
    a.mission === "paradrop" ||
    !allowed.includes(a.mission) ||
    !AIR_MISSION_TYPES[a.mission].includes(a.type)
  ) {
    return "bad_air_mission";
  }
  if (a.count > 0 && a.deploymentsUsed >= WW_MAX_DEPLOYMENTS) {
    return "too_many_deployments";
  }
  if (a.count > 0 && !a.anyBaseInRange) return "no_air_base";
  if (a.count > a.have) return "no_planes";
  return null;
}

// ---- The paradrop judge the army card shares (lane A2 fills it) ----

/** What paradropBlockOf reads (P4 spec §14.10). */
export interface ParadropAsk {
  /** The army's region has an air base (level ≥ 1). */
  fromAirBase: boolean;
  /** Center to center km to the target, and the best transport's range. */
  targetKm: number;
  transportRangeKm: number;
  transportsFree: number;
  transportsNeed: number;
  /** Our superiority over the target's zone yesterday, ‰. */
  airSupPm: number;
}

/** Spec §14.10: the P4 conditions of a paradrop; null when they hold (lane A2). */
export function paradropBlockOf(a: ParadropAsk): WwOrderBlock | null {
  void a;
  return null;
}
