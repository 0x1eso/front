// ww229: the Netherlands' national spirits (names and texts
// ww1936.spirit.<id>, ww1936.spirit_desc.<id>). Data only. The mechanism's
// two ladders: the water line (sluices ready, then flooded, then drained
// back) and the Indies oil contracts (a year each, to Japan or the West).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const NLD_SPIRITS: readonly SpiritDef[] = [
  // ---- start ----
  // The policy of independence: no alliances, no guarantees asked or given.
  {
    id: "nld_independence",
    icon: "dove",
    stats: { enemyJustifyTimePct: 30, warSupportBp: -500, tradeCostPct: 5 },
  },
  // Colijn's guilder still on gold: dear exports, sound money.
  {
    id: "nld_gold_guilder",
    icon: "scales",
    stats: { civConstructionPct: -10, consumerGoodsPp: 2, stabilityBp: 300 },
  },
  // Pillarisation: Catholics, Protestants, socialists and liberals each in
  // their own world, steady and slow to move.
  {
    id: "nld_pillarisation",
    icon: "document",
    stats: { stabilityBp: 500, lawCostPct: 15 },
  },
  // Twenty years of budget cuts left a militia army without training.
  {
    id: "nld_hollow_army",
    icon: "chain_broken",
    stats: { trainPct: 15, attackPct: -5 },
  },
  // ---- the water line (mechanism) ----
  {
    id: "nld_sluices_ready",
    icon: "tower",
    stats: { fortConstructionPct: 10, enemyJustifyTimePct: 20 },
  },
  {
    id: "nld_water_line_flooded",
    icon: "shield",
    stats: {
      defensePct: 20,
      entrenchSpeedPct: 20,
      consumerGoodsPp: 3,
      stabilityBp: -300,
    },
  },
  // ---- the Indies oil (mechanism, a year each) ----
  {
    id: "nld_oil_for_yen",
    icon: "oil",
    stats: { tradeCostPct: 10, ppGainPct: 5 },
  },
  {
    id: "nld_oil_for_allies",
    icon: "oil",
    stats: { tradeCostPct: 10, fuelPct: 10 },
  },
  // ---- focuses and events ----
  {
    id: "nld_cheap_guilder",
    icon: "industry",
    stats: { civConstructionPct: 10, tradeCostPct: 5 },
  },
  {
    id: "nld_hard_guilder",
    icon: "scales",
    stats: { stabilityBp: 500, ppGainPct: 5, civConstructionPct: -5 },
  },
  {
    id: "nld_labour_plan",
    icon: "document",
    stats: { civConstructionPct: 10, infraConstructionPct: 15 },
  },
  {
    id: "nld_national_cabinet",
    icon: "handshake",
    stats: { stabilityBp: 500, warSupportBp: 500 },
  },
  {
    id: "nld_old_age_law",
    icon: "wheat",
    stats: { stabilityBp: 500, manpowerGrowthPct: 5 },
  },
  {
    id: "nld_union_order",
    icon: "crown",
    stats: { stabilityBp: 500, ppGainPct: 10 },
  },
  {
    id: "nld_nsb_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 1000, milConstructionPct: 10, stabilityBp: -300 },
  },
  {
    id: "nld_council_state",
    icon: "star_plain",
    stats: { civConstructionPct: 10, milConstructionPct: 5, stabilityBp: -300 },
  },
  {
    id: "nld_colonial_houses",
    icon: "globe",
    stats: { tradeCostPct: 10, extractionPct: 5 },
  },
  {
    id: "nld_philips_works",
    icon: "radio",
    stats: { rsElectronicsPct: 10 },
  },
  {
    id: "nld_water_engineers",
    icon: "road",
    stats: { infraConstructionPct: 15, fortConstructionPct: 10 },
  },
  {
    id: "nld_holland_redoubt",
    icon: "fort",
    stats: { defensePct: 10, fortConstructionPct: 15 },
  },
  {
    id: "nld_forward_line",
    icon: "sword",
    stats: { defensePct: 5, attackPct: 5, fortConstructionPct: 10 },
  },
  {
    id: "nld_inundation_drill",
    icon: "compass",
    stats: { entrenchSpeedPct: 15, riverPenaltyCutPct: 15 },
  },
  {
    id: "nld_jungle_fighters",
    icon: "compass",
    stats: { forestDefensePct: 15, supplyUsePct: -5 },
  },
  {
    id: "nld_air_watch",
    icon: "tower",
    stats: { airDefensePct: 10, aaPct: 10 },
  },
  {
    id: "nld_capital_ship_plan",
    icon: "ship",
    stats: { dockOutputPct: 10, consumerGoodsPp: 1 },
  },
  {
    id: "nld_neutral_watch",
    icon: "tower",
    stats: { enemyJustifyTimePct: 30, navalDetectPct: 10 },
  },
  {
    id: "nld_indies_commonwealth",
    icon: "scales",
    stats: { stabilityBp: 300, complianceGainPct: 10 },
  },
  {
    id: "nld_low_countries_market",
    icon: "scales",
    stats: { tradeCostPct: 10, civConstructionPct: 5 },
  },
  {
    id: "nld_benelux_union",
    icon: "crown",
    stats: { stabilityBp: 500, ppGainPct: 5, recruitablePct: 1 },
  },
  {
    id: "nld_dietsland_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 500, attackPct: 5 },
  },
  {
    id: "nld_mobilised",
    icon: "infantry",
    stats: { recruitablePct: 2, consumerGoodsPp: 3, warSupportBp: 500 },
  },
  {
    id: "nld_oranje_broadcasts",
    icon: "radio",
    stats: { warSupportBp: 500, stabilityBp: 300 },
  },
  {
    id: "nld_london_cabinet",
    icon: "crown",
    stats: { legitimacyGainPct: 20, ppGainPct: 5 },
  },
];
