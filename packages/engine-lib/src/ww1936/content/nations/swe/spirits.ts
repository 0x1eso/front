// ww229: Sweden's national spirits (names and texts ww1936.spirit.<id>,
// ww1936.spirit_desc.<id>). Data only. The start keeps the shared
// gen_armed_neutrality until swe_armed_watch replaces it with the first step
// of the readiness ladder (watch, reinforced, full), which the readiness
// decisions climb and descend.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SWE_SPIRITS: readonly SpiritDef[] = [
  // ---- start ----
  // The 1933 "cow trade": Social Democrats and the Farmers' League.
  {
    id: "swe_cow_trade",
    icon: "handshake",
    stats: { stabilityBp: 500, ppGainPct: 5 },
  },
  // The 1925 defence decision cut the army to a cadre.
  {
    id: "swe_defence_1925",
    icon: "chain_broken",
    stats: { trainPct: 10, orgPct: -5 },
  },
  // Kiruna and Gällivare ore, the lever of Swedish neutrality.
  {
    id: "swe_northern_ore",
    icon: "mine",
    stats: { extractionPct: 10, tradeCostPct: 5 },
  },
  // ---- the readiness ladder (mechanism) ----
  {
    id: "swe_readiness_watch",
    icon: "tower",
    stats: { defensePct: 10, enemyJustifyTimePct: 50, fortConstructionPct: 10 },
  },
  {
    id: "swe_readiness_reinforced",
    icon: "tower",
    stats: {
      defensePct: 15,
      enemyJustifyTimePct: 50,
      fortConstructionPct: 15,
      recruitablePct: 2,
      consumerGoodsPp: 2,
    },
  },
  {
    id: "swe_readiness_full",
    icon: "shield",
    stats: {
      defensePct: 20,
      enemyJustifyTimePct: 50,
      fortConstructionPct: 20,
      recruitablePct: 4,
      consumerGoodsPp: 5,
      stabilityBp: -500,
      warSupportBp: 1000,
    },
  },
  // ---- the ore contracts (decisions, a year each) ----
  {
    id: "swe_coal_from_germany",
    icon: "steel",
    stats: { tradeCostPct: 10, civConstructionPct: 5 },
  },
  {
    id: "swe_western_trade",
    icon: "oil",
    stats: { tradeCostPct: 10, fuelPct: 10 },
  },
  // ---- focuses and events ----
  {
    id: "swe_social_insurance",
    icon: "document",
    stats: { stabilityBp: 700, consumerGoodsPp: 1 },
  },
  {
    id: "swe_national_coalition",
    icon: "handshake",
    stats: { ppGainPct: 10, stabilityBp: 500, warSupportBp: 300 },
  },
  {
    id: "swe_swedish_model",
    icon: "scales",
    stats: { outputPct: 5, stabilityBp: 300 },
  },
  {
    id: "swe_crown_rule",
    icon: "crown",
    stats: { stabilityBp: 1000, coupResistPct: 25, ppGainPct: 5 },
  },
  {
    id: "swe_national_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 1500, milConstructionPct: 10, stabilityBp: -500 },
  },
  {
    id: "swe_workers_state",
    icon: "fist",
    stats: {
      civConstructionPct: 10,
      milConstructionPct: 10,
      stabilityBp: -500,
    },
  },
  {
    id: "swe_labour_peace",
    icon: "handshake",
    stats: { stabilityBp: 500, outputPct: 3 },
  },
  { id: "swe_ore_boom", icon: "mine", stats: { extractionPct: 15 } },
  {
    id: "swe_quality_steel",
    icon: "steel",
    stats: { outputPct: 3, rsArmorPct: 5 },
  },
  {
    id: "swe_skf_bearings",
    icon: "industry",
    stats: { milConstructionPct: 5, outputPct: 3 },
  },
  { id: "swe_gas_generators", icon: "oil", stats: { fuelUsePct: -10 } },
  {
    id: "swe_norrland_winter",
    icon: "compass",
    stats: { recoveryPct: 5, infDefensePct: 3 },
  },
  {
    id: "swe_staff_college",
    icon: "map",
    stats: { planSpeedPct: 10, generalXpPct: 10 },
  },
  {
    id: "swe_army_1942",
    icon: "infantry",
    stats: { orgPct: 5, reinforcePct: 10 },
  },
  {
    id: "swe_home_guard",
    icon: "shield",
    stats: { recruitablePct: 3, defensePct: 3 },
  },
  { id: "swe_baltic_minefields", icon: "ship", stats: { navyDefensePct: 5 } },
  {
    id: "swe_german_market",
    icon: "steel",
    stats: { tradeCostPct: 5, outputPct: 3 },
  },
  {
    id: "swe_western_market",
    icon: "globe",
    stats: { tradeCostPct: 5, researchPct: 3 },
  },
  {
    id: "swe_nordic_cause",
    icon: "flag",
    stats: { warSupportBp: 500, ppGainPct: 5 },
  },
  {
    id: "swe_united_north",
    icon: "crown",
    stats: { stabilityBp: 500, recruitablePct: 3, ppGainPct: 5 },
  },
  {
    id: "swe_ration_cards",
    icon: "wheat",
    stats: { consumerGoodsPp: -2, stabilityBp: -300 },
  },
  {
    id: "swe_grey_press",
    icon: "megaphone",
    stats: { stabilityBp: 300, warSupportBp: 300 },
  },
  {
    id: "swe_total_defence",
    icon: "fort",
    stats: { recruitablePct: 2, fortConstructionPct: 15, warSupportBp: 500 },
  },
];
