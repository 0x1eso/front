// ww229: Canada's national spirits (names and texts ww1936.spirit.<id>,
// ww1936.spirit_desc.<id>). Data only. The conscription ladder (decisions.ts)
// swaps can_kings_pledge -> can_home_defence_draft -> can_pledge_released ->
// can_overseas_conscription, or ends in can_volunteer_army.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CAN_SPIRITS: readonly SpiritDef[] = [
  // ---- start ----
  // The government's promise: no conscription for service overseas.
  {
    id: "can_kings_pledge",
    icon: "dove",
    stats: { stabilityBp: 300, recruitablePct: -1, warSupportBp: -300 },
  },
  // English and French Canada, two peoples who read the world differently.
  {
    id: "can_two_solitudes",
    icon: "scales",
    stats: { stabilityBp: -300, warSupportBp: -500, driftNeuBp: 2 },
  },
  // Drought and the Depression on the prairies.
  {
    id: "can_dust_bowl",
    icon: "wheat",
    stats: { consumerGoodsPp: 3, manpowerGrowthPct: -5 },
  },
  // The Shield, the forests and the wheat: a country of raw materials.
  {
    id: "can_dominion_resources",
    icon: "mine",
    stats: { extractionPct: 10, tradeCostPct: -5 },
  },
  // ---- the conscription ladder (mechanism) ----
  {
    id: "can_home_defence_draft",
    icon: "shield",
    stats: { recruitablePct: 2, stabilityBp: -200, defensePct: 5 },
  },
  {
    id: "can_pledge_released",
    icon: "ballot",
    stats: { recruitablePct: 3, stabilityBp: -400, warSupportBp: 300 },
  },
  {
    id: "can_overseas_conscription",
    icon: "infantry",
    stats: {
      recruitablePct: 5,
      stabilityBp: -800,
      warSupportBp: 300,
      driftNeuBp: 4,
    },
  },
  {
    id: "can_volunteer_army",
    icon: "medal",
    stats: {
      recruitablePct: 1,
      stabilityBp: 400,
      warSupportBp: -200,
      trainPct: -10,
    },
  },
  {
    id: "can_quebec_unrest",
    icon: "fist",
    stats: { stabilityBp: -500, driftNeuBp: 3 },
  },
  // ---- politics ----
  {
    id: "can_social_insurance",
    icon: "document",
    stats: { stabilityBp: 300, consumerGoodsPp: 1 },
  },
  {
    id: "can_baby_bonus",
    icon: "wheat",
    stats: { manpowerGrowthPct: 10, stabilityBp: 200 },
  },
  {
    id: "can_ccf_planning",
    icon: "wheat",
    stats: { civConstructionPct: 10, stabilityBp: -200, driftDemBp: 2 },
  },
  {
    id: "can_corporate_order",
    icon: "crown",
    stats: { stabilityBp: 800, ppGainPct: 5, warSupportBp: -300 },
  },
  {
    id: "can_blue_shirt_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 1000, stabilityBp: -300, recruitablePct: 2 },
  },
  {
    id: "can_peoples_dominion",
    icon: "star_plain",
    stats: { milConstructionPct: 10, civConstructionPct: 5, stabilityBp: -300 },
  },
  // ---- economy ----
  {
    id: "can_reciprocity_trade",
    icon: "handshake",
    stats: { tradeCostPct: -10, consumerGoodsPp: -1 },
  },
  {
    id: "can_mining_boom",
    icon: "mine",
    stats: { extractionPct: 10 },
  },
  {
    id: "can_howe_boys",
    icon: "industry",
    stats: { milConstructionPct: 10, outputPct: 3 },
  },
  {
    id: "can_arsenal_of_empire",
    icon: "factory_mil",
    stats: { outputPct: 5, dockOutputPct: 5 },
  },
  {
    id: "can_hyde_park_dollars",
    icon: "handshake",
    stats: { tradeCostPct: -10, ppGainPct: 5 },
  },
  {
    id: "can_price_controls",
    icon: "scales",
    stats: { stabilityBp: 400, consumerGoodsPp: -1 },
  },
  {
    id: "can_victory_bond_drive",
    icon: "flag",
    stats: { warSupportBp: 500, ppGainPct: 5 },
  },
  {
    id: "can_bank_of_england_gold",
    icon: "crown",
    stats: { ppGainPct: 10, tradeCostPct: -5 },
  },
  // ---- army ----
  {
    id: "can_vimy_tradition",
    icon: "medal",
    stats: { attackPct: 5, orgPct: 5 },
  },
  {
    id: "can_set_piece_artillery",
    icon: "artillery",
    stats: { artillerySoftPct: 10, planSpeedPct: 10 },
  },
  // ---- air and navy ----
  {
    id: "can_bcatp",
    icon: "plane",
    stats: { airLossCutPct: 8, airDetectPct: 5 },
  },
  {
    id: "can_rcaf_squadrons",
    icon: "plane",
    stats: { airAttackPct: 5 },
  },
  {
    id: "can_escort_force",
    icon: "ship",
    stats: { convoyEscortPct: 15 },
  },
  {
    id: "can_northwest_atlantic_command",
    icon: "compass",
    stats: { convoyEscortPct: 10, navalDetectPct: 10 },
  },
  // ---- diplomacy ----
  {
    id: "can_middle_power_spirit",
    icon: "globe",
    stats: { diploCostPct: -15, stabilityBp: 200 },
  },
];
