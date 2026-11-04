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
  // P6 (P6 spec §15.4), appended: sorties over a land zone, no target.
  "recon",
  // ww8 (air overhaul §3.4), appended: fighters flying with a bomber wing.
  "escort",
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
  recon: ["fighter", "heavy_fighter", "cas"],
  escort: ["fighter", "heavy_fighter"],
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
  "recon",
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
  /** P6 (spec §15.3, lane W2): present and true while it bombs by night. */
  night?: boolean;
  /** P6 (lane E, T1b): planes per plane design slot, present only with some. */
  dcounts?: number[];
}
export interface AirBaseUse {
  region: number;
  used: number;
  cap: number;
  damagePm: number;
  /** ww8: a field strip, not an air_base building (design §3.2). */
  strip?: boolean;
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
  /** The country's regions with bomb damage outstanding: [region, damage milli], ascending. */
  bombedRegions: [number, number][];
  /** P4 lane U: the zones the AI runs for this human (air_auto), ascending. */
  autoZones?: number[];
  // ww8 (live wing model only).
  /** Field strips of this country: [region, ready tick], ascending. */
  strips?: [number, number][];
  /** The raid reports both as attacker and as victim, oldest first (design §5.2). */
  reports?: AirRaidReport[];
  /** The armies under [✈ priority], ascending (army_air_priority). */
  priorityArmies?: number[];
  /** w50: the country's air templates (own country only) and its air groups, by id. Absent with none. */
  templates?: AirTemplate[];
  groups?: AirGroupView[];
}
export interface WwAirData {
  zones: AirZoneData[];
  deployments: AirDeploySummary[];
  removedDeployments: number[];
  details: CountryAirDetail[];
  // ww8 (live wing model only; absent in an old-model game). A removed wing
  // is in removedDeployments.
  /** This game runs the wing model (AirTypes.WW_WINGS_LIVE): the screens switch on it. */
  live?: boolean;
  /** Every country's changed wings, short (the client's fog filters them). */
  briefs?: WingBrief[];
  /** The human countries' changed wings in full (only their owners read them). */
  wings?: WingDetail[];
  /** One row per take-off, stand-down or ferry this tick. */
  flights?: WingFlightRow[];
  /** One row per side that lost planes in a zone's air battle this tick. */
  fights?: AirFightRow[];
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
/**
 * P4 Task 15 (내 판단): the 1936 stock is at least this ‰ of the capacity.
 * The start counts the country's own oil only (trade deals come on its
 * first days), so an importer — Italy, France — began with nothing.
 */
export const WW_FUEL_START_FLOOR_PM = 500;

/** The orders WwAir.issue takes (Extract<WwOrder, …>). */
export type AirOrder = Extract<
  WwOrder,
  { kind: "air_deploy" | "air_recall" | "air_auto" }
>;

// ---- ww8 air overhaul: wings (design ww8-air-design.md §3). Append only. ----

/**
 * The switch between the two air models. true: the wing model runs and the
 * old orders are refused. false: the old daily deployment model runs, and the
 * wing orders are refused. Every real game starts with this value
 * (WwAir.wingsLive). The old model stays in the tree, off, until a later
 * cleanup; its tests run on it through tests/ww1936/oldAirModel.ts.
 */
export const WW_WINGS_LIVE = true;

/** Wing.phase. Stored by position: append only. */
export const WING_PHASES = [
  "ground",
  "out",
  "station",
  "back",
  "rearm",
  "ferry",
] as const;
export type WingPhase = (typeof WING_PHASES)[number];
export const WP_GROUND = 0;
export const WP_OUT = 1;
export const WP_STATION = 2;
export const WP_BACK = 3;
export const WP_REARM = 4;
export const WP_FERRY = 5;

/** Wing.mission and Wing.flyMission when there is none. */
export const WING_NO_MISSION = -1;

/** The wing orders, at the end of WwOrderSchema. Append only. */
export const WING_ORDER_KINDS = [
  "wing_mission",
  "wing_base",
  "wing_auto",
  "wing_disband",
  "air_field",
  "army_air_priority",
] as const;
export type WingOrderKind = (typeof WING_ORDER_KINDS)[number];

/** Strategic bombing's target kinds (design §5.1). Append only. */
export const WW_BOMB_CLASSES = [
  "auto",
  "factories",
  "rail",
  "port",
  "fuel",
  "city",
  "airfield",
] as const;
export type WwBombClass = (typeof WW_BOMB_CLASSES)[number];

/**
 * A wing: one plane type at one base (design §3.1). The standing order is
 * (mission, sr, target, follow, escortOf, cls); the sortie in the air froze
 * its own copy at take-off (flyMission, flySr, hit, flyMilli, leg), so a new
 * order applies from the next sortie (design §3.3).
 */
export interface Wing {
  id: number;
  owner: number;
  /** The standing order's zone (strategic id), 0 with none. WwAir.wingsIn follows it. */
  sr: number;
  /** AIR_TYPES index. */
  type: number;
  /** The standing order: AIR_MISSIONS index, WING_NO_MISSION when idle. */
  mission: number;
  /** Planes per generation. */
  counts: number[];
  /** Old model only: the (owner, sr, type, mission) group's wanted count. 0 in the wing model. */
  goalCount: number;
  /** Region of the base; −(ship id) for a carrier wing; 0 none. */
  base: number;
  /** Losses not yet taken, milli. */
  lossRest: number;
  /** Under [auto]; a human's direct order pins this wing only (owner decision 4). */
  auto: boolean;
  /** The country a volunteer wing flies for, 0 for its owner. */
  volunteerFor: number;
  /** Planes per plane design slot (WW_PLANE_DESIGN_SLOTS). */
  dcounts: number[];
  night: boolean;
  /** Its ace, 0 none. */
  ace: number;
  /** The card's number, per (owner, type): "No. 3 Fighter Wing". */
  nameNo: number;
  /** The standing order's target: a region, a sea zone, or 0 for the whole zone. */
  target: number;
  /** The army it follows, 0 none. */
  follow: number;
  /** The wing it escorts, 0 none. */
  escortOf: number;
  /** WW_BOMB_CLASSES index. */
  cls: number;
  /** WING_PHASES index. */
  phase: number;
  /** The tick this phase ends. */
  until: number;
  /** This sortie's planes × efficiency ‰, fixed at take-off. */
  flyMilli: number;
  /** This sortie's one-way ticks. */
  leg: number;
  /** This sortie's target (battle region, region or sea zone); while ferrying, the base it left. */
  hit: number;
  /** The zone this sortie fights over, 0 on the ground. */
  flySr: number;
  /** The mission this sortie flies, WING_NO_MISSION on the ground. */
  flyMission: number;
  xpMilli: number;
  /** Planes shot down, ever. */
  kills: number;
  /** The day of its last ferry, −1 never ([auto] waits 10 days between). */
  lastFerryDay: number;
  /** The day of its last under-strength notice, −1 never (design §6: 7 days apart). */
  noticeDay: number;
  /** The card's "yesterday" line: shot down and lost today, then the day before. */
  dayKills: number;
  dayLost: number;
  prevKills: number;
  prevLost: number;
  /** The highest multiple of ACE_KILLS of `kills` an ace roll was made at (lane D). */
  aceMark: number;
  /** w50: the air group it belongs to (AirGroup.id), 0 none. */
  group: number;
  /** w50: its own full size when the template splits a type smaller than WW_WING_MAX_PLANES; 0: the type's full size. */
  fullMax: number;
}

/** A wing's new fields at rest. The hash only reads a wing that left them. */
export const WING_NEW_FIELD_DEFAULTS = {
  nameNo: 0,
  target: 0,
  follow: 0,
  escortOf: 0,
  cls: 0,
  phase: WP_GROUND,
  until: 0,
  flyMilli: 0,
  leg: 0,
  hit: 0,
  flySr: 0,
  flyMission: WING_NO_MISSION,
  xpMilli: 300,
  kills: 0,
  lastFerryDay: -1,
  noticeDay: -1,
  dayKills: 0,
  dayLost: 0,
  prevKills: 0,
  prevLost: 0,
  aceMark: 0,
  group: 0,
  fullMax: 0,
} as const;

/** One raid report row (design §5.2), kept by both countries. */
export interface AirRaidReport {
  day: number;
  attacker: number;
  victim: number;
  region: number;
  /** WW_BOMB_CLASSES index. */
  cls: number;
  raids: number;
  planes: number;
  lost: number;
  points: number;
  /** [BUILDING_IDS index, damage milli], ascending. */
  stopped: [number, number][];
  fuelMilli: number;
  shipsHit: number;
  groundPlanes: number;
  wsBp: number;
  repairDays: number;
}

// What the screens read of the wings (WwAirData).

/** Every wing of every country, short. Ids and indexes only (up to 1,500 wings). */
export interface WingBrief {
  id: number;
  owner: number;
  /** wingSide: the volunteer host's side, else the owner's. */
  side: number;
  /** AIR_TYPES index. */
  type: number;
  base: number;
  planes: number;
  phase: number;
  until: number;
  flySr: number;
  /** See Wing.hit. */
  hit: number;
  flyMission: number;
}

/** A human country's wing in full: everything its card shows. */
export interface WingDetail extends WingBrief {
  nameNo: number;
  mission: number;
  sr: number;
  target: number;
  follow: number;
  escortOf: number;
  cls: number;
  night: boolean;
  auto: boolean;
  volunteerFor: number;
  counts: number[];
  /** Present only with some design planes. */
  dcounts?: number[];
  flyMilli: number;
  leg: number;
  xpMilli: number;
  kills: number;
  ace: number;
  prevKills: number;
  prevLost: number;
  /** deploymentStats now, for its range circle and flight times. */
  rangeKm: number;
  speedKmh: number;
  /** w50: its air group (0 none) and its own full size (0: the type's). */
  group?: number;
  fullMax?: number;
}

/**
 * A wing's schedule, one row per take-off (design §10.3): id, phase, the
 * tick that phase ends, L, S, R, target, planes. The client works out every
 * later phase from it. The target is the wing's hit. On a ferry row that is the
 * base it left (it flies to its new `base`), `until` holds the rest after
 * landing, and R is that rest.
 */
export type WingFlightRow = [
  id: number,
  phase: number,
  until: number,
  leg: number,
  station: number,
  rearm: number,
  target: number,
  planes: number,
];
/** An air battle's result: zone, side, planes it lost. */
export type AirFightRow = [sr: number, side: number, lost: number];

// Constants (start values, tuned by lane H; design §3–§6).

/** A wing's full strength by type. Carrier wings mirror their deck and never read it. */
export const WW_WING_MAX_PLANES: Readonly<Record<AirType, number>> = {
  fighter: 150,
  heavy_fighter: 150,
  cas: 150,
  bomber: 120,
  naval_bomber: 120,
  strat_bomber: 100,
  transport_plane: 100,
  cv_fighter: 150,
  cv_cas: 150,
  cv_naval_bomber: 150,
};
/** Land-based wings per country (carrier wings don't count). */
export const WW_MAX_WINGS = 80;
/** A new wing's fewest planes. */
export const WW_WING_FORM_MIN = 20;
/** Of a type's planes this % (at least WW_WING_RESERVE_MIN) stays in stock. */
export const WW_WING_RESERVE_PCT = 10;
export const WW_WING_RESERVE_MIN = 50;
/** One rearm refills up to this % of full strength. */
export const WW_WING_REFILL_PCT = 25;
/** Days after a disband before that type forms a new wing. */
export const WING_REFORM_COOLDOWN_DAYS = 30;
/** One rearm swaps up to this many old planes for newer stock. */
export const WING_UPGRADE_PER_REARM = 5;
/** A forming wing goes near the fronts within this of the capital (Wings.frontKm). */
export const WING_FORM_FRONT_KM = 1500;
/** Ticks of rest after a ferry. */
export const WING_FERRY_REST = 15;
/** [auto] ferries a wing at most this often, days. */
export const WING_AUTO_FERRY_DAYS = 10;
/** One order names at most this many wings (the wire's limit too). */
export const WING_MAX_PER_ORDER = 20;
/** A base overrun takes this % of the planes on the ground. */
export const WING_OVERRUN_LOSS_PCT = 20;
/** A captured base starts with this damage per level. */
export const WW_CAPTURED_BASE_DAMAGE_PM = 500;
/** Field strip: capacity, sortie efficiency, days to build, per country. */
export const WW_FIELD_STRIP_PLANES = 100;
export const WW_FIELD_STRIP_EFF_PM = 800;
export const WW_FIELD_STRIP_DAYS = 5;
export const WW_FIELD_STRIP_MAX = 8;
/** A zone's air battle runs every this many ticks. */
export const AIR_PULSE_TICKS = 2;
/** A wing with nothing to do looks again after this many ticks. */
export const WING_GROUND_RECHECK_TICKS = 4;
/** Take-offs are staggered by wing id × this, so two waves overlap. */
export const WING_STAGGER_TICKS = 3;
/** A sortie's fuel: flyMilli × fuelPerSortie × (2L + S) / this. */
export const WW_AIR_FUEL_TICKS = 6;
/** Escort cuts bomber losses by at most this ‰. */
export const WW_ESCORT_CUT_MAX_PM = 600;
/** Under radar, interceptors scramble this many ticks before the enemy arrives. */
export const WW_RADAR_WARN_TICKS = 3;
/** Without radar (a named zone only), this many ticks after the enemy arrives. */
export const WW_NO_RADAR_SCRAMBLE_TICKS = 2;
/** Interception's station, ticks: until the enemy is gone, within these. */
export const WING_INTERCEPT_MIN_STATION = 4;
export const WING_INTERCEPT_MAX_STATION = 10;
/** The superiority score closes 1/this of the gap per pulse. */
export const WW_AIR_SCORE_DIV = 4;
/** A zone's day luck on air losses, ‰. */
export const WW_AIR_LUCK_MIN_PM = 800;
export const WW_AIR_LUCK_MAX_PM = 1_200;
/** A bomb run's luck, ±%. */
export const WW_AIR_BOMB_LUCK_PCT = 25;
/** The screens hear of a zone's superiority when it crosses this band, ‰. */
export const WW_AIR_VIEW_BAND_PM = 50;
/** A new wing's experience (regular). */
export const WW_WING_START_XP = WING_NEW_FIELD_DEFAULTS.xpMilli;
/** A replacement plane's experience. */
export const WW_ROOKIE_XP = 100;
/** Below this % of full strength a wing skips its next sortie. */
export const WING_RTB_PCT = 30;
/** The under-strength notice's spacing, days. */
export const WING_NOTICE_DAYS = 7;
/** Bomb points to fuel, and to planes on the ground (design §5.1). */
export const WW_BOMB_FUEL_MILLI_PER_POINT = 40;
export const WW_BOMB_POINTS_PER_GROUND_PLANE = 200;
/** Raid reports a country keeps, and how long a same-target raid merges into one, days. */
export const WW_AIR_REPORT_ROWS = 40;
export const WW_AIR_REPORT_MERGE_DAYS = 30;

/** What WwAir.issue takes of the wing orders. */
export type WingOrder = Extract<WwOrder, { kind: WingOrderKind }>;

// ---- w50: air groups (design /home/eser/dev/ww50-air-group-design.md). Append only. ----

/** A group's total planes, a template's step, templates and zones per order. One constant for the owner to change. */
export const WW_MAX_GROUP_PLANES = 600;
export const WW_GROUP_STEP = 25;
export const WW_MAX_AIR_TEMPLATES = 20;
export const WW_GROUP_MAX_ZONES = 5;
export const WW_AIR_TEMPLATE_NAME_MAX = 24;
/** A template's keep-N at most. */
export const WW_MAX_KEEP_GROUPS = 20;
/** The air order kinds of w50, at the end of WwOrderSchema. */
export const GROUP_ORDER_KINDS = [
  "air_template",
  "air_template_drop",
  "air_group_order",
  "air_group_disband",
] as const;
export type GroupOrderKind = (typeof GROUP_ORDER_KINDS)[number];
export type GroupOrder = Extract<WwOrder, { kind: GroupOrderKind }>;

/** A saved template (engine state per country). `planes`: per AIR_TYPES index, steps of WW_GROUP_STEP, carrier types 0. */
export interface AirTemplate {
  id: number;
  name: string;
  planes: number[];
  /** How many groups the engine keeps formed, 0 none. */
  keep: number;
}

/** What the owner sees of a member wing. */
export interface AirGroupMember {
  wing: number;
  /** AIR_TYPES index. */
  type: number;
  planes: number;
  /** Its full size (the template's split, else the type's). */
  full: number;
  /** WING_PHASES index, until (tick), the zone its sortie flies over (0 none) and its mission (WING_NO_MISSION none). */
  phase: number;
  until: number;
  flySr: number;
  flyMission: number;
  /** Its standing zone and mission now (what the group's pick gave it; -1 / 0 waiting). */
  sr: number;
  mission: number;
  /** Yesterday: shot down by it, lost. */
  kills: number;
  lost: number;
  auto: boolean;
}
/** One ordered zone of a group. */
export interface AirGroupZone {
  sr: number;
  /** The group's planes assigned to or flying in the zone now. */
  planes: number;
  /** Our side's and the worst enemy side's superiority there, ‰. */
  supPm: number;
  enemySupPm: number;
  /** Bit i: AIR_TYPES[i] has planes in the group and reaches the zone from the group's base. */
  reachMask: number;
}
/** A group, in full, for its owner only. */
export interface AirGroupView {
  id: number;
  /** The template it keeps (0 none) and its name. */
  tpl: number;
  name: string;
  /** Ordered zones (≤ WW_GROUP_MAX_ZONES), the priority one (0 none), the army it follows (0 none). */
  zones: number[];
  priority: number;
  army: number;
  /** WW_BOMB_CLASSES index, and a single bomb target region (0 none). */
  cls: number;
  target: number;
  auto: boolean;
  night: boolean;
  /** Its base region (0 none). */
  base: number;
  /** Planes now and wanted by the template, per AIR_TYPES index (want empty with no template). */
  planes: number[];
  want: number[];
  /** Range km per AIR_TYPES index of the types in it (0 absent). */
  rangeKm: number[];
  members: AirGroupMember[];
  zoneInfo: AirGroupZone[];
}

/** The plane types a template may hold (no carrier types, no transports), in AIR_TYPES order. */
export const AIR_GROUP_TYPES = [
  "fighter",
  "bomber",
  "heavy_fighter",
  "cas",
  "naval_bomber",
  "strat_bomber",
] as const satisfies readonly AirType[];
