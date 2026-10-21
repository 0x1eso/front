// World War 1936 P2 — divisions and front lines
// (docs/superpowers/specs/2026-10-20-ww1936-p2-divisions-design.md).
// zbin and snapshots store these lists by position: append only.
import { EQUIP_KEYS, EquipmentType } from "./EconomyTypes";

export const BATTALION_IDS = [
  "infantry",
  "cavalry",
  "mountain",
  "marine",
  "paratrooper",
  "motorized",
  "artillery",
  "mot_artillery",
  "anti_tank",
  "anti_air",
  "light_armor",
  "medium_armor",
] as const;
export type BattalionId = (typeof BATTALION_IDS)[number];

export const SUPPORT_IDS = [
  "engineer",
  "recon",
  "support_artillery",
  "support_anti_tank",
  "support_anti_air",
  "field_hospital",
  "logistics",
  "signal",
] as const;
export type SupportId = (typeof SUPPORT_IDS)[number];

export const LAND_TERRAINS = [
  "plains",
  "forest",
  "hills",
  "mountain",
  "marsh",
  "jungle",
  "desert",
  "urban",
] as const;
export type LandTerrain = (typeof LAND_TERRAINS)[number];

export const WEATHERS = [
  "clear",
  "rain",
  "mud",
  "snow",
  "frozen",
  "heat",
] as const;
export type Weather = (typeof WEATHERS)[number];

export const GENERAL_TRAITS = [
  "panzer_leader",
  "infantry_officer",
  "cavalry_officer",
  "offensive_doctrine",
  "defensive_doctrine",
  "winter_specialist",
  "desert_fox",
  "mountaineer",
  "river_crosser",
  "logistics_wizard",
  "organizer",
] as const;
export type GeneralTrait = (typeof GENERAL_TRAITS)[number];
/** Bit of a trait in a trait mask. */
export function traitBit(t: GeneralTrait): number {
  return 1 << GENERAL_TRAITS.indexOf(t);
}

export const STANCES = ["careful", "balanced", "aggressive"] as const;
export type Stance = (typeof STANCES)[number];

export const MOVE_MODES = [
  "none",
  "walk",
  "retreat",
  "advance",
  "rail",
  "sea",
] as const;
export type MoveMode = (typeof MOVE_MODES)[number];
export const MOVE_NONE = 0;
export const MOVE_WALK = 1;
export const MOVE_RETREAT = 2;
export const MOVE_ADVANCE = 3;
export const MOVE_RAIL = 4;
export const MOVE_SEA = 5;

/** A division's role in its battle. */
export const ROLE_NONE = 0;
export const ROLE_ATTACK = 1;
export const ROLE_DEFEND = 2;

export const ARMY_ORDER_KINDS = [
  "idle",
  "move",
  "front",
  "plan",
  "paradrop",
  // P4 (P4 spec §11.1): preparing or sailing a naval invasion; `to` is the
  // target region, the preparation state lives in WwNavy.invasions.
  "invade",
] as const;
export type ArmyOrderKind = (typeof ARMY_ORDER_KINDS)[number];

/**
 * An army's standing order (spec §6.1), flat so it snapshots as one record.
 * move: `to`, `mode` (MOVE_WALK | MOVE_RAIL | MOVE_SEA). front: `anchor`,
 * `enemy` (smallID, 0 = every enemy). plan: front + `targets`, `stance`,
 * `executing`. paradrop: `to`, `readyDay`.
 */
export interface ArmyOrder {
  kind: ArmyOrderKind;
  to: number;
  mode: number;
  anchor: number;
  enemy: number;
  targets: number[];
  stance: Stance;
  executing: boolean;
  readyDay: number;
}
export function idleOrder(): ArmyOrder {
  return {
    kind: "idle",
    to: 0,
    mode: MOVE_NONE,
    anchor: 0,
    enemy: 0,
    targets: [],
    stance: "balanced",
    executing: false,
    readyDay: -1,
  };
}

/**
 * The equipment a division carries (spec §5.2): an allow-list, so P4's
 * planes and convoy stay out and P6's tank designs (slots 18–29) are
 * appended on their own.
 */
export const GROUND_EQUIPMENT: readonly EquipmentType[] = [
  "infantry_equipment",
  "support_equipment",
  "artillery",
  "anti_tank",
  "anti_air",
  "motorized",
  "light_tank",
  "medium_tank",
];
const GROUND_SET: ReadonlySet<EquipmentType> = new Set(GROUND_EQUIPMENT);
/**
 * EQUIP_KEYS indices of the ground equipment, in EQUIP_KEYS order: a
 * division's 18 equipment slots (spec §5.2).
 */
