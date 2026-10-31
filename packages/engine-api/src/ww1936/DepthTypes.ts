// World War 1936 P6 — depth (docs/superpowers/specs/2026-10-20-ww1936-p6-depth-design.md).
// APPEND ONLY: every list below is a wire, snapshot or content enum.
import { zb } from "@openfront/zbin";
import { z } from "zod";
import type { CountryTag } from "./Countries";
import type { FocusId } from "./PoliticsTypes";

// ---- Doctrine (spec §3) ----
export const DOCTRINE_DOMAINS = ["land", "naval", "air"] as const;
export type DoctrineDomain = (typeof DOCTRINE_DOMAINS)[number];
export const GRAND_DOCTRINES = [
  "gd_mobile",
  "gd_firepower",
  "gd_battleplan",
  "gd_mass",
  "gd_fleet_in_being",
  "gd_trade_interdiction",
  "gd_base_strike",
  "gd_strategic_destruction",
  "gd_battlefield_support",
  "gd_operational_integrity",
] as const;
export type GrandDoctrine = (typeof GRAND_DOCTRINES)[number];
/** DOCTRINE_DOMAINS index of each grand doctrine. */
export const GD_DOMAIN: readonly number[] = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2];
/** Three per domain, in DOCTRINE_DOMAINS order: track t belongs to domain floor(t / 3). */
export const DOCTRINE_TRACKS = [
  "infantry",
  "armor",
  "support",
  "surface",
  "escort",
  "carrier",
  "fighter",
  "bomber",
  "naval_air",
] as const;
export type DoctrineTrack = (typeof DOCTRINE_TRACKS)[number];
export const SUBDOCTRINES = [
  "inf_elastic",
  "inf_assault",
  "inf_mass_mob",
  "arm_breakthrough",
  "arm_inf_support",
  "arm_mech",
  "sup_artillery",
  "sup_deep_ops",
  "sup_entrenched",
  "nav_battleline",
  "nav_cruiser",
  "nav_wolfpack",
  "nav_convoy_escort",
  "nav_carrier_force",
  "nav_carrier_support",
  "air_interceptor",
  "air_escort",
  "air_strategic_campaign",
  "air_ground_attack",
  "air_maritime_strike",
  "air_maritime_patrol",
] as const;
export type Subdoctrine = (typeof SUBDOCTRINES)[number];
/** DOCTRINE_TRACKS index of each sub-doctrine. */
export const SUB_TRACK: readonly number[] = [
  0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
];
export const MASTERY_LEVELS_MILLI = [
  100_000, 300_000, 600_000, 1_000_000, 1_500_000,
] as const;
export const MASTERY_MAX_MILLI = 1_500_000;
export const MASTERY_BASE_DAY_MILLI = 300;
export const MASTERY_CAP_DAY_MILLI = 1_200;
/** Track level sum of a domain at which its grand doctrine's completion effect applies. */
export const GD_COMPLETE_LEVELS = 6;
export const GD_SWITCH_XP = [100, 75, 75] as const; // land, naval, air experience
export const GD_SWITCH_LOCK_DAYS = 180;
export const SUB_SWITCH_XP = 25;
export const SUB_SWITCH_LOCK_DAYS = 90;
/** doctrine_mastery effect: one "research bonus +100%" of P3/P5 content = +60 mastery (spec §1.4). */
export const MASTERY_PER_RESEARCH_BONUS = 60;

