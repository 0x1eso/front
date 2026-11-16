// ww229: Brazil's spirits: four at the start, the focus and event ones, and
// the five bands of the Vargas-Integralist balance (core.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const BRA_SPIRITS: SpiritDef[] = [
  // ---- at the start ----
  // Coffee is most of the exports and the world no longer buys it.
  {
    id: "bra_sp_coffee_crisis",
    icon: "wheat",
    stats: { civConstructionPct: -10, stabilityBp: -200 },
  },
  // The state of siege after the 1935 rising.
  {
    id: "bra_sp_state_of_siege",
    icon: "chain_broken",
    stats: { stabilityBp: 300, driftComBp: -5, ppGainPct: -5 },
  },
  // The officers who made the 1930 revolution still talk politics.
  {
    id: "bra_sp_barracks_politics",
    icon: "medal",
    stats: { coupResistPct: -15, armyXpMilli: 50 },
  },
  // São Paulo and Minas still run their own affairs, police and all.
  {
    id: "bra_sp_state_oligarchies",
    icon: "map",
    stats: { ppGainPct: -10, stabilityBp: -200 },
  },
  // ---- focuses and events ----
  {
    id: "bra_sp_estado_novo",
    icon: "document",
    stats: { stabilityBp: 500, driftNeuBp: 3, driftDemBp: -3 },
  },
  {
    id: "bra_sp_dip",
    icon: "radio",
    stats: { warSupportBp: 300, driftNeuBp: 3 },
  },
  {
    id: "bra_sp_dasp",
    icon: "document",
    stats: { ppGainPct: 5, advisorCostPct: -10 },
  },
  {
    id: "bra_sp_labour_code",
    icon: "factory",
    stats: { stabilityBp: 300, driftComBp: -3, consumerGoodsPp: 1 },
  },
  {
    id: "bra_sp_coffee_managed",
    icon: "wheat",
    stats: { stabilityBp: 200, ppGainPct: 3 },
  },
  {
    id: "bra_sp_free_coffee",
    icon: "globe",
    stats: { civConstructionPct: 5, stabilityBp: -300 },
  },
  {
    id: "bra_sp_getulio_back",
    icon: "star_plain",
    stats: { stabilityBp: 500, driftNeuBp: 5 },
  },
  {
    id: "bra_sp_republic_restored",
    icon: "ballot",
    stats: { stabilityBp: 300, driftDemBp: 5, warSupportBp: -200 },
  },
  {
    id: "bra_sp_peoples_brazil",
    icon: "star_plain",
    stats: { driftComBp: 5, civConstructionPct: 5, stabilityBp: 200 },
  },
  {
    id: "bra_sp_integral_state",
    icon: "fist",
    stats: { warSupportBp: 800, driftFasBp: 5, stabilityBp: -200 },
  },
  {
    id: "bra_sp_empire_restored",
    icon: "crown",
    stats: { stabilityBp: 500, coupResistPct: 20, driftNeuBp: 3 },
  },
  {
    id: "bra_sp_hemisphere_partner",
    icon: "handshake",
    stats: { civConstructionPct: 5, ppGainPct: 3 },
  },
  {
    id: "bra_sp_german_mission",
    icon: "eagle_plain",
    stats: { divXpGainPct: 10, planSpeedPct: 5 },
  },
  {
    id: "bra_sp_armed_neutrality",
    icon: "scales",
    stats: { defensePct: 5, warSupportBp: 300 },
  },
  {
    id: "bra_sp_equidistance_dividend",
    icon: "scales",
    stats: { ppGainPct: 8, milConstructionPct: 5 },
  },
  {
    id: "bra_sp_technical_schools",
    icon: "research",
    stats: { rsIndustryPct: 5, researchPct: 3 },
  },
  {
    id: "bra_sp_french_school",
    icon: "compass",
    stats: { planSpeedPct: 10, defensePct: 3 },
  },
  {
    id: "bra_sp_compulsory_service",
    icon: "infantry",
    stats: { recruitablePct: 2, manpowerGrowthPct: 5 },
  },
  {
    id: "bra_sp_air_force",
    icon: "plane",
    stats: { airXpMilli: 50, airAttackPct: 3 },
  },
  {
    id: "bra_sp_coastal_patrol",
    icon: "plane",
    stats: { navalStrikePct: 10, convoyEscortPct: 5 },
  },
  {
    id: "bra_sp_south_atlantic_patrol",
    icon: "ship",
    stats: { convoyEscortPct: 10, navyXpMilli: 30 },
  },
  {
    id: "bra_sp_belligerence",
    icon: "sword",
    stats: { warSupportBp: 500, milConstructionPct: 5 },
  },
  {
    id: "bra_sp_smoking_snakes",
    icon: "infantry",
    stats: { infAttackPct: 5, divXpGainPct: 10 },
  },
  {
    id: "bra_sp_senta_a_pua",
    icon: "plane",
    stats: { airAttackPct: 5 },
  },
  {
    id: "bra_sp_abc_staff",
    icon: "compass",
    stats: { planSpeedPct: 5, defensePct: 3 },
  },
  {
    id: "bra_sp_march_west",
    icon: "road",
    stats: { infraConstructionPct: 10, manpowerGrowthPct: 5 },
  },
  // ---- the balance of power: Vargas (left) to the Integralists (right) ----
  {
    id: "bra_bop_estado_novo_firm",
    icon: "document",
    stats: { stabilityBp: 500, driftFasBp: -5, warSupportBp: -200 },
  },
  {
    id: "bra_bop_getulio_holds",
    icon: "shield",
    stats: { stabilityBp: 300 },
  },
  {
    id: "bra_bop_uneasy_truce",
    icon: "scales",
    stats: { ppGainPct: -5 },
  },
  {
    id: "bra_bop_green_tide",
    icon: "megaphone",
    stats: { stabilityBp: -300, driftFasBp: 5 },
  },
  {
    id: "bra_bop_integralist_surge",
    icon: "fist",
    stats: { stabilityBp: -800, driftFasBp: 10, warSupportBp: 300 },
  },
];
