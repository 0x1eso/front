// ww229: Greece's spirits: four at the start, the focus and event ones, and
// the five bands of the Metaxas-Venizelist balance (core.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const GRC_SPIRITS: SpiritDef[] = [
  // ---- at the start ----
  // Royalists against Venizelists since 1915: two armies of officers, two
  // states in turn, coups and purges.
  {
    id: "grc_sp_national_schism",
    icon: "scales",
    stats: { stabilityBp: -500, coupResistPct: -10 },
  },
  // More than a million refugees from Asia Minor since 1923.
  {
    id: "grc_sp_refugee_nation",
    icon: "map",
    stats: { manpowerGrowthPct: 10, consumerGoodsPp: 2, stabilityBp: -200 },
  },
  // One of the largest merchant fleets in the world, mostly tramp steamers.
  {
    id: "grc_sp_merchant_marine",
    icon: "ship",
    stats: { tradeCostPct: -15, convoyLossPct: -10 },
  },
  // The default of 1932: the drachma off gold, credit dear.
  {
    id: "grc_sp_sovereign_default",
    icon: "document",
    stats: { civConstructionPct: -10, ppGainPct: -5 },
  },
  // ---- focuses and events ----
  {
    id: "grc_sp_fourth_of_august",
    icon: "crown",
    stats: { stabilityBp: 500, driftNeuBp: 3, coupResistPct: 20 },
  },
  {
    id: "grc_sp_eon",
    icon: "flag",
    stats: { warSupportBp: 300, recruitablePct: 2 },
  },
  {
    id: "grc_sp_third_civilisation",
    icon: "megaphone",
    stats: { ppGainPct: 5, warSupportBp: 200 },
  },
  {
    id: "grc_sp_social_insurance",
    icon: "wheat",
    stats: { stabilityBp: 400, driftComBp: -2 },
  },
  {
    id: "grc_sp_crown_and_army",
    icon: "medal",
    stats: { coupResistPct: 25, armyXpMilli: 50 },
  },
  {
    id: "grc_sp_parliamentary_rule",
    icon: "ballot",
    stats: { stabilityBp: 300, driftDemBp: 4, ppGainPct: -5 },
  },
  {
    id: "grc_sp_crowned_democracy",
    icon: "crown",
    stats: { stabilityBp: 500, coupResistPct: 10 },
  },
  {
    id: "grc_sp_second_republic",
    icon: "eagle_plain",
    stats: { warSupportBp: 300, driftDemBp: 5, stabilityBp: -200 },
  },
  {
    id: "grc_sp_new_order",
    icon: "fist",
    stats: { warSupportBp: 800, stabilityBp: -300, driftFasBp: 5 },
  },
  {
    id: "grc_sp_peoples_rule",
    icon: "star_plain",
    stats: { driftComBp: 5, civConstructionPct: 5, stabilityBp: 200 },
  },
  {
    id: "grc_sp_great_idea",
    icon: "map",
    stats: { warSupportBp: 600, justifyCostPct: -15, stabilityBp: -200 },
  },
  {
    id: "grc_sp_pyrkal",
    icon: "factory_mil",
    stats: { milConstructionPct: 10, gunBonusPct: 5 },
  },
  {
    id: "grc_sp_state_arsenals",
    icon: "factory",
    stats: { milConstructionPct: 5, rsArtilleryPct: 10, rsInfantryPct: 5 },
  },
  {
    id: "grc_sp_mountain_warfare",
    icon: "shield",
    stats: { defensePct: 5, infDefensePct: 5 },
  },
  {
    id: "grc_sp_mule_columns",
    icon: "road",
    stats: { supplyUsePct: -5, artSupplyPct: -10 },
  },
  {
    id: "grc_sp_ochi",
    icon: "fist",
    stats: { warSupportBp: 1000, defensePct: 5, stabilityBp: 300 },
  },
  {
    id: "grc_sp_fortress_garrisons",
    icon: "fort",
    stats: { fortDefPerLevelBp: 100, entrenchSpeedPct: 10 },
  },
  {
    id: "grc_sp_free_greek_forces",
    icon: "flag",
    stats: { legitimacyGainPct: 15, warSupportBp: 300 },
  },
  {
    id: "grc_sp_destroyer_raids",
    icon: "ship",
    stats: { convoyRaidPct: 10, navyAttackPct: 5 },
  },
  {
    id: "grc_sp_great_famine",
    icon: "wheat",
    stats: { stabilityBp: -800, manpowerGrowthPct: -20 },
  },
  {
    id: "grc_sp_island_exile",
    icon: "chain_broken",
    stats: { driftComBp: -3, driftDemBp: -2, stabilityBp: -200 },
  },
  // ---- the balance of power's bands (core.ts), regime to Venizelists ----
  {
    id: "grc_bop_new_state",
    icon: "crown",
    stats: { stabilityBp: 500, driftNeuBp: 3, ppGainPct: -5 },
  },
  {
    id: "grc_bop_regime_holds",
    icon: "shield",
    stats: { stabilityBp: 300, coupResistPct: 10 },
  },
  {
    id: "grc_bop_uneasy_truce",
    icon: "scales",
    stats: { ppGainPct: 5 },
  },
  {
    id: "grc_bop_venizelist_officers",
    icon: "medal",
    stats: { stabilityBp: -300, driftDemBp: 3 },
  },
  {
    id: "grc_bop_schism_reopens",
    icon: "chain_broken",
    stats: { stabilityBp: -800, driftDemBp: 5, coupResistPct: -20 },
  },
];