// ---- Command (spec §4) ----
export const CP_MAX_MILLI = 100_000;
export const CP_DAY_MILLI = 400;
export const CP_FM_UPKEEP_MILLI = 50;
export const FM_PROMOTE_CP = 30;
export const FM_PROMOTE_PP = 25;
export const MEDAL_CP = 10;
export const MEDAL_COOLDOWN_DAYS = 120;
export const MEDAL_DAYS = 180;
export const WW_MAX_FIELD_MARSHALS = 4;
export const WW_GROUP_ARMIES = 5;
export const ARMY_SPIRIT_CATEGORIES = [
  "land_recruit",
  "land_command",
  "land_formation",
  "naval_training",
  "naval_ops",
  "air_personnel",
  "air_command",
] as const;
export type ArmySpiritCategory = (typeof ARMY_SPIRIT_CATEGORIES)[number];
/** DOCTRINE_DOMAINS index of each category. */
export const SPIRIT_CAT_DOMAIN: readonly number[] = [0, 0, 0, 1, 1, 2, 2];
/** Three per category, in ARMY_SPIRIT_CATEGORIES order: spirit s belongs to category floor(s / 3). */
export const ARMY_SPIRITS = [
  "as_conscript",
  "as_professional",
  "as_reserve",
  "as_mission_command",
  "as_central_command",
  "as_political_officers",
  "as_combined_arms",
  "as_mass_formation",
  "as_elite_units",
  "as_fleet_drill",
  "as_night_training",
  "as_damage_control",
  "as_aggressive_fleet",
  "as_fleet_preservation",
  "as_joint_ops",
  "as_pilot_school",
  "as_ground_crew",
  "as_air_college",
  "as_escort_first",
  "as_independent_air",
  "as_army_cooperation",
] as const;
export type ArmySpirit = (typeof ARMY_SPIRITS)[number];
export const SPIRIT_PICK_XP = 25;
export const SPIRIT_SWITCH_XP = 50;
export const SPIRIT_LOCK_DAYS = 90;
export const FM_TRAITS = [
  "fm_offensive",
  "fm_defensive",
  "fm_logistics",
  "fm_thorough",
  "fm_fast_planner",
  "fm_inspiring",
  "fm_strategist",
] as const;
export type FmTrait = (typeof FM_TRAITS)[number];
export const MEDALS = [
  "medal_valor",
  "medal_defense",
  "medal_service",
] as const;
export type Medal = (typeof MEDALS)[number];
export const REINFORCE_PRIORITIES = ["low", "normal", "high"] as const;

// ---- Designs (spec §5) ----
export const DESIGN_KINDS = ["tank", "ship", "plane"] as const;
export type DesignKind = (typeof DESIGN_KINDS)[number];
export const DESIGN_ORIGINS = [
  "own",
  "captured",
  "received",
  "licensed",
] as const;
export type DesignOrigin = (typeof DESIGN_ORIGINS)[number];
export const WW_TANK_DESIGN_SLOTS = 12;
export const WW_PLANE_DESIGN_SLOTS = 16;
export const WW_SHIP_DESIGN_SLOTS = 24;
export const DESIGN_SLOTS: Readonly<Record<DesignKind, number>> = {
  tank: 12,
  ship: 24,
  plane: 16,
};
export const DESIGN_NAME_MAX = 24;
export const TANK_BASES = [
  "light_1",
  "light_2",
  "medium_1",
  "medium_2",
  "medium_3",
  "heavy_1",
  "heavy_2",
  "heavy_3",
  "super_heavy_1",
  "modern_1",
] as const;
export type TankBase = (typeof TANK_BASES)[number];
/** Tank slot kinds; a chassis has gun, turret, suspension, armor, engine, then 1–2 specials. */
export const TANK_SLOT_KINDS = [
  "gun",
  "turret",
  "suspension",
  "armor",
  "engine",
  "special",
] as const;
export const TANK_MODULES = [
  "mg",
  "auto20",
  "gun_small",
  "gun_cs",
  "gun_hv",
  "gun_heavy",
  "flame",
  "howitzer",
  "aa_auto",
  "turret_none",
  "turret_open",
  "turret_1",
  "turret_2",
  "turret_3",
  "bogie",
  "christie",
  "torsion",
  "interleaved",
  "riveted",
  "welded",
  "cast",
  "petrol",
  "diesel",
  "engine_2",
  "engine_3",
  "gun_super",
  "radio",
  "sloped",
  "aux_mg",
  "smoke",
  "skirts",
  "amphibious",
  "flail",
] as const;
export type TankModule = (typeof TANK_MODULES)[number];
export const TANK_ROLES = [
  "tank",
  "tank_destroyer",
  "sp_artillery",
  "sp_anti_air",
] as const;
export type TankRole = (typeof TANK_ROLES)[number];
export const SHIP_SLOT_KINDS = [
  "main",
  "secondary",
  "torpedo",
  "asw",
  "fire_control",
  "armor",
  "engine",
  "hangar",
  "special",
] as const;
export type ShipSlotKind = (typeof SHIP_SLOT_KINDS)[number];
export const SHIP_MODULES = [
  "main_heavy",
  "main_light",
  "sec_dp",
  "sec_aa",
  "sec_light",
  "torp_none",
  "torp_heavy",
  "asw_sonar",
  "asw_dc_heavy",
  "fc_improved",
  "radar_surface",
  "radar_adv",
  "radar_microwave",
  "armor_heavy",
  "armor_light",
  "armor_deck",
  "engine_fast",
  "engine_long",
  "hangar_large",
  "hangar_small",
  "mine_layer",
  "minesweep",
  "floatplane",
  "snorkel",
  "shbb_hull",
  "aa_2",
  "aa_3",
  "fc_2",
] as const;
export type ShipModule = (typeof SHIP_MODULES)[number];
export const PLANE_BASES = [
  "small_1",
  "small_2",
  "small_3",
  "medium_1",
  "medium_2",
  "medium_3",
  "large_1",
  "large_2",
  "large_3",
  "jet_1",
  "jet_2",
  "jet_medium_1",
] as const;
export type PlaneBase = (typeof PLANE_BASES)[number];
export const PLANE_SLOT_KINDS = [
  "weapon",
  "aux",
  "defense",
  "special",
] as const;
export type PlaneSlotKind = (typeof PLANE_SLOT_KINDS)[number];
export const PLANE_MODULES = [
  "w_mg2",
  "w_mg4",
  "w_hmg",
  "w_cannon20",
  "w_cannon30",
  "w_bombs_s",
  "w_bombs_m",
  "w_bombs_l",
  "w_torpedo",
  "w_rockets",
  "w_cargo",
  "m_def_turret",
  "m_armor",
  "m_self_sealing",
  "m_drop_tank",
  "m_dive_brakes",
  "m_bomb_sight",
  "m_radar",
  "m_carrier",
  "m_engine_boost",
  "m_recon_camera",
  "radar_2",
] as const;
export type PlaneModule = (typeof PLANE_MODULES)[number];
/** Equipment need groups past EQUIPMENT_TYPES (plan decision 6). */
export const EXTRA_NEED_GROUPS = [
  "heavy_tank_g",
  "td_g",
  "spa_g",
  "spaa_g",
] as const;
export type ExtraNeedGroup = (typeof EXTRA_NEED_GROUPS)[number];

