// ww229: Portugal's national spirits (names and texts ww1936.spirit.<id>,
// ww1936.spirit_desc.<id>). Data only. The wolfram contracts are timed
// spirits the decisions give a year at a time; the Azores spirits come from
// the lease or the armed refusal.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const PRT_SPIRITS: readonly SpiritDef[] = [
  // ---- start ----
  // The New State of the 1933 constitution: one party list, censorship,
  // corporations instead of unions, a president above it all.
  {
    id: "prt_estado_novo",
    icon: "shield",
    stats: { stabilityBp: 800, coupResistPct: 25, driftNeuBp: 2 },
  },
  // Salazar's surpluses: a sound escudo, but every escudo counted twice.
  {
    id: "prt_salazar_finances",
    icon: "scales",
    stats: { ppGainPct: 10, consumerGoodsPp: -2, constructionPct: -5 },
  },
  // A country of smallholders and fishermen, half of it unable to read.
  {
    id: "prt_rural_country",
    icon: "wheat",
    stats: { researchPct: -10, outputPct: -10, manpowerGrowthPct: 5 },
  },
  // The alliance of 1373 with England, the oldest still in force.
  {
    id: "prt_oldest_alliance",
    icon: "handshake",
    stats: { enemyJustifyTimePct: 25, tradeCostPct: -5 },
  },
  // ---- the wolfram trade (mechanism) ----
  {
    id: "prt_german_contracts",
    icon: "mine",
    stats: { tradeCostPct: -10, ppGainPct: 5, milConstructionPct: 5 },
  },
  {
    id: "prt_allied_contracts",
    icon: "mine",
    stats: { tradeCostPct: -10, ppGainPct: 5, fuelPct: 10 },
  },
  {
    id: "prt_wolfram_rush",
    icon: "mine",
    stats: { extractionPct: 15, ppGainPct: 5, stabilityBp: -300 },
  },
  {
    id: "prt_allied_purchases",
    icon: "handshake",
    stats: { extractionPct: 10, tradeCostPct: -10 },
  },
  // ---- the Atlantic islands ----
  {
    id: "prt_atlantic_bases",
    icon: "plane",
    stats: { convoyEscortPct: 10, airDetectPct: 10, tradeCostPct: -5 },
  },
  {
    id: "prt_armed_islands",
    icon: "fort",
    stats: { defensePct: 10, enemyJustifyTimePct: 30, fortConstructionPct: 10 },
  },
  // ---- focuses and events ----
  {
    id: "prt_corporative_order",
    icon: "scales",
    stats: { stabilityBp: 500, consumerGoodsPp: -1, driftComBp: -2 },
  },
  {
    id: "prt_licensing_regime",
    icon: "document",
    stats: { stabilityBp: 300, civConstructionPct: -5, outputPct: 5 },
  },
  {
    id: "prt_fomento",
    icon: "factory",
    stats: { civConstructionPct: 10, infraConstructionPct: 10 },
  },
  {
    id: "prt_reorganised_industry",
    icon: "industry",
    stats: { outputPct: 5, effCapBp: 300, researchPct: 5 },
  },
  {
    id: "prt_patrol_service",
    icon: "ship",
    stats: { convoyEscortPct: 10, navalPatrolPct: 10, navyXpMilli: 50 },
  },
  {
    id: "prt_neutral_lean",
    icon: "dove",
    stats: { enemyJustifyTimePct: 25, tensionPct: -10, warSupportBp: -300 },
  },
  {
    id: "prt_peninsular_bloc",
    icon: "handshake",
    stats: { enemyJustifyTimePct: 20, defensePct: 5 },
  },
  {
    id: "prt_iberian_cause",
    icon: "flag",
    stats: { justifyTimePct: -15, warSupportBp: 500 },
  },
  {
    id: "prt_united_iberia",
    icon: "crown",
    stats: { stabilityBp: 500, recruitablePct: 2, outputPct: 5 },
  },
  {
    id: "prt_one_empire",
    icon: "globe",
    stats: { nonCoreManpowerPp: 5, extractionPct: 5, ppGainPct: 5 },
  },
  {
    id: "prt_pluricontinental",
    icon: "globe",
    stats: { stabilityBp: 300, nonCoreManpowerPp: 5, resistanceTargetPct: -10 },
  },
  {
    id: "prt_steadfast_neutrality",
    icon: "dove",
    stats: { stabilityBp: 500, enemyJustifyTimePct: 30 },
  },
  {
    id: "prt_rationing",
    icon: "wheat",
    stats: { consumerGoodsPp: -2, stabilityBp: -300, warSupportBp: 500 },
  },
  {
    id: "prt_legion_mobilised",
    icon: "infantry",
    stats: { recruitablePct: 2, defensePct: 5, stabilityBp: -200 },
  },
  {
    id: "prt_refugee_port",
    icon: "ship",
    stats: { intelPct: 15, ppGainPct: 5, stabilityBp: -200 },
  },
  {
    id: "prt_spanish_volunteers",
    icon: "flag",
    stats: { armyXpMilli: 50, warSupportBp: 300 },
  },
  // ---- the political routes' ends ----
  {
    id: "prt_restored_crown",
    icon: "crown",
    stats: { stabilityBp: 700, legitimacyGainPct: 10, driftNeuBp: 2 },
  },
  {
    id: "prt_syndicalist_order",
    icon: "eagle_plain",
    stats: { warSupportBp: 1000, recruitablePct: 2, stabilityBp: -300 },
  },
  {
    id: "prt_restored_republic",
    icon: "ballot",
    stats: { stabilityBp: 500, ppGainPct: 5, consumerGoodsPp: 1 },
  },
  {
    id: "prt_workers_republic",
    icon: "star_plain",
    stats: { recruitablePct: 2, outputPct: 5, stabilityBp: -300 },
  },
];
