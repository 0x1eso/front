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
  // P6 (P6 spec §16.2), appended.
  "uranium",
  "coal",
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
  // P4 (P4 spec §12.1)
  "naval_base",
  "air_base",
  "anti_air",
  "radar",
  "coastal_fort",
  "synthetic_refinery",
  "fuel_silo",
  // P6 (P6 spec §9.1, §16.2, §16.4), appended.
  "facility_nuclear",
  "facility_rocket",
  "facility_science",
  "rocket_site",
  "power_plant",
  "dam",
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
  naval_base: 2_500,
  air_base: 1_800,
  anti_air: 1_500,
  radar: 3_000,
  coastal_fort: 2_500,
  synthetic_refinery: 12_000,
  fuel_silo: 2_500,
  facility_nuclear: 15_000,
  facility_rocket: 8_000,
  facility_science: 6_000,
  rocket_site: 2_500,
  power_plant: 5_000,
  // P6 spec §16.4: a dam is only ever repaired (scenario dams at level 0).
  dam: 6_000,
};
/** What can be built (P4 spec §5.1: dockyards from now on). */
export const BUILDABLE: readonly BuildingId[] = [
  "civ",
  "mil",
  "dock",
  "infra",
  "fort",
  "rail",
  "supply_hub",
  "naval_base",
  "air_base",
  "anti_air",
  "radar",
  "coastal_fort",
  "synthetic_refinery",
  "fuel_silo",
  // P6 (plan Task 1 Step 2): the rest of their rules are depthBuildBlock's.
  "facility_nuclear",
  "facility_rocket",
  "facility_science",
  "rocket_site",
  "power_plant",
  "dam",
];
export const MAX_INFRA = 5;
/** Buildings that are a level of the region, not a slot (P2 plan decision 10). */
export const LEVEL_BUILDINGS: readonly BuildingId[] = [
  "infra",
  "fort",
  "rail",
  "supply_hub",
  // P4 (P4 spec §12.1): no slot, built in occupied regions too.
  "naval_base",
  "air_base",
  "anti_air",
  "radar",
  "coastal_fort",
  // P6 (spec §9.1, §16.4): no slot.
  "rocket_site",
  "dam",
];
/** Highest level of each level building. */
export const LEVEL_MAX: Readonly<Partial<Record<BuildingId, number>>> = {
  infra: 5,
  fort: 5,
  rail: 5,
  supply_hub: 1,
  naval_base: 10,
  air_base: 10,
  anti_air: 5,
  radar: 3,
  coastal_fort: 5,
  // P6 (spec §9.1, §16.4).
  rocket_site: 3,
  dam: 1,
};
/**
 * P6 (spec §9.1, §16.2): slot buildings with a cap per region (a power
 * plant takes one shared slot a level, at most 3; a facility one, at most 1).
 */
export const SLOT_BUILDING_MAX: Readonly<Partial<Record<BuildingId, number>>> =
  {
    facility_nuclear: 1,
    facility_rocket: 1,
    facility_science: 1,
    power_plant: 3,
  };
/**
 * Buildings that need a coast (P4 spec §5.1, §12.1): a dockyard a coastal
 * region, a naval base and a coastal fort a harbor zone (spec §3.5).
 */