/** One saved design (spec §21.4 wire shape). `modules[i]` is slot i's module id, "" for the base fitting. */
export interface DesignDef {
  kind: DesignKind;
  base: string;
  modules: string[];
  armorLevel?: number;
  engineLevel?: number;
  name: string;
}
export const DesignNameSchema = zb.string({
  min: 1,
  max: DESIGN_NAME_MAX,
  // Review L6: P2's template-name rule (no control or format characters
  // such as bidi overrides, no space at either end) and no markup.
  regex: /^[^\s\p{Cc}\p{Cf}<>](?:[^\p{Cc}\p{Cf}<>]*[^\s\p{Cc}\p{Cf}<>])?$/u,
});
export const DesignDefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tank"),
    base: z.enum(TANK_BASES),
    modules: z
      .array(z.union([z.enum(TANK_MODULES), z.literal("")]))
      .min(6)
      .max(7),
    armorLevel: zb.uint({ max: 10 }),
    engineLevel: zb.uint({ max: 10 }),
    name: DesignNameSchema,
  }),
  z.object({
    kind: z.literal("ship"),
    base: zb.string({
      min: 4,
      max: 4,
      regex: /^(dd|cl|ca|bc|bb|cv|ss)_[1-4]$/,
    }),
    modules: z
      .array(z.union([z.enum(SHIP_MODULES), z.literal("")]))
      .min(3)
      .max(6),
    name: DesignNameSchema,
  }),
  z.object({
    kind: z.literal("plane"),
    base: z.enum(PLANE_BASES),
    modules: z
      .array(z.union([z.enum(PLANE_MODULES), z.literal("")]))
      .min(4)
      .max(6),
    name: DesignNameSchema,
  }),
]);

/** Tank design numbers at battalion level (P2 units): attack values, armor, pierce centi; speed centi-km/h. */
export interface TankDesignStats {
  kind: "tank";
  role: TankRole;
  /** NEED_GROUPS index the design fills (plan decision 6). */
  group: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  pierce: number;
  armor: number;
  aa: number;
  hardnessPm: number;
  speedCenti: number;
  relPm: number;
  orgAdd: number;
  fuelPct: number;
  costMilli: number;
  /** RESOURCE_IDS order, per factory. */
  resources: number[];
  /** DS_* flag bits below. */
  flags: number;
  year: number;
}
export const DS_FLAME = 1 << 0; // urban and fort attack +10%
export const DS_AMPHIBIOUS = 1 << 1; // half river/strait/landing penalties
export const DS_FLAIL = 1 << 2; // its division: fort penalty −25%
export const DS_SKIRTS = 1 << 3; // +4 armor in the pierce comparison
export const DS_TD_DEFEND = 1 << 4; // tank destroyer: +10% defence when defending
export const DS_CARRIER = 1 << 5; // plane: carrier capable
export const DS_RADAR = 1 << 6; // plane: no night penalty, naval patrol ×1.3 (×1.5 with magnetron)
export const DS_RECON = 1 << 7; // plane: recon ×2
export const DS_CARGO = 1 << 8; // plane: transport
export const DS_MINE_LAYER = 1 << 9; // ship
export const DS_MINESWEEP = 1 << 10; // ship
export const DS_JET = 1 << 11; // plane: fuel ×1.6

