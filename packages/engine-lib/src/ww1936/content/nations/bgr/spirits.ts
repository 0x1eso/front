// ww229: Bulgaria's spirits: four at the start, the focus and event ones,
// and the stages of the lost lands (national catastrophes -> one land back
// -> two -> all three). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const BGR_SPIRITS: SpiritDef[] = [
  // ---- at the start ----
  // Boris III rules through cabinets of his own choosing; parties are banned.
  {
    id: "bgr_sp_tsars_personal_rule",
    icon: "crown",
    stats: { stabilityBp: 300, driftNeuBp: 3, ppGainPct: -5 },
  },
  // The Treaty of Neuilly: a volunteer army of 20,000, no tanks, no planes.
  {
    id: "bgr_sp_neuilly_chains",
    icon: "chain_broken",
    stats: { recruitablePct: -2, milConstructionPct: -10 },
  },
  // 1913 and 1918: the lost lands, the refugees, the debts. Stage 0.
  {
    id: "bgr_sp_national_catastrophes",
    icon: "map",
    stats: { warSupportBp: 500, stabilityBp: -300 },
  },
  // Tobacco, roses and grain: a peasant economy that sells one crop.
  {
    id: "bgr_sp_tobacco_economy",
    icon: "wheat",
    stats: { civConstructionPct: -10, tradeCostPct: -10 },
  },
  // ---- the lost lands, stages 1-3 (events on regaining a land) ----
  {
    id: "bgr_sp_lands_one",
    icon: "map",
    stats: { warSupportBp: 300, stabilityBp: 100 },
  },
  {
    id: "bgr_sp_lands_two",
    icon: "map",
    stats: { warSupportBp: 200, stabilityBp: 300, ppGainPct: 3 },
  },
  {
    id: "bgr_sp_san_stefano",
    icon: "flag",
    stats: { stabilityBp: 600, warSupportBp: 300, ppGainPct: 5 },
  },
  // ---- the crown and the routes ----
  {
    id: "bgr_sp_tsars_firm_rule",
    icon: "crown",
    stats: { stabilityBp: 600, driftNeuBp: 4 },
  },
  {
    id: "bgr_sp_palace_government",
    icon: "document",
    stats: { ppGainPct: 8, advisorCostPct: -10 },
  },
  {
    id: "bgr_sp_regency",
    icon: "crown",
    stats: { stabilityBp: -300, ppGainPct: -5, coupResistPct: -10 },
  },
  {
    id: "bgr_sp_zveno_state",
    icon: "star_plain",
    stats: { stabilityBp: 400, ppGainPct: 5, driftNeuBp: 3 },
  },
  {
    id: "bgr_sp_peasant_democracy",
    icon: "wheat",
    stats: { stabilityBp: 400, civConstructionPct: 5, driftDemBp: 4 },
  },
  {
    id: "bgr_sp_peoples_power",
    icon: "star_plain",
    stats: { stabilityBp: 300, civConstructionPct: 5, driftComBp: 4 },
  },
  {
    id: "bgr_sp_legionary_state",
    icon: "fist",
    stats: { warSupportBp: 800, stabilityBp: -300, driftFasBp: 4 },
  },
  {
    id: "bgr_sp_corporate_bulgaria",
    icon: "factory",
    stats: { milConstructionPct: 5, ppGainPct: 5, driftFasBp: 3 },
  },
  // ---- the army ----
  {
    id: "bgr_sp_hidden_army",
    icon: "shield",
    stats: { recruitablePct: -1, milConstructionPct: -5, warSupportBp: 200 },
  },
  {
    id: "bgr_sp_army_unbound",
    icon: "sword",
    stats: { recruitablePct: 1, milConstructionPct: 5 },
  },
  {
    id: "bgr_sp_war_academy",
    icon: "compass",
    stats: { planSpeedPct: 10, orgPct: 3 },
  },
  {
    id: "bgr_sp_imro_bands",
    icon: "fist",
    stats: { warSupportBp: 300, stabilityBp: -300 },
  },
  {
    id: "bgr_sp_mountain_redoubt",
    icon: "fort",
    stats: { defensePct: 8 },
  },
  {
    id: "bgr_sp_eastern_corps",
    icon: "sword",
    stats: { attackPct: 3, warSupportBp: -300 },
  },
  // ---- the economy ----
  {
    id: "bgr_sp_german_clearing",
    icon: "document",
    stats: { tradeCostPct: -15, ppGainPct: 3 },
  },
  {
    id: "bgr_sp_western_markets",
    icon: "globe",
    stats: { civConstructionPct: 5, tradeCostPct: 5 },
  },
  // ---- the air and the home front ----
  {
    id: "bgr_sp_pilot_schools",
    icon: "plane",
    stats: { airDefensePct: 5, airAttackPct: 3 },
  },
  {
    id: "bgr_sp_sofia_shelters",
    icon: "tower",
    stats: { bombDamageTakenPct: -15 },
  },
  // ---- diplomacy ----
  {
    id: "bgr_sp_strict_neutrality",
    icon: "scales",
    stats: { defensePct: 5, warSupportBp: -200, stabilityBp: 300 },
  },
  {
    id: "bgr_sp_symbolic_war",
    icon: "dove",
    stats: { stabilityBp: 300, warSupportBp: -300 },
  },
  {
    id: "bgr_sp_soviet_friendship",
    icon: "handshake",
    stats: { driftComBp: 3, stabilityBp: -200 },
  },
];
