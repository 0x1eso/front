// World War 1936 P4 — air (spec §12–§14). Append only.
import type { WwOrder } from "../Schemas";
import type { EquipmentType } from "./EconomyTypes";

/** A subset of EQUIPMENT_TYPES, in this order (spec §12.2). */
export const AIR_TYPES = [
  "fighter",
  "bomber",
  "heavy_fighter",
  "cas",
  "naval_bomber",
  "strat_bomber",
  "transport_plane",
  "cv_fighter",
  "cv_cas",
  "cv_naval_bomber",
] as const satisfies readonly EquipmentType[];
export type AirType = (typeof AIR_TYPES)[number];
export const CARRIER_AIR_TYPES = [
  "cv_fighter",
  "cv_cas",
  "cv_naval_bomber",
] as const satisfies readonly AirType[];
export type CarrierAirType = (typeof CARRIER_AIR_TYPES)[number];

export const AIR_MISSIONS = [
  "air_superiority",
  "interception",
  "cas",
  "strategic_bombing",
  "naval_strike",
  "port_strike",
  "naval_patrol",
  "paradrop",
  "air_supply",
] as const;
export type AirMission = (typeof AIR_MISSIONS)[number];
/** Which types fly which mission (spec §14.1). paradrop is an army order, never a deployment. */
export const AIR_MISSION_TYPES: Readonly<
  Record<AirMission, readonly AirType[]>
> = {
  air_superiority: ["fighter", "heavy_fighter", "cv_fighter"],
  interception: ["fighter", "heavy_fighter", "cv_fighter"],
  cas: ["cas", "bomber", "cv_cas"],
  strategic_bombing: ["strat_bomber", "bomber"],
  naval_strike: ["naval_bomber", "cv_naval_bomber", "cas", "bomber", "cv_cas"],
  port_strike: ["naval_bomber", "bomber", "strat_bomber", "cas"],
  naval_patrol: ["naval_bomber", "cv_naval_bomber"],
  paradrop: [],
  air_supply: ["transport_plane"],
};
/** Spec §14.1 last line: what a sea zone and a land zone allow. */
export const SEA_ZONE_MISSIONS: readonly AirMission[] = [
  "air_superiority",
  "interception",
  "naval_strike",
  "port_strike",
  "naval_patrol",
];
export const LAND_ZONE_MISSIONS: readonly AirMission[] = [
  "air_superiority",
  "interception",
  "cas",
  "strategic_bombing",
  "port_strike",
  "air_supply",
];

export const AIR_ORDER_KINDS = [
  "air_deploy",
  "air_recall",
  "air_auto",
] as const;
export type AirOrderKind = (typeof AIR_ORDER_KINDS)[number];

/** A plane's numbers after generation, techs and stats (spec §12.2). Attack/defense: centi. */
export interface PlaneStats {
  airAtk: number;
  airDef: number;
  agility: number;
  speedKmh: number;
  rangeKm: number;
  ground: number;
  strat: number;
  naval: number;
  /** Air superiority weight, milli (fighters (atk + def) / 30, others 100). */
  supWeightMilli: number;
  fuelPerSortieMilli: number;
}

// ---- What the screens read (GameUpdateType.WwAir, spec §19.4) ----

export interface AirZoneSide {
  side: number;
  supPm: number;
  /** Sorties yesterday per AIR_TYPES index (everyone sees them; the fog is P6). */
  sorties: number[];
}
export interface AirZoneResult {
  shotDown: number;
  lost: number;
  casHitsCenti: number;
  bombPoints: number;
  navalDamageMilli: number;
}
/**
 * Spec §14.6: a side under enemy air over a zone — the worst superiority ‰
 * of a side at war with it there, and that enemy's battlefield-support
 * bonus (its supPenaltyPp). The land war's penalty reads exactly these
 * (engine-lib zoneAirPenaltyBp).
 */
export interface AirEnemySky {
  side: number;
  enemySupPm: number;
  bonusPp: number;
}
export interface AirZoneData {
  sr: number;
  sides: AirZoneSide[];
  /** The receiving side's results yesterday (own side only). */
  result: [number, AirZoneResult][];
  /** Every side with an enemy flying over the zone, by side (the engine always sends it). */
  enemySky?: AirEnemySky[];
}
export interface AirDeploySummary {
  id: number;
  owner: number;
  sr: number;
  type: AirType;
  mission: AirMission;
  counts: number[];
  target: number;
  /** Region of the base, or −(ship id) for a carrier. */
  base: number;
}
export interface AirBaseUse {
  region: number;
  used: number;
  cap: number;
  damagePm: number;
}
export interface CountryAirDetail {
  smallID: number;
  bases: AirBaseUse[];
  /** Per AIR_TYPES index: stock, deployed, on decks. */
  stock: number[];
  deployed: number[];
  decks: number[];
  /** Last 30 days: shot down, lost, bomb points given, taken, ships and convoys sunk by planes. */
  tally30: number[];
  bombedRegions: [number, number][];
}
export interface WwAirData {
  zones: AirZoneData[];
  deployments: AirDeploySummary[];
  removedDeployments: number[];
  details: CountryAirDetail[];
}

// ---- Constants (spec §12–§15, §25.3) ----

export const WW_AIR_BASE_CAPACITY = 200;
export const WW_MAX_DEPLOYMENTS = 200;
export const WW_MAX_DEPLOY_COUNT = 5_000;
export const WW_AIR_LOSS_K = 28;
export const WW_CAS_HIT_SCALE_PM = 300;
export const WW_BOMB_POINTS_PER_BUILDING = 4_000;
export const WW_BOMB_REPAIR_COST_PCT = 30;
export const WW_BOMB_WS_DIV = 400;
export const WW_BOMB_WS_MAX_BP = 1_500;
export const WW_PARADROP_AIRSUP_PM = 700;
export const WW_PARADROP_PLANES_PER_WEIGHT = 20;
export const WW_AIR_SUPPLY_PER_SORTIE_MILLI = 20;
export const WW_AIR_PENALTY_BP_PER_PM = 7;
export const WW_AIR_PENALTY_MAX_BP = 3_500;
/** Spec §14.6 with the enemy's battlefield support (+5%p): −35% − 5%p. */
export const WW_AIR_PENALTY_BONUS_MAX_BP = 4_000;
export const WW_AIR_MOVE_PER_PM = 600;
export const WW_AA_CUT_MAX_PCT = 70;
export const WW_RADAR_RANGE_KM = 300;
export const WW_RADAR_DETECT_PM = 150;
export const WW_FUEL_PER_OIL = 24;
export const WW_FUEL_BASE_CAP = 20_000;
export const WW_FUEL_CAP_PER_OIL = 2_500;
export const WW_FUEL_SILO_CAP = 10_000;
export const WW_FUEL_START_DAYS = 90;

/** The orders WwAir.issue takes (Extract<WwOrder, …>). */
export type AirOrder = Extract<
  WwOrder,
  { kind: "air_deploy" | "air_recall" | "air_auto" }
>;
