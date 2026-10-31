import type { SpecialProject } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  DOCTRINE_DOMAIN,
  DoctrineSchool,
  TechBranch,
  TechTab,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

export interface TechEffects {
  constructionPct: number;
  slotPct: number;
  effCapBp: number;
  outputPct: number;
  extractionPct: number;
  retentionBp: number;
  researchPct: number;
  attackPct: number;
  defensePct: number;
  speedPct: number;
  /** Multiplies the motorized and tank bonuses (spec §9.4 mobile_2). */
  vehicleBonusPct: number;
  /** Multiplies the artillery, AT, AA and support bonuses (firepower_1). */
  gunBonusPct: number;
  recruitablePct: number;
  trainPct: number;
  // P2 (plan decision 11): land war keys, appended (P3's WwStats reads all).
  /** Fort construction speed, percent (fortification_1). */
  fortConstructionPct: number;
  /** Railway construction speed, percent (rail_1). */
  railConstructionPct: number;
  /** Rail movement speed, percent (rail_1). */
  railSpeedPct: number;
  /** Breakthrough, percent. */
  breakthroughPct: number;
  /** Maximum organization, percent. */
  orgPct: number;
  /** Organization recovery, percent. */
  recoveryPct: number;
  /** Planning speed, percent (battleplan_2). */
  planSpeedPct: number;
  /** Maximum planning bonus, bp (battleplan_1). */
  planMaxBp: number;
  /** Maximum entrenchment, levels (battleplan_2). */
  entrenchMax: number;
  /** Supply use, percent (positive: more). */
  supplyUsePct: number;
  /** Daily army experience, milli. */
  armyXpMilli: number;
  /** General experience gain, percent. */
  generalXpPct: number;
  /** Cut of the snow and frost attack penalty, percent. */
  winterPenaltyPct: number;
  /** Attack in the desert, percent. */
  desertAttackPct: number;
  /** Defence in forests, percent. */
  forestDefensePct: number;
  /** Breakthrough of armoured and motorized divisions, percent (mobile_2). */
  mechBreakPct: number;
  /** Organization of armoured and motorized divisions, points (mobile_2). */
  mechOrg: number;
  /** Soft attack of artillery, percent (firepower_1). */
  artillerySoftPct: number;
  /** Cut of infantry training time, percent (mass_1). */
  infTrainCutPct: number;
  /** Organization of infantry battalions, points (mass_2). */
  infOrg: number;
  // P4 (pre-flight ruling 2): the doctrine and tech keys of P4 spec §16.3
  // (WW_STAT_KEYS names: techStats copies them by key).
  positioningPct: number;
  screeningPct: number;
  convoyRaidPct: number;
  carrierStrikePct: number;
  stratBombPct: number;
  casPct: number;
  paradropPrepPct: number;
  airDetectPct: number;
  navalDetectPct: number;
  // P4 doctrine keys (P6 pre-flight): the rules read these, never a
  // doctrine tech id.
  /** fleet_in_being_1: capital ship attack (N2). */
  capitalAttackPct: number;
  /** fleet_in_being_2: BB and BC HP (shipStats). */
  capitalHpPct: number;
  /** trade_interdiction_1: submarine torpedo (shipStats). */
  subTorpedoPct: number;
  /** trade_interdiction_1: submarine visibility, negative hides (shipStats). */
  subVisibilityPct: number;
  /** trade_interdiction_2: submarine organization, points (shipStats). */
  subOrg: number;
  /** trade_interdiction_2: surface raiders' raid power (raidPowerCenti). */
  surfaceRaidPct: number;
  /** base_strike_1: carrier deck size (shipStats). */
  deckPct: number;
  /** base_strike_2: naval and carrier torpedo bombers' naval attack (planeStats). */
  navalBomberPct: number;
  /** base_strike_2: carrier strike cycle, rounds fewer (N2). */
  carrierRoundsCut: number;
  /** strategic_destruction_1: fighters' air attack (planeStats). */
  fighterAttackPct: number;
  /** strategic_destruction_2: heavy fighters' and strategic bombers' air defense (planeStats). */
  heavyDefensePct: number;
  /** operational_integrity_1: fighters' agility (planeStats). */
  fighterAgilityPct: number;
  /** operational_integrity_2: air combat losses cut (A1). */
  airLossCutPct: number;
  /** operational_integrity_2: every plane's naval attack (planeStats). */
  airNavalPct: number;
  /** battlefield_support_1: the superiority penalty dealt to the enemy, points (A2). */
  supPenaltyPp: number;
}
/**
 * The summed effects of researched techs: the P1+P2 keys always, any other
 * WwStats key a researched tech gives (research overhaul: the new techs'
 * keys flow into the stats like these).
 */
export type TechTotals = TechEffects & Partial<WwStats>;

/**
 * Research overhaul (design §3.2): what a tech is to the AI's score —
 * an equipment generation, an improvement of equipment in service, a
 * designer module, a designer chassis or airframe, a unit or company, an
 * economy or science tech, a 1945 tech (mostly for the unlimited game).
 */
export const TECH_ROLES = [
  "gen",
  "imp",
  "module",
  "chassis",
  "unit",
  "eco",
  "post",
] as const;
export type TechRole = (typeof TECH_ROLES)[number];

/** Research overhaul: the research days multiplier of an improvement, a normal and a big tech, ‰. */
export const COST_IMP = 750;
export const COST_NORMAL = 1000;
export const COST_BIG = 1250;

/**
 * Research overhaul (changes §2.7): the one global knob on every tech's
 * research days, ‰ (1000 = ×1.0). Phase 3 moved it (1000 -> 1300) to
 * land the majors' 1945 share in 45–60%.
 */
export const WW_RESEARCH_COST_PM = 1300;

/** A designer part a tech opens (DesignRules reads it; phase 2 wires it). */
export interface TechDesignPart {
  designer: "tank" | "ship" | "plane";
  part: "module" | "chassis";
  /** The module or chassis / airframe id in DesignRules. */
  id: string;
}

