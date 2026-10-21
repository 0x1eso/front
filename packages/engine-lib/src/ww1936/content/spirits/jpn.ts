// World War 1936 P5 — Japanese national spirits from focuses (spec §18.3,
// §19.4: 16). Stability and war support are in bp. Two ids carry a _spirit
// suffix because a focus has the bare name (ids are unique across focuses,
// events, decisions and spirits — tests/ww1936/FocusData).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_JPN: SpiritDef[] = [
  // jpn_military_ministers
  {
    id: "jpn_military_voice",
    icon: "sword",
    stats: { ppGainPct: 10, stabilityBp: -500, justifyTimePct: -10 },
  },
  // jpn_wartime_mobilisation
  {
    id: "jpn_war_mobilisation",
    icon: "factory_mil",
    stats: { outputPct: 10, consumerGoodsPp: -3, recruitablePct: 5 },
  },
  // jpn_hardline_cabinet (180 days)
  { id: "jpn_war_resolve", icon: "fist", stats: { justifyTimePct: -25 } },
  // jpn_unified_war_administration
  {
    id: "jpn_war_administration",
    icon: "tower",
    stats: { ppGainPct: 10, outputPct: 5 },
  },
  // jpn_party_cabinet
  {
    id: "jpn_party_politics",
    icon: "ballot",
    stats: { ppGainPct: 5, warSupportBp: -500 },
  },
  // jpn_cooperative_diplomacy: the tension this country makes −20%.
  {
    id: "jpn_cooperative_diplomacy_spirit",
    icon: "globe",
    stats: { tensionPct: -20 },
  },
  // jpn_strike_north: winter penalty −25%.
  {
    id: "jpn_northern_readiness",
    icon: "compass",
    stats: { winterPenaltyPct: -25 },
  },
  // jpn_hawaii_operation (90 days)
  {
    id: "jpn_surprise_prep",
    icon: "carrier",
    stats: { navyAttackPct: 10, carrierStrikePct: 15 },
  },
  // jpn_captured_arms
  {
    id: "jpn_captured_arms_spirit",
    icon: "artillery",
    stats: { capturePct: 10 },
  },
  // jpn_night_tactics
  {
    id: "jpn_night_fighting",
    icon: "star_plain",
    stats: { attackPct: 5, forestDefensePct: 10 },
  },
  // jpn_jungle_training: no jungle stat exists, so woodland defence stands in.
  {
    id: "jpn_jungle_warfare",
    icon: "compass",
    stats: { supplyUsePct: -10, forestDefensePct: 10 },
  },
  // jpn_naval_landing_force
  { id: "jpn_landing_skill", icon: "ship", stats: { invasionPrepPct: -15 } },
  // jpn_garrison_units
  {
    id: "jpn_garrison_system",
    icon: "shield",
    stats: { garrisonNeedPct: -15 },
  },
  // jpn_carrier_strike_force
  { id: "jpn_carrier_focus", icon: "carrier", stats: { carrierStrikePct: 10 } },
  // jpn_battleship_priority
  { id: "jpn_big_ship_priority", icon: "ship", stats: { navyAttackPct: 5 } },
  // jpn_submarine_fleet
  {
    id: "jpn_submarine_squadrons",
    icon: "submarine",
    stats: { subAttackPct: 5 },
  },
];
