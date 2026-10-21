// World War 1936 P4 — navy (docs/superpowers/specs/2026-10-20-ww1936-p4-navy-air-design.md).
// zbin and snapshots store these lists by position: append only.
import type { WwOrder } from "../Schemas";

export const SHIP_CLASSES = ["dd", "cl", "ca", "bc", "bb", "cv", "ss"] as const;
export type ShipClass = (typeof SHIP_CLASSES)[number];
export const SHIP_ROLES = ["screen", "capital", "carrier", "sub"] as const;
export type ShipRole = (typeof SHIP_ROLES)[number];
export const SHIP_ROLE: Readonly<Record<ShipClass, ShipRole>> = {
  dd: "screen",
  cl: "screen",
  ca: "capital",
  bc: "capital",
  bb: "capital",
  cv: "carrier",
  ss: "sub",
};
/** Generations per class (spec §4.2: the 1944 tier for DD, CL, BB, CV, SS only). */
export const SHIP_GENS: Readonly<Record<ShipClass, number>> = {
  dd: 4,
  cl: 4,
  ca: 3,
  bc: 3,
  bb: 4,
  cv: 4,
  ss: 4,
};
/** Class index of a role group, for the per-class counts on the wire. */
export const SHIP_CLASS_COUNT = SHIP_CLASSES.length;

export const FLEET_MISSIONS = [
  "hold",
  "patrol",
  "strike",
  "raid",
  "escort",
  "invasion_support",
  "training",
] as const;
export type FleetMission = (typeof FLEET_MISSIONS)[number];
export const ENGAGE_RULES = ["avoid", "if_stronger", "always"] as const;
export type EngageRule = (typeof ENGAGE_RULES)[number];
export const FLEET_STATES = [
  "docked",
  "moving",
  "on_station",
  "sortie",
  "battle",
  "returning",
  "repairing",
] as const;
export type FleetState = (typeof FLEET_STATES)[number];
export const RETURN_AT_PCTS = [0, 30, 50, 70] as const;
export const ADMIRAL_TRAITS = [
  "superior_tactician",
  "aviation_enthusiast",
  "sea_wolf",
  "fleet_protector",
  "spotter",
  "amphibious_expert",
] as const;
export type AdmiralTrait = (typeof ADMIRAL_TRAITS)[number];
export function admiralTraitBit(t: AdmiralTrait): number {
  return 1 << ADMIRAL_TRAITS.indexOf(t);
}
export const SEA_EDGE_KINDS = ["water", "strait", "canal", "dateline"] as const;
export type SeaEdgeKind = (typeof SEA_EDGE_KINDS)[number];
export const EDGE_WATER = 0;
export const EDGE_STRAIT = 1;
export const EDGE_CANAL = 2;
export const EDGE_DATELINE = 3;

/** Plan decision 21: the uses convoys are handed to, by priority (smaller first). */
export const CONVOY_USES = ["voyage", "supply", "trade"] as const;
export type ConvoyUse = (typeof CONVOY_USES)[number];
export const CONVOY_USE_PRIORITY: Readonly<Record<ConvoyUse, number>> = {
  voyage: 10,
  supply: 20,
  trade: 40,
};

export const INVASION_STATES = [
  "preparing",
  "ready",
  "sailing",
  "landing",
  "returning",
] as const;
export type InvasionState = (typeof INVASION_STATES)[number];

/** The ww_order kinds navy.issue takes (spec §19.3), in WwOrder order. */
export const NAVY_ORDER_KINDS = [
  "fleet_mission",
  "fleet_move",
  "fleet_return",
  "fleet_base",
  "fleet_engage",
  "fleet_return_at",
  "fleet_split",
  "fleet_merge",
  "fleet_admiral",
  "fleet_auto",
  "fleet_port_strike",
  "carrier_mix",
  "naval_line_add",
  "naval_line_docks",
  "naval_line_count",
  "naval_line_remove",
  "naval_line_move",
  "appoint_admiral",
  "army_invade",
  "invasion_execute",
  "invasion_cancel",
] as const;
export type NavyOrderKind = (typeof NAVY_ORDER_KINDS)[number];

/** A ship's numbers after generation, techs and stats (spec §4.1–§4.3). Attack, pierce, armor: centi. */
export interface ShipStats {
  hpMilli: number;
  orgMilli: number;
  light: number;
  lightPierce: number;
  heavy: number;
  heavyPierce: number;
  torpedo: number;
  depth: number;
  armor: number;
  aa: number;
  speedCentiKn: number;
  rangeKm: number;
  /** Surface visibility, or submerged visibility for a submarine. */
  vis: number;
  surfDetect: number;
  subDetect: number;
  /** Carrier deck slots (0 for every other class). */
  deck: number;
  fuelPerDayMilli: number;
  /** Naval industry points (spec §4.2 cost ladder). */
  cost: number;
  /** Supremacy weight (spec §4.1, last column). */
  supWeight: number;
}

