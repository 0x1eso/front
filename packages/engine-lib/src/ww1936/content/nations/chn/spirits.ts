// ww229: Nationalist China's national spirits. Start spirits (in the
// politics row) and event or decision spirits keep their numbers; a focus's
// add_spirit is tripled (FocusScale), so the focus spirits carry small
// numbers. The pack's chn_* spirits (spirits/pack_china.ts) and the balance
// spirits bop_chn_* (depth/mech.ts) stay where they are. Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CHN_SPIRITS: SpiritDef[] = [
  {
    id: "chn_sp_nanjing_decade",
    icon: "industry",
    stats: { civConstructionPct: 10, ppGainPct: 5 },
  },
  {
    id: "chn_sp_personal_armies",
    icon: "chain_broken",
    stats: { orgPct: -10, trainPct: 15 },
  },
  {
    id: "chn_sp_vast_peasantry",
    icon: "wheat",
    stats: { manpowerGrowthPct: 15, researchPct: -10 },
  },
  {
    id: "chn_sp_fabi",
    icon: "scales",
    stats: { ppGainPct: 3, consumerGoodsPp: -1 },
  },
  {
    id: "chn_sp_generalissimo_rule",
    icon: "medal",
    stats: { planSpeedPct: 3, ppGainPct: 2, stabilityBp: -100 },
  },
  {
    id: "chn_sp_party_machine",
    icon: "document",
    stats: { stabilityBp: 150, ppGainPct: 2 },
  },
  {
    id: "chn_sp_baojia",
    icon: "shield",
    stats: { recruitablePct: 1, garrisonNeedPct: -5 },
  },
  {
    id: "chn_sp_resources_commission",
    icon: "mine",
    stats: { extractionPct: 3, civConstructionPct: 2 },
  },
  {
    id: "chn_sp_heavy_plan",
    icon: "factory_mil",
    stats: { milConstructionPct: 4 },
  },
  { id: "chn_sp_tungsten", icon: "mine", stats: { extractionPct: 3 } },
  {
    id: "chn_sp_export_collateral",
    icon: "oil",
    stats: { ppGainPct: 2, outputPct: 1 },
  },
  {
    id: "chn_sp_standard_arsenals",
    icon: "factory_mil",
    stats: { outputPct: 2 },
  },
  {
    id: "chn_sp_burma_route",
    icon: "road",
    stats: { fuelPct: 3, outputPct: 1 },
  },
  { id: "chn_sp_hump", icon: "plane", stats: { fuelPct: 3, supplyUsePct: -2 } },
  {
    id: "chn_sp_shanghai_stand",
    icon: "sword",
    stats: { attackPct: 2, warSupportBp: 150 },
  },
  { id: "chn_sp_northern_line", icon: "shield", stats: { defensePct: 3 } },
  {
    id: "chn_sp_flooded_plain",
    icon: "chain_broken",
    stats: { defensePct: 4, stabilityBp: -150 },
  },
  {
    id: "chn_sp_war_areas",
    icon: "compass",
    stats: { planSpeedPct: 3, supplyUsePct: -2 },
  },
  {
    id: "chn_sp_counteroffensive",
    icon: "sword",
    stats: { attackPct: 3, orgPct: 1 },
  },
  {
    id: "chn_sp_jianqiao",
    icon: "medal",
    stats: { airAttackPct: 2, airAgilityPct: 2 },
  },
  {
    id: "chn_sp_warning_net",
    icon: "radio",
    stats: { airDetectPct: 5, airDefensePct: 2 },
  },
  {
    id: "chn_sp_river_mines",
    icon: "mine",
    stats: { navyDefensePct: 3, shoreBombardPct: -3 },
  },
  { id: "chn_sp_hapro", icon: "handshake", stats: { milConstructionPct: 3 } },
  {
    id: "chn_sp_great_power",
    icon: "star_plain",
    stats: { ppGainPct: 3, stabilityBp: 150 },
  },
  {
    id: "chn_sp_front_uneasy",
    icon: "handshake",
    stats: { warSupportBp: 300, stabilityBp: -300 },
  },
  {
    id: "chn_sp_front_solid",
    icon: "handshake",
    stats: { warSupportBp: 800, recruitablePct: 3 },
  },
  {
    id: "chn_sp_front_broken",
    icon: "chain_broken",
    stats: { warSupportBp: -500, stabilityBp: -800 },
  },
  {
    id: "chn_sp_inflation",
    icon: "scales",
    stats: { stabilityBp: -500, consumerGoodsPp: 3 },
  },
];
