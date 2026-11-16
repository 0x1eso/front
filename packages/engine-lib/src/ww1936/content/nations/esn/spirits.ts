// ww229 (design ww227 §3, §5): Nationalist Spain's spirits. Start spirits
// (with the base esp_civil_war_nation), the five bands of the Falange ↔
// Traditionalist balance (core.ts BOP row), then the focus spirits. Stats
// use the WwStats keys (stabilityBp: 100 = 1%p; tradeCostPct: + is more
// trade units per factory). Data only (ContentPurity).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ESN_SPIRITS: SpiritDef[] = [
  // ---- start ----
  // The Army of Africa's colonial veterans lead the rising.
  {
    id: "esn_african_veterans",
    icon: "medal",
    stats: { attackPct: 5, divXpGainPct: 10 },
  },
  // A rear of wheat and cattle, almost without factories (removed by
  // esn_devastated_regions).
  {
    id: "esn_agrarian_rear",
    icon: "wheat",
    stats: { civConstructionPct: -10, consumerGoodsPp: 2 },
  },

  // ---- the balance of power: Falange (−) ↔ Traditionalists (+) ----
  {
    id: "esn_bop_falange_state",
    icon: "megaphone",
    stats: { ppGainPct: 5, warSupportBp: 500, stabilityBp: -500 },
  },
  {
    id: "esn_bop_falange_lead",
    icon: "megaphone",
    stats: { warSupportBp: 300 },
  },
  { id: "esn_bop_arbiter", icon: "scales", stats: { stabilityBp: 500 } },
  {
    id: "esn_bop_tradition_lead",
    icon: "flag",
    stats: { manpowerGrowthPct: 5 },
  },
  {
    id: "esn_bop_carlist_strength",
    icon: "flag",
    stats: { stabilityBp: 500, manpowerGrowthPct: 10, ppGainPct: -10 },
  },

  // ---- focus spirits ----
  {
    id: "esn_foreign_instructors",
    icon: "plane",
    stats: { sortieEffPct: 5, rsAirPct: 5 },
  },
  {
    id: "esn_aragon_drive",
    icon: "map",
    stats: { attackPct: 5, breakthroughPct: 5 },
  },
  { id: "esn_final_push", icon: "sword", stats: { attackPct: 5, orgPct: 5 } },
  {
    id: "esn_single_party",
    icon: "handshake",
    stats: { ppGainPct: 5, coupResistPct: 10 },
  },
  {
    id: "esn_burgos_ministries",
    icon: "document",
    stats: { decisionCostPct: -10, advisorCostPct: -10 },
  },
  {
    id: "esn_vertical_syndicates",
    icon: "factory",
    stats: { outputPct: 3, stabilityBp: 200 },
  },
  {
    id: "esn_youth_front",
    icon: "megaphone",
    stats: { manpowerGrowthPct: 5, warSupportBp: 300 },
  },
  {
    id: "esn_caudillaje",
    icon: "eagle_plain",
    stats: { stabilityBp: 500, coupResistPct: 20, ppGainPct: 5 },
  },
  {
    id: "esn_constitutional_crown",
    icon: "crown",
    stats: { stabilityBp: 500, tradeCostPct: 5 },
  },
  {
    id: "esn_fueros_restored",
    icon: "crown",
    stats: { stabilityBp: 300, manpowerGrowthPct: 5 },
  },
  {
    id: "esn_restored_parliament",
    icon: "ballot",
    stats: { researchPct: 3, stabilityBp: 300 },
  },
  {
    id: "esn_peoples_militia",
    icon: "fist",
    stats: { warSupportBp: 500, manpowerGrowthPct: 5 },
  },
  {
    id: "esn_ini_holdings",
    icon: "factory",
    stats: { constructionPct: 5, outputPct: 3 },
  },
  {
    id: "esn_autarky",
    icon: "wheat",
    stats: { outputPct: 3, extractionPct: 10, tradeCostPct: -5 },
  },
  { id: "esn_aero_institute", icon: "research", stats: { rsAirPct: 10 } },
  // esn_legion: the national unit's character.
  { id: "esn_legion_spirit", icon: "star_plain", stats: { infAttackPct: 5 } },
  {
    id: "esn_provisional_officer_corps",
    icon: "medal",
    stats: { divXpGainPct: 10, trainPct: 10 },
  },
  {
    id: "esn_staff_schooling",
    icon: "document",
    stats: { planSpeedPct: 10, generalXpPct: 10 },
  },
  {
    id: "esn_air_tactics",
    icon: "plane",
    stats: { casPct: 5, sortieEffPct: 5 },
  },
  {
    id: "esn_home_trained_pilots",
    icon: "research",
    stats: { airDefensePct: 5, airAgilityPct: 3 },
  },
  {
    id: "esn_non_belligerent",
    icon: "scales",
    stats: { enemyJustifyTimePct: 50, stabilityBp: 500 },
  },
  {
    id: "esn_iberian_bloc_pact",
    icon: "shield",
    stats: { enemyJustifyTimePct: 25, defensePct: 3 },
  },
  {
    id: "esn_neutral_course",
    icon: "dove",
    stats: { enemyJustifyTimePct: 50, tradeCostPct: 5 },
  },
  {
    id: "esn_rock_siege",
    icon: "artillery",
    stats: { attackPct: 5, fortPenaltyCutPct: 10 },
  },
  {
    id: "esn_imperial_pride",
    icon: "crown",
    stats: { warSupportBp: 500, stabilityBp: 300 },
  },
  {
    id: "esn_one_iberia",
    icon: "map",
    stats: { manpowerGrowthPct: 5, stabilityBp: -500 },
  },
  { id: "esn_war_footing", icon: "factory_mil", stats: { outputPct: 5 } },
  {
    id: "esn_occupied_resistance",
    icon: "shield",
    stats: { resistanceTargetPct: 15 },
  },
];
