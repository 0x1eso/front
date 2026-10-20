// World War 1936 P5 — French and Vichy national spirits from focuses and
// events (spec §19.4; the starting spirits fra_divided, fra_defensive_mind
// and fra_hollow_years are P3's, and "resistance support" is the endgame
// lane's gen_resistance_support). Stability and war support in bp
// (100 = 1 point). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_FRA: SpiritDef[] = [
  // fra_popular_front, 365 days: stability +10%, factory output -5%.
  {
    id: "fra_matignon",
    icon: "handshake",
    stats: { stabilityBp: 1000, outputPct: -5 },
  },
  // fra_arms_nationalisation replaces fra_divided (-10%, PP -15%).
  {
    id: "fra_divided_eased",
    icon: "chain_broken",
    stats: { stabilityBp: -500, ppGainPct: -8 },
  },
  // fra_rearmament_plan
  {
    id: "fra_rearmament_plan",
    icon: "factory_mil",
    stats: { milConstructionPct: 10 },
  },
  // fra_war_government
  {
    id: "fra_sacred_union",
    icon: "flag",
    stats: { stabilityBp: 1000, warSupportBp: 1000 },
  },
  // fra_national_union
  {
    id: "fra_hard_line",
    icon: "sword",
    stats: { warSupportBp: 1000, stabilityBp: -500 },
  },
  // fra_early_rearmament
  {
    id: "fra_rearm_first",
    icon: "factory_mil",
    stats: { milConstructionPct: 15, consumerGoodsPp: -2 },
  },
  // fra_strong_executive
  {
    id: "fra_parliament_crisis",
    icon: "scales",
    stats: { ppGainPct: 10, stabilityBp: -500 },
  },
  // fra_neutral_france: enemies need 25% longer to justify a goal on France.
  {
    id: "fra_neutrality",
    icon: "tower",
    stats: { enemyJustifyTimePct: 25, defensePct: 5 },
  },
  // fra_maginot_extension replaces fra_defensive_mind (defence +5%,
  // attack -5%, fort construction +25%) with fort construction +40%.
  {
    id: "fra_defensive_mind_plus",
    icon: "fort",
    stats: { defensePct: 5, attackPct: -5, fortConstructionPct: 40 },
  },
  // fra_mobile_reserve
  { id: "fra_mobile_doctrine", icon: "tank", stats: { attackPct: 5 } },
  // fra_empire_defence
  {
    id: "fra_colonial_troops",
    icon: "infantry",
    stats: { nonCoreManpowerPp: 5 },
  },
  // fra_colonial_minerals
  { id: "fra_colonial_mines", icon: "mine", stats: { extractionPct: 5 } },
  // fra_ministry_of_armament
  {
    id: "fra_armament_ministry",
    icon: "factory",
    stats: { outputPct: 5, milConstructionPct: 10 },
  },
  // fra_southwest_dispersal
  {
    id: "fra_dispersed_factories",
    icon: "road",
    stats: { bombDamageTakenPct: -10 },
  },
  // fra_heavy_water
  { id: "fra_nuclear_physics", icon: "flask", stats: { researchPct: 5 } },
  // fra_june_appeal
  {
    id: "fra_free_france",
    icon: "radio",
    stats: { recruitablePct: 10, legitimacyGainPct: 20 },
  },
  // vic_full_powers (spec §19.4 "general"): stability +5%, PP -10%.
  {
    id: "vic_state_regime",
    icon: "document",
    stats: { stabilityBp: 500, ppGainPct: -10 },
  },
];
