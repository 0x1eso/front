import {
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
}
export type TechTotals = TechEffects;

export interface WwTechDef {
  id: WwTechId;
  branch: TechBranch;
  year: number;
  prereqs: readonly WwTechId[];
  effects: Partial<TechEffects>;
  school?: DoctrineSchool;
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

// Spec §9.4.
export const WW_TECHS: Readonly<Record<WwTechId, WwTechDef>> = {
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
};

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
};

/** Summed effects of researched techs (fixed WW_TECH_IDS order). */
export function techTotals(researched: ReadonlySet<WwTechId>): TechTotals {
  const out = { ...ZERO };
  for (const id of WW_TECH_IDS) {
    if (!researched.has(id)) continue;
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

/** The doctrine school a country has opened (researched or researching), or null. */
export function openSchool(techs: Iterable<WwTechId>): DoctrineSchool | null {
  for (const id of techs) {
    const s = WW_TECHS[id].school;
    if (s !== undefined) return s;
  }
  return null;
}