export const COASTAL_BUILDINGS: readonly BuildingId[] = [
  "dock",
  "naval_base",
  "coastal_fort",
];
/** The tech a building needs (P4 spec §12.1); the radar's third level needs radar_2. */
export const BUILDING_TECH: Readonly<Partial<Record<BuildingId, WwTechId>>> = {
  anti_air: "anti_air_1",
  radar: "radar_1",
  synthetic_refinery: "synthetic_oil_1",
  // P6 (spec §9.1).
  facility_nuclear: "nuclear_physics",
  facility_rocket: "rocketry_1",
  facility_science: "electronics_1",
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
  // P4 (P4 spec §12.2, §5.3): aircraft and the convoy (plan decision 14).
  "heavy_fighter",
  "cas",
  "naval_bomber",
  "strat_bomber",
  "transport_plane",
  "cv_fighter",
  "cv_cas",
  "cv_naval_bomber",
  "convoy",
  // P6 (plan decision 5): design slots (gen = slot), then the specials.
  "tank_design",
  "plane_design",
  "railway_gun",
  "floating_harbor",
  "flying_bomb",
  "ballistic_rocket",
  "atomic_bomb",
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
export const EQUIPMENT_FAMILIES = [
  "infantry",
  "guns",
  "vehicles",
  "aircraft",
  // P4: the convoy, built on naval lines only.
  "naval",
  // P6: the atomic bomb (facilities make it).
  "special",
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
  heavy_fighter: 3,
  cas: 3,
  naval_bomber: 3,
  strat_bomber: 3,
  transport_plane: 1,
  cv_fighter: 3,
  cv_cas: 3,
  cv_naval_bomber: 3,
  convoy: 1,
  tank_design: 12,
  plane_design: 16,
  railway_gun: 1,
  floating_harbor: 1,
  flying_bomb: 1,
  ballistic_rocket: 1,
  atomic_bomb: 1,
};

/** Stockpile slots: one per (type, generation), in EQUIPMENT_TYPES order. */
export const EQUIP_KEYS: readonly (readonly [EquipmentType, number])[] =
  EQUIPMENT_TYPES.flatMap((type) =>
    Array.from(
      { length: EQUIPMENT_GENS[type] },
      (_, i) => [type, i + 1] as const,
    ),
  );
export const EQUIP_KEY_COUNT = EQUIP_KEYS.length; // 23 before P4, 46 with it, 79 with P6

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
  // P4 (P4 spec §4.3)
  "naval",
  // Research overhaul (changes §2.1), appended: the support companies.
  "support",
] as const;
export type TechBranch = (typeof TECH_BRANCHES)[number];
/**
 * Research overhaul (changes §2.1): the research screen's ten tabs, in
 * screen order. A tech's tab is its branch ("electronics" is shown as
 * engineering); "doctrine" shows the mastery summary and "projects" the
 * special projects, neither holds a researchable tech.
 */
export const TECH_TABS = [
  "infantry",
  "support",
  "armour",
  "artillery",
  "naval",
  "air",
  "electronics",
  "industry",
  "doctrine",
  "projects",
] as const;
export type TechTab = (typeof TECH_TABS)[number];
/**
 * Research overhaul (changes §6 idea 1): the auto-research leanings, one
 * byte of a human country's state (CountryEconomy.researchLean).
 */
export const RESEARCH_LEANS = [
  "balanced",
  "army",
  "navy",
  "air",
  "industry",
] as const;
export type ResearchLean = (typeof RESEARCH_LEANS)[number];
/**
 * Research grants (changes §6 idea 3): PP for one temporary research
 * bonus on a branch (a ResearchBonus the next tech of the branch takes).
 */
export const WW_RESEARCH_GRANT = { pp: 40, pct: 50, uses: 1 } as const;
export const DOCTRINE_SCHOOLS = [
  "mobile",
  "firepower",
  "battleplan",
  "mass",
  // P4 (plan decision 23): three sea and three air schools.
  "fleet_in_being",
  "trade_interdiction",
  "base_strike",
  "strategic_destruction",
  "battlefield_support",
  "operational_integrity",
] as const;
export type DoctrineSchool = (typeof DOCTRINE_SCHOOLS)[number];
/** Plan decision 23: one school a domain (land, sea, air). */
export const DOCTRINE_DOMAIN: Readonly<
  Record<DoctrineSchool, "land" | "sea" | "air">
