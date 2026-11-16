// ww229: Mexico's spirits: four at the start, the oil stages (foreign oil,
// the boycott, the strained and the grown Pemex) and the focus and event
// ones. Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const MEX_SPIRITS: SpiritDef[] = [
  // ---- at the start ----
  // The foreign companies (El Águila, Huasteca) pump and ship the oil.
  {
    id: "mex_sp_foreign_oil",
    icon: "oil",
    stats: { fuelPct: -20, ppGainPct: -5 },
  },
  // The Revolution promised land; most villages still wait for it.
  {
    id: "mex_sp_land_hunger",
    icon: "wheat",
    stats: { stabilityBp: -500, manpowerGrowthPct: 10 },
  },
  // Divisional generals of the Revolution hold the military zones.
  {
    id: "mex_sp_revolutionary_generals",
    icon: "medal",
    stats: { coupResistPct: -15, recruitablePct: 1 },
  },
  // The anticlerical laws and the memory of the Cristero war.
  {
    id: "mex_sp_church_and_state",
    icon: "scales",
    stats: { stabilityBp: -300, driftFasBp: 3 },
  },
  // ---- the oil stages ----
  {
    id: "mex_sp_oil_boycotted",
    icon: "oil",
    stats: { fuelPct: -10, tradeCostPct: 20, ppGainPct: 5 },
  },
  {
    id: "mex_sp_mixed_oil",
    icon: "oil",
    stats: { fuelPct: -5, tradeCostPct: -5 },
  },
  {
    id: "mex_sp_pemex_strained",
    icon: "oil",
    stats: { fuelPct: 5, tradeCostPct: 10 },
  },
  {
    id: "mex_sp_pemex",
    icon: "oil",
    stats: { fuelPct: 20, ppGainPct: 5, extractionPct: 5 },
  },
  // ---- focuses and events ----
  {
    id: "mex_sp_corporate_party",
    icon: "scales",
    stats: { ppGainPct: 10, coupResistPct: 20, driftNeuBp: 3 },
  },
  {
    id: "mex_sp_ejidos",
    icon: "wheat",
    stats: { stabilityBp: 300, manpowerGrowthPct: 10, civConstructionPct: -5 },
  },
  {
    id: "mex_sp_socialist_school",
    icon: "research",
    stats: { researchPct: 5, driftComBp: 3, stabilityBp: -200 },
  },
  {
    id: "mex_sp_national_unity",
    icon: "handshake",
    stats: { stabilityBp: 500, warSupportBp: 300 },
  },
  {
    id: "mex_sp_deep_revolution",
    icon: "fist",
    stats: { driftComBp: 5, civConstructionPct: 5, stabilityBp: -200 },
  },
  {
    id: "mex_sp_workers_state",
    icon: "star_plain",
    stats: { driftComBp: 5, milConstructionPct: 5, stabilityBp: 300 },
  },
  {
    id: "mex_sp_free_suffrage",
    icon: "ballot",
    stats: { stabilityBp: 300, driftDemBp: 5 },
  },
  {
    id: "mex_sp_sinarquista_order",
    icon: "flag",
    stats: { warSupportBp: 800, driftFasBp: 5, stabilityBp: -300 },
  },
  {
    id: "mex_sp_caudillo_rule",
    icon: "medal",
    stats: { stabilityBp: 300, milConstructionPct: 5, warSupportBp: 300 },
  },
  {
    id: "mex_sp_import_substitution",
    icon: "factory",
    stats: { civConstructionPct: 5, tradeCostPct: -5 },
  },
  {
    id: "mex_sp_monterrey_capital",
    icon: "industry",
    stats: { civConstructionPct: 8, stabilityBp: -200 },
  },
  {
    id: "mex_sp_refuge",
    icon: "flask",
    stats: { researchPct: 5, ppGainPct: 3 },
  },
  {
    id: "mex_sp_braceros",
    icon: "rail",
    stats: { ppGainPct: 5, manpowerGrowthPct: -5 },
  },
  {
    id: "mex_sp_defensas_rurales",
    icon: "shield",
    stats: { recruitablePct: 2, garrisonNeedPct: -10 },
  },
  {
    id: "mex_sp_lost_north_fever",
    icon: "sword",
    stats: { warSupportBp: 1000, justifyTimePct: -20, stabilityBp: -300 },
  },
  {
    id: "mex_sp_isthmus_league",
    icon: "globe",
    stats: { diploCostPct: -15, stabilityBp: 200 },
  },
  {
    id: "mex_sp_cristero_embers",
    icon: "fist",
    stats: { stabilityBp: -400, driftFasBp: 3 },
  },
  {
    id: "mex_sp_war_boom",
    icon: "factory",
    stats: { civConstructionPct: 10, milConstructionPct: 5 },
  },
];
