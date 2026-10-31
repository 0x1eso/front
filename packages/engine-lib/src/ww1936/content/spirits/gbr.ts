// World War 1936 P3 — British national spirits from focuses and events
// (spec §19.8; starting spirits gbr_peace_mood and gbr_empire are K6's).
// Stability and war support in bp (100 = 1 point).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_GBR: SpiritDef[] = [
  // gbr_defence_white_paper
  {
    id: "gbr_rearm_programme",
    icon: "factory_mil",
    stats: { milConstructionPct: 10 },
  },
  // gbr_appeasement
  {
    id: "gbr_peace_policy",
    icon: "dove",
    stats: { stabilityBp: 500, warSupportBp: -500, tensionPct: -10 },
  },
  // gbr_guarantees: guarantees cost no political power
  {
    id: "gbr_guarantee_pledge",
    icon: "shield",
    stats: {},
    rules: ["free_guarantees"],
  },
  // gbr_ministry_of_supply
  { id: "gbr_supply_ministry", icon: "industry", stats: { outputPct: 5 } },
  // gbr_war_cabinet, gbr_churchill
  {
    id: "gbr_war_coalition",
    icon: "handshake",
    stats: { stabilityBp: 1000, warSupportBp: 1000 },
  },
  // gbr_labour_partnership
  {
    id: "gbr_planned_economy",
    icon: "factory",
    stats: { civConstructionPct: 10, consumerGoodsPp: 2 },
  },
  // gbr_collective_security: guarantees open at 10% world tension
  {
    id: "gbr_security_pact",
    icon: "scales",
    stats: {},
    rules: [{ guaranteeGatePct: 10 }],
  },
  // gbr_one_empire
  {
    id: "gbr_united_empire",
    icon: "crown",
    stats: { nonCoreManpowerPp: 10, stabilityBp: 500 },
  },
  // gbr_university_research
  { id: "gbr_university_drive", icon: "research", stats: { researchPct: 10 } },
  // gbr_empire_resources
  { id: "gbr_empire_mines", icon: "mine", stats: { extractionPct: 10 } },
  // gbr_total_production
  { id: "gbr_total_output", icon: "factory_mil", stats: { outputPct: 10 } },
  // gbr_desert_training
  { id: "gbr_desert_warfare", icon: "compass", stats: { desertAttackPct: 10 } },
  // gbr_abdication, second option (365 days)
  {
    id: "gbr_kings_party",
    icon: "crown",
    stats: { warSupportBp: 500, stabilityBp: -1000 },
  },
  // gbr_prague_shock (replaces gbr_peace_mood)
  {
    id: "gbr_no_more_concessions",
    icon: "fist",
    stats: { warSupportBp: 1000 },
  },
  // gbr_territorial_army
  {
    id: "gbr_territorial_reserve",
    icon: "infantry",
    stats: { recruitablePct: 10 },
  },
  // gbr_imperial_preference: more trade units per factory (spec "inside the
  // faction" approximated as every deal, plan Task 12 Step 1)
  { id: "gbr_empire_trade", icon: "wheat", stats: { tradeCostPct: 15 } },
  // gbr_beveridge
  {
    id: "gbr_welfare_state",
    icon: "crown",
    stats: { stabilityBp: 700, manpowerGrowthPct: 5 },
  },
  // gbr_bletchley
  {
    id: "gbr_codebreakers",
    icon: "radio",
    stats: { intelPct: 15, rsElectronicsPct: 5 },
  },
  // gbr_imperial_federation
  {
    id: "gbr_federal_council",
    icon: "crown",
    stats: { nonCoreManpowerPp: 10, ppGainPct: 10 },
  },
  // gbr_infantry_tank
  {
    id: "gbr_infantry_tank_doctrine",
    icon: "tank",
    stats: { orgPct: 5, rsArmorPct: 5 },
  },
  // gbr_cruiser_tank
  {
    id: "gbr_cruiser_tank_doctrine",
    icon: "road",
    stats: { mechBreakPct: 10 },
  },
  // gbr_burma_campaign
  { id: "gbr_chindits", icon: "infantry", stats: { forestDefensePct: 10 } },
  // gbr_rationing
  {
    id: "gbr_ration_book",
    icon: "wheat",
    stats: { consumerGoodsPp: -3, stabilityBp: -300 },
  },
];