export interface WwTechDef {
  id: WwTechId;
  branch: TechBranch;
  /** The research screen tab (TECH_TABS): the branch's. */
  tab: TechTab;
  year: number;
  prereqs: readonly WwTechId[];
  effects: Partial<WwStats>;
  /** Research days multiplier ‰ (COST_IMP / COST_NORMAL / COST_BIG). */
  costPm: number;
  role: TechRole;
  /**
   * Either/or (changes §2.4): another line of `group` researched or
   * running blocks this tech ("exclusive"); cancelled, it opens again.
   */
  exclusive?: { group: string; line: number };
  /** The special project that must be finished first ("no_project"). */
  project?: SpecialProject;
  /** The designer module, chassis or airframe it opens. */
  design?: TechDesignPart;
  school?: DoctrineSchool;
  /**
   * P6 (plan decision 25, spec §1.4): an old doctrine tech. Its id stays in
   * WW_TECH_IDS; it cannot be researched, the screens skip it and its
   * effects are empty (the grand doctrines carry them now).
   */
  retired?: true;
}

/** The support companies (research overhaul changes §2.6: the support tab). */
const SUPPORT_COMPANIES: ReadonlySet<string> = new Set([
  "engineer_company",
  "recon_company",
  "field_hospital",
  "logistics_company",
  "signal_company",
  "military_police",
]);
const GEN_ID =
  /^(inf_eq|support_eq|artillery|anti_tank|anti_air|light_tank|medium_tank|heavy_tank|fighter|bomber|heavy_fighter|cas|naval_bomber|strat_bomber|dd|cl|ca|bc|bb|cv|ss|transport_plane)_\d$|^motorized_1$/;
const UNIT_ID =
  /^(mountaineers|marines|paratroopers|landing_craft_\d|carrier_aviation|railway_gun_1|floating_harbor_1)$/;

/** The role of a tech before the overhaul (its data predates the field). */
function baseRole(id: string, branch: TechBranch): TechRole {
  if (branch === "industry" || branch === "electronics") return "eco";
  if (branch === "support" || UNIT_ID.test(id)) return "unit";
  if (GEN_ID.test(id)) return "gen";
  return "module";
}

function t(
  id: WwTechId,
  branch: TechBranch,
  year: number,
  prereqs: readonly WwTechId[] = [],
  effects: Partial<WwStats> = {},
  school?: DoctrineSchool,
): WwTechDef {
  // Research overhaul (changes §2.6): the six companies move to the
  // support branch; nothing else of theirs changes.
  const b: TechBranch = SUPPORT_COMPANIES.has(id) ? "support" : branch;
  return {
    id,
    branch: b,
    tab: b,
    year,
    prereqs,
    effects,
    costPm: COST_NORMAL,
    role: baseRole(id, b),
    ...(school ? { school } : {}),
  };
}

interface NewOpts {
  cost?: number;
  role?: TechRole;
  exclusive?: { group: string; line: number };
  project?: SpecialProject;
  design?: TechDesignPart;
}

/** Research overhaul (changes §2.3): a new tech (cost ‰ default: an improvement). */
function n(
  id: WwTechId,
  branch: TechBranch,
  year: number,
  prereqs: readonly WwTechId[],
  effects: Partial<WwStats>,
  o: NewOpts = {},
): WwTechDef {
  return {
    id,
    branch,
    tab: branch,
    year,
    prereqs,
    effects,
    costPm: o.cost ?? COST_IMP,
    role: o.role ?? (year >= 1945 ? "post" : "imp"),
    ...(o.exclusive ? { exclusive: o.exclusive } : {}),
    ...(o.project ? { project: o.project } : {}),
    ...(o.design ? { design: o.design } : {}),
  };
}

/**
 * P4: the generation techs `<prefix>_<n>` of the given years, each after
 * the previous one; `first` is the first generation with a tech (ships:
 * 2, the 1922 model is open from the start; planes: 1).
 */
function gens(
  prefix: string,
  years: readonly number[],
  branch: TechBranch = "naval",
  first = 2,
): Record<string, WwTechDef> {
  const out: Record<string, WwTechDef> = {};
  years.forEach((year, i) => {
    const id = `${prefix}_${first + i}` as WwTechId;
    const prev = i === 0 ? [] : [`${prefix}_${first + i - 1}` as WwTechId];
    out[id] = t(id, branch, year, prev);
  });
  return out;
}

/** Research overhaul (changes §2.4): the one either/or pair, its two lines. */
export const INDUSTRY_ORG = "industry_org";
const CONCENTRATED = { group: INDUSTRY_ORG, line: 0 } as const;
const DISPERSED = { group: INDUSTRY_ORG, line: 1 } as const;

