// World War 1936 P5 — Italian national spirits (spec §19.4, 13). Stats use
// the P3/P4/P5 WwStats keys: stability and war support in bp (100 = 1%p),
// tradeCostPct is the trade units per factory (P3 spec §3.2: + is more).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_ITA: SpiritDef[] = [
  // ita_pact_of_steel: war support +5%, justification time −10%.
  {
    id: "ita_pact",
    icon: "handshake",
    stats: { warSupportBp: 500, justifyTimePct: -10 },
  },
  // ita_non_belligerence (365 days): others justify 25% slower, trade +10%.
  {
    id: "ita_non_belligerent",
    icon: "scales",
    stats: { enemyJustifyTimePct: 25, tradeCostPct: 10 },
  },
  // ita_axis_war_economy: factory output +10%, consumer goods −3%p.
  {
    id: "ita_war_mobilisation",
    icon: "factory_mil",
    stats: { outputPct: 10, consumerGoodsPp: -3 },
  },
  // ita_crown_council: political power −5%, coup resistance +25%.
  {
    id: "ita_crown_shadow",
    icon: "crown",
    stats: { ppGainPct: -5, coupResistPct: 25 },
  },
  // ita_armed_neutrality: defence +10%, others justify 50% slower.
  {
    id: "ita_armed_neutrality_spirit",
    icon: "shield",
    stats: { defensePct: 10, enemyJustifyTimePct: 50 },
  },
  // ita_autarky: extraction +10%, trade −10%, military construction +5%.
  {
    id: "ita_autarky_spirit",
    icon: "mine",
    stats: { extractionPct: 10, tradeCostPct: -10, milConstructionPct: 5 },
  },
  // ita_alpine_hydro: factory output +5%.
  { id: "ita_hydro_power", icon: "industry", stats: { outputPct: 5 } },
  // ita_desert_doctrine: desert attack +10%, supply use −5%.
  {
    id: "ita_desert_war",
    icon: "compass",
    stats: { desertAttackPct: 10, supplyUsePct: -5 },
  },
  // ita_war_booty: captured equipment +5%p (P5 spec §14).
  { id: "ita_war_booty_spirit", icon: "medal", stats: { capturePct: 5 } },
  // ita_battleship_programme (365 days): dockyard output +10%.
  { id: "ita_capital_ships", icon: "ship", stats: { dockOutputPct: 10 } },
  // ita_submarine_arm: submarine attack +5%.
  {
    id: "ita_submarine_priority",
    icon: "submarine",
    stats: { subAttackPct: 5 },
  },
  // ita_torpedo_bombers: naval strike +10%.
  { id: "ita_torpedo_tactics", icon: "bomber", stats: { navalStrikePct: 10 } },
  // ita_armistice (35 days, removed by ita_cobelligerence): stability −10%.
  {
    id: "ita_cobelligerent_prep",
    icon: "chain_broken",
    stats: { stabilityBp: -1000 },
  },
];
