// World War 1936 P1 — industry and research
// (docs/superpowers/specs/2026-10-20-ww1936-p1-industry-design.md).
// zbin and snapshots store these lists by position: append only.

export const RESOURCE_IDS = [
  "oil",
  "aluminium",
  "rubber",
  "tungsten",
  "steel",
  "chromium",
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export const RESOURCE_COUNT = RESOURCE_IDS.length;

export const REGION_CATEGORIES = [
  "wasteland",
  "pastoral",
  "rural",
  "town",
  "large_town",
  "city",
  "large_city",
  "metropolis",
  "megalopolis",
] as const;
export type RegionCategory = (typeof REGION_CATEGORIES)[number];

/** Shared building slots per category (spec §3.3). */
export const CATEGORY_SLOTS: Readonly<Record<RegionCategory, number>> = {
  wasteland: 0,
  pastoral: 1,
  rural: 2,
  town: 4,
  large_town: 5,
  city: 6,
  large_city: 8,
  metropolis: 10,
  megalopolis: 12,
};

export const BUILDING_IDS = [
  "civ",
  "mil",
  "dock",
  "infra",
  "fort",
  "rail",
  "supply_hub",
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];
/** Construction points per building (spec §4.1; P2 spec §11.7). */
export const BUILDING_COST: Readonly<Record<BuildingId, number>> = {
  civ: 10_800,
  mil: 7_200,
  dock: 6_400,
  infra: 4_500,
  fort: 4_000,
  rail: 3_000,
  supply_hub: 6_000,
};
/** What can be built; dockyards wait for P4 (spec §4.1). */
export const BUILDABLE: readonly BuildingId[] = [
  "civ",
  "mil",
  "infra",
  "fort",
  "rail",
  "supply_hub",
];
export const MAX_INFRA = 5;
/** Buildings that are a level of the region, not a slot (P2 plan decision 10). */
export const LEVEL_BUILDINGS: readonly BuildingId[] = [
  "infra",
  "fort",
  "rail",
  "supply_hub",
];
/** Highest level of each level building. */
export const LEVEL_MAX: Readonly<Partial<Record<BuildingId, number>>> = {
  infra: 5,
  fort: 5,
  rail: 5,
  supply_hub: 1,
};

export const EQUIPMENT_TYPES = [
  "infantry_equipment",
  "support_equipment",
  "artillery",
  "anti_tank",
  "anti_air",
  "motorized",
  "light_tank",
  "medium_tank",
  "fighter",
  "bomber",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
export const EQUIPMENT_FAMILIES = [
  "infantry",
  "guns",
  "vehicles",
  "aircraft",
] as const;
export type EquipmentFamily = (typeof EQUIPMENT_FAMILIES)[number];

/** Generations per type (spec §8.1). */
export const EQUIPMENT_GENS: Readonly<Record<EquipmentType, number>> = {
  infantry_equipment: 3,
  support_equipment: 2,
  artillery: 3,
  anti_tank: 2,
  anti_air: 2,
  motorized: 1,
  light_tank: 2,
  medium_tank: 3,
  fighter: 3,
  bomber: 2,
};

/** Stockpile slots: one per (type, generation), in EQUIPMENT_TYPES order. */
export const EQUIP_KEYS: readonly (readonly [EquipmentType, number])[] =
  EQUIPMENT_TYPES.flatMap((type) =>
    Array.from(
      { length: EQUIPMENT_GENS[type] },
      (_, i) => [type, i + 1] as const,
    ),
  );
export const EQUIP_KEY_COUNT = EQUIP_KEYS.length; // 23

const KEY_BASE: ReadonlyMap<EquipmentType, number> = (() => {
  const m = new Map<EquipmentType, number>();
  let i = 0;
  for (const t of EQUIPMENT_TYPES) {
    m.set(t, i);
    i += EQUIPMENT_GENS[t];
  }
  return m;
})();

/** The stock index of (type, gen); -1 when the generation does not exist. */
export function equipKey(type: EquipmentType, gen: number): number {
  if (!Number.isInteger(gen) || gen < 1 || gen > EQUIPMENT_GENS[type]) {
    return -1;
  }
  return KEY_BASE.get(type)! + gen - 1;
}

export const ECONOMY_LAWS = [
  "civilian",
  "early_mobilization",
  "partial_mobilization",
  "war_economy",
  "total_mobilization",
] as const;
export const TRADE_LAWS = [
  "free_trade",
  "export_focus",
  "limited_exports",
  "closed_economy",
] as const;
export const CONSCRIPTION_LAWS = [
  "disarmed",
  "volunteer",
  "limited",
  "extensive",
  "service",
  "all_adults",
  "scraping",
] as const;
export type EconomyLaw = (typeof ECONOMY_LAWS)[number];
export type TradeLaw = (typeof TRADE_LAWS)[number];
export type ConscriptionLaw = (typeof CONSCRIPTION_LAWS)[number];
export const LAW_KINDS = ["economy", "trade", "conscription"] as const;
export type LawKind = (typeof LAW_KINDS)[number];
export const LAW_VALUES = [
  ...ECONOMY_LAWS,
  ...TRADE_LAWS,
  ...CONSCRIPTION_LAWS,
] as const;
export type LawValue = (typeof LAW_VALUES)[number];
export const LAW_LADDERS: Readonly<Record<LawKind, readonly LawValue[]>> = {
  economy: ECONOMY_LAWS,
  trade: TRADE_LAWS,
  conscription: CONSCRIPTION_LAWS,
};
export interface CountryLaws {
  economy: EconomyLaw;
  trade: TradeLaw;
  conscription: ConscriptionLaw;
}

export const TECH_BRANCHES = [
  "infantry",
  "artillery",
  "armour",
  "air",
  "industry",
  "electronics",
  "doctrine",
] as const;
export type TechBranch = (typeof TECH_BRANCHES)[number];
export const DOCTRINE_SCHOOLS = [
  "mobile",
  "firepower",
  "battleplan",
  "mass",
] as const;
export type DoctrineSchool = (typeof DOCTRINE_SCHOOLS)[number];

export const WW_TECH_IDS = [
  "inf_eq_1",
  "inf_eq_2",
  "inf_eq_3",
  "support_eq_1",
  "support_eq_2",
  "motorized_1",
  "artillery_1",
  "artillery_2",
  "artillery_3",
  "anti_tank_1",
  "anti_tank_2",
  "anti_air_1",
  "anti_air_2",
  "light_tank_1",
  "light_tank_2",
  "medium_tank_1",
  "medium_tank_2",
  "medium_tank_3",
  "fighter_1",
  "fighter_2",
  "fighter_3",
  "bomber_1",
  "bomber_2",
  "construction_1",
  "construction_2",
  "construction_3",
  "tools_1",
  "tools_2",
  "tools_3",
  "tools_4",
  "output_1",
  "output_2",
  "excavation_1",
  "excavation_2",
  "flexible_line",
  "electronics_1",
  "computing_1",
  "computing_2",
  "mobile_1",
  "mobile_2",
  "firepower_1",
  "firepower_2",
  "battleplan_1",
  "battleplan_2",
  "mass_1",
  "mass_2",
  // P2 (P2 spec §4.6), appended.
  "engineer_company",
  "recon_company",
  "mountaineers",
  "marines",
  "field_hospital",
  "logistics_company",
  "signal_company",
  "paratroopers",
  "fortification_1",
  "rail_1",
] as const;
export type WwTechId = (typeof WW_TECH_IDS)[number];

// Limits and constants (spec §4–§10).
export const WW_DAY_SPLIT = 7;
export const WW_MAX_QUEUE = 30;
export const WW_MAX_PROJECT_COUNT = 10;
export const WW_MAX_CIVS_PER_PROJECT = 15;
/** Construction points a civilian factory gives a day. */
export const WW_CIV_OUTPUT = 5;
/** Industry milli-points a military factory gives a day at 100%. */
export const WW_MIL_OUTPUT_MILLI = 4_500;
export const WW_MAX_LINES = 20;
export const WW_MAX_LINE_FACTORIES = 500;
export const WW_MAX_TRADES = 20;
export const WW_MAX_TRADE_CIVS = 50;
export const WW_TRADE_UNITS_PER_CIV = 8;
/**
 * Research slots (P3 spec §1.4, §26.4-9): factories give at most 5
 * (researchSlotCount); the sixth comes only from the research_slot effect.
 */
export const WW_MAX_SLOTS = 6;
export const WW_LAW_COOLDOWN_DAYS = 30;
export const WW_AI_PERIOD_DAYS = 10;
export const WW_MEN_PER_INF_EQUIPMENT = 10;

/** Why an order is refused (UI text ww1936.econ.block.<id>). */
export const WW_ORDER_BLOCKS = [
  "dead",
  "not_controlled",
  "occupied",
  "not_buildable",
  "no_slots",
  "infra_max",
  "queue_full",
  "bad_index",
  "law_kind",
  "law_same",
  "law_condition",
  "law_cooldown",
  "no_tech",
  "lines_full",
  "bad_line",
  "no_partner",
  "no_room",
  "trades_full",
  "no_civs",
  "researched",
  "in_progress",
  "prereq",
  "doctrine",
  "no_slot",
  "bad_slot",
  // P2 (P2 spec §16.3), appended; bad_region: not a land region.
  "no_army",
  "army_busy",
  "no_path",
  "not_adjacent",
  "not_at_war",
  "army_full",
  "no_xp",
  "bad_template",
  "special_cap",
  "no_rail",
  "no_port",
  "para_range",
  "para_cooldown",
  "template_in_use",
  "too_many_templates",
  "too_many_armies",
  "general_unavailable",
  "bad_region",
  // P3 (P3 spec §22.3, plan decision 3), appended.
  "no_pp",
  "focus_busy",
  "focus_done",
  "focus_prereq",
  "focus_exclusive",
  "focus_unavailable",
  "slot_locked",
  "advisor_unavailable",
  "decision_unavailable",
  "decision_cooldown",
  "no_event",
  "bad_option",
  "justify_busy",
  "justify_blocked",
  "law_ws",
  "law_tension",
  "law_ideology",
  "faction_rule",
  "faction_war",
  "treaty_exists",
  "nap_young",
  "tension_gate",
  "bad_target",
  "focus_none",
] as const;
export type WwOrderBlock = (typeof WW_ORDER_BLOCKS)[number];

// ---- What the screens read (GameUpdateType.WwEconomy) ----

/** Every processed country, every day. */
export interface WwCountrySummary {
  smallID: number;
  civ: number;
  mil: number;
  dock: number;
  idleMil: number;
  freeCivMilli: number;
  manpower: number;
  recruitable: number;
  /** The men in the field divisions (the P2 troop mirror; replays read it). */
  troopCap: number;
  researchedCount: number;
  /** A working line lacks a resource. */
  shortage: boolean;
  /** Units a day still for sale, RESOURCE_IDS order (spec §7.4). */
  exportRoom: number[];
  /**
   * Its techs' bonus to building slots, percent: a region it controls has
   * regionSlots(category, slotPct) slots (spec §4.2), whoever plays it.
   */
  slotPct: number;
}

export interface WwProjectData {
  region: number;
  building: BuildingId;
  count: number;
  progressMilli: number;
  costMilli: number;
  assignedMilli: number;
  speedPct: number;
}

export interface WwLineData {
  id: number;
  equipment: EquipmentType;
  gen: number;
  factories: number;
  active: number;
  effBp: number;
  progressMilli: number;
  costMilli: number;
  fill: number;
  outputMilli: number;
}

export interface WwSlotData {
  tech: WwTechId;
  progressMilli: number;
  totalMilli: number;
}

export interface WwTradeData {
  id: number;
  buyer: number;
  seller: number;
  resource: ResourceId;
  civs: number;
}

export interface WwResourceRow {
  produced: number;
  exported: number;
  imported: number;
  used: number;
}

/** Human countries only, on the days they are processed or ordered. */
export interface WwCountryDetail {
  smallID: number;
  laws: CountryLaws;
  lawCooldownUntil: Record<LawKind, number>;
  queue: WwProjectData[];
  lines: WwLineData[];
  slotCount: number;
  slots: (WwSlotData | null)[];
  researched: WwTechId[];
  buying: WwTradeData[];
  selling: WwTradeData[];
  /** EQUIP_KEYS order. */
  stock: number[];
  /** RESOURCE_IDS order. */
  resources: WwResourceRow[];
  consumerGoodsMilli: number;
  paidCivs: number;
  receivedCivs: number;
  effCapBp: number;
  /** Days of the longest running war; -1 at peace. */
  warDays: number;
  /**
   * The countries it may buy from now (the engine's partnerJudge: alive,
   * no war, no embargo from the seller, a route), smallIDs ascending.
   */
  tradePartners: number[];
}

export interface WwRegionData {
  id: number;
  controller: number;
  civ: number;
  mil: number;
  dock: number;
  infra: number;
  /** P2 level buildings (plan decision 10). */
  fort: number;
  rail: number;
  hub: number;
  /**
   * P3 (spec §10.4 `resource`): the deposit bonus, RESOURCE_IDS order;
   * absent when the region has none.
   */
  res?: number[];
}

export interface WwEconomyData {
  countries: WwCountrySummary[];
  details: WwCountryDetail[];
  regions: WwRegionData[];
}