/** Ship design modifiers over the P4 base stats (spec §5.3.3): percents and absolute deltas. */
export interface ShipDesignMods {
  kind: "ship";
  lightPct: number;
  heavyPct: number;
  torpedoPct: number;
  depthPct: number;
  aaPct: number;
  armorPct: number;
  hpPct: number;
  piercePct: number;
  deckPct: number;
  damageTakenPct: number;
  surfDetectPct: number;
  subDetectPct: number;
  visPct: number;
  rangePct: number;
  fuelPct: number;
  hitPct: number;
  speedCentiKn: number;
  costPct: number;
  flags: number;
  year: number;
}

/** Plane design numbers (spec §5.4): attack values centi, speed km/h, range km. */
export interface PlaneDesignStats {
  kind: "plane";
  /** EQUIPMENT_TYPES name of the P4 type it flies as (spec §5.4.2 role table). */
  type: string;
  airAttack: number;
  airDefense: number;
  agility: number;
  ground: number;
  strategic: number;
  naval: number;
  speed: number;
  range: number;
  detect: number;
  relPm: number;
  costMilli: number;
  resources: number[];
  fuelPct: number;
  flags: number;
  year: number;
}
export type DesignStats = TankDesignStats | ShipDesignMods | PlaneDesignStats;

/** Fields of one KeyStatsTable row (plan decision 7), KS_FIELDS per ground slot. */
export const KS = {
  soft: 0,
  hard: 1,
  def: 2,
  brk: 3,
  pierce: 4,
  armor: 5,
  hardnessPm: 6,
  speedCenti: 7,
  aa: 8,
  relPm: 9,
  fuelPct: 10,
  orgAdd: 11,
  flags: 12,
} as const;
export const KS_FIELDS = 13;
/**
 * Spec §21.2 / plan decision 7: a country's numbers of every division
 * equipment slot (GROUND_SLOTS rows). `group`: the NEED_GROUPS index the
 * slot fills (-1: an empty design slot); `year`: the draw order's year;
 * `stats`: KS_FIELDS per slot. A table is rebuilt as a new object, never
 * written in place (pre-flight §0-3a: its identity is a stats input).
 */
export interface KeyStatsTable {
  group: Int8Array;
  year: Int16Array;
  stats: Int32Array;
}

// ---- MIO, licences, market (spec §6, §7) ----
export const MIO_FAMILIES = [
  "mio_infantry",
  "mio_artillery",
  "mio_armor",
  "mio_air_light",
  "mio_air_heavy",
  "mio_naval",
] as const;
export type MioFamily = (typeof MIO_FAMILIES)[number];
export const MIO_ARCHETYPES = [
  "state_arsenal",
  "private_combine",
  "design_bureau",
] as const;
export type MioArchetype = (typeof MIO_ARCHETYPES)[number];
/** 3 columns (p, q, s) × 3 rows; bit i of a trait mask = MIO_TRAITS[i]. */
export const MIO_TRAITS = [
  "p1",
  "p2",
  "p3",
  "q1",
  "q2",
  "q3",
  "s1",
  "s2",
  "s3",
] as const;
export type MioTrait = (typeof MIO_TRAITS)[number];
/** The free trait of each archetype (spec §6.1). */
export const MIO_FREE_TRAIT: readonly number[] = [0, 3, 6];
export const MIO_MAX_SIZE = 10;
export const MIO_SWITCH_PP = 50;
export const MIO_INVEST_PP = 50;
export const MIO_INVEST_MILLI = 600_000;
export const MIO_INVEST_COOLDOWN_DAYS = 180;
export const WW_MAX_LICENCES = 8;
export const WW_MAX_LISTINGS = 6;
/**
 * The most units one market_list or market_buy order carries (the order
 * schemas' cap); final review D2: a listing never holds more, so a buy of
 * the whole listing always fits the schema.
 */
export const WW_MARKET_MAX_COUNT = 1_000_000;
export const MARKET_DAYS = 30;
export const EMBARGO_PP = 25;
export const LICENCE_CARD_TICKS = 200; // 20 s at 10 ticks a second