> = {
  mobile: "land",
  firepower: "land",
  battleplan: "land",
  mass: "land",
  fleet_in_being: "sea",
  trade_interdiction: "sea",
  base_strike: "sea",
  strategic_destruction: "air",
  battlefield_support: "air",
  operational_integrity: "air",
};

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
  // P4 (P4 spec §4.3, §12.3), appended.
  "dd_2",
  "dd_3",
  "dd_4",
  "cl_2",
  "cl_3",
  "cl_4",
  "ca_2",
  "ca_3",
  "bc_2",
  "bc_3",
  "bb_2",
  "bb_3",
  "bb_4",
  "cv_2",
  "cv_3",
  "cv_4",
  "ss_2",
  "ss_3",
  "ss_4",
  "sonar_1",
  "sonar_2",
  "fire_control_1",
  "torpedo_1",
  "naval_radar_1",
  "landing_craft_1",
  "landing_craft_2",
  "fleet_in_being_1",
  "fleet_in_being_2",
  "trade_interdiction_1",
  "trade_interdiction_2",
  "base_strike_1",
  "base_strike_2",
  "heavy_fighter_1",
  "heavy_fighter_2",
  "heavy_fighter_3",
  "cas_1",
  "cas_2",
  "cas_3",
  "naval_bomber_1",
  "naval_bomber_2",
  "naval_bomber_3",
  "strat_bomber_1",
  "strat_bomber_2",
  "strat_bomber_3",
  "transport_plane_1",
  "carrier_aviation",
  "strategic_destruction_1",
  "strategic_destruction_2",
  "battlefield_support_1",
  "battlefield_support_2",
  "operational_integrity_1",
  "operational_integrity_2",
  "radar_1",
  "radar_2",
  "synthetic_oil_1",
  "synthetic_oil_2",
  // P5 (P5 spec §8.5), appended: the military police company.
  "military_police",
  // P6 (P6 spec §5.2.5 then §5.7 order), appended.
  "heavy_tank_1",
  "heavy_tank_2",
  "heavy_tank_3",
  "tank_gun_2",
  "tank_gun_3",
  "cast_armor",
  "diesel_engine",
  "torsion_bar",
  "tank_radio",
  "sloped_armor",
  "interleaved_wheels",
  "amphibious_drive",
  "flame_tank",
  "dual_purpose_guns",
  "naval_radar_2",
  "armored_deck",
  "mine_warfare_1",
  "snorkel",
  "super_heavy_battleship",
  "floating_harbor_1",
  "aircraft_cannon_1",
  "aircraft_cannon_2",
  "self_sealing_tanks",
  "drop_tanks",
  "bomb_sight_1",
  "air_rockets_1",
  "air_radar_1",
  "railway_gun_1",
  "cryptography_1",
  "cryptography_2",
  "cryptography_3",
  "nuclear_physics",
  "rocketry_1",
  // Research overhaul (changes §2.3), appended in tab order: infantry,
  // support, armour, artillery, naval, air, engineering, industry.
  "inf_imp_1",
  "support_imp_1",
  "winter_gear_1",
  "motorized_2",
  "desert_gear_1",
  "inf_imp_2",
  "marines_2",
  "inf_at_1",
  "para_2",
  "motorized_3",
  "inf_at_2",
  "inf_imp_3",
  "reinforce_1",
  "engineer_2",
  "recon_2",
  "field_maintenance",
  "logistics_2",
  "mp_2",
  "hospital_2",
  "signal_2",
  "engineer_3",
  "recon_3",
  "logistics_3",
  "tank_reliability_1",
  "armor_plate_2",
  "tank_engine_2",
  "armor_coordination",
  "tank_reliability_2",
  "armor_plate_3",
  "tank_engine_3",
  "tank_gun_4",
  "super_heavy_tank",
  "modern_tank_1",
  "art_imp_1",
  "art_towing",
  "at_imp_1",
  "aa_imp_1",
  "art_imp_2",
  "fire_direction",
  "at_imp_2",
  "aa_imp_2",
  "art_imp_3",
  "at_imp_3",
  "aa_imp_3",
  "naval_aa_1",
  "damage_control_1",
  "naval_engine_2",
  "convoy_escort_1",
  "torpedo_2",
  "depth_charge_2",
  "mine_warfare_2",
  "transport_ship_2",
  "fire_control_2",
  "naval_aa_2",
  "damage_control_2",
  "naval_engine_3",
  "hedgehog",
  "convoy_escort_2",
  "carrier_deck_2",
  "torpedo_3",
  "aero_engine_2",
  "air_armor_1",
  "naval_strike_1",
  "long_range_1",
  "transport_plane_2",
  "air_ground_control",
  "carrier_aviation_2",
  "aero_engine_3",
  "bomb_sight_2",
  "naval_strike_2",
  "aero_engine_4",
  "air_rockets_2",
  "air_radar_2",
  "jet_airframe_2",
  "jet_bomber_1",
  "radio_1",
  "encryption_1",
  "radio_2",
  "encryption_2",
  "rocketry_2",
  "operations_research",
  "radar_3",
  "computing_3",
  "electronic_warfare",
  "cryptography_4",
  "computing_4",
  "nuclear_reactor",
  "concentrated_1",
  "dispersed_1",
  "fuel_storage_1",
  "fuel_refining_1",
  "energy_grid_1",
  "dockyard_1",
  "fortification_2",
  "synthetic_rubber_1",
  "concentrated_2",
  "dispersed_2",
  "rail_2",
  "fuel_refining_2",
  "energy_grid_2",
  "dockyard_2",
  "construction_4",
  "excavation_3",
  "fortification_3",
  "concentrated_3",
  "dispersed_3",
  "tools_5",
  "construction_5",
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
 * Research slots (research overhaul changes §1): a country's start slots
 * (EconomyStart.startResearchSlots) plus the research_slot effects of its
 * focuses and decisions, never more than this. The cap also sizes
 * cancel_research's slot field: changing it moves the zbin layout.
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
  // P4 (P4 spec §19.3), appended; bad_zone: not a strategic region or sea zone.
  "no_fleet",
  "fleet_busy",
  "fleet_full",
  "too_many_fleets",
  "no_sea_path",
  "out_of_range",
  "lake",
  "canal_closed",
  "not_coastal",
  "no_naval_base",
  "no_dock",
  "bad_ship_class",
  "line_full",
  "admiral_unavailable",
  "no_convoys",
  "invasion_too_large",
  "invasion_not_ready",
  "naval_supremacy_low",
  "not_in_port",
  "no_air_base",
  "base_full",
  "no_planes",
  "bad_air_mission",
  "no_transport_planes",
  "air_superiority_low",
  "too_many_deployments",
  // P6 pre-flight: engine-lib NoStrike. Unused: the list was abolished
  // 2026-10-31 (append-only: the entry stays for the wire and the hash).
  "no_strike_region",
  "bad_zone",
  // P5 (P5 spec §21.3, plan decision 36), appended.
  "not_participant",
  "conference_closed",
  "too_many_demands",
  "bad_demand",
  "law_locked",
  "not_integrable",
  "ll_conditions",
  "ll_limit",
  "volunteer_conditions",
  "volunteer_limit",
  "not_volunteer",
  "ships_not_owned",
  "no_takeover",
  "disarmed",
  "subject_restricted",
  // P6 (P6 spec §21.4), appended ("no_civs" and "no_xp" exist since P1/P2).
  "no_cp",
  "doctrine_locked",
  "trait_unavailable",
  "fm_limit",
  "group_full",
  "design_slots_full",
  "module_locked",
  "module_bad_slot",
  "bad_base",
  "treaty_limit",
  "design_in_use",
  "not_refittable",
  "no_agency",
  "no_operative",
  "network_low",
  "op_unavailable",
  "no_crypto_target",
  "not_decrypted",
  "no_facility",
  "project_locked",
  "no_atomic",
  "nuke_conditions",
  "out_of_rocket_range",
  "raid_conditions",
  "embargoed",
  "licence_exists",
  "listing_bad",
  "cfocus_locked",
  "faction_leader_only",
  "scorch_conditions",
  "harbor_conditions",
  "railgun_limit",
  // White peace (EndgameTypes.WHITE_PEACE_ORDER_KINDS), appended.
  "peace_too_early",
  "peace_cooldown",
  "peace_war_kind",
  "peace_pending",
  "peace_no_offer",
  // Easy naval invasions (owner brief 2026-10-30), appended: no port of our
  // side the landing force can reach over land.
  "no_invasion_port",
  // Negotiated peace (owner request 2026-10-30), appended: terms the giver
  // can't give, its capital, more than 40% of its victory points, and the
  // Korea / Taiwan rules. Those last two (zone_only, claim_only) are unused:
  // abolished 2026-10-31 (append-only: they stay for the wire and the hash).
  "peace_bad_terms",
  "peace_capital",
  "peace_too_much",
  "zone_only",
  "claim_only",
  // Research overhaul (changes §2.4, §2.5), appended: the other line of an
  // either/or pair is researched or running; the special project a tech
  // follows is not finished.
  "exclusive",
  "no_project",
  // Research grants, appended: the branch already holds a bonus.
  "bonus_held",
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
  /** P4 spec §15.4: yesterday's fuel ratio ‰ (the fuel band, enemy fleets' fuel dots). */
  fuelRatioPm: number;
  /** P6 spec §16.2: yesterday's energy ratio ‰ (1000: enough). */
  energyPm: number;
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
  /** The research bonus % this slot holds (absent: none). */
  bonusPct?: number;
}

