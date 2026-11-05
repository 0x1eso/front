// World War 1936 w69: the seven majors' permanent national traits, one way of
// playing each. Texts: ww1936.spirit.<id>, ww1936.spirit_desc.<id>; the
// one-line style of each country is ww1936.style.<TAG>. They sit in the
// country's starting spirits (countries.ts) and apply to the AI and a human
// alike. Effects are 15-25 % (a few points of org or reliability where the
// stat is not a percent). Nothing here rests on terrain or weather.
//
// The Soviet Union's early command weakness is timed: it starts with the
// country, runs out on its date and hands over to a milder one (SpiritDef.next).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

/** The date the Soviet purge gap ends, and the date its scars end. */
export const SUN_GAP_END = "1941-01-01";
export const SUN_SCARS_END = "1942-01-01";

export const SPIRITS_NATIONAL: readonly SpiritDef[] = [
  // ---- Germany: quality and armoured war ----
  {
    id: "nat_deu_panzer",
    icon: "tank",
    stats: { mechBreakPct: 10, mechOrg: 4, armorBrkPct: 10 },
  },
  { id: "nat_deu_workshop", icon: "industry", stats: { effCapBp: 800 } },
  {
    id: "nat_deu_strain",
    icon: "mine",
    stats: { mioCostPct_armor: 15, mioRelPp_armor: -5, extractionPct: -15 },
  },

  // ---- Soviet Union: manpower and mass production ----
  {
    id: "nat_sun_mass",
    icon: "infantry",
    stats: {
      recruitablePct: 20,
      mioCostPct_infantry: -5,
      mioCostPct_artillery: -5,
      mioCostPct_armor: -15,
      mioStatPct_armor: -10,
      mioStatPct_air_light: -10,
    },
  },
  {
    id: "nat_sun_resilience",
    icon: "fist",
    stats: { recoveryPct: 25, reinforcePct: 20 },
  },
  {
    id: "nat_sun_purge_gap",
    icon: "chain_broken",
    stats: { orgPct: -15, planSpeedPct: -30, planMaxBp: -1500 },
    next: "nat_sun_purge_scars",
    nextUntil: SUN_SCARS_END,
  },
  {
    id: "nat_sun_purge_scars",
    icon: "chain_broken",
    stats: { orgPct: -7, planSpeedPct: -15, planMaxBp: -700 },
  },

  // ---- United States: industry and logistics ----
  {
    id: "nat_usa_arsenal",
    icon: "factory",
    stats: {
      constructionPct: 20,
      dockOutputPct: 15,
      mioCostPct_air_light: -10,
      mioCostPct_air_heavy: -10,
      mioCostPct_naval: -10,
    },
  },
  {
    id: "nat_usa_logistics",
    icon: "rail",
    stats: { supplyUsePct: -15, fuelUsePct: -15, fuelCapPct: 20 },
  },
  {
    id: "nat_usa_slow_mobilisation",
    icon: "dove",
    stats: { trainPct: 25, recruitablePct: -10 },
  },

  // ---- United Kingdom: sea and air ----
  {
    id: "nat_gbr_lifeline",
    icon: "ship",
    stats: { convoyLossPct: -15, convoyEscortPct: 15 },
  },
  {
    id: "nat_gbr_radar_net",
    icon: "radio",
    stats: { airDetectPct: 25, airDefensePct: 15, aaPct: 15 },
  },
  {
    id: "nat_gbr_commonwealth",
    icon: "globe",
    stats: {
      extractionPct: 15,
      tradeCostPct: 15,
      recruitablePct: -15,
      mioStatPct_armor: -10,
    },
  },

  // ---- France: fortress defence ----
  {
    id: "nat_fra_citadel",
    icon: "fort",
    stats: { fortDefPerLevelBp: 500, entrenchSpeedPct: 50, entrenchMax: 1 },
  },
  {
    id: "nat_fra_slow_heavy",
    icon: "tank",
    stats: {
      armorArmorPct: 15,
      armorDefensePct: 10,
      advanceSpeedPct: -15,
      infAttackPct: -10,
    },
  },
  {
    id: "nat_fra_stripped_arsenal",
    icon: "chain_broken",
    stats: {},
    rules: ["licence_gear_only"],
  },

  // ---- Japan: naval aviation and infantry assault ----
  {
    id: "nat_jpn_kido_butai",
    icon: "carrier",
    stats: { carrierStrikePct: 20, carrierDeckPct: 15, torpedoPct: 20 },
  },
  {
    id: "nat_jpn_assault",
    icon: "sword",
    stats: { infAttackPct: 10, infOrg: 3 },
  },
  {
    id: "nat_jpn_scarce",
    icon: "oil",
    stats: { extractionPct: -10, tradeCostPct: -10, mioStatPct_armor: -10 },
  },

  // ---- Italy: the Mediterranean and light mobility ----
  { id: "nat_ita_mare_nostrum", icon: "ship", stats: { navalSpeedPct: 20 } },
  {
    id: "nat_ita_light_forces",
    icon: "road",
    stats: { mioCostPct_armor: -15, mioCostPct_air_light: -15 },
  },
  {
    id: "nat_ita_thin_industry",
    icon: "factory_mil",
    stats: {
      constructionPct: -15,
      outputPct: -10,
      mioStatPct_armor: -10,
      mioStatPct_artillery: -10,
    },
  },

  // ---- ww91 N2: the army of each major (area A), from the start ----
  // Strength and cost together, as the major's way of fighting; the rows and
  // their history are in ww91-national-design.md section 4.
  {
    // Assault tactics and radios, a long school; the guns lag the panzers.
    id: "nat_deu_army",
    icon: "infantry",
    stats: {
      infBrkPct: 15,
      infOrg: 3,
      infTrainCutPct: -15,
      tacticInitiative: 5,
      artSpeedPct: -10,
    },
  },
  {
    // A mass army trained quickly, a planned barrage, a rough early tank.
    id: "nat_sun_army",
    icon: "infantry",
    stats: {
      infTrainCutPct: 15,
      infAttackPct: -10,
      footDefOrgPp: -5,
      tacticInitiative: -5,
      prepFirePct: 25,
      artillerySoftPct: -10,
      armorArmorPct: 10,
      armorRelPp: -5,
    },
  },
  {
    // Fire direction centres, a reliable thin tank, steady replacements.
    id: "nat_usa_army",
    icon: "artillery",
    stats: {
      artillerySoftPct: 15,
      artSupplyPct: 15,
      armorSpeedPct: 10,
      armorRelPp: 5,
      armorArmorPct: -10,
      reinforcePct: 10,
      infOrg: -3,
      divXpGainPct: -15,
      casualtyReturnPp: 10,
    },
  },
  {
    // Firepower instead of infantry risk; few men, so slow and careful.
    id: "nat_gbr_army",
    icon: "artillery",
    stats: {
      artillerySoftPct: 15,
      infAttackPct: -10,
      infOrg: 3,
      reinforcePct: -15,
      advanceSpeedPct: -10,
      armorRelPp: -5,
    },
  },
  {
    // Methodical battle, plenty of guns, a hollow reserve, thick slow tanks.
    id: "nat_fra_army",
    icon: "fort",
    stats: {
      planMaxBp: 1000,
      planSpeedPct: -15,
      tacticInitiative: -10,
      artillerySoftPct: 10,
      atPiercePct: 10,
      recruitablePct: -10,
      armorAttackPct: -10,
    },
  },
  {
    // Night infiltration and no surrender; few guns, little to eat.
    id: "nat_jpn_army",
    icon: "sword",
    stats: {
      infBrkPct: 10,
      casualtyReturnPp: -10,
      footDefOrgPp: -5,
      atPiercePct: -15,
      infSupplyPct: -15,
      artillerySoftPct: -15,
    },
  },
  {
    // Binary divisions raised fast; thin firepower and old guns.
    id: "nat_ita_army",
    icon: "infantry",
    stats: { infTrainCutPct: 15, infAttackPct: -10, tacticInitiative: -5 },
  },

  // ---- ww91 N2: the national units (area C), given by a focus ----
  // natUnit hides the line; NationalUnits.ts holds the numbers.
  { id: "nat_deu_unit", icon: "road", stats: { natUnit: 1 } },
  { id: "nat_sun_unit", icon: "medal", stats: { natUnit: 2 } },
  { id: "nat_usa_unit", icon: "ship", stats: { natUnit: 3 } },
  { id: "nat_gbr_unit", icon: "sword", stats: { natUnit: 4 } },
  { id: "nat_fra_unit", icon: "medal", stats: { natUnit: 5 } },
  { id: "nat_jpn_unit", icon: "ship", stats: { natUnit: 6 } },
  { id: "nat_ita_unit", icon: "compass", stats: { natUnit: 7 } },
];

/** The traits each major starts with, in the order the panel shows them. */
export const NATIONAL_SPIRITS: Readonly<Record<string, readonly string[]>> = {
  DEU: ["nat_deu_panzer", "nat_deu_workshop", "nat_deu_strain", "nat_deu_army"],
  SUN: ["nat_sun_mass", "nat_sun_resilience", "nat_sun_army"],
  USA: [
    "nat_usa_arsenal",
    "nat_usa_logistics",
    "nat_usa_slow_mobilisation",
    "nat_usa_army",
  ],
  GBR: [
    "nat_gbr_lifeline",
    "nat_gbr_radar_net",
    "nat_gbr_commonwealth",
    "nat_gbr_army",
  ],
  FRA: [
    "nat_fra_citadel",
    "nat_fra_slow_heavy",
    "nat_fra_stripped_arsenal",
    "nat_fra_army",
  ],
  JPN: ["nat_jpn_kido_butai", "nat_jpn_assault", "nat_jpn_scarce", "nat_jpn_army"],
  ITA: [
    "nat_ita_mare_nostrum",
    "nat_ita_light_forces",
    "nat_ita_thin_industry",
    "nat_ita_army",
  ],
};