// ---- Intelligence (spec §8) ----
export const AGENCY_UPGRADES = [
  "ag_ops_1",
  "ag_ops_2",
  "ag_ops_3",
  "ag_crypto_1",
  "ag_crypto_2",
  "ag_cipher",
  "ag_army_dept",
  "ag_navy_dept",
  "ag_air_dept",
  "ag_civil_dept",
  "ag_counter",
  "ag_special_ops",
] as const;
export type AgencyUpgrade = (typeof AGENCY_UPGRADES)[number];
export const AGENCY_FOUND_PP = 50;
export const AGENCY_UPGRADE_DAYS = 90;
export const AGENCY_UPGRADE_CIVS = 2;
export const INTEL_MISSIONS = [
  "build_network",
  "boost_ideology",
  "propaganda",
  "counter_intelligence",
  "support_resistance",
  "suppress_resistance",
] as const;
export type IntelMission = (typeof INTEL_MISSIONS)[number];
export const INTEL_OPERATIONS = [
  "op_infiltrate_army",
  "op_infiltrate_navy",
  "op_infiltrate_air",
  "op_steal_blueprints",
  "op_capture_cipher",
  "op_sabotage",
  "op_collaboration",
  "op_coup",
  "op_rescue",
  "op_uprising",
] as const;
export type IntelOperation = (typeof INTEL_OPERATIONS)[number];
export const INTEL_DOMAINS = ["civil", "army", "navy", "air"] as const;
export type IntelDomain = (typeof INTEL_DOMAINS)[number];
export const ID_CIVIL = 0;
export const ID_ARMY = 1;
export const ID_NAVY = 2;
export const ID_AIR = 3;
export const OPERATIVE_STATES = [
  "idle",
  "travel",
  "mission",
  "operation",
  "captured",
] as const;
export type OperativeState = (typeof OPERATIVE_STATES)[number];
export const WW_MAX_OPERATIVES = 4;
export const OPERATIVE_RECRUIT_DAYS = 30;
export const OPERATIVE_TRAVEL_DAYS = 10;
export const OPERATIVE_SKILL_DAYS = 180;
export const OPERATIVE_MAX_SKILL = 3;
export const OPERATIVE_JAIL_DAYS = 365;
export const CODENAME_COUNT = 60;
export const DECRYPT_EXPLOIT_DAYS = 90;
export const DECRYPT_RESET_PM = 300;
/** Intel bands (spec §8.8): 0 unknown, 1 rough, 2 close, 3 exact. */
export const INTEL_BAND_FLOORS = [0, 20, 50, 80] as const;

// ---- Special projects, atomic bomb, rockets, raids (spec §9, §10) ----
export const SPECIAL_PROJECTS = [
  "sp_atomic",
  "sp_flying_bomb",
  "sp_ballistic",
  "sp_jet_engine",
  "sp_cavity_magnetron",
  "sp_proximity_fuze",
] as const;
export type SpecialProject = (typeof SPECIAL_PROJECTS)[number];
export const SCIENTIST_SPECS = [
  "nuclear",
  "rocket",
  "electronics",
  "aviation",
] as const;
export type ScientistSpec = (typeof SCIENTIST_SPECS)[number];
export const FACILITY_IDS = [
  "facility_nuclear",
  "facility_rocket",
  "facility_science",
] as const;
export type FacilityId = (typeof FACILITY_IDS)[number];
export const ATOMIC_MILESTONES_PM = [300, 600, 900] as const;
export const ATOMIC_BOMB_DAYS = 120;
export const ATOMIC_URANIUM_DAY = 2;
export const WW_MAX_ATOMIC_STOCK = 10;
export const NUKE_MIN_BOMBERS = 10;
export const NUKED_DAYS = 365;
export const RAID_KINDS = ["raid_para", "raid_commando", "raid_bomb"] as const;
export type RaidKind = (typeof RAID_KINDS)[number];
export const RAID_PREP_DAYS: readonly number[] = [20, 15, 7];
export const WW_MAX_RAIDS = 2;
export const ROCKET_KINDS = ["flying_bomb", "ballistic_rocket"] as const;
export const ROCKET_RANGE_KM: readonly number[] = [250, 320];
export const ROCKET_POINTS: readonly number[] = [1_000, 1_500];