// Spec §9.4.
const BASE_TECHS: Readonly<Record<WwTechId, WwTechDef>> = {
  inf_eq_1: t("inf_eq_1", "infantry", 1936),
  inf_eq_2: t("inf_eq_2", "infantry", 1939, ["inf_eq_1"]),
  inf_eq_3: t("inf_eq_3", "infantry", 1942, ["inf_eq_2"]),
  support_eq_1: t("support_eq_1", "infantry", 1936),
  support_eq_2: t("support_eq_2", "infantry", 1940, ["support_eq_1"]),
  motorized_1: t("motorized_1", "infantry", 1936),
  artillery_1: t("artillery_1", "artillery", 1936),
  artillery_2: t("artillery_2", "artillery", 1939, ["artillery_1"]),
  artillery_3: t("artillery_3", "artillery", 1942, ["artillery_2"]),
  anti_tank_1: t("anti_tank_1", "artillery", 1936, ["artillery_1"]),
  anti_tank_2: t("anti_tank_2", "artillery", 1940, ["anti_tank_1"]),
  anti_air_1: t("anti_air_1", "artillery", 1936, ["artillery_1"]),
  anti_air_2: t("anti_air_2", "artillery", 1940, ["anti_air_1"]),
  light_tank_1: t("light_tank_1", "armour", 1936, ["motorized_1"]),
  light_tank_2: t("light_tank_2", "armour", 1938, ["light_tank_1"]),
  medium_tank_1: t("medium_tank_1", "armour", 1939, ["light_tank_2"]),
  medium_tank_2: t("medium_tank_2", "armour", 1941, ["medium_tank_1"]),
  medium_tank_3: t("medium_tank_3", "armour", 1943, ["medium_tank_2"]),
  fighter_1: t("fighter_1", "air", 1936),
  fighter_2: t("fighter_2", "air", 1940, ["fighter_1"]),
  fighter_3: t("fighter_3", "air", 1944, ["fighter_2"]),
  bomber_1: t("bomber_1", "air", 1936),
  bomber_2: t("bomber_2", "air", 1940, ["bomber_1"]),
  construction_1: t("construction_1", "industry", 1936, [], {
    constructionPct: 10,
    slotPct: 20,
  }),
  construction_2: t("construction_2", "industry", 1938, ["construction_1"], {
    constructionPct: 10,
    slotPct: 20,
  }),
  construction_3: t("construction_3", "industry", 1940, ["construction_2"], {
    constructionPct: 10,
    slotPct: 20,
  }),
  tools_1: t("tools_1", "industry", 1936, [], { effCapBp: 1000 }),
  tools_2: t("tools_2", "industry", 1938, ["tools_1"], { effCapBp: 1000 }),
  tools_3: t("tools_3", "industry", 1940, ["tools_2"], { effCapBp: 1000 }),
  tools_4: t("tools_4", "industry", 1942, ["tools_3"], { effCapBp: 1000 }),
  output_1: t("output_1", "industry", 1937, ["tools_1"], { outputPct: 10 }),
  output_2: t("output_2", "industry", 1940, ["output_1"], { outputPct: 10 }),
  excavation_1: t("excavation_1", "industry", 1937, [], { extractionPct: 10 }),
  excavation_2: t("excavation_2", "industry", 1940, ["excavation_1"], {
    extractionPct: 10,
  }),
  flexible_line: t("flexible_line", "industry", 1939, ["tools_2"], {
    retentionBp: 1000,
  }),
  electronics_1: t("electronics_1", "electronics", 1936, [], {
    researchPct: 3,
  }),
  computing_1: t("computing_1", "electronics", 1938, ["electronics_1"], {
    researchPct: 5,
  }),
  computing_2: t("computing_2", "electronics", 1941, ["computing_1"], {
    researchPct: 5,
  }),
  mobile_1: t("mobile_1", "doctrine", 1936, [], { speedPct: 10 }, "mobile"),
  // P2 plan decision 11: the doctrines read on the land war's keys.
  mobile_2: t(
    "mobile_2",
    "doctrine",
    1939,
    ["mobile_1"],
    { mechBreakPct: 20, mechOrg: 5 },
    "mobile",
  ),
  firepower_1: t(
    "firepower_1",
    "doctrine",
    1936,
    [],
    { artillerySoftPct: 20 },
    "firepower",
  ),
  firepower_2: t(
    "firepower_2",
    "doctrine",
    1939,
    ["firepower_1"],
    { attackPct: 10 },
    "firepower",
  ),
  battleplan_1: t(
    "battleplan_1",
    "doctrine",
    1936,
    [],
    { defensePct: 10, planMaxBp: 1000 },
    "battleplan",
  ),
  battleplan_2: t(
    "battleplan_2",
    "doctrine",
    1939,
    ["battleplan_1"],
    { defensePct: 10, planSpeedPct: 50, entrenchMax: 2 },
    "battleplan",
  ),
  mass_1: t(
    "mass_1",
    "doctrine",
    1936,
    [],
    { recruitablePct: 10, infTrainCutPct: 33 },
    "mass",
  ),
  mass_2: t(
    "mass_2",
    "doctrine",
    1939,
    ["mass_1"],
    { attackPct: 5, defensePct: 5, infOrg: 10 },
    "mass",
  ),
  // P2 (P2 spec §4.6): companies, special forces, forts and railways.
  engineer_company: t("engineer_company", "infantry", 1936, ["support_eq_1"]),
  recon_company: t("recon_company", "infantry", 1936, ["support_eq_1"]),
  mountaineers: t("mountaineers", "infantry", 1936, ["inf_eq_1"]),
  marines: t("marines", "infantry", 1936, ["inf_eq_1"]),
  field_hospital: t("field_hospital", "infantry", 1938, ["support_eq_1"]),
  logistics_company: t("logistics_company", "infantry", 1938, ["support_eq_1"]),
  signal_company: t("signal_company", "electronics", 1938, ["electronics_1"]),
  paratroopers: t("paratroopers", "infantry", 1938, ["mountaineers"]),
  // "−25% cost" as +33% construction speed (plan decision 10).
  fortification_1: t("fortification_1", "industry", 1936, [], {
    fortConstructionPct: 33,
  }),
  rail_1: t("rail_1", "industry", 1937, ["construction_1"], {
    railConstructionPct: 33,
    railSpeedPct: 20,
  }),
  // P4 (P4 spec §4.3, §12.3; plan Task 1 Step 14). What changes a ship or
  // a plane is read by tech id in shipStats / planeStats (plan decision 23);
  // the effects here are WwStats keys only.
  ...gens("dd", [1936, 1940, 1944]),
  ...gens("cl", [1936, 1940, 1944]),
  ...gens("ca", [1936, 1940]),
  ...gens("bc", [1936, 1940]),
  ...gens("bb", [1936, 1940, 1944]),
  ...gens("cv", [1936, 1940, 1944]),
  ...gens("ss", [1936, 1940, 1944]),
  sonar_1: t("sonar_1", "naval", 1936),
  sonar_2: t("sonar_2", "naval", 1940, ["sonar_1"]),
  // Hit +10% (N2 reads the id).
  fire_control_1: t("fire_control_1", "naval", 1938),
  torpedo_1: t("torpedo_1", "naval", 1938),
  // Surface detection +20% (shipStats), hit +5% (N2).
  naval_radar_1: t("naval_radar_1", "naval", 1939, ["electronics_1"]),
  // Capacity and preparation: invasionCapacity / invasionPrepDays read the ids.
  landing_craft_1: t("landing_craft_1", "naval", 1939, ["marines"]),
  landing_craft_2: t("landing_craft_2", "naval", 1942, ["landing_craft_1"]),
  // The sea doctrines (P4 spec §4.3): every bonus is a stat key (P6
  // pre-flight), read by shipStats, planeStats, raidPowerCenti and N2.
  fleet_in_being_1: t(
    "fleet_in_being_1",
    "naval",
    1936,
    [],
    { positioningPct: 5, capitalAttackPct: 10 },
    "fleet_in_being",
  ),
  fleet_in_being_2: t(
    "fleet_in_being_2",
    "naval",
    1939,
    ["fleet_in_being_1"],
    { screeningPct: 15, capitalHpPct: 10 },
    "fleet_in_being",
  ),
  trade_interdiction_1: t(
    "trade_interdiction_1",
    "naval",
    1936,
    [],
    {
      convoyRaidPct: 15,
      subTorpedoPct: 15,
      subVisibilityPct: -10,
    },
    "trade_interdiction",
  ),
  trade_interdiction_2: t(
    "trade_interdiction_2",
    "naval",
    1939,
    ["trade_interdiction_1"],
    { convoyRaidPct: 15, surfaceRaidPct: 50, subOrg: 10 },
    "trade_interdiction",
  ),
  base_strike_1: t(
    "base_strike_1",
    "naval",
    1936,
    [],
    { carrierStrikePct: 20, deckPct: 10 },
    "base_strike",
  ),
  base_strike_2: t(
    "base_strike_2",
    "naval",
    1939,
    ["base_strike_1"],
    { navalBomberPct: 15, carrierRoundsCut: 1 },
    "base_strike",
  ),
  ...gens("heavy_fighter", [1936, 1940, 1944], "air", 1),
  ...gens("cas", [1936, 1940, 1944], "air", 1),
  ...gens("naval_bomber", [1936, 1940, 1944], "air", 1),
  ...gens("strat_bomber", [1936, 1940, 1944], "air", 1),
  transport_plane_1: t("transport_plane_1", "air", 1937),
  carrier_aviation: t("carrier_aviation", "air", 1936),
  strategic_destruction_1: t(
    "strategic_destruction_1",
    "air",
    1936,
    [],
    { stratBombPct: 15, fighterAttackPct: 5 },
    "strategic_destruction",
  ),
  strategic_destruction_2: t(
    "strategic_destruction_2",
    "air",
    1939,
    ["strategic_destruction_1"],
    { stratBombPct: 15, heavyDefensePct: 15 },
    "strategic_destruction",
  ),
  battlefield_support_1: t(
    "battlefield_support_1",
    "air",
    1936,
    [],
    { casPct: 15, supPenaltyPp: 5 },
    "battlefield_support",
  ),
  battlefield_support_2: t(
    "battlefield_support_2",
    "air",
    1939,
    ["battlefield_support_1"],
    { casPct: 15, paradropPrepPct: -50 },
    "battlefield_support",
  ),
  operational_integrity_1: t(
    "operational_integrity_1",
    "air",
    1936,
    [],
    { airDetectPct: 10, fighterAgilityPct: 10 },
    "operational_integrity",
  ),
  operational_integrity_2: t(
    "operational_integrity_2",
    "air",
    1939,
    ["operational_integrity_1"],
    { airLossCutPct: 15, airNavalPct: 10 },
    "operational_integrity",
  ),
  radar_1: t("radar_1", "electronics", 1938, ["electronics_1"]),
  // Detection +50‰ = 5 × 10 (detectionPm reads airDetectPct × 10).
  radar_2: t("radar_2", "electronics", 1941, ["radar_1"], { airDetectPct: 5 }),
  synthetic_oil_1: t("synthetic_oil_1", "industry", 1937),
  synthetic_oil_2: t("synthetic_oil_2", "industry", 1941, ["synthetic_oil_1"]),
  // P5 (P5 spec §8.5): the military police company (support equipment 1, like its P2 siblings).
  military_police: t("military_police", "infantry", 1937, ["support_eq_1"]),
  // P6 (P6 spec §5.2.5, §5.7): they open design modules, bases, the
  // facilities and the railway gun; no effects (the intelligence lane
  // counts the cryptography techs).
  heavy_tank_1: t("heavy_tank_1", "armour", 1939, ["medium_tank_1"]),
  heavy_tank_2: t("heavy_tank_2", "armour", 1941, ["heavy_tank_1"]),
  heavy_tank_3: t("heavy_tank_3", "armour", 1943, ["heavy_tank_2"]),
  tank_gun_2: t("tank_gun_2", "armour", 1940, ["anti_tank_2"]),
  tank_gun_3: t("tank_gun_3", "armour", 1942, ["tank_gun_2"]),
  cast_armor: t("cast_armor", "armour", 1938, ["light_tank_2"]),
  diesel_engine: t("diesel_engine", "armour", 1938, ["motorized_1"]),
  torsion_bar: t("torsion_bar", "armour", 1939, ["light_tank_2"]),
  tank_radio: t("tank_radio", "armour", 1938, ["electronics_1"]),
  sloped_armor: t("sloped_armor", "armour", 1940, ["medium_tank_1"]),
  interleaved_wheels: t("interleaved_wheels", "armour", 1941, ["torsion_bar"]),
  amphibious_drive: t("amphibious_drive", "armour", 1941, ["marines"]),
  flame_tank: t("flame_tank", "armour", 1938, ["engineer_company"]),
  dual_purpose_guns: t("dual_purpose_guns", "naval", 1940, ["fire_control_1"]),
  naval_radar_2: t("naval_radar_2", "naval", 1942, ["naval_radar_1"]),
  armored_deck: t("armored_deck", "naval", 1939, ["cv_2"]),
  mine_warfare_1: t("mine_warfare_1", "naval", 1936),
  snorkel: t("snorkel", "naval", 1944, ["ss_3"]),
  super_heavy_battleship: t("super_heavy_battleship", "naval", 1940, ["bb_3"]),
  floating_harbor_1: t("floating_harbor_1", "naval", 1943, ["landing_craft_2"]),
  aircraft_cannon_1: t("aircraft_cannon_1", "air", 1938, ["fighter_1"]),
  aircraft_cannon_2: t("aircraft_cannon_2", "air", 1942, ["aircraft_cannon_1"]),
  self_sealing_tanks: t("self_sealing_tanks", "air", 1938, ["fighter_1"]),
  drop_tanks: t("drop_tanks", "air", 1939, ["fighter_1"]),
  bomb_sight_1: t("bomb_sight_1", "air", 1939, ["bomber_1"]),
  air_rockets_1: t("air_rockets_1", "air", 1942, ["cas_2"]),
  air_radar_1: t("air_radar_1", "air", 1941, ["radar_1"]),
  railway_gun_1: t("railway_gun_1", "artillery", 1939, ["artillery_2"]),
  cryptography_1: t("cryptography_1", "electronics", 1936),
  cryptography_2: t("cryptography_2", "electronics", 1939, ["cryptography_1"]),
  cryptography_3: t("cryptography_3", "electronics", 1942, ["cryptography_2"]),
  nuclear_physics: t("nuclear_physics", "electronics", 1940, ["computing_1"]),
  rocketry_1: t("rocketry_1", "electronics", 1939, ["electronics_1"]),
  // ---- Research overhaul (changes §2.3): 108 new techs, appended ----
  // Improvements (×0.75 days unless noted) between the generations, the
  // designer parts, the support companies' upgrades, industry and science.
  // Effects are WwStats keys; a part the designer opens is `design`.
  // -- infantry
  inf_imp_1: n("inf_imp_1", "infantry", 1937, ["inf_eq_1"], {
    infAttackPct: 3,
  }),
  support_imp_1: n("support_imp_1", "infantry", 1938, ["support_eq_1"], {
    supportCompanyPct: 5,
  }),
  winter_gear_1: n("winter_gear_1", "infantry", 1938, ["inf_eq_1"], {
    winterPenaltyPct: 25,
  }),
  motorized_2: n("motorized_2", "infantry", 1939, ["motorized_1"], {
    motSpeedPct: 10,
  }),
  desert_gear_1: n("desert_gear_1", "infantry", 1939, ["inf_eq_1"], {
    desertAttackPct: 10,
  }),
  inf_imp_2: n("inf_imp_2", "infantry", 1940, ["inf_eq_2", "inf_imp_1"], {
    infAttackPct: 5,
  }),
  marines_2: n(
    "marines_2",
    "infantry",
    1940,
    ["marines"],
    { invasionPrepPct: -10 },
    { role: "unit" },
  ),
  inf_at_1: n(
    "inf_at_1",
    "infantry",
    1941,
    ["inf_eq_2", "anti_tank_1"],
    { infHardPct: 15 },
    { cost: COST_NORMAL },
  ),
  para_2: n(
    "para_2",
    "infantry",
    1941,
    ["paratroopers", "transport_plane_1"],
    { paradropPrepPct: -25 },
    { role: "unit" },
  ),
  motorized_3: n(
    "motorized_3",
    "infantry",
    1942,
    ["motorized_2"],
    { motOrg: 3, motSpeedPct: 5 },
    { cost: COST_NORMAL },
  ),
  inf_at_2: n(
    "inf_at_2",
    "infantry",
    1943,
    ["inf_at_1", "rocketry_1"],
    { infHardPct: 15 },
    { cost: COST_NORMAL },
  ),
  inf_imp_3: n(
    "inf_imp_3",
    "infantry",
    1944,
    ["inf_eq_3", "inf_imp_2"],
    { infAttackPct: 5, infDefensePct: 3 },
    { cost: COST_NORMAL },
  ),
  // -- support (the companies' upgrades)
  reinforce_1: n(
    "reinforce_1",
    "support",
    1938,
    ["support_eq_1"],
    { reinforcePct: 10 },
    { role: "unit" },
  ),
  engineer_2: n(
    "engineer_2",
    "support",
    1939,
    ["engineer_company"],
    { entrenchSpeedPct: 10, riverPenaltyCutPct: 10 },
    { role: "unit" },
  ),
  recon_2: n(
    "recon_2",
    "support",
    1939,
    ["recon_company"],
    { reconPct: 10 },
    { role: "unit" },
  ),
  field_maintenance: n(
    "field_maintenance",
    "support",
    1939,
    ["support_eq_1"],
    { capturePct: 5, armorRelPp: 3 },
    { role: "unit" },
  ),
  logistics_2: n(
    "logistics_2",
    "support",
    1940,
    ["logistics_company", "motorized_1"],
    { supplyUsePct: -5 },
    { role: "unit" },
  ),
  mp_2: n(
    "mp_2",
    "support",
    1940,
    ["military_police"],
    { garrisonNeedPct: -10 },
    { role: "unit" },
  ),
  hospital_2: n(
    "hospital_2",
    "support",
    1941,
    ["field_hospital"],
    { casualtyReturnPp: 10 },
    { role: "unit" },
  ),
  signal_2: n(
    "signal_2",
    "support",
    1941,
    ["signal_company", "radio_1"],
    { planSpeedPct: 10 },
    { role: "unit" },
  ),
  engineer_3: n(
    "engineer_3",
    "support",
    1942,
    ["engineer_2"],
    { fortPenaltyCutPct: 10 },
    { role: "unit" },
  ),
  recon_3: n(
    "recon_3",
    "support",
    1942,
    ["recon_2", "radio_1"],
    { reconPct: 10 },
    { role: "unit" },
  ),
  logistics_3: n(
    "logistics_3",
    "support",
    1943,
    ["logistics_2"],
    { supplyUsePct: -5 },
    { role: "unit" },
  ),
  // -- armour
  tank_reliability_1: n(
    "tank_reliability_1",
    "armour",
    1939,
    ["light_tank_2"],
    { armorRelPp: 5 },
  ),
  armor_plate_2: n("armor_plate_2", "armour", 1940, ["cast_armor"], {
    armorArmorPct: 5,
  }),
  tank_engine_2: n(
    "tank_engine_2",
    "armour",
    1940,
    ["diesel_engine"],
    {},
    {
      cost: COST_NORMAL,
      role: "module",
      design: { designer: "tank", part: "module", id: "engine_2" },
    },
  ),
  armor_coordination: n("armor_coordination", "armour", 1941, ["tank_radio"], {
    armorBrkPct: 5,
  }),
  tank_reliability_2: n(
    "tank_reliability_2",
    "armour",
    1942,
    ["tank_reliability_1"],
    { armorRelPp: 5 },
  ),
  armor_plate_3: n(
    "armor_plate_3",
    "armour",
    1943,
    ["armor_plate_2", "sloped_armor"],
    { armorArmorPct: 5 },
  ),
  tank_engine_3: n(
    "tank_engine_3",
    "armour",
    1943,
    ["tank_engine_2"],
    {},
    {
      cost: COST_NORMAL,
      role: "module",
      design: { designer: "tank", part: "module", id: "engine_3" },
    },
  ),
  tank_gun_4: n(
    "tank_gun_4",
    "armour",
    1944,
    ["tank_gun_3"],
    {},
    {
      cost: COST_NORMAL,
      role: "module",
      design: { designer: "tank", part: "module", id: "gun_super" },
    },
  ),
  super_heavy_tank: n(
    "super_heavy_tank",
    "armour",
    1944,
    ["heavy_tank_3"],
    {},
    {
      cost: COST_BIG,
      role: "chassis",
      design: { designer: "tank", part: "chassis", id: "super_heavy_1" },
    },
  ),
  modern_tank_1: n(
    "modern_tank_1",
    "armour",
    1945,
    ["medium_tank_3", "tank_gun_4"],
    {},
    {
      cost: COST_BIG,
      role: "post",
      design: { designer: "tank", part: "chassis", id: "modern_1" },
    },
  ),
  // -- artillery
  art_imp_1: n("art_imp_1", "artillery", 1937, ["artillery_1"], {
    artillerySoftPct: 5,
  }),
  art_towing: n(
    "art_towing",
    "artillery",
    1938,
    ["artillery_1", "motorized_1"],
    {
      artSpeedPct: 10,
    },
  ),
  at_imp_1: n("at_imp_1", "artillery", 1938, ["anti_tank_1"], {
    atPiercePct: 10,
  }),
  aa_imp_1: n("aa_imp_1", "artillery", 1938, ["anti_air_1"], { aaPct: 10 }),
  art_imp_2: n("art_imp_2", "artillery", 1940, ["artillery_2", "art_imp_1"], {
    artillerySoftPct: 5,
  }),
  fire_direction: n(
    "fire_direction",
    "artillery",
    1941,
    ["artillery_2", "signal_company"],
    { artillerySoftPct: 5 },
    { cost: COST_NORMAL },
  ),
  at_imp_2: n("at_imp_2", "artillery", 1941, ["anti_tank_2", "at_imp_1"], {
    atPiercePct: 10,
    atHardPct: 5,
  }),
  aa_imp_2: n("aa_imp_2", "artillery", 1941, ["anti_air_2", "aa_imp_1"], {
    aaPct: 10,
  }),
  art_imp_3: n("art_imp_3", "artillery", 1943, ["artillery_3", "art_imp_2"], {
    artillerySoftPct: 5,
  }),
  at_imp_3: n("at_imp_3", "artillery", 1944, ["at_imp_2"], { atHardPct: 10 }),
  aa_imp_3: n(
    "aa_imp_3",
    "artillery",
    1944,
    ["aa_imp_2"],
    { aaPct: 15 },
    { project: "sp_proximity_fuze" },
  ),
  // -- naval
  naval_aa_1: n(
    "naval_aa_1",
    "naval",
    1938,
    ["anti_air_1"],
    {},
    {
      role: "module",
      design: { designer: "ship", part: "module", id: "aa_2" },
    },
  ),
  damage_control_1: n("damage_control_1", "naval", 1938, [], {
    navalDamageTakenPct: -5,
  }),
  naval_engine_2: n("naval_engine_2", "naval", 1939, [], {
    navalSpeedPct: 5,
  }),
  convoy_escort_1: n("convoy_escort_1", "naval", 1939, ["dd_2"], {
    convoyEscortPct: 10,
  }),
  torpedo_2: n("torpedo_2", "naval", 1940, ["torpedo_1"], { torpedoPct: 10 }),
  depth_charge_2: n("depth_charge_2", "naval", 1940, ["sonar_1"], {
    depthChargePct: 15,
  }),
  // Magnetic mines and sweeping: the mine rules read the id (phase 2).
  mine_warfare_2: n("mine_warfare_2", "naval", 1940, ["mine_warfare_1"], {}),
  transport_ship_2: n("transport_ship_2", "naval", 1940, [], {
    convoyLossPct: -10,
  }),
  fire_control_2: n(
    "fire_control_2",
    "naval",
    1941,
    ["fire_control_1", "naval_radar_1"],
    {},
    {
      cost: COST_NORMAL,
      role: "module",
      design: { designer: "ship", part: "module", id: "fc_2" },
    },
  ),
  naval_aa_2: n(
    "naval_aa_2",
    "naval",
    1941,
    ["naval_aa_1", "dual_purpose_guns"],
    {},
    {
      role: "module",
      design: { designer: "ship", part: "module", id: "aa_3" },
    },
  ),
  damage_control_2: n("damage_control_2", "naval", 1941, ["damage_control_1"], {
    navalDamageTakenPct: -5,
    repairPct: 10,
  }),
  naval_engine_3: n("naval_engine_3", "naval", 1942, ["naval_engine_2"], {
    navalSpeedPct: 5,
  }),
  hedgehog: n("hedgehog", "naval", 1942, ["depth_charge_2", "sonar_2"], {
    depthChargePct: 15,
  }),
  convoy_escort_2: n(
    "convoy_escort_2",
    "naval",
    1942,
    ["convoy_escort_1", "sonar_2"],
    { convoyEscortPct: 10 },
  ),
  carrier_deck_2: n(
    "carrier_deck_2",
    "naval",
    1942,
    ["cv_3", "armored_deck"],
    { carrierDeckPct: 10 },
    { cost: COST_NORMAL },
  ),
  torpedo_3: n(
    "torpedo_3",
    "naval",
    1943,
    ["torpedo_2", "sonar_2"],
    { torpedoPct: 10, subTorpedoPct: 10 },
    { cost: COST_NORMAL },
  ),
  // -- air
  aero_engine_2: n("aero_engine_2", "air", 1939, ["fighter_1"], {
    airAgilityPct: 5,
  }),
  air_armor_1: n("air_armor_1", "air", 1939, ["self_sealing_tanks"], {
    airLossCutPct: 5,
  }),
  naval_strike_1: n("naval_strike_1", "air", 1939, ["naval_bomber_1"], {
    navalStrikePct: 10,
  }),
  long_range_1: n("long_range_1", "air", 1940, ["drop_tanks"], {
    airRangePct: 10,
  }),
  transport_plane_2: n(
    "transport_plane_2",
    "air",
    1941,
    ["transport_plane_1"],
    { paradropPrepPct: -15 },
  ),
  air_ground_control: n(
    "air_ground_control",
    "air",
    1941,
    ["radar_1", "signal_company"],
    { interceptShareBp: 500 },
    { cost: COST_NORMAL },
  ),
  carrier_aviation_2: n(
    "carrier_aviation_2",
    "air",
    1941,
    ["carrier_aviation"],
    { sortieEffPct: 10 },
  ),
  aero_engine_3: n("aero_engine_3", "air", 1942, ["aero_engine_2"], {
    airAgilityPct: 5,
  }),
  bomb_sight_2: n("bomb_sight_2", "air", 1942, ["bomb_sight_1"], {
    stratBombPct: 10,
  }),
  naval_strike_2: n("naval_strike_2", "air", 1942, ["naval_strike_1"], {
    navalStrikePct: 10,
  }),
  aero_engine_4: n("aero_engine_4", "air", 1944, ["aero_engine_3"], {
    airAgilityPct: 5,
  }),
  air_rockets_2: n("air_rockets_2", "air", 1944, ["air_rockets_1"], {
    casPct: 10,
  }),
  air_radar_2: n(
    "air_radar_2",
    "air",
    1944,
    ["air_radar_1", "radar_2"],
    {},
    {
      cost: COST_NORMAL,
      role: "module",
      design: { designer: "plane", part: "module", id: "radar_2" },
    },
  ),
  jet_airframe_2: n(
    "jet_airframe_2",
    "air",
    1945,
    ["aero_engine_4"],
    {},
    {
      cost: COST_BIG,
      role: "post",
      project: "sp_jet_engine",
      design: { designer: "plane", part: "chassis", id: "jet_2" },
    },
  ),
  jet_bomber_1: n(
    "jet_bomber_1",
    "air",
    1945,
    ["strat_bomber_2"],
    {},
    {
      cost: COST_BIG,
      role: "post",
      project: "sp_jet_engine",
      design: { designer: "plane", part: "chassis", id: "jet_medium_1" },
    },
  ),
  // -- engineering (branch electronics)
  radio_1: n(
    "radio_1",
    "electronics",
    1937,
    ["electronics_1"],
    { planSpeedPct: 5 },
    { role: "eco" },
  ),
  encryption_1: n(
    "encryption_1",
    "electronics",
    1938,
    ["electronics_1"],
    { encryptPct: 10 },
    { role: "eco" },
  ),
  radio_2: n(
    "radio_2",
    "electronics",
    1940,
    ["radio_1"],
    { planMaxBp: 500 },
    { role: "eco" },
  ),
  encryption_2: n(
    "encryption_2",
    "electronics",
    1941,
    ["encryption_1"],
    { encryptPct: 10 },
    { role: "eco" },
  ),
  rocketry_2: n(
    "rocketry_2",
    "electronics",
    1942,
    ["rocketry_1"],
    { projectSpeedPct: 10 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  operations_research: n(
    "operations_research",
    "electronics",
    1942,
    ["computing_2"],
    { supplyUsePct: -3, convoyLossPct: -5 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  radar_3: n(
    "radar_3",
    "electronics",
    1943,
    ["radar_2"],
    { airDetectPct: 10, navalDetectPct: 10 },
    { cost: COST_NORMAL, role: "eco", project: "sp_cavity_magnetron" },
  ),
  computing_3: n(
    "computing_3",
    "electronics",
    1943,
    ["computing_2"],
    { researchPct: 5 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  electronic_warfare: n(
    "electronic_warfare",
    "electronics",
    1943,
    ["radar_2"],
    { nightBombBp: 500, airDetectPct: 5 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  cryptography_4: n(
    "cryptography_4",
    "electronics",
    1944,
    ["cryptography_3", "computing_2"],
    { decryptPct: 10 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  computing_4: n(
    "computing_4",
    "electronics",
    1945,
    ["computing_3"],
    { researchPct: 3 },
    { cost: COST_BIG },
  ),
  // A power reactor: energy, not a weapon.
  nuclear_reactor: n(
    "nuclear_reactor",
    "electronics",
    1945,
    ["nuclear_physics"],
    { energyPct: 10 },
    { cost: COST_BIG },
  ),
  // -- industry (concentrated ⇄ dispersed: either/or, changes §2.4)
  concentrated_1: n(
    "concentrated_1",
    "industry",
    1937,
    ["tools_1"],
    { outputPct: 5 },
    { cost: COST_NORMAL, role: "eco", exclusive: CONCENTRATED },
  ),
  dispersed_1: n(
    "dispersed_1",
    "industry",
    1937,
    ["tools_1"],
    { effCapBp: 300, bombDamageTakenPct: -10 },
    { cost: COST_NORMAL, role: "eco", exclusive: DISPERSED },
  ),
  fuel_storage_1: n(
    "fuel_storage_1",
    "industry",
    1938,
    [],
    { fuelCapPct: 10 },
    { role: "eco" },
  ),
  fuel_refining_1: n(
    "fuel_refining_1",
    "industry",
    1938,
    ["excavation_1"],
    { fuelPct: 10 },
    { role: "eco" },
  ),
  energy_grid_1: n(
    "energy_grid_1",
    "industry",
    1938,
    [],
    { energyPct: 10 },
    { role: "eco" },
  ),
  dockyard_1: n(
    "dockyard_1",
    "industry",
    1938,
    [],
    { dockOutputPct: 10 },
    { role: "eco" },
  ),
  fortification_2: n(
    "fortification_2",
    "industry",
    1939,
    ["fortification_1"],
    { fortConstructionPct: 33 },
    { role: "eco" },
  ),
  // A refinery also makes rubber: the resource rules read the id (phase 2).
  synthetic_rubber_1: n(
    "synthetic_rubber_1",
    "industry",
    1939,
    ["synthetic_oil_1"],
    {},
    { cost: COST_NORMAL, role: "eco" },
  ),
  concentrated_2: n(
    "concentrated_2",
    "industry",
    1940,
    ["concentrated_1", "tools_2"],
    { outputPct: 5 },
    { cost: COST_NORMAL, role: "eco", exclusive: CONCENTRATED },
  ),
  dispersed_2: n(
    "dispersed_2",
    "industry",
    1940,
    ["dispersed_1", "tools_2"],
    { effCapBp: 300, bombDamageTakenPct: -10 },
    { cost: COST_NORMAL, role: "eco", exclusive: DISPERSED },
  ),
  rail_2: n(
    "rail_2",
    "industry",
    1940,
    ["rail_1"],
    { railConstructionPct: 33, railSpeedPct: 20 },
    { role: "eco" },
  ),
  fuel_refining_2: n(
    "fuel_refining_2",
    "industry",
    1941,
    ["fuel_refining_1"],
    { fuelPct: 10 },
    { role: "eco" },
  ),
  energy_grid_2: n(
    "energy_grid_2",
    "industry",
    1941,
    ["energy_grid_1"],
    { energyPct: 10 },
    { role: "eco" },
  ),
  dockyard_2: n(
    "dockyard_2",
    "industry",
    1941,
    ["dockyard_1"],
    { dockOutputPct: 10 },
    { role: "eco" },
  ),
  construction_4: n(
    "construction_4",
    "industry",
    1942,
    ["construction_3"],
    { constructionPct: 10, slotPct: 20 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  excavation_3: n(
    "excavation_3",
    "industry",
    1942,
    ["excavation_2"],
    { extractionPct: 10 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  fortification_3: n(
    "fortification_3",
    "industry",
    1942,
    ["fortification_2"],
    { fortDefPerLevelBp: 100 },
    { role: "eco" },
  ),
  concentrated_3: n(
    "concentrated_3",
    "industry",
    1943,
    ["concentrated_2", "tools_3"],
    { outputPct: 5 },
    { cost: COST_NORMAL, role: "eco", exclusive: CONCENTRATED },
  ),
  dispersed_3: n(
    "dispersed_3",
    "industry",
    1943,
    ["dispersed_2", "tools_3"],
    { effCapBp: 300, bombDamageTakenPct: -10 },
    { cost: COST_NORMAL, role: "eco", exclusive: DISPERSED },
  ),
  tools_5: n(
    "tools_5",
    "industry",
    1944,
    ["tools_4"],
    { effCapBp: 500 },
    { cost: COST_NORMAL, role: "eco" },
  ),
  construction_5: n(
    "construction_5",
    "industry",
    1945,
    ["construction_4"],
    { constructionPct: 10 },
    { cost: COST_NORMAL },
  ),
} as Record<WwTechId, WwTechDef>;

/** P6 (plan decision 25, spec §1.4): the 20 old doctrine techs, retired. */
export const RETIRED_DOCTRINE_TECHS: readonly WwTechId[] = [
  "mobile_1",
  "mobile_2",
  "firepower_1",
  "firepower_2",
  "battleplan_1",
  "battleplan_2",
  "mass_1",
  "mass_2",
  "fleet_in_being_1",
  "fleet_in_being_2",
  "trade_interdiction_1",
  "trade_interdiction_2",
  "base_strike_1",
  "base_strike_2",
  "strategic_destruction_1",
  "strategic_destruction_2",
  "battlefield_support_1",
  "battlefield_support_2",
  "operational_integrity_1",
  "operational_integrity_2",
];
const RETIRED = new Set<WwTechId>(RETIRED_DOCTRINE_TECHS);

/** Spec §9.4; P6: the retired doctrine techs keep their row, empty. */
export const WW_TECHS: Readonly<Record<WwTechId, WwTechDef>> =
  Object.fromEntries(
    WW_TECH_IDS.map((id) => {
      const d = BASE_TECHS[id];
      return [
        id,
        RETIRED.has(id) ? { ...d, effects: {}, retired: true as const } : d,
      ];
    }),
  ) as Record<WwTechId, WwTechDef>;

/**
 * P6 (spec §3.2, pre-flight §0-5): a retired doctrine tech's own effects,
 * the values its grand doctrine carries on the same stat keys (one source:
 * DoctrineRules.GRAND_DOCTRINE_STATS is built from these).
 */
export function retiredTechEffects(id: WwTechId): Partial<WwStats> {
  return BASE_TECHS[id].effects;
}

/** P6: a tech no one researches (plan decision 25). */
export function isRetiredTech(id: WwTechId): boolean {
  return WW_TECHS[id].retired === true;
}

const ZERO: TechEffects = {
  constructionPct: 0,
  slotPct: 0,
  effCapBp: 0,
  outputPct: 0,
  extractionPct: 0,
  retentionBp: 0,
  researchPct: 0,
  attackPct: 0,
  defensePct: 0,
  speedPct: 0,
  vehicleBonusPct: 0,
  gunBonusPct: 0,
  recruitablePct: 0,
  trainPct: 0,
  fortConstructionPct: 0,
  railConstructionPct: 0,
  railSpeedPct: 0,
  breakthroughPct: 0,
  orgPct: 0,
  recoveryPct: 0,
  planSpeedPct: 0,
  planMaxBp: 0,
  entrenchMax: 0,
  supplyUsePct: 0,
  armyXpMilli: 0,
  generalXpPct: 0,
  winterPenaltyPct: 0,
  desertAttackPct: 0,
  forestDefensePct: 0,
  mechBreakPct: 0,
  mechOrg: 0,
  artillerySoftPct: 0,
  infTrainCutPct: 0,
  infOrg: 0,
  positioningPct: 0,
  screeningPct: 0,
  convoyRaidPct: 0,
  carrierStrikePct: 0,
  stratBombPct: 0,
  casPct: 0,
  paradropPrepPct: 0,
  airDetectPct: 0,
  navalDetectPct: 0,
  capitalAttackPct: 0,
  capitalHpPct: 0,
  subTorpedoPct: 0,
  subVisibilityPct: 0,
  subOrg: 0,
  surfaceRaidPct: 0,
  deckPct: 0,
  navalBomberPct: 0,
  carrierRoundsCut: 0,
  fighterAttackPct: 0,
  heavyDefensePct: 0,
  fighterAgilityPct: 0,
  airLossCutPct: 0,
  airNavalPct: 0,
  supPenaltyPp: 0,
};

/**
 * Summed effects of researched techs (fixed WW_TECH_IDS order). The P1+P2
 * keys are always there; another key only once a researched tech gives it.
 */
export function techTotals(researched: ReadonlySet<WwTechId>): TechTotals {
  const out: TechTotals = { ...ZERO };
  const sum = out as Partial<WwStats>;
  for (const id of WW_TECH_IDS) {
    // P6 plan decision 25: a retired tech adds nothing (its effects are {}).
    if (!researched.has(id) || RETIRED.has(id)) continue;
    const fx = WW_TECHS[id].effects;
    for (const k in fx) {
      const key = k as keyof WwStats;
      sum[key] = (sum[key] ?? 0) + fx[key]!;
    }
  }
  return out;
}

/** Base research days of a tech year (spec §9.2). */
export function techDays(year: number): number {
  return 120 + 15 * (year - 1936);
}

/**
 * Research overhaul (changes §2.7): a tech's research cost, milli-days —
 * techDays(year) × its multiplier × the global knob (both ‰), rounded
 * down. The engine (stepResearch), the screens' ETA and the saved
 * progress all use this one function.
 */
export function techCostMilli(
  id: WwTechId,
  knobPm: number = WW_RESEARCH_COST_PM,
): number {
  const d = WW_TECHS[id];
  return Math.floor((techDays(d.year) * d.costPm * knobPm) / 1000);
}

/** techCostMilli in whole days, rounded up (the screens). */
export function techCostDays(id: WwTechId): number {
  return Math.ceil(techCostMilli(id) / 1000);
}

/**
 * The doctrine school a country has opened in `domain` (researched or
 * researching), or null. P4 plan decision 23: one school a domain (land,
 * sea, air).
 */
export function openSchool(
  techs: Iterable<WwTechId>,
  domain: "land" | "sea" | "air" = "land",
): DoctrineSchool | null {
  for (const id of techs) {
    const s = WW_TECHS[id].school;
    if (s !== undefined && DOCTRINE_DOMAIN[s] === domain) return s;
  }
  return null;
}
