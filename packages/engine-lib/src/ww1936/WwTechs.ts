import {
  DOCTRINE_DOMAIN,
  DoctrineSchool,
  TechBranch,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";

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
export type TechTotals = TechEffects;

export interface WwTechDef {
  id: WwTechId;
  branch: TechBranch;
  year: number;
  prereqs: readonly WwTechId[];
  effects: Partial<TechEffects>;
  school?: DoctrineSchool;
  /**
   * P6 (plan decision 25, spec §1.4): an old doctrine tech. Its id stays in
   * WW_TECH_IDS; it cannot be researched, the screens skip it and its
   * effects are empty (the grand doctrines carry them now).
   */
  retired?: true;
}

function t(
  id: WwTechId,
  branch: TechBranch,
  year: number,
  prereqs: readonly WwTechId[] = [],
  effects: Partial<TechEffects> = {},
  school?: DoctrineSchool,
): WwTechDef {
  return { id, branch, year, prereqs, effects, ...(school ? { school } : {}) };
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

/** Summed effects of researched techs (fixed WW_TECH_IDS order). */
export function techTotals(researched: ReadonlySet<WwTechId>): TechTotals {
  const out = { ...ZERO };
  for (const id of WW_TECH_IDS) {
    // P6 plan decision 25: a retired tech adds nothing (its effects are {}).
    if (!researched.has(id) || RETIRED.has(id)) continue;
    for (const [k, v] of Object.entries(WW_TECHS[id].effects)) {
      out[k as keyof TechEffects] += v;
    }
  }
  return out;
}

/** Base research days (spec §9.2). */
export function techDays(year: number): number {
  return 120 + 15 * (year - 1936);
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
