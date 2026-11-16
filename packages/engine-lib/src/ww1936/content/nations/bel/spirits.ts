// ww229: Belgium's national spirits. Start spirits (in the politics row) and
// event or decision spirits keep their numbers; a focus's add_spirit is
// tripled (FocusScale), so the focus spirits below carry small numbers. The
// five bel_sp_bop_* are the language balance's bands (core.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const BEL_SPIRITS: SpiritDef[] = [
  // ---- start ----
  // Three parties that distrust each other govern together.
  {
    id: "bel_sp_three_parties",
    icon: "handshake",
    stats: { stabilityBp: 300, ppGainPct: -10 },
  },
  // The devalued franc: exports sell again, the recovery runs on.
  {
    id: "bel_sp_franc_recovery",
    icon: "factory",
    stats: { civConstructionPct: 5, tradeCostPct: -10 },
  },
  // A short service: the conscripts go home before they learn their trade.
  {
    id: "bel_sp_short_service",
    icon: "infantry",
    stats: { recruitablePct: -5, trainPct: -10 },
  },

  // ---- focuses (tripled) ----
  {
    id: "bel_sp_labour_conference",
    icon: "fist",
    stats: { stabilityBp: 100, consumerGoodsPp: 1 },
  },
  {
    id: "bel_sp_social_pact",
    icon: "handshake",
    stats: { stabilityBp: 100, driftDemBp: 2 },
  },
  {
    id: "bel_sp_recovery_office",
    icon: "document",
    stats: { civConstructionPct: 3, stabilityBp: 50 },
  },
  {
    id: "bel_sp_labour_plan",
    icon: "factory",
    stats: { civConstructionPct: 4, ppGainPct: -3, driftNeuBp: 2 },
  },
  {
    id: "bel_sp_language_regiments",
    icon: "infantry",
    stats: { orgPct: 1, recruitablePct: 1 },
  },
  {
    id: "bel_sp_language_compromise",
    icon: "scales",
    stats: { stabilityBp: 100 },
  },
  {
    id: "bel_sp_mobilisation_plans",
    icon: "industry",
    stats: { milConstructionPct: 3 },
  },
  {
    id: "bel_sp_katanga_copper",
    icon: "mine",
    stats: { extractionPct: 3, tradeCostPct: -3 },
  },
  {
    id: "bel_sp_force_publique",
    icon: "infantry",
    stats: { nonCoreManpowerPp: 1 },
  },
  {
    id: "bel_sp_canal_defence",
    icon: "shield",
    stats: { defensePct: 1, entrenchSpeedPct: 3 },
  },
  {
    id: "bel_sp_canal_line",
    icon: "fort",
    stats: { defensePct: 2, riverPenaltyCutPct: 2 },
  },
  {
    id: "bel_sp_ardennes_forward",
    icon: "map",
    stats: { forestDefensePct: 3, defensePct: 1 },
  },
  {
    id: "bel_sp_air_reorganised",
    icon: "plane",
    stats: { airAttackPct: 2 },
  },
  {
    id: "bel_sp_independence",
    icon: "scales",
    stats: { enemyJustifyTimePct: 5, warSupportBp: -100 },
  },
  {
    id: "bel_sp_french_accord",
    icon: "handshake",
    stats: { planSpeedPct: 2, defensePct: 1 },
  },
  {
    id: "bel_sp_oslo_trade",
    icon: "globe",
    stats: { tradeCostPct: -3 },
  },
  {
    id: "bel_sp_allied_plans",
    icon: "map",
    stats: { planSpeedPct: 2 },
  },
  {
    id: "bel_sp_last_stand",
    icon: "sword",
    stats: { defensePct: 3 },
  },
  {
    id: "bel_sp_london_government",
    icon: "globe",
    stats: { legitimacyGainPct: 3, ppGainPct: 3 },
  },
  {
    id: "bel_sp_secret_army",
    icon: "shield",
    stats: { intelPct: 3, warSupportBp: 100 },
  },

  // ---- events and decisions (not tripled) ----
  {
    id: "bel_sp_mechelen_alert",
    icon: "radio",
    stats: { warSupportBp: 300, planSpeedPct: 10 },
  },
  {
    id: "bel_sp_royal_question",
    icon: "crown",
    stats: { stabilityBp: -500 },
  },
  {
    id: "bel_sp_strike_wave",
    icon: "fist",
    stats: { stabilityBp: -300, outputPct: -5 },
  },

  // ---- the language balance (core.ts bop, left = francophone) ----
  {
    id: "bel_sp_bop_french_state",
    icon: "flag",
    stats: { stabilityBp: -300, driftFasBp: 3, ppGainPct: 5 },
  },
  {
    id: "bel_sp_bop_francophone_lead",
    icon: "document",
    stats: { stabilityBp: -100, driftFasBp: 1 },
  },
  {
    id: "bel_sp_bop_language_peace",
    icon: "scales",
    stats: { stabilityBp: 200 },
  },
  {
    id: "bel_sp_bop_flemish_rise",
    icon: "megaphone",
    stats: { stabilityBp: -100, driftFasBp: 1, manpowerGrowthPct: 3 },
  },
  {
    id: "bel_sp_bop_flemish_ascendant",
    icon: "chain_broken",
    stats: { stabilityBp: -400, driftFasBp: 3, warSupportBp: -300 },
  },
];