// ---- Packs, continuous focuses, mechanisms (spec §11–§14) ----
export const FOCUS_PACKS = [
  "chn",
  "ccp",
  "chw",
  "spa",
  "pol",
  "tur",
  "bal",
  "nor",
  "lat",
  "dom",
  "new",
] as const;
export type FocusPack = (typeof FOCUS_PACKS)[number];
export interface FocusPackDef {
  id: FocusPack;
  replaces: readonly FocusId[];
}
export const PACK_COLUMNS = [20, 35] as const;
export const CONTINUOUS_FOCUSES = [
  "cf_industry",
  "cf_construction",
  "cf_research",
  "cf_political",
  "cf_stability",
  "cf_war_effort",
  "cf_army",
  "cf_navy_air",
] as const;
export type ContinuousFocus = (typeof CONTINUOUS_FOCUSES)[number];
export const CFOCUS_UNLOCK_FOCUSES = 10;
export const CFOCUS_UNLOCK_DATE = "1939-01-01";
export const CFOCUS_LOCK_DAYS = 30;
export const BOP_TAGS = ["CHN", "JPN", "FRA"] as const;
/** Bands: far left, left, centre, right, far right (spec §13.2, boundaries ±600 / ±200). */
export const BOP_BANDS = 5;
export const CONGRESS_START_BP = 3_000;
export const FACTION_RULES = [
  "fr_ideology_lock",
  "fr_shared_research",
  "fr_shared_intel",
] as const;
export type FactionRule = (typeof FACTION_RULES)[number];
export const FACTION_GOALS = [
  "fg_members",
  "fg_europe_vp",
  "fg_sea_lanes",
  "fg_research",
  "fg_industry",
  "fg_liberation",
] as const;
export type FactionGoal = (typeof FACTION_GOALS)[number];
export const FACTION_RULE_PP = 50;
export const FACTION_RULE_LOCK_DAYS = 180;
export const TREATY_LEAVE_PP = 50;
export const TREATY_LEAVE_DAYS = 30;
export const TREATY_END_DATE = "1942-12-31";

// ---- World (spec §16) ----
export const LANDMARKS = [
  "lm_eiffel",
  "lm_westminster",
  "lm_kremlin",
  "lm_brandenburg",
  "lm_colosseum",
  "lm_liberty",
  "lm_empire_state",
  "lm_golden_gate",
  "lm_hagia_sophia",
  "lm_forbidden_city",
  "lm_himeji",
  "lm_christ_redeemer",
  "lm_taj_mahal",
] as const;
export type Landmark = (typeof LANDMARKS)[number];
export const DAMS = [
  "dam_hoover",
  "dam_grand_coulee",
  "dam_norris",
  "dam_dnipro",
  "dam_mohne",
  "dam_eder",
  "dam_kembs",
  "dam_galloway",
  "dam_vemork",
] as const;
export type Dam = (typeof DAMS)[number];
/** Energy of each dam at level 1 (spec §16.4). */
export const DAM_ENERGY: readonly number[] = [10, 12, 4, 10, 3, 3, 4, 3, 4];
/** A region's landmark and dam (scenario v5, spec §16.1). */
export interface LandmarkDef {
  id: Landmark;
  region: number;
}
export interface DamDef {
  id: Dam;
  region: number;
  downstream: readonly number[];
}
export const FLOOD_DAYS = 60;
export const DAM_REPAIR_COST = 6_000;
export const SCORCH_PP = 10;
export const SCORCH_DAYS = 3;
export const HARBOR_DAYS = 120;
export const HARBOR_DECAY_FROM = 61;
export const WW_MAX_RAILGUNS = 2;
export const RAILGUN_HIT_CENTI = 600;
export const ENERGY_PER_COAL = 3;
export const ENERGY_PER_HYDRO = 2;
export const ENERGY_PER_PLANT = 6;
export const COAL_PER_REFINERY = 2;

// ---- Orders (spec §21.4; plan decision 4: after "army_garrison", this order) ----
export const DEPTH_ORDER_KINDS = [
  "doctrine_pick",
  "subdoctrine_pick",
  "army_spirit_pick",
  "trait_assign",
  "promote_fm",
  "ag_create",
  "ag_add",
  "ag_remove",
  "ag_disband",
  "ag_front",
  "ag_execute",
  "ag_auto",
  "medal_award",
  "army_priority",
  "design_save",
  "design_copy",
  "design_obsolete",
  "design_rename",
  "ship_refit",
  "line_convert",
  "mio_pick",
  "mio_trait",
  "mio_invest",
  "licence_request",
  "licence_answer",
  "licence_cancel",
  "market_list",
  "market_unlist",
  "market_buy",
  "embargo",
  "embargo_lift",
  "intel_found",
  "intel_upgrade",
  "operative_recruit",
  "operative_assign",
  "operative_recall",
  "operation_start",
  "operation_cancel",
  "crypto_target",
  "crypto_activate",
  "project_start",
  "project_cancel",
  "project_scientist",
  "nuke_drop",
  "rocket_strike",
  "raid",
  "raid_cancel",
  "cfocus_set",
  "cfocus_clear",
  "faction_rule",
  "faction_goal",
  "treaty_leave",
  "railgun_assign",
  "railgun_return",
  "harbor_deploy",
  "scorch",
  "air_night",
] as const;
export type DepthOrderKind = (typeof DEPTH_ORDER_KINDS)[number];