export const GROUND_EQUIP_KEYS: readonly number[] = EQUIP_KEYS.flatMap(
  ([t], i) => (GROUND_SET.has(t) ? [i] : []),
);
export const GROUND_SLOTS = GROUND_EQUIP_KEYS.length; // 18
/** The division slot of an EQUIP_KEYS index; -1 for aircraft. */
export function groundSlotOf(key: number): number {
  return GROUND_EQUIP_KEYS.indexOf(key);
}

export interface TemplateDef {
  name: string;
  battalions: readonly BattalionId[];
  support: readonly SupportId[];
}

/** Template flags (TemplateStats sets them; modifiers read them). */
export const TPL_ENGINEER = 1 << 0;
export const TPL_RECON = 1 << 1;
export const TPL_HOSPITAL = 1 << 2;
export const TPL_LOGISTICS = 1 << 3;
export const TPL_SIGNAL = 1 << 4;
/** Any light or medium armour battalion (mobile_2, panzer_leader). */
export const TPL_ARMOR_ANY = 1 << 5;
/** At least half the battalions are armour (terrain penalty, spec §4.1). */
export const TPL_ARMOR_MAJOR = 1 << 6;
/** Any motorized or motorized artillery battalion. */
export const TPL_MOTOR_ANY = 1 << 7;
/** At least half the battalions are mountain / marine / cavalry. */
export const TPL_MOUNTAIN_MAJOR = 1 << 8;
export const TPL_MARINE_MAJOR = 1 << 9;
export const TPL_CAVALRY_MAJOR = 1 << 10;
/** Every combat battalion is paratrooper-capable: at least one paratrooper. */
export const TPL_PARA_ANY = 1 << 11;
/** No armour, motorized or cavalry battalion (infantry_officer). */
export const TPL_INFANTRY_DIV = 1 << 12;
/** Any mountain battalion (half snow penalty, spec §10). */
export const TPL_MOUNTAIN_ANY = 1 << 13;
/** Any marine battalion (half river and strait penalty). */
export const TPL_MARINE_ANY = 1 << 14;

/**
 * A division's numbers (spec §4.3, §16.2): attack and defence values and
 * armour/pierce in centi, org and HP and supply in milli, hardness ‰,
 * speed centi-km/h. `need` and `parts` are indexed by EQUIPMENT_TYPES.
 */
export interface DivisionStats {
  width: number;
  men: number;
  hpMilli: number;
  orgMilli: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  pierce: number;
  armor: number;
  hardnessPm: number;
  speedCenti: number;
  supplyMilli: number;
  trainDays: number;
  /** Units the template needs, EQUIPMENT_TYPES order. */
  need: number[];
  /**
   * soft, hard, def, brk (centi) carried by battalions and companies whose
   * main equipment is EQUIPMENT_TYPES[i]: four per type. divisionStats
   * scales them by that type's fill.
   */
  parts: number[];
  flags: number;
  /** Mountain + marine + paratrooper battalions. */
  special: number;
  battalions: number;
  /** P4 spec §10.5: battalion and company weights, centi (convoys: divisionConvoys). */
  weightCenti: number;
  /** P4 spec §14.6: anti-air battalions 20, companies 10, by generation. */
  airAtk: number;
  /** P4 spec §15.4: the fuel battalions' share of the width, ‰. */
  fuelWidthPm: number;
  /** P4 spec §15.3: Σ LAND_FUEL_PER_HOUR_MILLI of its battalions. */
  fuelHourMilli: number;
}

export interface CombatMods {
  attackBp: number;
  defenseBp: number;
}

/** One modifier line for the battle card (key ww1936.mod.<id>). */
export interface ModLine {
  id: string;
  bp: number;
}

/** A side of a battle as predictBattle reads it (sums over its divisions). */
export interface SideSum {
  divisions: number;
  width: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  /** Width-weighted averages. */
  armor: number;
  pierce: number;
  hardnessPm: number;
  orgMilli: number;
  hpMilli: number;
}

export interface BattleCtx {
  land: LandTerrain;
  directions: number;
  /** Combined modifiers of each side (combineMods), bp. */
  attackerAttackBp: number;
  attackerBlockBp: number;
  defenderAttackBp: number;
  defenderBlockBp: number;
}