export interface WwTradeData {
  id: number;
  buyer: number;
  seller: number;
  resource: ResourceId;
  civs: number;
  /** Units a day it moves (the last factory may buy fewer than 8). */
  units: number;
}

export interface WwResourceRow {
  produced: number;
  exported: number;
  imported: number;
  used: number;
}

/** WwCountryDetail.slotHint: a focus or a decision that gives a research slot. */
export interface WwSlotHint {
  kind: "focus" | "decision";
  /** The FocusId or DecisionId. */
  id: string;
  /** It can be started or taken now (the yellow dot); false: the next one, not yet. */
  ready: boolean;
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
  /** Partial progress of techs that left a slot unfinished; absent when none. */
  savedResearch?: WwSlotData[];
  /**
   * Research speed % from the country's stats per TECH_BRANCHES order
   * (researchPct + the branch's rs*Pct: techs, spirits, advisors, focus).
   */
  researchBranchPct: number[];
  /** Faction shared research % of techs not yet researched; only non-zero ones. */
  sharedResearch?: [WwTechId, number][];
  /**
   * Research overhaul R1: where the slots come from — the start slots and
   * the research_slot effects of focuses and of decisions (slotCount is
   * their sum, capped at WW_MAX_SLOTS).
   */
  slotSources?: {
    start: number;
    focus: number;
    decision: number;
    /** The most it can reach: start + its tree's slot focuses + the decision, ≤ WW_MAX_SLOTS. */
    max: number;
  };
  /**
   * Research overhaul R1 (the slot chip's yellow dot): the next source of
   * a research slot and whether it can be taken now; absent when the slots
   * are at the cap or no source is left. Auto-research never takes it.
   */
  slotHint?: WwSlotHint;
  /** RESEARCH_LEANS index of the auto-research leaning; absent: balanced (0). */
  researchLean?: number;
  /** Bit i: SPECIAL_PROJECTS[i] finished (the project gate of researchBlockOf). */
  projectsDone?: number;
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
  /** P4 spec §15: fuel milli, its capacity, yesterday's gain and use (land, navy, air). */
  fuelMilli: number;
  fuelCapMilli: number;
  fuelGainMilli: number;
  fuelUseMilli: [number, number, number];
  refineries: number;
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
  /** P4 buildings (P4 spec §12.1). */
  navalBase: number;
  airBase: number;
  aa: number;
  radar: number;
  coastalFort: number;
  refinery: number;
  silo: number;
  /** Bomb damage milli, BUILDING_IDS order; empty when undamaged (P4 spec §14.8). */
  damage: number[];
  /** P6 (scenario v5, spec §16.1–§16.4): deposits, hydro, the depth buildings and the dam. */
  coal: number;
  uranium: number;
  hydro: number;
  /** FACILITY_IDS index + 1 of the region's facility, 0: none. */
  facility: number;
  rocketSite: number;
  powerPlant: number;
  /** DAMS index + 1 of the region's dam, 0: none. */
  dam: number;
  damLevel: number;
  /**
   * P4 lane U: the repair of the building being mended (the first damaged
   * one, BUILDING_IDS order), ‰ of its next whole building; absent when
   * undamaged.
   */
  repairPm?: number;
}

export interface WwEconomyData {
  countries: WwCountrySummary[];
  details: WwCountryDetail[];
  regions: WwRegionData[];
}
