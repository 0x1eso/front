// World War 1936 P1 (spec §13): what the economy screens draw, as plain
// data from the view (WwEconomyView) and the scenario. No Lit here: the
// screens render it and the tests read it. Every judgement that blocks a
// button is the engine's own function from engine-lib (EconomyChecks,
// EconomyRules, WwLaws), fed with the view's copy of the data (plan
// decision 3, pre-flight U8).
import type { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BuildingId,
  DoctrineSchool,
  EconomyLaw,
  equipKey,
  EQUIPMENT_GENS,
  EQUIPMENT_TYPES,
  EquipmentType,
  LAW_LADDERS,
  LawKind,
  LawValue,
  LEVEL_MAX,
  MAX_INFRA,
  RegionCategory,
  RESOURCE_IDS,
  ResourceId,
  TechBranch,
  TradeLaw,
  WW_MAX_PROJECT_COUNT,
  WW_MAX_QUEUE,
  WW_MAX_TRADE_CIVS,
  WW_TECH_IDS,
  WW_TRADE_UNITS_PER_CIV,
  WwCountryDetail,
  WwCountrySummary,
  WwLineData,
  WwOrderBlock,
  WwTechId,
  WwTradeData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BATTALION_IDS,
  SUPPORT_IDS,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_STAT_KEYS,
  WwStatKey,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { renderNumber } from "@openfront/engine-lib/Format";
import { BATTALIONS, SUPPORTS } from "@openfront/engine-lib/ww1936/Battalions";
import { dayIndex } from "@openfront/engine-lib/ww1936/Calendar";
import {
  addLineBlockOf,
  buildBlockOf,
  BuildCheck,
  equipmentTechBlock,
  lawBlockOf,
  openTradeBlockOf,
  payableCivs,
  QueuedInRegion,
  queuedInRegion,
  queuedLevels,
  regionShares,
  researchBlockOf,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  aheadPct,
  allocateResources,
  constructionDaysLeft,
  constructionProgress,
  consumerGoodsMilli,
  coveragePermille,
  effAfterSwitch,
  exportCapacity,
  regionSlots,
  researchProgress,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import { EQUIPMENT, genTech } from "@openfront/engine-lib/ww1936/Equipment";
import { isNoStrike } from "@openfront/engine-lib/ww1936/NoStrike";
import {
  lawBlock,
  lawCost,
  LawCtx,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  DEPTH_BUILDINGS,
  depthBuildBlock,
} from "@openfront/engine-lib/ww1936/WorldRules";
import { lawEffects } from "@openfront/engine-lib/ww1936/WwLaws";
import {
  techDays,
  TechEffects,
  techTotals,
  WW_TECHS,
} from "@openfront/engine-lib/ww1936/WwTechs";
import { translateText } from "../../Utils";
import type { GameView } from "../../view";
import type { WwEconomyView } from "../../view/WwEconomyView";
import type { WwEndgameView } from "../../view/WwEndgameView";
import type { WwPoliticsView } from "../../view/WwPoliticsView";
import { today, wwActive, type WwGame } from "./WorldWarModel";

/** What the economy screens read from the game (a fake in tests). */
export type WwEconGame = WwGame & Pick<GameView, "wwEconomy" | "wwEndgame">;

// ---- Translation keys (spelled out: tests/TranslationSystem.test.ts counts
// each literal, and the Records make the compiler check every id has one) ----

export const BUILDING_KEYS: Readonly<Record<BuildingId, string>> = {
  civ: "ww1936.building.civ",
  mil: "ww1936.building.mil",
  dock: "ww1936.building.dock",
  infra: "ww1936.building.infra",
  fort: "ww1936.building.fort",
  rail: "ww1936.building.rail",
  supply_hub: "ww1936.building.supply_hub",
  naval_base: "ww1936.building.naval_base",
  air_base: "ww1936.building.air_base",
  anti_air: "ww1936.building.anti_air",
  radar: "ww1936.building.radar",
  coastal_fort: "ww1936.building.coastal_fort",
  synthetic_refinery: "ww1936.building.synthetic_refinery",
  fuel_silo: "ww1936.building.fuel_silo",
  // P6 (spec §9.1, §16.2, §16.4).
  facility_nuclear: "ww1936.building.facility_nuclear",
  facility_rocket: "ww1936.building.facility_rocket",
  facility_science: "ww1936.building.facility_science",
  rocket_site: "ww1936.building.rocket_site",
  power_plant: "ww1936.building.power_plant",
  dam: "ww1936.building.dam",
};

export const RESOURCE_KEYS: Readonly<Record<ResourceId, string>> = {
  oil: "ww1936.res.oil",
  aluminium: "ww1936.res.aluminium",
  rubber: "ww1936.res.rubber",
  tungsten: "ww1936.res.tungsten",
  steel: "ww1936.res.steel",
  chromium: "ww1936.res.chromium",
  // P6 (spec §9.3, §16.2).
  uranium: "ww1936.res.uranium",
  coal: "ww1936.res.coal",
};

export const EQUIPMENT_KEYS: Readonly<Record<EquipmentType, string>> = {
  infantry_equipment: "ww1936.equip.infantry_equipment",
  support_equipment: "ww1936.equip.support_equipment",
  artillery: "ww1936.equip.artillery",
  anti_tank: "ww1936.equip.anti_tank",
  anti_air: "ww1936.equip.anti_air",
  motorized: "ww1936.equip.motorized",
  light_tank: "ww1936.equip.light_tank",
  medium_tank: "ww1936.equip.medium_tank",
  fighter: "ww1936.equip.fighter",
  bomber: "ww1936.equip.bomber",
  heavy_fighter: "ww1936.equip.heavy_fighter",
  cas: "ww1936.equip.cas",
  naval_bomber: "ww1936.equip.naval_bomber",
  strat_bomber: "ww1936.equip.strat_bomber",
  transport_plane: "ww1936.equip.transport_plane",
  cv_fighter: "ww1936.equip.cv_fighter",
  cv_cas: "ww1936.equip.cv_cas",
  cv_naval_bomber: "ww1936.equip.cv_naval_bomber",
  convoy: "ww1936.equip.convoy",
  // P6 (plan decision 5).
  tank_design: "ww1936.equip.tank_design",
  plane_design: "ww1936.equip.plane_design",
  railway_gun: "ww1936.equip.railway_gun",
  floating_harbor: "ww1936.equip.floating_harbor",
  flying_bomb: "ww1936.equip.flying_bomb",
  ballistic_rocket: "ww1936.equip.ballistic_rocket",
  atomic_bomb: "ww1936.equip.atomic_bomb",
};

/** By generation − 1. */
export const GEN_KEYS = [
  "ww1936.gen.1",
  "ww1936.gen.2",
  "ww1936.gen.3",
] as const;

export const REGION_CAT_KEYS: Readonly<Record<RegionCategory, string>> = {
  wasteland: "ww1936.region_cat.wasteland",
  pastoral: "ww1936.region_cat.pastoral",
  rural: "ww1936.region_cat.rural",
  town: "ww1936.region_cat.town",
  large_town: "ww1936.region_cat.large_town",
  city: "ww1936.region_cat.city",
  large_city: "ww1936.region_cat.large_city",
  metropolis: "ww1936.region_cat.metropolis",
  megalopolis: "ww1936.region_cat.megalopolis",
};

export const LAW_KIND_KEYS: Readonly<Record<LawKind, string>> = {
  economy: "ww1936.law_kind.economy",
  trade: "ww1936.law_kind.trade",
  conscription: "ww1936.law_kind.conscription",
};

export const LAW_KEYS: Readonly<Record<LawValue, string>> = {
  civilian: "ww1936.law.economy.civilian",
  early_mobilization: "ww1936.law.economy.early_mobilization",
  partial_mobilization: "ww1936.law.economy.partial_mobilization",
  war_economy: "ww1936.law.economy.war_economy",
  total_mobilization: "ww1936.law.economy.total_mobilization",
  free_trade: "ww1936.law.trade.free_trade",
  export_focus: "ww1936.law.trade.export_focus",
  limited_exports: "ww1936.law.trade.limited_exports",
  closed_economy: "ww1936.law.trade.closed_economy",
  disarmed: "ww1936.law.conscription.disarmed",
  volunteer: "ww1936.law.conscription.volunteer",
  limited: "ww1936.law.conscription.limited",
  extensive: "ww1936.law.conscription.extensive",
  service: "ww1936.law.conscription.service",
  all_adults: "ww1936.law.conscription.all_adults",
  scraping: "ww1936.law.conscription.scraping",
};

/**
 * P1's texts for the steps with a condition. P3 (spec §7.2) gates laws by
 * war support, tension and government instead: lawStepReason shows the
 * block's own text (ww1936.econ.block.law_ws …); these wait for Task 8/9.
 */
export const LAW_NEED_KEYS: Readonly<Partial<Record<LawValue, string>>> = {
  partial_mobilization: "ww1936.econ.law_need.partial_mobilization",
  war_economy: "ww1936.econ.law_need.war_economy",
  total_mobilization: "ww1936.econ.law_need.total_mobilization",
  extensive: "ww1936.econ.law_need.extensive",
  service: "ww1936.econ.law_need.service",
  all_adults: "ww1936.econ.law_need.all_adults",
  scraping: "ww1936.econ.law_need.scraping",
};

export const BRANCH_KEYS: Readonly<Record<TechBranch, string>> = {
  infantry: "ww1936.branch.infantry",
  artillery: "ww1936.branch.artillery",
  armour: "ww1936.branch.armour",
  air: "ww1936.branch.air",
  industry: "ww1936.branch.industry",
  electronics: "ww1936.branch.electronics",
  doctrine: "ww1936.branch.doctrine",
  naval: "ww1936.branch.naval",
};

export const SCHOOL_KEYS: Readonly<Record<DoctrineSchool, string>> = {
  mobile: "ww1936.school.mobile",
  firepower: "ww1936.school.firepower",
  battleplan: "ww1936.school.battleplan",
  mass: "ww1936.school.mass",
  fleet_in_being: "ww1936.school.fleet_in_being",
  trade_interdiction: "ww1936.school.trade_interdiction",
  base_strike: "ww1936.school.base_strike",
  strategic_destruction: "ww1936.school.strategic_destruction",
  battlefield_support: "ww1936.school.battlefield_support",
  operational_integrity: "ww1936.school.operational_integrity",
};

export const TECH_KEYS: Readonly<Record<WwTechId, string>> = {
  inf_eq_1: "ww1936.tech.inf_eq_1",
  inf_eq_2: "ww1936.tech.inf_eq_2",
  inf_eq_3: "ww1936.tech.inf_eq_3",
  support_eq_1: "ww1936.tech.support_eq_1",
  support_eq_2: "ww1936.tech.support_eq_2",
  motorized_1: "ww1936.tech.motorized_1",
  artillery_1: "ww1936.tech.artillery_1",
  artillery_2: "ww1936.tech.artillery_2",
  artillery_3: "ww1936.tech.artillery_3",
  anti_tank_1: "ww1936.tech.anti_tank_1",
  anti_tank_2: "ww1936.tech.anti_tank_2",
  anti_air_1: "ww1936.tech.anti_air_1",
  anti_air_2: "ww1936.tech.anti_air_2",
  light_tank_1: "ww1936.tech.light_tank_1",
  light_tank_2: "ww1936.tech.light_tank_2",
  medium_tank_1: "ww1936.tech.medium_tank_1",
  medium_tank_2: "ww1936.tech.medium_tank_2",
  medium_tank_3: "ww1936.tech.medium_tank_3",
  fighter_1: "ww1936.tech.fighter_1",
  fighter_2: "ww1936.tech.fighter_2",
  fighter_3: "ww1936.tech.fighter_3",
  bomber_1: "ww1936.tech.bomber_1",
  bomber_2: "ww1936.tech.bomber_2",
  construction_1: "ww1936.tech.construction_1",
  construction_2: "ww1936.tech.construction_2",
  construction_3: "ww1936.tech.construction_3",
  tools_1: "ww1936.tech.tools_1",
  tools_2: "ww1936.tech.tools_2",
  tools_3: "ww1936.tech.tools_3",
  tools_4: "ww1936.tech.tools_4",
  output_1: "ww1936.tech.output_1",
  output_2: "ww1936.tech.output_2",
  excavation_1: "ww1936.tech.excavation_1",
  excavation_2: "ww1936.tech.excavation_2",
  flexible_line: "ww1936.tech.flexible_line",
  electronics_1: "ww1936.tech.electronics_1",
  computing_1: "ww1936.tech.computing_1",
  computing_2: "ww1936.tech.computing_2",
  mobile_1: "ww1936.tech.mobile_1",
  mobile_2: "ww1936.tech.mobile_2",
  firepower_1: "ww1936.tech.firepower_1",
  firepower_2: "ww1936.tech.firepower_2",
  battleplan_1: "ww1936.tech.battleplan_1",
  battleplan_2: "ww1936.tech.battleplan_2",
  mass_1: "ww1936.tech.mass_1",
  mass_2: "ww1936.tech.mass_2",
  engineer_company: "ww1936.tech.engineer_company",
  recon_company: "ww1936.tech.recon_company",
  mountaineers: "ww1936.tech.mountaineers",
  marines: "ww1936.tech.marines",
  field_hospital: "ww1936.tech.field_hospital",
  logistics_company: "ww1936.tech.logistics_company",
  signal_company: "ww1936.tech.signal_company",
  paratroopers: "ww1936.tech.paratroopers",
  fortification_1: "ww1936.tech.fortification_1",
  rail_1: "ww1936.tech.rail_1",
  dd_2: "ww1936.tech.dd_2",
  dd_3: "ww1936.tech.dd_3",
  dd_4: "ww1936.tech.dd_4",
  cl_2: "ww1936.tech.cl_2",
  cl_3: "ww1936.tech.cl_3",
  cl_4: "ww1936.tech.cl_4",
  ca_2: "ww1936.tech.ca_2",
  ca_3: "ww1936.tech.ca_3",
  bc_2: "ww1936.tech.bc_2",
  bc_3: "ww1936.tech.bc_3",
  bb_2: "ww1936.tech.bb_2",
  bb_3: "ww1936.tech.bb_3",
  bb_4: "ww1936.tech.bb_4",
  cv_2: "ww1936.tech.cv_2",
  cv_3: "ww1936.tech.cv_3",
  cv_4: "ww1936.tech.cv_4",
  ss_2: "ww1936.tech.ss_2",
  ss_3: "ww1936.tech.ss_3",
  ss_4: "ww1936.tech.ss_4",
  sonar_1: "ww1936.tech.sonar_1",
  sonar_2: "ww1936.tech.sonar_2",
  fire_control_1: "ww1936.tech.fire_control_1",
  torpedo_1: "ww1936.tech.torpedo_1",
  naval_radar_1: "ww1936.tech.naval_radar_1",
  landing_craft_1: "ww1936.tech.landing_craft_1",
  landing_craft_2: "ww1936.tech.landing_craft_2",
  fleet_in_being_1: "ww1936.tech.fleet_in_being_1",
  fleet_in_being_2: "ww1936.tech.fleet_in_being_2",
  trade_interdiction_1: "ww1936.tech.trade_interdiction_1",
  trade_interdiction_2: "ww1936.tech.trade_interdiction_2",
  base_strike_1: "ww1936.tech.base_strike_1",
  base_strike_2: "ww1936.tech.base_strike_2",
  heavy_fighter_1: "ww1936.tech.heavy_fighter_1",
  heavy_fighter_2: "ww1936.tech.heavy_fighter_2",
  heavy_fighter_3: "ww1936.tech.heavy_fighter_3",
  cas_1: "ww1936.tech.cas_1",
  cas_2: "ww1936.tech.cas_2",
  cas_3: "ww1936.tech.cas_3",
  naval_bomber_1: "ww1936.tech.naval_bomber_1",
  naval_bomber_2: "ww1936.tech.naval_bomber_2",
  naval_bomber_3: "ww1936.tech.naval_bomber_3",
  strat_bomber_1: "ww1936.tech.strat_bomber_1",
  strat_bomber_2: "ww1936.tech.strat_bomber_2",
  strat_bomber_3: "ww1936.tech.strat_bomber_3",
  transport_plane_1: "ww1936.tech.transport_plane_1",
  carrier_aviation: "ww1936.tech.carrier_aviation",
  strategic_destruction_1: "ww1936.tech.strategic_destruction_1",
  strategic_destruction_2: "ww1936.tech.strategic_destruction_2",
  battlefield_support_1: "ww1936.tech.battlefield_support_1",
  battlefield_support_2: "ww1936.tech.battlefield_support_2",
  operational_integrity_1: "ww1936.tech.operational_integrity_1",
  operational_integrity_2: "ww1936.tech.operational_integrity_2",
  radar_1: "ww1936.tech.radar_1",
  radar_2: "ww1936.tech.radar_2",
  synthetic_oil_1: "ww1936.tech.synthetic_oil_1",
  synthetic_oil_2: "ww1936.tech.synthetic_oil_2",
  // P5 (spec §8.5).
  military_police: "ww1936.tech.military_police",
  // P6 (spec §5.2.5, §5.7).
  heavy_tank_1: "ww1936.tech.heavy_tank_1",
  heavy_tank_2: "ww1936.tech.heavy_tank_2",
  heavy_tank_3: "ww1936.tech.heavy_tank_3",
  tank_gun_2: "ww1936.tech.tank_gun_2",
  tank_gun_3: "ww1936.tech.tank_gun_3",
  cast_armor: "ww1936.tech.cast_armor",
  diesel_engine: "ww1936.tech.diesel_engine",
  torsion_bar: "ww1936.tech.torsion_bar",
  tank_radio: "ww1936.tech.tank_radio",
  sloped_armor: "ww1936.tech.sloped_armor",
  interleaved_wheels: "ww1936.tech.interleaved_wheels",
  amphibious_drive: "ww1936.tech.amphibious_drive",
  flame_tank: "ww1936.tech.flame_tank",
  dual_purpose_guns: "ww1936.tech.dual_purpose_guns",
  naval_radar_2: "ww1936.tech.naval_radar_2",
  armored_deck: "ww1936.tech.armored_deck",
  mine_warfare_1: "ww1936.tech.mine_warfare_1",
  snorkel: "ww1936.tech.snorkel",
  super_heavy_battleship: "ww1936.tech.super_heavy_battleship",
  floating_harbor_1: "ww1936.tech.floating_harbor_1",
  aircraft_cannon_1: "ww1936.tech.aircraft_cannon_1",
  aircraft_cannon_2: "ww1936.tech.aircraft_cannon_2",
  self_sealing_tanks: "ww1936.tech.self_sealing_tanks",
  drop_tanks: "ww1936.tech.drop_tanks",
  bomb_sight_1: "ww1936.tech.bomb_sight_1",
  air_rockets_1: "ww1936.tech.air_rockets_1",
  air_radar_1: "ww1936.tech.air_radar_1",
  railway_gun_1: "ww1936.tech.railway_gun_1",
  cryptography_1: "ww1936.tech.cryptography_1",
  cryptography_2: "ww1936.tech.cryptography_2",
  cryptography_3: "ww1936.tech.cryptography_3",
  nuclear_physics: "ww1936.tech.nuclear_physics",
  rocketry_1: "ww1936.tech.rocketry_1",
};

export type EffectKey = keyof TechEffects | "unlock";

/** A research card's effect line (pre-flight R7.8). */
export const EFFECT_KEYS: Readonly<Record<EffectKey, string>> = {
  constructionPct: "ww1936.effect.constructionPct",
  slotPct: "ww1936.effect.slotPct",
  effCapBp: "ww1936.effect.effCapBp",
  outputPct: "ww1936.effect.outputPct",
  extractionPct: "ww1936.effect.extractionPct",
  retentionBp: "ww1936.effect.retentionBp",
  researchPct: "ww1936.effect.researchPct",
  attackPct: "ww1936.effect.attackPct",
  defensePct: "ww1936.effect.defensePct",
  speedPct: "ww1936.effect.speedPct",
  vehicleBonusPct: "ww1936.effect.vehicleBonusPct",
  gunBonusPct: "ww1936.effect.gunBonusPct",
  recruitablePct: "ww1936.effect.recruitablePct",
  trainPct: "ww1936.effect.trainPct",
  fortConstructionPct: "ww1936.effect.fortConstructionPct",
  railConstructionPct: "ww1936.effect.railConstructionPct",
  railSpeedPct: "ww1936.effect.railSpeedPct",
  breakthroughPct: "ww1936.effect.breakthroughPct",
  orgPct: "ww1936.effect.orgPct",
  recoveryPct: "ww1936.effect.recoveryPct",
  planSpeedPct: "ww1936.effect.planSpeedPct",
  planMaxBp: "ww1936.effect.planMaxBp",
  entrenchMax: "ww1936.effect.entrenchMax",
  supplyUsePct: "ww1936.effect.supplyUsePct",
  armyXpMilli: "ww1936.effect.armyXpMilli",
  generalXpPct: "ww1936.effect.generalXpPct",
  winterPenaltyPct: "ww1936.effect.winterPenaltyPct",
  desertAttackPct: "ww1936.effect.desertAttackPct",
  forestDefensePct: "ww1936.effect.forestDefensePct",
  mechBreakPct: "ww1936.effect.mechBreakPct",
  mechOrg: "ww1936.effect.mechOrg",
  artillerySoftPct: "ww1936.effect.artillerySoftPct",
  infTrainCutPct: "ww1936.effect.infTrainCutPct",
  infOrg: "ww1936.effect.infOrg",
  positioningPct: "ww1936.effect.positioningPct",
  screeningPct: "ww1936.effect.screeningPct",
  convoyRaidPct: "ww1936.effect.convoyRaidPct",
  carrierStrikePct: "ww1936.effect.carrierStrikePct",
  stratBombPct: "ww1936.effect.stratBombPct",
  casPct: "ww1936.effect.casPct",
  paradropPrepPct: "ww1936.effect.paradropPrepPct",
  airDetectPct: "ww1936.effect.airDetectPct",
  navalDetectPct: "ww1936.effect.navalDetectPct",
  capitalAttackPct: "ww1936.effect.capitalAttackPct",
  capitalHpPct: "ww1936.effect.capitalHpPct",
  subTorpedoPct: "ww1936.effect.subTorpedoPct",
  subVisibilityPct: "ww1936.effect.subVisibilityPct",
  subOrg: "ww1936.effect.subOrg",
  surfaceRaidPct: "ww1936.effect.surfaceRaidPct",
  deckPct: "ww1936.effect.deckPct",
  navalBomberPct: "ww1936.effect.navalBomberPct",
  carrierRoundsCut: "ww1936.effect.carrierRoundsCut",
  fighterAttackPct: "ww1936.effect.fighterAttackPct",
  heavyDefensePct: "ww1936.effect.heavyDefensePct",
  fighterAgilityPct: "ww1936.effect.fighterAgilityPct",
  airLossCutPct: "ww1936.effect.airLossCutPct",
  airNavalPct: "ww1936.effect.airNavalPct",
  supPenaltyPp: "ww1936.effect.supPenaltyPp",
  unlock: "ww1936.effect.unlock",
};

/** Why an order is refused (pre-flight X5): shown under a blocked button. */
export const BLOCK_KEYS: Readonly<Record<WwOrderBlock, string>> = {
  dead: "ww1936.econ.block.dead",
  not_controlled: "ww1936.econ.block.not_controlled",
  occupied: "ww1936.econ.block.occupied",
  not_buildable: "ww1936.econ.block.not_buildable",
  no_slots: "ww1936.econ.block.no_slots",
  infra_max: "ww1936.econ.block.infra_max",
  queue_full: "ww1936.econ.block.queue_full",
  bad_index: "ww1936.econ.block.bad_index",
  law_kind: "ww1936.econ.block.law_kind",
  law_same: "ww1936.econ.block.law_same",
  law_condition: "ww1936.econ.block.law_condition",
  law_cooldown: "ww1936.econ.block.law_cooldown",
  no_tech: "ww1936.econ.block.no_tech",
  lines_full: "ww1936.econ.block.lines_full",
  bad_line: "ww1936.econ.block.bad_line",
  no_partner: "ww1936.econ.block.no_partner",
  no_room: "ww1936.econ.block.no_room",
  trades_full: "ww1936.econ.block.trades_full",
  no_civs: "ww1936.econ.block.no_civs",
  researched: "ww1936.econ.block.researched",
  in_progress: "ww1936.econ.block.in_progress",
  prereq: "ww1936.econ.block.prereq",
  doctrine: "ww1936.econ.block.doctrine",
  no_slot: "ww1936.econ.block.no_slot",
  bad_slot: "ww1936.econ.block.bad_slot",
  no_army: "ww1936.econ.block.no_army",
  army_busy: "ww1936.econ.block.army_busy",
  no_path: "ww1936.econ.block.no_path",
  not_adjacent: "ww1936.econ.block.not_adjacent",
  not_at_war: "ww1936.econ.block.not_at_war",
  army_full: "ww1936.econ.block.army_full",
  no_xp: "ww1936.econ.block.no_xp",
  bad_template: "ww1936.econ.block.bad_template",
  special_cap: "ww1936.econ.block.special_cap",
  no_rail: "ww1936.econ.block.no_rail",
  no_port: "ww1936.econ.block.no_port",
  para_range: "ww1936.econ.block.para_range",
  para_cooldown: "ww1936.econ.block.para_cooldown",
  template_in_use: "ww1936.econ.block.template_in_use",
  too_many_templates: "ww1936.econ.block.too_many_templates",
  too_many_armies: "ww1936.econ.block.too_many_armies",
  general_unavailable: "ww1936.econ.block.general_unavailable",
  bad_region: "ww1936.econ.block.bad_region",
  // P3 (P3 spec §22.3, plan decision 25).
  no_pp: "ww1936.econ.block.no_pp",
  focus_busy: "ww1936.econ.block.focus_busy",
  focus_done: "ww1936.econ.block.focus_done",
  focus_prereq: "ww1936.econ.block.focus_prereq",
  focus_exclusive: "ww1936.econ.block.focus_exclusive",
  focus_unavailable: "ww1936.econ.block.focus_unavailable",
  slot_locked: "ww1936.econ.block.slot_locked",
  advisor_unavailable: "ww1936.econ.block.advisor_unavailable",
  decision_unavailable: "ww1936.econ.block.decision_unavailable",
  decision_cooldown: "ww1936.econ.block.decision_cooldown",
  no_event: "ww1936.econ.block.no_event",
  bad_option: "ww1936.econ.block.bad_option",
  justify_busy: "ww1936.econ.block.justify_busy",
  justify_blocked: "ww1936.econ.block.justify_blocked",
  law_ws: "ww1936.econ.block.law_ws",
  law_tension: "ww1936.econ.block.law_tension",
  law_ideology: "ww1936.econ.block.law_ideology",
  faction_rule: "ww1936.econ.block.faction_rule",
  faction_war: "ww1936.econ.block.faction_war",
  treaty_exists: "ww1936.econ.block.treaty_exists",
  nap_young: "ww1936.econ.block.nap_young",
  tension_gate: "ww1936.econ.block.tension_gate",
  bad_target: "ww1936.econ.block.bad_target",
  focus_none: "ww1936.econ.block.focus_none",
  no_fleet: "ww1936.econ.block.no_fleet",
  fleet_busy: "ww1936.econ.block.fleet_busy",
  fleet_full: "ww1936.econ.block.fleet_full",
  too_many_fleets: "ww1936.econ.block.too_many_fleets",
  no_sea_path: "ww1936.econ.block.no_sea_path",
  out_of_range: "ww1936.econ.block.out_of_range",
  lake: "ww1936.econ.block.lake",
  canal_closed: "ww1936.econ.block.canal_closed",
  not_coastal: "ww1936.econ.block.not_coastal",
  no_naval_base: "ww1936.econ.block.no_naval_base",
  no_dock: "ww1936.econ.block.no_dock",
  bad_ship_class: "ww1936.econ.block.bad_ship_class",
  line_full: "ww1936.econ.block.line_full",
  admiral_unavailable: "ww1936.econ.block.admiral_unavailable",
  no_convoys: "ww1936.econ.block.no_convoys",
  invasion_too_large: "ww1936.econ.block.invasion_too_large",
  invasion_not_ready: "ww1936.econ.block.invasion_not_ready",
  naval_supremacy_low: "ww1936.econ.block.naval_supremacy_low",
  not_in_port: "ww1936.econ.block.not_in_port",
  no_air_base: "ww1936.econ.block.no_air_base",
  base_full: "ww1936.econ.block.base_full",
  no_planes: "ww1936.econ.block.no_planes",
  bad_air_mission: "ww1936.econ.block.bad_air_mission",
  no_transport_planes: "ww1936.econ.block.no_transport_planes",
  air_superiority_low: "ww1936.econ.block.air_superiority_low",
  too_many_deployments: "ww1936.econ.block.too_many_deployments",
  no_strike_region: "ww1936.econ.block.no_strike_region",
  bad_zone: "ww1936.econ.block.bad_zone",
  // P5 (spec §21.3, plan decision 36).
  not_participant: "ww1936.econ.block.not_participant",
  conference_closed: "ww1936.econ.block.conference_closed",
  too_many_demands: "ww1936.econ.block.too_many_demands",
  bad_demand: "ww1936.econ.block.bad_demand",
  law_locked: "ww1936.econ.block.law_locked",
  not_integrable: "ww1936.econ.block.not_integrable",
  ll_conditions: "ww1936.econ.block.ll_conditions",
  ll_limit: "ww1936.econ.block.ll_limit",
  volunteer_conditions: "ww1936.econ.block.volunteer_conditions",
  volunteer_limit: "ww1936.econ.block.volunteer_limit",
  not_volunteer: "ww1936.econ.block.not_volunteer",
  ships_not_owned: "ww1936.econ.block.ships_not_owned",
  no_takeover: "ww1936.econ.block.no_takeover",
  disarmed: "ww1936.econ.block.disarmed",
  subject_restricted: "ww1936.econ.block.subject_restricted",
  // P6 (spec §21.4).
  no_cp: "ww1936.econ.block.no_cp",
  doctrine_locked: "ww1936.econ.block.doctrine_locked",
  trait_unavailable: "ww1936.econ.block.trait_unavailable",
  fm_limit: "ww1936.econ.block.fm_limit",
  group_full: "ww1936.econ.block.group_full",
  design_slots_full: "ww1936.econ.block.design_slots_full",
  module_locked: "ww1936.econ.block.module_locked",
  module_bad_slot: "ww1936.econ.block.module_bad_slot",
  bad_base: "ww1936.econ.block.bad_base",
  treaty_limit: "ww1936.econ.block.treaty_limit",
  design_in_use: "ww1936.econ.block.design_in_use",
  not_refittable: "ww1936.econ.block.not_refittable",
  no_agency: "ww1936.econ.block.no_agency",
  no_operative: "ww1936.econ.block.no_operative",
  network_low: "ww1936.econ.block.network_low",
  op_unavailable: "ww1936.econ.block.op_unavailable",
  no_crypto_target: "ww1936.econ.block.no_crypto_target",
  not_decrypted: "ww1936.econ.block.not_decrypted",
  no_facility: "ww1936.econ.block.no_facility",
  project_locked: "ww1936.econ.block.project_locked",
  no_atomic: "ww1936.econ.block.no_atomic",
  nuke_conditions: "ww1936.econ.block.nuke_conditions",
  out_of_rocket_range: "ww1936.econ.block.out_of_rocket_range",
  raid_conditions: "ww1936.econ.block.raid_conditions",
  embargoed: "ww1936.econ.block.embargoed",
  licence_exists: "ww1936.econ.block.licence_exists",
  listing_bad: "ww1936.econ.block.listing_bad",
  cfocus_locked: "ww1936.econ.block.cfocus_locked",
  faction_leader_only: "ww1936.econ.block.faction_leader_only",
  scorch_conditions: "ww1936.econ.block.scorch_conditions",
  harbor_conditions: "ww1936.econ.block.harbor_conditions",
  railgun_limit: "ww1936.econ.block.railgun_limit",
  // White peace.
  peace_too_early: "ww1936.econ.block.peace_too_early",
  peace_cooldown: "ww1936.econ.block.peace_cooldown",
  peace_war_kind: "ww1936.econ.block.peace_war_kind",
  peace_pending: "ww1936.econ.block.peace_pending",
  peace_no_offer: "ww1936.econ.block.peace_no_offer",
  no_invasion_port: "ww1936.econ.block.no_invasion_port",
  // Negotiated peace (Korea / Taiwan: the conference's existing reasons).
  peace_bad_terms: "ww1936.econ.block.peace_bad_terms",
  peace_capital: "ww1936.econ.block.peace_capital",
  peace_too_much: "ww1936.econ.block.peace_too_much",
  zone_only: "ww1936.peace.why.zone_only",
  claim_only: "ww1936.peace.why.claim_only",
};

// ---- Icons (pre-flight R7.7: emoji, no new image files) ----

export const RESOURCE_ICONS: Readonly<Record<ResourceId, string>> = {
  oil: "🛢️",
  aluminium: "🥫",
  rubber: "🌳",
  tungsten: "🪨",
  steel: "🔩",
  chromium: "💎",
  uranium: "☢️",
  coal: "⚫",
};

export const BUILDING_ICONS: Readonly<Record<BuildingId, string>> = {
  civ: "🏭",
  mil: "🛠️",
  dock: "⚓",
  infra: "🛤️",
  fort: "🏰",
  rail: "🚂",
  supply_hub: "📦",
  naval_base: "⚓",
  air_base: "🛫",
  anti_air: "🎯",
  radar: "📡",
  coastal_fort: "🏯",
  synthetic_refinery: "🛢️",
  fuel_silo: "⛽",
  facility_nuclear: "⚛️",
  facility_rocket: "🚀",
  facility_science: "🔬",
  rocket_site: "🎆",
  power_plant: "⚡",
  dam: "🌊",
};

export const EQUIPMENT_ICONS: Readonly<Record<EquipmentType, string>> = {
  infantry_equipment: "🪖",
  support_equipment: "📡",
  artillery: "💥",
  anti_tank: "🎯",
  anti_air: "🔭",
  motorized: "🚚",
  light_tank: "🚙",
  medium_tank: "🛡️",
  fighter: "✈️",
  bomber: "🛩️",
  heavy_fighter: "✈️",
  cas: "🛩️",
  naval_bomber: "🛩️",
  strat_bomber: "🛩️",
  transport_plane: "🛬",
  cv_fighter: "✈️",
  cv_cas: "🛩️",
  cv_naval_bomber: "🛩️",
  convoy: "🚢",
  tank_design: "🛡️",
  plane_design: "✈️",
  railway_gun: "🚂",
  floating_harbor: "⚓",
  flying_bomb: "🚀",
  ballistic_rocket: "🚀",
  atomic_bomb: "☢️",
};

// ---- Names ----

export const resourceName = (r: ResourceId) => translateText(RESOURCE_KEYS[r]);
export const buildingName = (b: BuildingId) => translateText(BUILDING_KEYS[b]);
export const equipmentName = (e: EquipmentType) =>
  translateText(EQUIPMENT_KEYS[e]);
export const genName = (gen: number) => translateText(GEN_KEYS[gen - 1]);
export const techName = (t: WwTechId) => translateText(TECH_KEYS[t]);
export const lawName = (v: LawValue) => translateText(LAW_KEYS[v]);
export const lawKindName = (k: LawKind) => translateText(LAW_KIND_KEYS[k]);
export const branchName = (b: TechBranch) => translateText(BRANCH_KEYS[b]);
export const schoolName = (s: DoctrineSchool) => translateText(SCHOOL_KEYS[s]);
export const blockText = (b: WwOrderBlock) => translateText(BLOCK_KEYS[b]);
export const regionCatName = (c: RegionCategory) =>
  translateText(REGION_CAT_KEYS[c]);

/** "●●●○○": infrastructure out of five. */
export function infraDots(infra: number): string {
  return "●".repeat(infra) + "○".repeat(Math.max(0, MAX_INFRA - infra));
}

/** A count with a real minus sign ("−3"); `plus` adds "+" to a gain. */
export function signedText(n: number, plus = false): string {
  if (n < 0) return `\u2212${-n}`;
  return plus && n > 0 ? `+${n}` : `${n}`;
}

/** "1.5": milli-factories with one decimal (pre-flight R7.6). */
export function milliText(milli: number): string {
  return (milli / 1000).toFixed(1);
}

/** The equipment generation a tech opens, if it opens one. */
export function techUnlock(
  tech: WwTechId,
): { equipment: EquipmentType; gen: number } | null {
  for (const equipment of EQUIPMENT_TYPES) {
    for (let gen = 1; gen <= EQUIPMENT_GENS[equipment]; gen++) {
      if (genTech(equipment, gen) === tech) return { equipment, gen };
    }
  }
  return null;
}

/** P2 (pre-flight T-b): the line of a land tech that opens a battalion or a company. */
export const UNLOCK_UNIT_KEY = "ww1936.effect.unlock_unit";

/**
 * The battalions and support companies a tech that opens no equipment
 * generation lets templates use (P2's land techs: mountaineers, marines,
 * paratroopers and the companies), as their names.
 */
export function techUnits(tech: WwTechId): string[] {
  if (techUnlock(tech) !== null) return [];
  return [
    ...BATTALION_IDS.filter((id) => BATTALIONS[id].techs.includes(tech)).map(
      (id) => translateText(`ww1936.battalion.${id}`),
    ),
    ...SUPPORT_IDS.filter((id) => SUPPORTS[id].techs.includes(tech)).map((id) =>
      translateText(`ww1936.support.${id}`),
    ),
  ];
}

/** A research card's effect lines: each bonus, or the generation or unit it opens. */
export function effectLines(tech: WwTechId): string[] {
  const out: string[] = [];
  const unlock = techUnlock(tech);
  if (unlock !== null) {
    out.push(
      translateText(EFFECT_KEYS.unlock, {
        equipment: equipmentName(unlock.equipment),
        gen: genName(unlock.gen),
      }),
    );
  }
  for (const unit of techUnits(tech)) {
    out.push(translateText(UNLOCK_UNIT_KEY, { unit }));
  }
  const effects = WW_TECHS[tech].effects;
  for (const k of Object.keys(effects) as (keyof TechEffects)[]) {
    const v = effects[k] ?? 0;
    // Basis points show as percent, milli as units.
    const n =
      k === "effCapBp" || k === "retentionBp" || k === "planMaxBp"
        ? v / 100
        : k === "armyXpMilli"
          ? v / 1000
          : v;
    out.push(translateText(EFFECT_KEYS[k], { n }));
  }
  return out;
}

/** Fighters and bombers only fill the stockpile until the air war (P4). */
export function stockOnly(equipment: EquipmentType): boolean {
  return EQUIPMENT[equipment].family === "aircraft";
}

// ---- Who is in the fight (spec §4.4, §7.4) ----

/**
 * Alive and not capitulated: a region's 1936 owner that still fights (so
 * the region is occupied, not annexed), or a country one can trade with.
 */
export function fightingFn(game: WwGame): (smallID: number) => boolean {
  return (id) => {
    if (id <= 0) return false;
    let p: ReturnType<WwGame["playerBySmallID"]>;
    try {
      p = game.playerBySmallID(id);
    } catch {
      return false;
    }
    // P5 pre-flight §0-1: an exile still fights.
    return p.isPlayer() && wwActive(game, id);
  };
}

/** What the army is made of on the screen (PlayerView). */
export interface ArmyLike {
  troops(): number;
  outgoingAttacks(): readonly { troops: number }[];
  units(...types: UnitType[]): readonly { troops(): number }[];
}

/**
 * The army the engine counts (WwEconomy.armyMen): troops at home, in
 * attacks and on transport ships, each floored.
 */
export function armyMenOf(p: ArmyLike): number {
  let n = Math.floor(p.troops());
  for (const a of p.outgoingAttacks()) n += Math.floor(a.troops);
  for (const u of p.units(UnitType.TransportShip)) n += Math.floor(u.troops());
  return n;
}

/**
 * Days of my longest running war now, -1 at peace — the engine's
 * WwEconomy.warDays from the P0 war list, not the last daily detail.
 */
export function liveWarDays(game: WwGame, me: number): number {
  const data = game.worldWarData();
  if (data === null) return -1;
  let since: number | null = null;
  for (const w of data.wars) {
    if ((w.a === me || w.b === me) && (since === null || w.sinceTick < since)) {
      since = w.sinceTick;
    }
  }
  return since === null ? -1 : today(game) - dayIndex(since, data.prepEndTick);
}

// ---- The top band (spec §13.1) ----

export interface TopBandEconomy {
  civ: number;
  mil: number;
  manpowerText: string;
  shortage: boolean;
}

export function topBandEconomy(s: WwCountrySummary): TopBandEconomy {
  return {
    civ: s.civ,
    mil: s.mil,
    manpowerText: menText(s.manpower),
    shortage: s.shortage,
  };
}

/**
 * "1.2M" for 1,195,000: people as they are (spec §13.1's "1.1M", controller
 * ruling) — not the troop bar's tenths (renderTroops). Manpower, the army,
 * the caps and the daily draft all count men.
 */
export function menText(men: number): string {
  return renderNumber(men, 1);
}

// ---- Construction (spec §4, §13.3 tab 1) ----

export interface ConstructionRow {
  index: number;
  region: number;
  regionName: string;
  building: BuildingId;
  count: number;
  /** Of the building under way, 0..1. */
  progress: number;
  /** Milli construction points a day. */
  perDay: number;
  /** -1 while it gets no factories (EconomyRules.constructionDaysLeft). */
  daysLeft: number;
  civs: number;
}

function regionName(
  scenario: ScenarioIndex,
  id: number,
  korean: boolean,
): string {
  const r = scenario.region(id);
  if (r === undefined) return "";
  return korean ? r.nameKo : r.name;
}

export function constructionRows(
  detail: WwCountryDetail,
  scenario: ScenarioIndex,
  korean = false,
): ConstructionRow[] {
  return detail.queue.map((q, index) => {
    const perDay = constructionProgress(q.assignedMilli, q.speedPct);
    return {
      index,
      region: q.region,
      regionName: regionName(scenario, q.region, korean),
      building: q.building,
      count: q.count,
      progress: q.costMilli > 0 ? q.progressMilli / q.costMilli : 0,
      perDay,
      daysLeft: constructionDaysLeft(
        q.costMilli,
        q.progressMilli,
        q.count,
        perDay,
      ),
      civs: q.assignedMilli / 1000,
    };
  });
}

/** The building-slot bonus of a country's research (construction_n). */
export function slotPctOf(detail: WwCountryDetail | null): number {
  return detail === null ? 0 : techTotals(new Set(detail.researched)).slotPct;
}

/**
 * Any country's building-slot bonus (spec §4.2): the engine sends it in
 * every country's summary (WwCountrySummary.slotPct), so a region an AI
 * holds counts that AI's construction research too. A human's own detail
 * gives it before the first summary.
 */
export function slotPctOfCountry(view: WwEconomyView, smallID: number): number {
  return view.summary(smallID)?.slotPct ?? slotPctOf(view.detail(smallID));
}

/**
 * P5 (pre-flight §0-5): whether `region` is a core of `owner` now — the
 * endgame's core holders once they changed, else the scenario's (a core of
 * its 1936 owner).
 */
export function isCoreNow(
  endgame: WwEndgameView | null,
  scenario: ScenarioIndex,
  region: number,
  owner: number,
): boolean {
  const holders = endgame?.coreHolders(region) ?? null;
  if (holders !== null) return holders.includes(owner);
  const r = scenario.region(region);
  return (
    r !== undefined && r.core && scenario.ownerByRegion()[region] === owner
  );
}

/**
 * Final review B, I1 (fix lane E): the judge's `noStrike` input. Lane E
 * adds `noStrike?: boolean` to engine-lib's BuildCheck; the intersection
 * keeps this side typechecking until both lanes are merged (it is then the
 * same type).
 */
export type ScreenBuildCheck = BuildCheck & { noStrike?: boolean };

/**
 * P6: what the depth rules of a building read beyond the economy view
 * (the engine's Construction.depthBlockOf). Without them a screen judges
 * every P6 building "not_buildable" (BuildCheck.depthBlock absent).
 */
export interface BuildDepthInputs {
  /** The lobby's ww1936Nukes (on unless the host turned it off). */
  nukesOn: boolean;
  /** SPECIAL_PROJECTS bits I finished (WwDepthDetail.projects.done). */
  projectsDone: number;
  /** The regions' legal owners (WwPoliticsView); null: the 1936 owners. */
  legalOwner: ArrayLike<number> | null;
  /**
   * The dams' levels by DAMS index (WwDepthView.worldData, sent whenever
   * one changes; the economy's region copy is resent only with the
   * region); empty: the economy view's.
   */
  damLevel: readonly number[];
}

/** The depth inputs of `me` from the game's views (the build menu's). */
export function buildDepthInputs(
  game: Partial<Pick<GameView, "wwDepth" | "wwPolitics">> & {
    config?: () => { gameConfig?: () => { ww1936Nukes?: boolean } };
  },
  me: number,
): BuildDepthInputs {
  return {
    nukesOn: game.config?.().gameConfig?.().ww1936Nukes !== false,
    projectsDone: game.wwDepth?.()?.detail(me)?.projects.done ?? 0,
    legalOwner: game.wwPolitics?.()?.legalOwner ?? null,
    damLevel: game.wwDepth?.()?.worldData.damLevel ?? [],
  };
}

const FLYING_BOMB = SPECIAL_PROJECTS.indexOf("sp_flying_bomb");

/** The engine's Construction.depthBlockOf, from the views. */
function depthBlockOf(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  region: number,
  building: BuildingId,
  count: number,
  queued: QueuedInRegion,
  endgame: WwEndgameView | null,
  depth: BuildDepthInputs,
): WwOrderBlock | null {
  const legalOwner =
    depth.legalOwner?.[region] ?? scenario.ownerByRegion()[region];
  const dam = scenario.damOf(region);
  return depthBuildBlock({
    building,
    count,
    core: legalOwner === me && isCoreNow(endgame, scenario, region, me),
    // FACILITY_IDS index + 1 of the facility built, else of the one queued.
    facility:
      view.facility[region] !== 0 ? view.facility[region] : queued.facility,
    researched: new Set(view.detail(me)?.researched ?? []),
    infra: view.infra[region],
    nukesOn: depth.nukesOn,
    flyingBombDone: (depth.projectsDone & (1 << FLYING_BOMB)) !== 0,
    levelWithQueue:
      building === "power_plant"
        ? view.powerPlant[region] + queued.power_plant
        : view.buildingCount(building, region) + queuedLevels(queued, building),
    dam,
    damLevel: dam < 0 ? 0 : (depth.damLevel[dam] ?? view.damLevel[region]),
    damQueued: queued.dam > 0,
  });
}

/**
 * What the engine's buildBlock checks, from the view (Construction.buildBlock).
 * `depth`: the P6 buildings' inputs (buildDepthInputs); null judges them
 * not buildable.
 */
export function buildCheck(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  region: number,
  building: BuildingId,
  count: number,
  slotPct: number,
  fighting: (smallID: number) => boolean,
  endgame: WwEndgameView | null = null,
  depth: BuildDepthInputs | null = null,
): ScreenBuildCheck {
  const r = scenario.region(region);
  const queue = view.detail(me)?.queue ?? [];
  const queued = queuedInRegion(queue, region);
  const controller = r === undefined ? 0 : view.controller[region];
  const owner = r === undefined ? 0 : scenario.ownerByRegion()[region];
  return {
    building,
    count,
    controlled: r !== undefined && controller === me,
    occupied:
      r !== undefined &&
      regionShares(
        controller,
        owner,
        isCoreNow(endgame, scenario, region, owner),
        fighting(owner),
      ).occupied,
    queueLength: queue.length,
    levelWithQueue:
      r === undefined || LEVEL_MAX[building] === undefined
        ? 0
        : levelOf(view, building, region) + queuedLevels(queued, building),
    usedSlots:
      r === undefined
        ? 0
        : view.civ[region] +
          view.mil[region] +
          view.dock[region] +
          view.refinery[region] +
          view.silo[region] +
          // P6 (spec §9.1, §16.2): a facility and the power plants hold
          // shared slots too (Construction.slotBuildings).
          (view.facility[region] !== 0 ? 1 : 0) +
          view.powerPlant[region] +
          queued.factories,
    slots: r === undefined ? 0 : regionSlots(r.cat, slotPct),
    // P4 (P4 spec §5.1, §12.1): the coast, the harbor zone, the techs.
    coastal: r?.coastal ?? false,
    harbor: scenario.harborOf(region) !== 0,
    researched: new Set(view.detail(me)?.researched ?? []),
    // Final review B, I1: nothing is built in Korea or Taiwan, so the build
    // menu and the region card grey it out (the engine refused silently).
    noStrike: isNoStrike(scenario, region),
    // P6: the depth rules' answer (absent: not buildable).
    ...(r !== undefined && depth !== null && DEPTH_BUILDINGS.includes(building)
      ? {
          depthBlock: depthBlockOf(
            view,
            scenario,
            me,
            region,
            building,
            count,
            queued,
            endgame,
            depth,
          ),
        }
      : {}),
  };
}

export function buildBlock(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  region: number,
  building: BuildingId,
  count: number,
  slotPct: number,
  fighting: (smallID: number) => boolean,
  endgame: WwEndgameView | null = null,
  depth: BuildDepthInputs | null = null,
): WwOrderBlock | null {
  return buildBlockOf(
    buildCheck(
      view,
      scenario,
      me,
      region,
      building,
      count,
      slotPct,
      fighting,
      endgame,
      depth,
    ),
  );
}

export interface BuildCandidate {
  id: number;
  name: string;
  /** Slots (or infrastructure levels) still free after the queue's reservations. */
  free: number;
  slots: number;
  infra: number;
}

/** How many of `building` the region still takes, reservations counted. */
function freeRoom(c: BuildCheck): number {
  const max = LEVEL_MAX[c.building];
  return max !== undefined ? max - c.levelWithQueue : c.slots - c.usedSlots;
}

/** A level building's level in a region, from the view (P2 plan decision 10). */
function levelOf(
  view: WwEconomyView,
  building: BuildingId,
  region: number,
): number {
  switch (building) {
    case "infra":
      return view.infra[region];
    case "fort":
      return view.fort[region];
    case "rail":
      return view.rail[region];
    case "supply_hub":
      return view.hub[region];
    case "naval_base":
    case "air_base":
    case "anti_air":
    case "radar":
    case "coastal_fort":
    case "rocket_site":
      // P6 (spec §9.1): the rocket site's level too. A dam's level is the
      // depth state's; the engine's count of it stays 0, as here.
      return view.buildingCount(building, region);
    default:
      return 0;
  }
}

/**
 * Spec §13.3: the regions I control where `building` can go now — most
 * free slots first, then the best infrastructure, then the region id.
 * Occupied regions take no factories (buildBlockOf: "occupied").
 */
export function buildCandidates(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  building: BuildingId,
  slotPct: number,
  fighting: (smallID: number) => boolean,
  korean = false,
  endgame: WwEndgameView | null = null,
  depth: BuildDepthInputs | null = null,
): BuildCandidate[] {
  const out: BuildCandidate[] = [];
  for (const r of scenario.landRegions) {
    if (view.controller[r.id] !== me) continue;
    const c = buildCheck(
      view,
      scenario,
      me,
      r.id,
      building,
      1,
      slotPct,
      fighting,
      endgame,
      depth,
    );
    if (buildBlockOf(c) !== null) continue;
    out.push({
      id: r.id,
      name: korean ? r.nameKo : r.name,
      free: freeRoom(c),
      slots: LEVEL_MAX[building] ?? c.slots,
      infra: view.infra[r.id],
    });
  }
  return out.sort(
    (a, b) => b.free - a.free || b.infra - a.infra || a.id - b.id,
  );
}

/**
 * Why no region takes `building` when buildCandidates is empty: the
 * commonest block among the regions I control (on a tie, the one that got
 * there first in region order); "not_controlled" when I control none.
 */
export function noCandidateBlock(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  building: BuildingId,
  slotPct: number,
  fighting: (smallID: number) => boolean,
  endgame: WwEndgameView | null = null,
  depth: BuildDepthInputs | null = null,
): WwOrderBlock {
  const counts = new Map<WwOrderBlock, number>();
  let best: WwOrderBlock = "not_controlled";
  let most = 0;
  for (const r of scenario.landRegions) {
    if (view.controller[r.id] !== me) continue;
    const b = buildBlock(
      view,
      scenario,
      me,
      r.id,
      building,
      1,
      slotPct,
      fighting,
      endgame,
      depth,
    );
    if (b === null) continue;
    const n = (counts.get(b) ?? 0) + 1;
    counts.set(b, n);
    if (n > most) {
      most = n;
      best = b;
    }
  }
  return best;
}

// ---- Auto-place ("알아서 짓기") ----

/** Buildings that belong at the front (or the coast), not in the safe core. */
const FRONT_BUILDINGS: readonly BuildingId[] = [
  "fort",
  "air_base",
  "anti_air",
  "radar",
  "coastal_fort",
  "naval_base",
  "rocket_site",
];
/** What a unit already placed in a region costs the next one there (spread). */
const AUTO_SPREAD_PENALTY = 35;

export interface AutoPlacement {
  region: number;
  name: string;
  count: number;
}

export interface AutoPlan {
  placements: AutoPlacement[];
  /** Units placed (the sum of the placements' counts). */
  placed: number;
  /** Why nothing could be placed (placements empty), else null. */
  block: WwOrderBlock | null;
}

/**
 * How good a region is for `building`: a safe, developed core region for
 * the economy buildings (infrastructure, free slots, away from the front
 * and from bombed ground), the front or the coast for the defences. A pure
 * function of what the views read, so a screen and a test agree.
 */
export function autoPlaceScore(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  region: number,
  building: BuildingId,
  free: number,
  fighting: (smallID: number) => boolean,
  endgame: WwEndgameView | null,
): number {
  let front = 0;
  for (const n of scenario.regionNeighbours(region)) {
    const c = view.controller[n];
    if (c !== me && c !== 0 && fighting(c)) front++;
  }
  const bombed = view.region(region).damage.some((d) => d > 0) ? 1 : 0;
  const infra = view.infra[region];
  const core = isCoreNow(endgame, scenario, region, me) ? 1 : 0;
  let score = infra * 100 + Math.min(free, 5) * 8 + core * 50;
  if (FRONT_BUILDINGS.includes(building)) {
    const coastal = scenario.region(region)?.coastal ? 1 : 0;
    score += Math.min(front, 3) * 90 + coastal * 30 - infra * 60;
    if (building === "anti_air" || building === "radar") score += bombed * 40;
    if (building === "naval_base" || building === "coastal_fort") {
      score += scenario.harborOf(region) !== 0 ? 40 : 0;
    }
  } else {
    score -= Math.min(front, 3) * 70 + bombed * 60;
    if (
      building === "infra" ||
      building === "supply_hub" ||
      building === "rail"
    ) {
      score += view.rail[region] * 10 + view.hub[region] * 20;
    }
  }
  return score;
}

/**
 * Spread `total` units of `building` across the best regions that can take
 * them, reservations counted; every placement is re-judged by buildBlock
 * with its final count, so no order goes out that the engine would refuse.
 */
export function autoPlace(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  building: BuildingId,
  total: number,
  slotPct: number,
  fighting: (smallID: number) => boolean,
  korean = false,
  endgame: WwEndgameView | null = null,
  depth: BuildDepthInputs | null = null,
): AutoPlan {
  const candidates = buildCandidates(
    view,
    scenario,
    me,
    building,
    slotPct,
    fighting,
    korean,
    endgame,
    depth,
  );
  if (candidates.length === 0) {
    return {
      placements: [],
      placed: 0,
      block: noCandidateBlock(
        view,
        scenario,
        me,
        building,
        slotPct,
        fighting,
        endgame,
        depth,
      ),
    };
  }
  const base = new Map(
    candidates.map((c) => [
      c.id,
      autoPlaceScore(
        view,
        scenario,
        me,
        c.id,
        building,
        c.free,
        fighting,
        endgame,
      ),
    ]),
  );
  const taken = new Map<number, number>();
  const room = WW_MAX_QUEUE - (view.detail(me)?.queue.length ?? 0);
  for (let i = 0; i < total; i++) {
    let best: BuildCandidate | null = null;
    let bestScore = 0;
    for (const c of candidates) {
      const t = taken.get(c.id) ?? 0;
      if (t >= c.free || t >= WW_MAX_PROJECT_COUNT) continue;
      // A fresh order costs a queue place.
      if (t === 0 && taken.size >= room) continue;
      const sc = (base.get(c.id) ?? 0) - t * AUTO_SPREAD_PENALTY;
      if (best === null || sc > bestScore) {
        best = c;
        bestScore = sc;
      }
    }
    if (best === null) break;
    taken.set(best.id, (taken.get(best.id) ?? 0) + 1);
  }
  const placements: AutoPlacement[] = [];
  let placed = 0;
  for (const c of candidates) {
    let n = taken.get(c.id) ?? 0;
    // The final count may trip a rule the single unit did not.
    while (
      n > 0 &&
      buildBlock(
        view,
        scenario,
        me,
        c.id,
        building,
        n,
        slotPct,
        fighting,
        endgame,
        depth,
      ) !== null
    ) {
      n--;
    }
    if (n > 0) {
      placements.push({ region: c.id, name: c.name, count: n });
      placed += n;
    }
  }
  placements.sort(
    (a, b) =>
      (base.get(b.region) ?? 0) - (base.get(a.region) ?? 0) ||
      a.region - b.region,
  );
  return {
    placements,
    placed,
    block: placed === 0 ? "queue_full" : null,
  };
}

/** The most the count stepper offers for a candidate. */
export function maxBuildCount(c: BuildCandidate): number {
  return Math.max(1, Math.min(WW_MAX_PROJECT_COUNT, c.free));
}

// ---- Production (spec §8, §13.3 tab 2) ----

export interface LineRow {
  id: number;
  index: number;
  equipment: EquipmentType;
  gen: number;
  factories: number;
  active: number;
  /** 0..1 */
  eff: number;
  /** 0..1 */
  cap: number;
  /** Units a day. */
  perDay: number;
  /** Resources this line gets less of than it needs. */
  shortage: ResourceId[];
}

/**
 * Per line, the resources it is short of (pre-flight R7.9): the engine's
 * own allocation (EconomyRules.allocateResources, as Production.stepProduction
 * calls it) on the detail — lines in order take what they need from
 * produced − exported + imported.
 */
export function lineShortages(detail: WwCountryDetail): ResourceId[][] {
  const available = RESOURCE_IDS.map((_, r) => {
    const row = detail.resources[r];
    return row === undefined ? 0 : row.produced - row.exported + row.imported;
  });
  return allocateResources(
    available,
    detail.lines.map((l) => ({
      key: equipKey(l.equipment, l.gen),
      factories: l.active,
    })),
  ).short.map((lacks) => lacks.map((r) => RESOURCE_IDS[r]));
}

export function lineRows(detail: WwCountryDetail): LineRow[] {
  const shortages = lineShortages(detail);
  return detail.lines.map((l, index) => ({
    id: l.id,
    index,
    equipment: l.equipment,
    gen: l.gen,
    factories: l.factories,
    active: l.active,
    eff: l.effBp / 10_000,
    cap: detail.effCapBp / 10_000,
    perDay: l.costMilli > 0 ? l.outputMilli / l.costMilli : 0,
    shortage: shortages[index],
  }));
}

/** The efficiency (bp) a line keeps when switched (EconomyRules.effAfterSwitch). */
export function switchPreview(
  line: WwLineData,
  to: EquipmentType,
  toGen: number,
  retentionBp: number,
): number {
  return effAfterSwitch(
    line.effBp,
    line.equipment,
    line.gen,
    to,
    toGen,
    retentionBp,
  );
}

/** The flexible-line bonus of a country's research. */
export function retentionBpOf(detail: WwCountryDetail): number {
  return techTotals(new Set(detail.researched)).retentionBp;
}

export function addLineBlock(
  detail: WwCountryDetail,
  equipment: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  return addLineBlockOf(
    new Set(detail.researched),
    detail.lines.length,
    equipment,
    gen,
  );
}

export function changeLineBlock(
  detail: WwCountryDetail,
  equipment: EquipmentType,
  gen: number,
): WwOrderBlock | null {
  return equipmentTechBlock(new Set(detail.researched), equipment, gen);
}

export interface StockRow {
  equipment: EquipmentType;
  /** Units by generation − 1. */
  gens: number[];
  total: number;
  /** 0..1 against the army; null for a type with no P1 combat role. */
  coverage: number | null;
}

/** Spec §13.3: the stockpile by type and generation, with its coverage. */
/** `men`: the army as the engine counts it (armyMenOf). */
export function stockRows(detail: WwCountryDetail, men: number): StockRow[] {
  return EQUIPMENT_TYPES.map((equipment) => {
    const gens: number[] = [];
    for (let gen = 1; gen <= EQUIPMENT_GENS[equipment]; gen++) {
      gens.push(detail.stock[equipKey(equipment, gen)] ?? 0);
    }
    const total = gens.reduce((a, b) => a + b, 0);
    const need = EQUIPMENT[equipment].needPer100k;
    return {
      equipment,
      gens,
      total,
      coverage: need > 0 ? coveragePermille(total, men, need) / 1000 : null,
    };
  });
}

// ---- Resources and trade (spec §7, §13.3 tab 3) ----

export interface ResourceRowView {
  id: ResourceId;
  produced: number;
  exported: number;
  imported: number;
  used: number;
  balance: number;
}

/**
 * The six resource rows (spec §13.3 tab 3). "Used" is what the working
 * lines need (their resources × active factories, as HOI4's resource view),
 * not what the engine could give them: with the given amount the balance
 * could never fall below zero, so a shortage would never show red.
 */
export function resourceRows(detail: WwCountryDetail): ResourceRowView[] {
  const need = RESOURCE_IDS.map(() => 0);
  for (const l of detail.lines) {
    const per = EQUIPMENT[l.equipment].resources;
    RESOURCE_IDS.forEach((_, r) => {
      need[r] += per[r] * l.active;
    });
  }
  return RESOURCE_IDS.map((id, r) => {
    const row = detail.resources[r] ?? {
      produced: 0,
      exported: 0,
      imported: 0,
      used: 0,
    };
    return {
      id,
      produced: row.produced,
      exported: row.exported,
      imported: row.imported,
      used: need[r],
      balance: row.produced - row.exported + row.imported - need[r],
    };
  });
}

export interface WarPair {
  a: number;
  b: number;
}

/**
 * The countries I may buy from, as the engine judged them on my last
 * detail (Trade.tradePartners: alive and fighting, no embargo from the
 * seller, the same faction, a shared sea zone or land through countries at
 * peace with me). The screens no longer build the trade graph themselves:
 * that walked the whole map on the main thread.
 */
export function tradePartnersOf(
  detail: WwCountryDetail | null,
): ReadonlySet<number> {
  return new Set(detail?.tradePartners ?? []);
}

function atWarFn(wars: readonly WarPair[], me: number) {
  const enemies = new Set<number>();
  for (const w of wars) {
    if (w.a === me) enemies.add(w.b);
    if (w.b === me) enemies.add(w.a);
  }
  return (id: number) => enemies.has(id);
}

export interface TradeOffer {
  smallID: number;
  tag: CountryTag;
  /** Units a day still for sale. */
  room: number;
}

/**
 * Spec §13.3: who can sell me `resource` — a trade partner (the engine's,
 * tradePartnersOf) with any room left (P4 Task 15: the last factory buys
 * what is left, fewer than 8 a day), most room first. A war declared since my last detail cuts at once (the
 * P0 war list is live); `canTrade`: alive and not capitulated.
 */
export function tradeOffers(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  wars: readonly WarPair[],
  resource: ResourceId,
  canTrade: (smallID: number) => boolean = () => true,
): TradeOffer[] {
  const r = RESOURCE_IDS.indexOf(resource);
  const partners = tradePartnersOf(view.detail(me));
  const atWar = atWarFn(wars, me);
  const out: TradeOffer[] = [];
  scenario.countries.forEach((tag, i) => {
    const id = i + 1;
    if (id === me || !canTrade(id) || !partners.has(id) || atWar(id)) return;
    // P4 Task 15: the last factory buys what is left (dealUnitsOf).
    const room = view.summary(id)?.exportRoom[r] ?? 0;
    if (room < 1) return;
    out.push({ smallID: id, tag, room });
  });
  return out.sort((a, b) => b.room - a.room || a.smallID - b.smallID);
}

/** Why a country with room to sell is not my trade partner. */
export type NotPartnerReason = "war" | "embargo" | "route";

export const NOT_PARTNER_KEYS: Readonly<Record<NotPartnerReason, string>> = {
  war: "ww1936.econ.not_partner_war",
  embargo: "ww1936.econ.not_partner_embargo",
  route: "ww1936.econ.not_partner_route",
};

export interface BlockedSeller extends TradeOffer {
  reason: NotPartnerReason;
}

/**
 * The countries that have `resource` to sell (any left) but are not
 * my partners, and why (pre-flight R7.14: no longer refused quietly): at
 * war with me, an embargo on me (`embargoed`, the seller's), or no route
 * (another faction, no shared sea zone and no land through countries at
 * peace with me). Gone and capitulated countries sell nothing: left out.
 */
export function blockedSellers(
  view: WwEconomyView,
  scenario: ScenarioIndex,
  me: number,
  wars: readonly WarPair[],
  resource: ResourceId,
  canTrade: (smallID: number) => boolean = () => true,
  embargoed: (seller: number) => boolean = () => false,
): BlockedSeller[] {
  const r = RESOURCE_IDS.indexOf(resource);
  const partners = tradePartnersOf(view.detail(me));
  const atWar = atWarFn(wars, me);
  const out: BlockedSeller[] = [];
  scenario.countries.forEach((tag, i) => {
    const id = i + 1;
    if (id === me || !canTrade(id)) return;
    if (partners.has(id) && !atWar(id)) return;
    const room = view.summary(id)?.exportRoom[r] ?? 0;
    if (room < 1) return;
    const reason: NotPartnerReason = atWar(id)
      ? "war"
      : embargoed(id)
        ? "embargo"
        : "route";
    out.push({ smallID: id, tag, room, reason });
  });
  return out.sort((a, b) => b.room - a.room || a.smallID - b.smallID);
}

/** Civilian factories my deals pay now (the engine's openTrade sums the deals). */
export function paidCivsOf(detail: WwCountryDetail): number {
  return sumCivs(detail.buying);
}

/** Civilian factories my sales bring in now. */
export function receivedCivsOf(detail: WwCountryDetail): number {
  return sumCivs(detail.selling);
}

function sumCivs(deals: readonly WwTradeData[]): number {
  let n = 0;
  for (const t of deals) n += t.civs;
  return n;
}

/** What the engine's openTrade checks, from the view (Trade.openTrade). */
export function openTradeBlock(
  view: WwEconomyView,
  me: number,
  seller: number,
  resource: ResourceId,
  civs: number,
  partnerOk: boolean,
): WwOrderBlock | null {
  const detail = view.detail(me);
  const mine = view.summary(me);
  if (detail === null || mine === null) return "dead";
  const r = RESOURCE_IDS.indexOf(resource);
  return openTradeBlockOf({
    partnerOk,
    buyerTrades: detail.buying.length,
    grows: detail.buying.some(
      (t) => t.seller === seller && t.resource === resource,
    ),
    civs,
    room: view.summary(seller)?.exportRoom[r] ?? 0,
    payable: payableCivs(mine.civ, detail.consumerGoodsMilli),
    paidCivs: paidCivsOf(detail),
  });
}

/** The most factories the buy stepper offers: the seller's room, my civilian factories, the cap. */
export function maxTradeCivs(
  view: WwEconomyView,
  me: number,
  room: number,
): number {
  const detail = view.detail(me);
  const mine = view.summary(me);
  if (detail === null || mine === null) return 1;
  const payable =
    payableCivs(mine.civ, detail.consumerGoodsMilli) - paidCivsOf(detail);
  return Math.max(
    1,
    Math.min(
      WW_MAX_TRADE_CIVS,
      Math.ceil(room / WW_TRADE_UNITS_PER_CIV),
      payable,
    ),
  );
}

// ---- Research (spec §9, §13.4) ----

export type ResearchCardState =
  | "done"
  | "running"
  | "available"
  | "prereq"
  | "doctrine";

export interface ResearchCard {
  id: WwTechId;
  year: number;
  /** Base days (WwTechs.techDays). */
  days: number;
  /** Days at today's speed and ahead-of-time penalty (left, when running). */
  etaDays: number;
  /** The ahead-of-time penalty today, percent. */
  ahead: number;
  state: ResearchCardState;
  /** researchBlockOf: why a tap would not start it (no_slot: all slots busy). */
  block: WwOrderBlock | null;
  school: DoctrineSchool | null;
}

/** Research speed bonus: electronics and the trade law (spec §9.2). */
export function researchSpeedPct(detail: WwCountryDetail): number {
  return (
    techTotals(new Set(detail.researched)).researchPct +
    lawEffects(detail.laws).researchPct
  );
}

function cardState(block: WwOrderBlock | null): ResearchCardState {
  switch (block) {
    case "researched":
      return "done";
    case "in_progress":
      return "running";
    case "prereq":
      return "prereq";
    case "doctrine":
      return "doctrine";
    default:
      return "available";
  }
}

function slotTechs(detail: WwCountryDetail): (WwTechId | null)[] {
  return detail.slots.map((s) => s?.tech ?? null);
}

export function researchBlock(
  detail: WwCountryDetail,
  tech: WwTechId,
): WwOrderBlock | null {
  return researchBlockOf(
    {
      researched: new Set(detail.researched),
      slots: slotTechs(detail),
      slotCount: detail.slotCount,
    },
    tech,
  );
}

export function researchCards(
  detail: WwCountryDetail,
  branch: TechBranch,
  day: number,
): ResearchCard[] {
  const state = {
    researched: new Set(detail.researched),
    slots: slotTechs(detail),
    slotCount: detail.slotCount,
  };
  const speed = researchSpeedPct(detail);
  // P6 plan decision 25: the retired doctrine techs are never offered.
  return WW_TECH_IDS.filter(
    (id) => WW_TECHS[id].branch === branch && WW_TECHS[id].retired !== true,
  ).map((id) => {
    const def = WW_TECHS[id];
    const days = techDays(def.year);
    const ahead = aheadPct(def.year, day);
    const perDay = researchProgress(speed, ahead);
    const slot = detail.slots.find((s) => s?.tech === id) ?? null;
    const left =
      slot === null
        ? days * 1000
        : Math.max(0, slot.totalMilli - slot.progressMilli);
    const block = researchBlockOf(state, id);
    return {
      id,
      year: def.year,
      days,
      etaDays: perDay > 0 ? Math.ceil(left / perDay) : 0,
      ahead,
      state: cardState(block),
      block,
      school: def.school ?? null,
    };
  });
}

export interface SlotRow {
  index: number;
  tech: WwTechId | null;
  /** 0..1 */
  progress: number;
  daysLeft: number;
  ahead: number;
  /** Past the slot count (spec §9.1): paused, its progress kept. */
  paused: boolean;
}

/** The slot row (spec §13.4): each slot's tech, progress, days left and penalty. */
export function researchSlots(detail: WwCountryDetail, day: number): SlotRow[] {
  const speed = researchSpeedPct(detail);
  const n = Math.max(detail.slotCount, detail.slots.length);
  return Array.from({ length: n }, (_, index) => {
    const s = detail.slots[index] ?? null;
    const paused = index >= detail.slotCount;
    if (s === null) {
      return { index, tech: null, progress: 0, daysLeft: 0, ahead: 0, paused };
    }
    const ahead = aheadPct(WW_TECHS[s.tech].year, day);
    const perDay = researchProgress(speed, ahead);
    return {
      index,
      tech: s.tech,
      progress: s.totalMilli > 0 ? s.progressMilli / s.totalMilli : 0,
      daysLeft:
        perDay > 0
          ? Math.ceil(Math.max(0, s.totalMilli - s.progressMilli) / perDay)
          : 0,
      ahead,
      paused,
    };
  }).filter((s) => !s.paused || s.tech !== null);
}

// ---- Laws (spec §5, §13.3 tab 4) ----

export interface LawStep {
  value: LawValue;
  current: boolean;
  /** Its P3 conditions hold today (PoliticsRules.lawBlock without the cost). */
  allowed: boolean;
  /** Which condition fails (law_ws, law_tension, law_ideology, law_condition); null when allowed. */
  condition: WwOrderBlock | null;
  /** Days until the kind may change again; 0 when it may. */
  cooldownDays: number;
  /** lawBlockOf: null when a tap sets it. */
  block: WwOrderBlock | null;
  /** P3 spec §7.1: what it costs, PP. */
  costPp: number;
}

/**
 * P3 spec §7.2: what the law conditions read on the screen — my war
 * support, government, PP and law cost stats, and the world's tension
 * (WwPoliticsView summary, detail and global).
 */
export interface LawPolitics {
  wsBp: number;
  wtBp: number;
  ruling: number;
  ppMilli: number;
  lawCostPct: number;
  conscriptionCostPct: number;
}

/** Before the first politics update: nothing known, nothing allowed that costs. */
export const NO_LAW_POLITICS: LawPolitics = {
  wsBp: 0,
  wtBp: 0,
  ruling: 3,
  ppMilli: 0,
  lawCostPct: 0,
  conscriptionCostPct: 0,
};

/** The politics view's numbers for `smallID` (a human's: its detail carries the stats). */
export function lawPoliticsOf(
  view: Pick<WwPoliticsView, "summary" | "detail" | "global"> | null,
  smallID: number,
): LawPolitics {
  const s = view?.summary(smallID) ?? null;
  if (view === null || s === null) return NO_LAW_POLITICS;
  const stats = view.detail(smallID)?.stats ?? [];
  const stat = (k: WwStatKey) => stats[WW_STAT_KEYS.indexOf(k)] ?? 0;
  return {
    wsBp: s.wsBp,
    wtBp: view.global?.wtBp ?? 0,
    ruling: s.ruling,
    ppMilli: s.ppMilli,
    lawCostPct: stat("lawCostPct"),
    conscriptionCostPct: stat("conscriptionCostPct"),
  };
}

/** `warDays`: the live one (liveWarDays), as the engine's lawBlock reads it. */
export function lawLadder(
  detail: WwCountryDetail,
  kind: LawKind,
  day: number,
  warDays = detail.warDays,
  pol: LawPolitics = NO_LAW_POLITICS,
): LawStep[] {
  const cooldownDays = Math.max(0, detail.lawCooldownUntil[kind] - day);
  const stats = emptyStats();
  stats.lawCostPct = pol.lawCostPct;
  stats.conscriptionCostPct = pol.conscriptionCostPct;
  return LAW_LADDERS[kind].map((value) => {
    const costPp = lawCost(value, stats);
    const ctx: LawCtx = {
      wsBp: pol.wsBp,
      wtBp: pol.wtBp,
      ruling: pol.ruling,
      atWar: warDays >= 0,
      ppMilli: pol.ppMilli,
      costMilli: costPp * 1000,
    };
    const condition = lawBlock(value, { ...ctx, ppMilli: 0, costMilli: 0 });
    return {
      value,
      current: detail.laws[kind] === value,
      allowed: condition === null,
      condition,
      cooldownDays,
      block: lawBlockOf(
        detail.laws,
        detail.lawCooldownUntil,
        kind,
        value,
        day,
        ctx,
      ),
      costPp,
    };
  });
}

/**
 * Whether setting the law would close deals at the next daily check
 * (Trade.validateTrades): a trade law whose export share falls below what
 * I sell, or an economy law whose consumer goods leave fewer civilian
 * factories than my deals pay. Such a change takes two taps.
 */
export function lawClosesDeals(
  detail: WwCountryDetail,
  summary: WwCountrySummary,
  kind: LawKind,
  value: LawValue,
): boolean {
  if (kind === "trade") {
    const pct = lawEffects({
      ...detail.laws,
      trade: value as TradeLaw,
    }).exportPct;
    return RESOURCE_IDS.some((id, r) => {
      let sold = 0;
      for (const t of detail.selling) {
        if (t.resource === id) sold += t.units;
      }
      return sold > exportCapacity(detail.resources[r]?.produced ?? 0, pct);
    });
  }
  if (kind === "economy") {
    const pct = lawEffects({
      ...detail.laws,
      economy: value as EconomyLaw,
    }).consumerGoodsPct;
    const cg = consumerGoodsMilli(summary.civ, summary.mil, pct);
    return paidCivsOf(detail) > payableCivs(summary.civ, cg);
  }
  return false;
}

/**
 * A locked step's reason: its failing condition (shown during the wait
 * too), the wait, or the block (P3: each with its own text).
 */
export function lawStepReason(step: LawStep): string | null {
  if (step.current || step.block === null) return null;
  if (step.condition !== null) return blockText(step.condition);
  if (step.block === "law_cooldown") {
    return translateText("ww1936.econ.cooldown", { n: step.cooldownDays });
  }
  return blockText(step.block);
}

// ---- The dials (spec §13.2) ----

export interface IndustryDial {
  /** The first queue entry's progress, 0..1. */
  progress: number;
  /** Military factories without a line. */
  idle: number;
  queued: number;
}

export function industryDial(
  detail: WwCountryDetail,
  summary: WwCountrySummary | null,
): IndustryDial {
  const first = detail.queue[0];
  return {
    progress:
      first === undefined || first.costMilli <= 0
        ? 0
        : first.progressMilli / first.costMilli,
    idle: summary === null ? 0 : idleMilOf(summary, detail),
    queued: detail.queue.length,
  };
}

/**
 * Military factories without a line. The engine's daily trim
 * (Production.stepProduction: the lines, top first, take what is left)
 * leaves exactly `mil − the factories the lines ask for`. Counted from the
 * lines it is right at once — in the preparation minute, before the
 * engine's first day, and right after a line order — while the summary's
 * `idleMil` only moves on the country's next day (it is 0 until day 0).
 */
export function idleMilOf(
  summary: WwCountrySummary,
  detail: WwCountryDetail,
): number {
  let asked = 0;
  for (const l of detail.lines) asked += l.factories;
  return Math.max(0, summary.mil - asked);
}

export interface ResearchDialModel {
  /** The furthest slot's progress, 0..1. */
  progress: number;
  /** Empty slots within the slot count. */
  free: number;
  running: number;
}

export function researchDial(detail: WwCountryDetail): ResearchDialModel {
  let progress = 0;
  let free = 0;
  let running = 0;
  for (let i = 0; i < detail.slotCount; i++) {
    const s = detail.slots[i] ?? null;
    if (s === null) {
      free++;
      continue;
    }
    running++;
    if (s.totalMilli > 0) {
      progress = Math.max(progress, s.progressMilli / s.totalMilli);
    }
  }
  return { progress, free, running };
}

// ---- The region card (spec §13.5) ----

export interface RegionCard {
  id: number;
  cat: RegionCategory;
  civ: number;
  mil: number;
  dock: number;
  slots: number;
  infra: number;
  /** Population, people. */
  pop: number;
  /** Deposits (at infrastructure 5), only those it has. */
  res: { id: ResourceId; amount: number }[];
  occupied: boolean;
  /** I control it and can queue there. */
  mine: boolean;
}

export function regionCard(game: WwEconGame, tile: TileRef): RegionCard | null {
  const scenario = game.worldWarScenario();
  const view = game.wwEconomy?.() ?? null;
  if (scenario === null || view === null) return null;
  const id = scenario.regionAt(tile);
  const r = scenario.region(id);
  if (r === undefined) return null;
  const now = view.region(id);
  const owner = scenario.ownerByRegion()[id];
  const me = game.myPlayer()?.smallID() ?? 0;
  return {
    id,
    cat: r.cat,
    civ: now.civ,
    mil: now.mil,
    dock: now.dock,
    // The engine's slot bonus of whoever holds it (an AI's construction
    // research too, from its summary).
    slots: regionSlots(r.cat, slotPctOfCountry(view, now.controller)),
    infra: now.infra,
    pop: r.pop * 1000,
    // P3's resource effect adds to the scenario's deposits.
    res: RESOURCE_IDS.flatMap((rid, i) => {
      const amount = r.res[i] + (now.res?.[i] ?? 0);
      return amount > 0 ? [{ id: rid, amount }] : [];
    }),
    occupied: regionShares(
      now.controller,
      owner,
      isCoreNow(game.wwEndgame?.() ?? null, scenario, id, owner),
      fightingFn(game)(owner),
    ).occupied,
    mine: me !== 0 && now.controller === me && view.detail(me) !== null,
  };
}

/** "25.0M": a region's population. */
export function populationText(people: number): string {
  return renderNumber(people);
}
