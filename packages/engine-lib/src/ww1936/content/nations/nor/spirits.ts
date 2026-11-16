// ww229: Norway's national spirits (names and texts ww1936.spirit.<id>,
// ww1936.spirit_desc.<id>). Data only. A spirit a focus adds counts three
// times (FocusScale), so the focus spirits stay small.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const NOR_SPIRITS: readonly SpiritDef[] = [
  // ---- start ----
  // The crisis compromise of 1935: Labour governs with the Farmers' Party.
  {
    id: "nor_crisis_pact",
    icon: "handshake",
    stats: { stabilityBp: 500, ppGainPct: 5 },
  },
  // The defence order of 1933 cut the army to a few weeks of drill.
  {
    id: "nor_defence_cuts",
    icon: "chain_broken",
    stats: { orgPct: -10, enemyJustifyTimePct: 25 },
  },
  // One of the largest merchant fleets in the world, most of it at sea.
  {
    id: "nor_great_merchant_fleet",
    icon: "ship",
    stats: { tradeCostPct: 10, convoyEscortPct: 5 },
  },
  // Waterfalls instead of coal: cheap power for the electro-industry.
  {
    id: "nor_white_coal_power",
    icon: "industry",
    stats: { energyPct: 10, civConstructionPct: 5 },
  },
  // ---- the merchant fleet (mechanism): chartered tonnage, a year at a time ----
  {
    id: "nor_charter_west",
    icon: "ship",
    stats: { tradeCostPct: 10, ppGainPct: 5 },
  },
  {
    id: "nor_charter_east",
    icon: "ship",
    stats: { tradeCostPct: 10, civConstructionPct: 5 },
  },
  { id: "nor_insured_fleet", icon: "document", stats: { convoyEscortPct: 5 } },
  // Nortraship: the fleet abroad earns for a government in exile.
  {
    id: "nor_nortraship_spirit",
    icon: "ship",
    stats: { ppGainPct: 5, convoyEscortPct: 5, legitimacyGainPct: 5 },
  },
  // A whaling season sold on the oil market.
  { id: "nor_whale_oil", icon: "oil", stats: { tradeCostPct: 5, fuelPct: 5 } },
  // ---- heavy water ----
  {
    id: "nor_heavy_water_trade",
    icon: "flask",
    stats: { ppGainPct: 5, rsIndustryPct: 5 },
  },
  // ---- the neutrality watch ----
  {
    id: "nor_watch",
    icon: "tower",
    stats: { defensePct: 3, enemyJustifyTimePct: 15 },
  },
  {
    id: "nor_watch_called_up",
    icon: "tower",
    stats: {
      defensePct: 10,
      recruitablePct: 2,
      consumerGoodsPp: 2,
      warSupportBp: 500,
    },
  },
  // ---- focuses ----
  {
    id: "nor_labour_peace",
    icon: "handshake",
    stats: { stabilityBp: 200, consumerGoodsPp: -1 },
  },
  {
    id: "nor_broad_coalition",
    icon: "handshake",
    stats: { stabilityBp: 200, warSupportBp: 100 },
  },
  {
    id: "nor_above_parties",
    icon: "crown",
    stats: { stabilityBp: 200, ppGainPct: 3 },
  },
  {
    id: "nor_ns_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 200, recruitablePct: 1 },
  },
  {
    id: "nor_council_republic",
    icon: "star_plain",
    stats: { outputPct: 2, warSupportBp: 100 },
  },
  {
    id: "nor_hydro_power",
    icon: "industry",
    stats: { energyPct: 3, civConstructionPct: 2 },
  },
  { id: "nor_ore_harbour", icon: "mine", stats: { tradeCostPct: 3 } },
  {
    id: "nor_provisioning",
    icon: "wheat",
    stats: { stabilityBp: 100, consumerGoodsPp: -1 },
  },
  { id: "nor_oslo_trade", icon: "handshake", stats: { tradeCostPct: 2 } },
  {
    id: "nor_strict_neutral",
    icon: "dove",
    stats: { enemyJustifyTimePct: 15, stabilityBp: 100 },
  },
  {
    id: "nor_ski_soldiers",
    icon: "infantry",
    stats: { forestDefensePct: 2, infAttackPct: 1 },
  },
  {
    id: "nor_coastal_squadron",
    icon: "ship",
    stats: { navyDefensePct: 2, navalDetectPct: 3 },
  },
  // ---- the war years ----
  {
    id: "nor_the_kings_no",
    icon: "crown",
    stats: { warSupportBp: 300, stabilityBp: 100 },
  },
  {
    id: "nor_valley_war",
    icon: "compass",
    stats: { defensePct: 2, forestDefensePct: 2 },
  },
  {
    id: "nor_government_abroad",
    icon: "globe",
    stats: { legitimacyGainPct: 5, ppGainPct: 2 },
  },
  {
    id: "nor_home_front_spirit",
    icon: "fist",
    stats: { resistanceTargetPct: 5 },
  },
  {
    id: "nor_milorg_spirit",
    icon: "fist",
    stats: { resistanceTargetPct: 3, infAttackPct: 1 },
  },
  {
    id: "nor_little_norway_camp",
    icon: "plane",
    stats: { airAttackPct: 1, airAgilityPct: 1 },
  },
  {
    id: "nor_linge_commandos",
    icon: "sword",
    stats: { infAttackPct: 1, paradropPrepPct: 5 },
  },
];