// ---- Content data shapes (K5 fills, engine-lib content/depth/*.ts) ----
export interface StartDoctrineDef {
  tag: CountryTag | "@aggressor" | "@democracy" | "@minor";
  /** GRAND_DOCTRINES ids per domain (null: none), then SUBDOCTRINES per track (9, null: none). */
  gd: readonly [
    GrandDoctrine | null,
    GrandDoctrine | null,
    GrandDoctrine | null,
  ];
  sub: readonly (Subdoctrine | null)[];
}
export interface StartFmDef {
  tag: CountryTag;
  /** P2 GENERALS id, or "title:<key>" for a titled marshal (Japan). */
  general: string;
  trait: FmTrait;
  from?: string;
  until?: string;
  /** "<position> <date>; <source 1>; <source 2>" (spec §27.7-4). */
  source: string;
}
export interface ScientistDef {
  tag: CountryTag;
  spec: ScientistSpec;
  skill: number;
  from?: string;
}
export interface AiDesignPreset {
  id: string;
  def: Omit<DesignDef, "name">;
  from?: string;
  tags?: readonly CountryTag[];
}
export interface NukeTargetDef {
  attacker: CountryTag;
  target: CountryTag;
  regions: readonly number[];
  notBefore: string;
}
export interface AgencyStartDef {
  tag: CountryTag;
  date: string;
}