/** One side's sums as predictNaval reads them (spec §9.9). */
export interface NavalSideSum {
  /** Ship counts per SHIP_CLASSES index. */
  count: number[];
  hpMilli: number;
  maxHpMilli: number;
  orgMilli: number;
  /** Centi sums over ships. */
  light: number;
  heavy: number;
  torpedo: number;
  depth: number;
  carrierAttack: number;
  /** Width-free averages, centi. */
  armor: number;
  lightPierce: number;
  heavyPierce: number;
  /** Highest surface visibility, slowest and fastest speed (centi-knots). */
  vis: number;
  minSpeed: number;
  maxSpeed: number;
  maneuver: number;
  modsBp: number;
}
export interface NavalCtx {
  attackerPosPct: number;
  defenderPosPct: number;
  attackerScreenBonusPm: number;
  defenderScreenBonusPm: number;
  /** Rounds between carrier strikes (3, base_strike_2: 2). */
  attackerCarrierEvery: number;
  defenderCarrierEvery: number;
}
export interface NavalPrediction {
  /** Defender HP lost per round ÷ attacker HP lost per round, ‰ (≥ 1000: the attacker hits harder). */
  ratioPm: number;
  rounds: number;
  sunkA: number;
  sunkB: number;
}

// ---- What the screens read (GameUpdateType.WwNavy, spec §19.4) ----

export const FLEET_FLAG_LOW_FUEL = 1 << 0;
export const FLEET_FLAG_AUTO = 1 << 1;
export const FLEET_FLAG_SPOTTED = 1 << 2;

export interface FleetShipData {
  id: number;
  cls: ShipClass;
  gen: number;
  /** >0: ShipNames.shipNameList(tag of nameOwner, cls) index + 1; <0: numbered name −n (plan decision 17). */
  nameIdx: number;
  /** The country whose name list nameIdx is of (a transferred ship keeps its name). */
  nameOwner: number;
  hpPm: number;
}
export interface FleetSummary {
  id: number;
  owner: number;
  /** >0: FLEET_NAMES index + 1; 0: "Fleet No. num". */
  nameIdx: number;
  num: number;
  /** Per SHIP_CLASSES index. */
  counts: number[];
  hpPm: number;
  orgPm: number;
  zone: number;
  /** Region of the port it lies in, 0 at sea. */
  docked: number;
  /** Zones ahead (at most 8), the next first; empty when not moving. */
  path: number[];
  progPm: number;
  /** Progress ‰ of the current edge per tick (the screen interpolates). */
  stepPm: number;
  mission: FleetMission;
  missionSr: number;
  state: FleetState;
  flags: number;
  // Own fleets only (the rest: 0, "always", 50, []).
  admiral: number;
  engage: EngageRule;
  returnAtPct: number;
  ships: FleetShipData[];
}
export interface NavalBattleSummary {
  zone: number;
  /** Representative country of each side (smallest smallID among its fleets' owners). */
  attacker: number;
  defender: number;
  round: number;
  hpPm: [number, number];
  orgPm: [number, number];
  ships: [number, number];
  /** Ships sunk this tick: [class index, side 0|1, nameIdx, nameOwner][]. */
  sunk: [number, number, number, number][];
}
export interface SeaRegionData {
  sr: number;
  /** [side key, supremacy ‰] for every side with power, side order. */
  sup: [number, number][];
  /** Enemy fleets my side spotted (the receiving client's side only; all sides for spectators: per side). */
  spotted: [number, number[]][];
  /** Convoys sunk here yesterday, milli, per losing country: [smallID, milli][]. */
  convoyLoss: [number, number][];
}
export interface ConvoyRouteData {
  id: number;
  use: ConvoyUse;
  owner: number;
  /**
   * Trade: the trade id (its seller is in the economy's trade list);
   * supply: the hub region; voyage: the voyage id (lane C's SeaRoute.ref).
   */
  ref: number;
  zones: number[];
  km: number;
  srs: number[];
  need: number;
  got: number;
}
export interface InvasionData {
  army: number;
  target: number;
  from: number;
  state: InvasionState;
  prepDone: number;
  prepDays: number;
  convoys: number;
  /** Route sea regions and our last supremacy there, ‰. */
  route: [number, number][];
}
export interface NavalLineData {
  id: number;
  cls: ShipClass | "convoy";
  gen: number;
  docks: number;
  activeDocks: number;
  progressMilli: number;
  costMilli: number;
  left: number;
  port: number;
  /** Next ship name index (plan decision 17). */
  nextName: number;
  outputMilli: number;
  fill: number;
}
export interface CountryNavyDetail {
  smallID: number;
  lines: NavalLineData[];
  docks: number;
  docksLent: number;
  docksIdle: number;
  convoys: number;
  convoysByUse: number[];
  routes: ConvoyRouteData[];
  invasions: InvasionData[];
  admirals: [number, number][];
  navyXpMilli: number;
  /** Convoys lost per day, last 30 days, oldest first. */
  convoyLoss30: number[];
  fuelMilli: number;
  fuelCapMilli: number;
  fuelRatioPm: number;
}
export interface WwNavyData {
  fleets: FleetSummary[];
  removedFleets: number[];
  battles: NavalBattleSummary[];
  endedBattles: number[];
  seaRegions: SeaRegionData[];
  details: CountryNavyDetail[];
}