export interface BattlePrediction {
  /** Attacker's org-removal speed ÷ defender's, ‰ (≥ 1000: attacker wins). */
  ratioPm: number;
  rounds: number;
  days: number;
}

// ---- What the screens read (GameUpdateType.WwLand, spec §16.4) ----

export const ARMY_MOVING = 1 << 0;
export const ARMY_BATTLE = 1 << 1;
export const ARMY_ENCIRCLED = 1 << 2;
export const ARMY_RAIL = 1 << 3;
export const ARMY_SEA = 1 << 4;
export const ARMY_RETREAT = 1 << 5;
export const ARMY_EXECUTING = 1 << 6;
export const ARMY_AUTO = 1 << 7;
export const ARMY_PARA = 1 << 8;
/** P4: preparing or sailing a naval invasion. */
export const ARMY_INVADE = 1 << 9;

export interface ArmyMoveData {
  from: number;
  to: number;
  /** Progress of the slowest moving division, ‰ of this edge. */
  progPm: number;
  /** ‰ it gains a tick (the screen interpolates). */
  stepPm: number;
}

export interface ArmySummary {
  id: number;
  owner: number;
  nameNo: number;
  /** 0: none. */
  general: number;
  divisions: number;
  strengthPm: number;
  orgPm: number;
  state: number;
  /** Token region (spec §6.1). */
  region: number;
  move: ArmyMoveData | null;
  sum: SideSum;
  /**
   * The branch symbol (pre-flight U12): BATTALION_IDS index of the most
   * numerous battalion of the template most of its divisions use (ties:
   * the smaller template id); -1 when it has none.
   */
  symbol: number;
  /** Filled for every human country's armies; the UI shows it only when owner === me. */
  mine: ArmyMineData | null;
}

export interface ArmyMineData {
  order: ArmyOrder;
  front: number[];
  planBp: number;
  auto: boolean;
  /** Remaining path of a move order. */
  path: number[];
  supplyPm: number;
  /** Ticks until the slowest division arrives; -1 when not moving. */
  etaTicks: number;
  /** Day of the last paradrop; -1: never (LandOrderChecks' cooldown). */
  paraLastDay: number;
}

export interface BattleSummary {
  region: number;
  attacker: number;
  defender: number;
  attLine: number;
  attReserve: number;
  defLine: number;
  defReserve: number;
  width: number;
  attWidth: number;
  defWidth: number;
  directions: number;
  /** Defender org lost / start org, ‰ (spec §12.3). */
  progressPm: number;
  attOrgPm: number;
  defOrgPm: number;
  attStrPm: number;
  defStrPm: number;
}

export interface RegionLandData {
  id: number;
  controller: number;
  /** Real supply of the controlling side, milli (the engine sends it for every region; the screen hides it for the off-side). */
  supplyMilli: number;
  /** Real supply its controlling side's divisions there use, milli (the region card's "use"; the screen hides it for the off-side). */
  useMilli: number;
  encircled: boolean;
  /** [smallID, divisions] of the three countries with most divisions there. */
  counts: [number, number][];
}

export interface CountryLandSummary {
  smallID: number;
  divisions: number;
  fieldMen: number;
  trainingMen: number;
  casualtiesToday: number;
  battles: number;
  encircledArmies: number;
}

export interface TemplateData {
  id: number;
  name: string;
  /** Translation key of a 1936 default (ww1936.tpl.<key>); "" for a player's own. */
  key: string;
  battalions: BattalionId[];
  support: SupportId[];
  inUse: number;
}

export interface TrainingData {
  id: number;
  template: number;
  remaining: number;
  /** Divisions of this entry in training: days done, days needed, fill ‰. */
  trainees: { days: number; need: number; fillPm: number }[];
  army: number;
  region: number;
  /** "manpower" | "equipment" | "" */
  waiting: string;
}

export interface GeneralData {
  id: number;
  /** GENERALS id ("" for a titled general). */
  key: string;
  titleNo: number;
  att: number;
  def: number;
  plan: number;
  log: number;
  traits: number;
  level: number;
  xp: number;
  army: number;
  /** First day it can serve, last day (-1: open). */
  from: number;
  until: number;
}