// ---- What the screens read (GameUpdateType.WwDepth, spec §21.5) ----
export interface WwDepthSummary {
  smallID: number;
  /** GRAND_DOCTRINES index per domain, -1 none. */
  gd: number[];
  /** Mastery level per track (9). */
  levels: number[];
  cpMilli: number;
  energyPm: number;
  mioSize: number[];
  fieldMarshals: number;
  /** 0..3 atomic milestones reached (everyone gets it; FogModel decides what shows). */
  atomicStage: number;
  atomicStock: number;
  agency: boolean;
}
export interface WwDesignSlotData {
  kind: DesignKind;
  slot: number;
  def: DesignDef;
  origin: DesignOrigin;
  from: number;
  obsolete: boolean;
  inUse: number;
}
export interface WwOperativeData {
  uid: number;
  codename: number;
  skill: number;
  state: OperativeState;
  target: number;
  mission: IntelMission | null;
  op: number;
  daysLeft: number;
  capturePm: number;
}
export interface WwOperationData {
  uid: number;
  kind: IntelOperation;
  target: number;
  operatives: number[];
  startDay: number;
  endDay: number;
  successPm: number;
}
export interface WwProjectData6 {
  project: SpecialProject;
  facility: number;
  progressPm: number;
  daysLeft: number;
  scientist: number;
  inputPm: number;
}
export interface WwDepthDetail {
  smallID: number;
  doctrine: {
    gd: number[];
    gdLock: number[];
    sub: number[];
    subLock: number[];
    masteryMilli: number[];
    gainMilli: number[];
    /** Lane D (wave B): whole experience per domain — army, navy, air (always sent). */
    xp?: number[];
  };
  command: {
    cpMilli: number;
    cpGainMilli: number;
    spirits: number[];
    spiritLock: number[];
    medalReady: number[];
    /** Lane D (wave B): [army id, the day it may get a medal again], by army id (always sent). */
    medalCooldown?: [number, number][];
  };
  designs: WwDesignSlotData[];
  mio: {
    arch: number[];
    fundsMilli: number[];
    traits: number[];
    size: number[];
    points: number[];
    investReady: number[];
  };
  intel: {
    agency: boolean;
    upgrades: number;
    upId: number;
    upProgressPm: number;
    operatives: WwOperativeData[];
    operations: WwOperationData[];
    cryptoTarget: number;
    cryptoPm: number;
    cipher: number;
    decrypt: number;
    /** Every finished decryption (own or a sharer's, spec §8.7); activeUntil −1 when not exploiting. */
    decrypted: { target: number; activeUntil: number }[];
    networks: [number, number][];
    // Lane I for lane U3 (wave B notes): what the intel drawer cannot rebuild.
    /** [target, domain bits (1 << ID_ARMY, ID_NAVY, ID_AIR)] of finished infiltrations. */
    infiltrated?: [number, number][];
    /** The level lines [target, domain, key of ww1936.intel.src.<key>, value]; they add up to the level. */
    levelParts?: [number, number, string, number][];
    /** [target, counter-intelligence in half units] where not 0 (plan decision 18). */
    targetCounter?: [number, number][];
    /** Who exploited our codes, by the day the exploitation ended (we learn only then). */
    decryptLog?: { target: number; day: number }[];
    /** Days to break the current target at today's pace; −1 none. */
    cryptoDaysLeft?: number;
    /** [land strategic region, side, recon sorties] of my side's last day (W2's reconBySide). */
    reconSorties?: [number, number, number][];
    /** The land strategic regions my radar reaches (spec §8.8 air line). */
    radarSr?: number[];
  };
  projects: {
    running: WwProjectData6[];
    done: number;
    scientists: { id: number; spec: number; skill: number; project: number }[];
    facilities: [number, number][];
  };
  market: {
    licencesIn: number[];
    licencesOut: number[];
    deals: number[];
    listings: number[];
  };
  mech: {
    cfocus: number;
    cfocusLock: number;
    cfocusOpen: boolean;
    congressBp: number;
    bop: number;
    bopBand: number;
    treatyMember: boolean;
  };
  energy: {
    demand: number;
    /** Coal units that go to the energy (× ENERGY_PER_COAL; the refineries' share is out). */
    coal: number;
    /** Hydro units of the controlled regions (× ENERGY_PER_HYDRO). */
    hydro: number;
    /** Working power plants (× ENERGY_PER_PLANT). */
    plants: number;
    /** Energy of the standing dams controlled (DAM_ENERGY, added as it is). */
    dams: number;
    ratioPm: number;
    /** Lane W1: the content's energy (added as it is). */
    extra: number;
    /** Lane W1 (controller ruling): the domestic base, controlled regions with infrastructure (added as it is). */
    base: number;
    /** The `energyPct` stat (more output from the whole supply); absent: 0. */
    pct?: number;
    /** Lane W1: the day's coal and uranium (output less exports plus imports; P1 keeps no pile). */
    coalStock: number;
    uraniumStock: number;
  };
}
export interface WwListingData {
  id: number;
  seller: number;
  key: number;
  design: DesignDef | null;
  count: number;
  priceMilli: number;
}
export interface WwDealData {
  id: number;
  buyer: number;
  seller: number;
  key: number;
  count: number;
  civs: number;
  paidPm: number;
  deliveredPm: number;
  endDay: number;
}
export interface WwLicenceData {
  id: number;
  from: number;
  to: number;
  key: number;
  ship: boolean;
  slot: number;
  sinceDay: number;
}
export interface WwArmyGroupData {
  id: number;
  owner: number;
  fm: number;
  armies: number[];
}
export interface WwDepthFx {
  kind: "nuke" | "nuke_intercepted" | "rocket" | "raid" | "dam";
  region: number;
  from: number;
  owner: number;
  tick: number;
}
export interface WwDepthWorld {
  /** [region, until day] lists, changed entries only after the first tick. */
  nuked: [number, number][];
  flooded: [number, number][];
  scorched: [number, number][];
  harbors: [number, number, number][];
  damLevel: number[];
}
export interface WwDepthData {
  countries?: WwDepthSummary[];
  details?: WwDepthDetail[];
  /** Observer rows (cap × 4 bytes) of human-controlled observers, on changed days. */
  intel?: { observer: number; row: number[] }[];
  designsOf?: {
    smallID: number;
    kind: DesignKind;
    slot: number;
    def: DesignDef | null;
  }[];
  armyGroups?: WwArmyGroupData[];
  market?: {
    listings: WwListingData[];
    deals: WwDealData[];
    licences: WwLicenceData[];
    embargoes: [number, number][];
    pendingLicences: {
      id: number;
      from: number;
      to: number;
      key: number;
      deadlineTick: number;
    }[];
  };
  mines?: [number, number, number][];
  aces?: { id: number; owner: number; deployment: number; callNo: number }[];
  world?: WwDepthWorld;
  congressBp?: number;
  /** T1b (spec §13.1): the US congress lets lend-lease through now (50% or the lend_lease flag; true without a US). */
  congressLl?: boolean;
  bop?: [number, number][];
  treaty?: { members: number[]; escalated: boolean; endDay: number };
  factionRules?: [number, number, boolean][];
  factionGoals?: [number, number[], number][];
  fx: WwDepthFx[];
  news: { id: string; params: Record<string, string | number> }[];
}