// ---- Limits and constants (spec §25.3) ----

/** Industry milli-points a dockyard gives a day (spec §5.2: 2.5, no efficiency). */
export const WW_DOCK_OUTPUT_MILLI = 2_500;
export const WW_MAX_DOCKS_PER_LINE = 15;
export const WW_MAX_NAVAL_LINES = 20;
export const WW_MAX_LINE_COUNT = 99;
export const WW_MAX_FLEETS = 40;
export const WW_MAX_FLEET_SHIPS = 60;
export const WW_SCREEN_RATIO = 3;
export const WW_NAVAL_MIN_ROUNDS = 4;
export const WW_NAVAL_RATIO_ROUNDS = 10;
export const WW_NAVAL_MAX_ROUNDS = 40;
export const WW_RETREAT_HP_LOSS_PM = 400;
export const WW_RETREAT_ORG_PM = 300;
export const WW_SHIP_RETREAT_HP_PM = 250;
export const WW_SUB_REVEAL_PM = 1000;
export const WW_SUB_FIRE_REVEAL_PM = 400;
export const WW_SPOT_FULL_PM = 1000;
export const WW_SPOT_DECAY_PM = 300;
export const WW_SPOT_RAID_BONUS_PM = 300;
export const WW_SPOT_AFTER_ESCAPE_PM = 500;
export const WW_RESUME_DAYS = 2;
/** Hit chance ‰ per weapon (spec §9.4). */
export const WW_HIT_LIGHT_PM = 120;
export const WW_HIT_HEAVY_PM = 100;
export const WW_HIT_TORPEDO_PM = 70;
export const WW_HIT_DEPTH_PM = 150;
export const WW_HIT_CARRIER_PM = 100;
export const WW_HIT_PORT_PM = 150;
export const WW_CONVOY_SPEED_KN = 12;
export const WW_TRADE_CONVOY_KM = 5_000;
export const WW_SUPPLY_CONVOY_KM = 500;
export const WW_INVASION_BASE_CAPACITY = 10;
export const WW_INVASION_PREP_DAYS = 60;
export const WW_INVASION_MAX_KM = 8_000;
export const WW_INVASION_LAUNCH_SUP_PM = 500;
export const WW_INVASION_ABORT_SUP_PM = 400;
export const WW_BEACHHEAD_DAYS = 30;
export const WW_BEACHHEAD_CAPACITY_MILLI = 6_000;
export const WW_RAID_CAP_PM = 30;
export const WW_RAID_K = 60;
export const WW_ESCORT_CUT_MAX_PM = 850;
export const WW_ASW_K_PM = 20;
export const WW_ISLAND_REGION_BASE = 1343;
export const WW_NAVY_XP_MAX_MILLI = 500_000;
export const WW_TITLED_ADMIRAL_BASE = 200_000;
export const WW_TITLED_ADMIRAL_XP_MILLI = 10_000;
/** Deck slots per ship row: 3 carrier types × 3 generations (plan decision 15). */
export const DECK_SLOTS = 9;
/** Strategic region ids: land 1..999, sea 1001.. (spec §3.4). */
export const SEA_SR_BASE = 1000;

// ---- The orders each lane takes (Extract<WwOrder, …>) ----

export type FleetOrder = Extract<
  WwOrder,
  {
    kind:
      | "fleet_mission"
      | "fleet_move"
      | "fleet_return"
      | "fleet_base"
      | "fleet_engage"
      | "fleet_return_at"
      | "fleet_split"
      | "fleet_merge"
      | "fleet_admiral"
      | "fleet_auto";
  }
>;
export type CarrierOrder = Extract<
  WwOrder,
  { kind: "fleet_port_strike" | "carrier_mix" }
>;
export type NavalLineOrder = Extract<
  WwOrder,
  {
    kind:
      | "naval_line_add"
      | "naval_line_docks"
      | "naval_line_count"
      | "naval_line_remove"
      | "naval_line_move";
  }
>;
export type InvasionOrder = Extract<
  WwOrder,
  { kind: "army_invade" | "invasion_execute" | "invasion_cancel" }
>;
export type ArmySeaOrder = Extract<WwOrder, { kind: "army_sea" }>;