export interface DivisionData {
  id: number;
  army: number;
  template: number;
  region: number;
  strengthPm: number;
  orgPm: number;
  exp: number;
  supplyPm: number;
  /** Lowest equipment fill of the division, ‰. */
  equipPm: number;
  /** The battle (its region) it fights in; 0: none. */
  battle: number;
  /** ROLE_NONE, ROLE_ATTACK or ROLE_DEFEND. */
  role: number;
}

export interface CountryLandDetail {
  smallID: number;
  armyXpMilli: number;
  templates: TemplateData[];
  training: TrainingData[];
  generals: GeneralData[];
  divisions: DivisionData[];
}

export interface WwLandData {
  armies: ArmySummary[];
  removedArmies: number[];
  battles: BattleSummary[];
  endedBattles: number[];
  regions: RegionLandData[];
  countries: CountryLandSummary[];
  details: CountryLandDetail[];
}

// ---- Limits and constants (spec §2–§12) ----

/** HOI4 hours one tick (one combat round) stands for, ×1000 (24 / 7.5 / 1.75). */
export const WW_ROUND_HOUR_MILLI = 1829;
export const WW_SPREAD_TILES_PER_TICK = 2000;
export const WW_MAX_ARMY_DIVISIONS = 24;
export const WW_MAX_TEMPLATES = 12;
export const WW_MAX_TRAINING = 20;
export const WW_MAX_TRAIN_COUNT = 10;
export const WW_MAX_ARMIES = 40;
/** HOI4's designer: 5 columns × 5 rows (pre-flight U1). */
export const WW_MAX_BATTALIONS = 25;
export const WW_MAX_SUPPORT = 4;
export const WW_MAX_WIDTH = 40;
export const WW_MAX_TARGETS = 3;
export const WW_TEMPLATE_NAME_MAX = 24;
/** Supply km a hub reaches (spec §11.2). */
export const WW_SUPPLY_RANGE = 600;
export const WW_PLAN_MAX_BP = 3000;
export const WW_PLAN_DAY_BP = 100;
export const WW_PLAN_FIGHT_BP = 50;
export const WW_ARMY_XP_MAX_MILLI = 500_000;
export const WW_TITLED_GENERAL_XP_MILLI = 10_000;
export const WW_PARA_RANGE_KM = 600;
export const WW_PARA_PREP_DAYS = 10;
export const WW_PARA_COOLDOWN_DAYS = 30;
/** Battle spread cap and daily move, ‰ of the region's tiles (spec §12.3). */
export const WW_SPREAD_BATTLE_PM = 400;
export const WW_SPREAD_DAY_PM = 200;
export const WW_DEPLOY_MIN_FILL_PM = 500;
export const WW_REINFORCE_PM = 100;
export const WW_UPGRADE_PM = 50;
export const WW_EXP_PER_DAY = 3;
export const WW_FRONT_DIVS_PER_REGION = 3;
export const WW_AI_PREWAR_DAYS = 60;
/** First id of a titled general (spec §6.2, plan decision 17; Generals.titledGeneralId). */
export const WW_TITLED_GENERAL_BASE = 100_000;

/** The order kinds land.issue takes (spec §16.3), in WwOrder order. */
export const LAND_ORDER_KINDS = [
  "template_save",
  "template_delete",
  "train",
  "cancel_train",
  "deploy_now",
  "army_move",
  "army_rail",
  "army_sea",
  "army_attack",
  "army_front",
  "army_plan",
  "army_execute",
  "army_halt",
  "army_split",
  "army_merge",
  "army_disband",
  "army_general",
  "army_auto",
  "paradrop",
  "appoint_general",
] as const;
export type LandOrderKind = (typeof LAND_ORDER_KINDS)[number];

/** Who gave a land order (pre-flight U2): a player's order turns `auto` off. */
export type LandOrderSource = "player" | "ai";

/**
 * The land war's messages (spec §15.8), full keys (pre-flight U5): every
 * sender passes one of these literally, so the translation check sees each.
 * Parameters: `count` (number), `region` (region id), `army` (the army's
 * nameNo), `general` (general id).
 */
export const LAND_MESSAGE_KEYS = [
  "events_display.ww1936_division_ready",
  "events_display.ww1936_region_taken",
  "events_display.ww1936_region_lost",
  "events_display.ww1936_encircled",
  "events_display.ww1936_divisions_destroyed",
  "events_display.ww1936_general_available",
  "events_display.ww1936_general_lost",
  "events_display.ww1936_no_tile_attacks",
] as const;
export type LandMessageKey = (typeof LAND_MESSAGE_KEYS)[number];
