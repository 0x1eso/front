// ww229: Argentina's spirits: four at the start, the focus and event ones,
// and the five bands of the Concordancia-officers balance (core.ts). Data
// only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ARG_SPIRITS: SpiritDef[] = [
  // ---- at the start ----
  // The Concordancia wins its elections with "patriotic fraud".
  {
    id: "arg_sp_infamous_decade",
    icon: "ballot",
    stats: { stabilityBp: -300, driftDemBp: 3, ppGainPct: 5 },
  },
  // Beef for the British market, British capital in the railways and ports.
  {
    id: "arg_sp_roca_runciman",
    icon: "handshake",
    stats: { tradeCostPct: -10, milConstructionPct: -10 },
  },
  // A Prussian-trained army that has already overthrown one president.
  {
    id: "arg_sp_officers_arbiters",
    icon: "sword",
    stats: { coupResistPct: -15, defensePct: 3 },
  },
  {
    id: "arg_sp_far_from_war",
    icon: "globe",
    stats: { warSupportBp: -1000, stabilityBp: 300 },
  },
  // ---- the balance of power, from the Concordancia to the officers ----
  {
    id: "arg_bop_concordancia_rules",
    icon: "ballot",
    stats: { stabilityBp: 500, ppGainPct: 5, warSupportBp: -300 },
  },
  {
    id: "arg_bop_conservatives_hold",
    icon: "scales",
    stats: { stabilityBp: 300, ppGainPct: 3 },
  },
  {
    id: "arg_bop_uneasy_barracks",
    icon: "shield",
    stats: { coupResistPct: -5 },
  },
  {
    id: "arg_bop_lodge_stirs",
    icon: "medal",
    stats: { warSupportBp: 300, stabilityBp: -300, driftFasBp: 3 },
  },
  {
    id: "arg_bop_officers_rule",
    icon: "star_plain",
    stats: {
      warSupportBp: 500,
      stabilityBp: -500,
      driftFasBp: 5,
      milConstructionPct: 5,
    },
  },
  // ---- focuses and events ----
  {
    id: "arg_sp_state_of_siege",
    icon: "chain_broken",
    stats: { stabilityBp: 500, ppGainPct: -5 },
  },
  {
    id: "arg_sp_concordancia",
    icon: "scales",
    stats: { stabilityBp: 300, coupResistPct: 20, ppGainPct: 5 },
  },
  {
    id: "arg_sp_radical_republic",
    icon: "ballot",
    stats: { stabilityBp: 500, civConstructionPct: 5, driftDemBp: 3 },
  },
  {
    id: "arg_sp_military_government",
    icon: "star_plain",
    stats: { stabilityBp: 300, milConstructionPct: 5, warSupportBp: 500 },
  },
  {
    id: "arg_sp_descamisados",
    icon: "fist",
    stats: { stabilityBp: 700, driftFasBp: 3, consumerGoodsPp: 1 },
  },
  {
    id: "arg_sp_third_position",
    icon: "compass",
    stats: { diploCostPct: -10, tensionPct: -10, stabilityBp: 300 },
  },
  {
    id: "arg_sp_corporate_state",
    icon: "eagle_plain",
    stats: { ppGainPct: 5, milConstructionPct: 5, stabilityBp: -300 },
  },
  {
    id: "arg_sp_workers_republic",
    icon: "star_plain",
    stats: { driftComBp: 5, civConstructionPct: 5, stabilityBp: 300 },
  },
  {
    id: "arg_sp_stubborn_neutrality",
    icon: "dove",
    stats: { stabilityBp: 300, tradeCostPct: -5, warSupportBp: -300 },
  },
  {
    id: "arg_sp_plata_customs",
    icon: "map",
    stats: { tradeCostPct: -10, civConstructionPct: 3 },
  },
  {
    id: "arg_sp_malvinas_fever",
    icon: "flag",
    stats: { warSupportBp: 700 },
  },
  {
    id: "arg_sp_industrial_promotion",
    icon: "factory",
    stats: { civConstructionPct: 10, milConstructionPct: 5 },
  },
  {
    id: "arg_sp_ypf",
    icon: "oil",
    stats: { fuelPct: 10, ppGainPct: 3 },
  },
  {
    id: "arg_sp_national_defence",
    icon: "shield",
    stats: { recruitablePct: 2, warSupportBp: 300 },
  },
  {
    id: "arg_sp_air_command",
    icon: "plane",
    stats: { airAttackPct: 5, airDefensePct: 5 },
  },
  {
    id: "arg_sp_wartime_exports",
    icon: "wheat",
    stats: { tradeCostPct: -10, consumerGoodsPp: -1, stabilityBp: 300 },
  },
  {
    id: "arg_sp_mobilisation",
    icon: "infantry",
    stats: { recruitablePct: 2, warSupportBp: 500, civConstructionPct: -10 },
  },
  {
    id: "arg_sp_spy_scandal",
    icon: "document",
    stats: { diploCostPct: 10, stabilityBp: -300 },
  },
];
