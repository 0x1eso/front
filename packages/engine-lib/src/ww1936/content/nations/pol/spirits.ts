// ww229: Poland's national spirits. Start spirits (in the politics row) and
// event or decision spirits keep their numbers; a focus's add_spirit is
// tripled (FocusScale), so the focus spirits below carry small numbers. The
// five pol_sp_bop_* are the balance-of-power bands (core.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const POL_SPIRITS: SpiritDef[] = [
  // ---- start ----
  // The Marshal is dead and his heirs quarrel: the camp has no centre.
  {
    id: "pol_sp_after_marshal",
    icon: "chain_broken",
    stats: { stabilityBp: -500, ppGainPct: -10 },
  },
  // Too many people on too little land: hands for the army, little to buy.
  {
    id: "pol_sp_land_hunger",
    icon: "wheat",
    stats: { consumerGoodsPp: 2, manpowerGrowthPct: 5 },
  },
  // A third of the citizens are Ukrainians, Belarusians, Jews and Germans.
  {
    id: "pol_sp_borderland_tension",
    icon: "map",
    stats: { stabilityBp: -300, recruitablePct: -5 },
  },

  // ---- focuses (tripled) ----
  {
    id: "pol_sp_defence_fund",
    icon: "medal",
    stats: { milConstructionPct: 3, warSupportBp: 100 },
  },
  {
    id: "pol_sp_cop_drive",
    icon: "industry",
    stats: { civConstructionPct: 3, milConstructionPct: 3 },
  },
  { id: "pol_sp_long_plan", icon: "document", stats: { constructionPct: 3 } },
  {
    id: "pol_sp_ozn",
    icon: "flag",
    stats: { stabilityBp: 150, driftNeuBp: 3 },
  },
  {
    id: "pol_sp_castle_technocrats",
    icon: "research",
    stats: { researchPct: 2, ppGainPct: 3 },
  },
  {
    id: "pol_sp_cavalry_brigades",
    icon: "sword",
    stats: { speedPct: 2, attackPct: 1 },
  },
  {
    id: "pol_sp_border_corps",
    icon: "tower",
    stats: { defensePct: 2, garrisonNeedPct: -5 },
  },
  {
    id: "pol_sp_plan_west",
    icon: "fort",
    stats: { defensePct: 2, entrenchSpeedPct: 5 },
  },
  {
    id: "pol_sp_plan_east",
    icon: "fort",
    stats: { defensePct: 2, recoveryPct: 5 },
  },
  {
    id: "pol_sp_pursuit_brigade",
    icon: "plane",
    stats: { fighterAttackPct: 3, airDefensePct: 2 },
  },
  {
    id: "pol_sp_maritime_league",
    icon: "ship",
    stats: { dockOutputPct: 3, navyXpMilli: 50 },
  },
  {
    id: "pol_sp_equal_distance",
    icon: "scales",
    stats: { stabilityBp: 100, tensionPct: -3 },
  },
  {
    id: "pol_sp_third_europe",
    icon: "globe",
    stats: { diploCostPct: -5 },
  },
  {
    id: "pol_sp_promethean_network",
    icon: "radio",
    stats: { intelPct: 3 },
  },
  {
    id: "pol_sp_underground_state",
    icon: "shield",
    stats: { resistanceTargetPct: 3, intelPct: 2 },
  },

  // ---- events and decisions (as written) ----
  // pol_ev_peasant_strike, the hard answer: the villages hold back.
  {
    id: "pol_sp_village_boycott",
    icon: "wheat",
    stats: { outputPct: -5, stabilityBp: -300 },
  },
  // pol_dec_bridgehead_retreat: the last line by the Romanian border.
  {
    id: "pol_sp_last_stand",
    icon: "shield",
    stats: { defensePct: 10, warSupportBp: 500 },
  },
  // pol_ev_gold_route: the reserve abroad keeps the state alive in exile.
  {
    id: "pol_sp_gold_abroad",
    icon: "scales",
    stats: { legitimacyGainPct: 10, ppGainPct: 5 },
  },

  // ---- balance of power (core.ts), far left to far right ----
  {
    id: "pol_sp_bop_opposition_rules",
    icon: "ballot",
    stats: { stabilityBp: 500, warSupportBp: -500, driftDemBp: 5 },
  },
  {
    id: "pol_sp_bop_opposition_gains",
    icon: "handshake",
    stats: { stabilityBp: 300, ppGainPct: -5 },
  },
  {
    id: "pol_sp_bop_uneasy_balance",
    icon: "scales",
    stats: { ppGainPct: -5, stabilityBp: 200 },
  },
  {
    id: "pol_sp_bop_colonels_lead",
    icon: "medal",
    stats: { milConstructionPct: 5, stabilityBp: -200 },
  },
  {
    id: "pol_sp_bop_colonels_alone",
    icon: "sword",
    stats: { milConstructionPct: 10, warSupportBp: 500, stabilityBp: -700 },
  },
];
