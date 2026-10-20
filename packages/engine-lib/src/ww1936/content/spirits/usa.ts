// World War 1936 P5 — American national spirits from focuses (spec §18.5,
// §19.4; the starting spirits usa_depression and usa_isolation are P3's).
// Stability and war support in bp (100 = 1 point).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_USA: SpiritDef[] = [
  // usa_second_new_deal (replaces usa_depression); usa_recession_response ends it
  {
    id: "usa_recovering_economy",
    icon: "factory",
    stats: { consumerGoodsPp: 5, stabilityBp: -500 },
  },
  // usa_preparedness
  {
    id: "usa_preparedness",
    icon: "shield",
    stats: { milConstructionPct: 15 },
  },
  // usa_arsenal_of_democracy
  {
    id: "usa_arsenal",
    icon: "factory_mil",
    stats: { milConstructionPct: 20, outputPct: 5 },
  },
  // usa_war_production_board
  {
    id: "usa_war_production",
    icon: "industry",
    stats: { outputPct: 10, consumerGoodsPp: -3 },
  },
  // usa_america_first
  {
    id: "usa_fortress_america",
    icon: "fort",
    stats: { defensePct: 10, enemyJustifyTimePct: 50 },
  },
  // usa_neutral_trade
  {
    id: "usa_neutral_trade",
    icon: "scales",
    stats: { tradeCostPct: -15, consumerGoodsPp: -2 },
  },
  // usa_neutrality_patrol
  { id: "usa_patrol_fleet", icon: "compass", stats: { navalDetectPct: 10 } },
  // usa_europe_first: "준비도 속도" is the battle-plan speed
  {
    id: "usa_europe_first",
    icon: "map",
    stats: { planSpeedPct: 10, invasionPrepPct: -15 },
  },
  // usa_pacific_first
  {
    id: "usa_pacific_first",
    icon: "carrier",
    stats: { carrierStrikePct: 10, invasionCapacity: 5 },
  },
  // usa_louisiana_maneuvers (180 days)
  { id: "usa_great_maneuvers", icon: "medal", stats: { generalXpPct: 15 } },
  // usa_motor_pool
  {
    id: "usa_motorised_army",
    icon: "road",
    stats: { speedPct: 10, supplyUsePct: -5 },
  },
  // usa_marine_corps
  {
    id: "usa_amphibious_doctrine",
    icon: "ship",
    stats: { invasionPrepPct: -15 },
  },
  // usa_two_ocean_navy
  { id: "usa_two_ocean_fleet", icon: "ship", stats: { dockOutputPct: 10 } },
  // usa_submarine_campaign
  {
    id: "usa_unrestricted_subs",
    icon: "submarine",
    stats: { convoyRaidPct: 15 },
  },
  // usa_strategic_bombing
  {
    id: "usa_daylight_bombing",
    icon: "bomber",
    stats: { stratBombPct: 10 },
  },
];
