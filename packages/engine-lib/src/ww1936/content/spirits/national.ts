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
    stats: { mechBreakPct: 15, mechOrg: 4, armorBrkPct: 15 },
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
      mioCostPct_infantry: -15,
      mioCostPct_artillery: -15,
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
    stats: { convoyLossPct: -20, convoyEscortPct: 15 },
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
      advanceSpeedPct: -20,
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
    stats: { infAttackPct: 15, infOrg: 5 },
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
    stats: { mioCostPct_armor: -15, mioCostPct_air_light: -15, speedPct: 15 },
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
];

/** The traits each major starts with, in the order the panel shows them. */
export const NATIONAL_SPIRITS: Readonly<Record<string, readonly string[]>> = {
  DEU: ["nat_deu_panzer", "nat_deu_workshop", "nat_deu_strain"],
  SUN: ["nat_sun_mass", "nat_sun_resilience"],
  USA: ["nat_usa_arsenal", "nat_usa_logistics", "nat_usa_slow_mobilisation"],
  GBR: ["nat_gbr_lifeline", "nat_gbr_radar_net", "nat_gbr_commonwealth"],
  FRA: ["nat_fra_citadel", "nat_fra_slow_heavy", "nat_fra_stripped_arsenal"],
  JPN: ["nat_jpn_kido_butai", "nat_jpn_assault", "nat_jpn_scarce"],
  ITA: [
    "nat_ita_mare_nostrum",
    "nat_ita_light_forces",
    "nat_ita_thin_industry",
  ],
};
