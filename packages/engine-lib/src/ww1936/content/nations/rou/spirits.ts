// ww229: Romania's spirits: four at the start, the focus and event ones,
// and the five bands of the Crown-Iron Guard balance (core.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ROU_SPIRITS: SpiritDef[] = [
  // ---- at the start ----
  // Greater Romania of 1918-1920: a third of the people are minorities.
  { id: "rou_sp_many_peoples", icon: "map", stats: { stabilityBp: -500 } },
  {
    id: "rou_sp_peasant_country",
    icon: "wheat",
    stats: { civConstructionPct: -10, manpowerGrowthPct: 10 },
  },
  {
    id: "rou_sp_black_gold",
    icon: "oil",
    stats: { ppGainPct: 5, fuelPct: 10 },
  },
  // Carol II's court circle: favours, commissions and quick dismissals.
  {
    id: "rou_sp_camarilla",
    icon: "crown",
    stats: { ppGainPct: -10, coupResistPct: 20 },
  },
  // ---- focuses and events ----
  {
    id: "rou_sp_straja",
    icon: "flag",
    stats: { warSupportBp: 300, recruitablePct: 2 },
  },
  {
    id: "rou_sp_royal_dictatorship",
    icon: "crown",
    stats: { stabilityBp: 500, driftNeuBp: 5, ppGainPct: 5 },
  },
  {
    id: "rou_sp_national_rebirth",
    icon: "megaphone",
    stats: { ppGainPct: 5, consumerGoodsPp: -2 },
  },
  {
    id: "rou_sp_peasant_state",
    icon: "wheat",
    stats: { stabilityBp: 500, civConstructionPct: 5, driftDemBp: 5 },
  },
  {
    id: "rou_sp_legionary_zeal",
    icon: "fist",
    stats: { warSupportBp: 1000, stabilityBp: -500, driftFasBp: 5 },
  },
  {
    id: "rou_sp_military_rule",
    icon: "star_plain",
    stats: { stabilityBp: 500, milConstructionPct: 5, warSupportBp: 500 },
  },
  {
    id: "rou_sp_peoples_republic",
    icon: "star_plain",
    stats: { driftComBp: 5, civConstructionPct: 5, stabilityBp: 300 },
  },
  {
    id: "rou_sp_armed_neutrality",
    icon: "scales",
    stats: { defensePct: 5, warSupportBp: 300 },
  },
  {
    id: "rou_sp_german_trade",
    icon: "document",
    stats: { ppGainPct: 5, milConstructionPct: 5 },
  },
  { id: "rou_sp_entente_staff", icon: "compass", stats: { planSpeedPct: 10 } },
  {
    id: "rou_sp_state_industry",
    icon: "factory_mil",
    stats: { milConstructionPct: 10, civConstructionPct: -5 },
  },
  {
    id: "rou_sp_foreign_capital",
    icon: "globe",
    stats: { civConstructionPct: 10, ppGainPct: -5 },
  },
  {
    id: "rou_sp_armament_plan",
    icon: "factory_mil",
    stats: { milConstructionPct: 10 },
  },
  {
    id: "rou_sp_ploiesti_defences",
    icon: "artillery",
    stats: { aaPct: 15, airDefensePct: 5 },
  },
  {
    id: "rou_sp_vanatori",
    icon: "infantry",
    stats: { infDefensePct: 5, divXpGainPct: 10 },
  },
  {
    id: "rou_sp_holy_war",
    icon: "sword",
    stats: { warSupportBp: 500, attackPct: 5 },
  },
  {
    id: "rou_sp_resistance",
    icon: "fist",
    stats: { stabilityBp: 300, warSupportBp: 500 },
  },
  {
    id: "rou_sp_german_instructors",
    icon: "eagle_plain",
    stats: { divXpGainPct: 10, planSpeedPct: 5 },
  },
  { id: "rou_sp_fighter_aces", icon: "plane", stats: { airAttackPct: 5 } },
  // ---- the balance of power: the Crown (left) to the Legion (right) ----
  {
    id: "rou_bop_royal_dictatorship",
    icon: "crown",
    stats: { stabilityBp: 500, driftFasBp: -5, warSupportBp: -300 },
  },
  { id: "rou_bop_crown_holds", icon: "shield", stats: { stabilityBp: 300 } },
  { id: "rou_bop_uneasy_balance", icon: "scales", stats: { ppGainPct: -5 } },
  {
    id: "rou_bop_legion_streets",
    icon: "megaphone",
    stats: { stabilityBp: -300, driftFasBp: 5 },
  },
  {
    id: "rou_bop_legion_terror",
    icon: "fist",
    stats: { stabilityBp: -800, driftFasBp: 10, warSupportBp: 300 },
  },
];
