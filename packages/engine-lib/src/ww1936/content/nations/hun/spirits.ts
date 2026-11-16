// ww229 (design ww227 §3, §5): Hungary's national spirits. Names and texts:
// ww1936.spirit.<id>, ww1936.spirit_desc.<id>. Spirit ids never repeat a
// focus id.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const HUN_SPIRITS: readonly SpiritDef[] = [
  // ---- start spirits ----
  // The Treaty of Trianon (1920) left two thirds of the old kingdom's land
  // outside the border: the wound feeds the right and the will to fight.
  {
    id: "hun_trianon_wound",
    icon: "map",
    stats: { stabilityBp: -500, warSupportBp: 500, driftFasBp: 5 },
  },
  // The treaty's arms limits (35,000 men, no tanks or military aircraft),
  // lifted by hun_equal_rights.
  {
    id: "hun_army_limits",
    icon: "chain_broken",
    stats: { conscriptionCostPct: 25, milConstructionPct: -10 },
  },
  // The regency: Horthy's wide powers and an officer corps loyal to him.
  {
    id: "hun_regency",
    icon: "crown",
    stats: { coupResistPct: 25, stabilityBp: 300 },
  },
  // Great estates and landless farm labourers; removed by a land reform.
  {
    id: "hun_landed_estates",
    icon: "wheat",
    stats: { manpowerGrowthPct: -10, consumerGoodsPp: 2 },
  },
  // ---- the revision's stages (events hun_first_lands_return and on) ----
  {
    id: "hun_revision_begun",
    icon: "map",
    stats: { stabilityBp: 300, warSupportBp: 500 },
  },
  {
    id: "hun_revision_advancing",
    icon: "map",
    stats: { stabilityBp: 500, warSupportBp: 700, ppGainPct: 5 },
  },
  {
    id: "hun_revision_fulfilled",
    icon: "crown",
    stats: { stabilityBp: 800, warSupportBp: 500, ppGainPct: 10 },
  },
  // ---- focus spirits ----
  {
    id: "hun_gyor_rearmament",
    icon: "factory_mil",
    stats: { milConstructionPct: 10 },
  },
  {
    id: "hun_csepel_craftsmen",
    icon: "factory_mil",
    stats: { effGrowthPct: 10 },
  },
  { id: "hun_aluminium_industry", icon: "steel", stats: { rsAirPct: 10 } },
  { id: "hun_polytechnic", icon: "flask", stats: { researchPct: 4 } },
  {
    id: "hun_levente_drill",
    icon: "infantry",
    stats: { recruitablePct: 2, trainPct: -5 },
  },
  { id: "hun_rapid_corps_spirit", icon: "road", stats: { motSpeedPct: 5 } },
  {
    id: "hun_hussar_spirit",
    icon: "medal",
    stats: { recoveryPct: 3, advanceSpeedPct: 3 },
  },
  {
    id: "hun_staff_college",
    icon: "compass",
    stats: { planSpeedPct: 8, divXpGainPct: 8 },
  },
  {
    id: "hun_carpathian_watch",
    icon: "fort",
    stats: { defensePct: 3, fortConstructionPct: 15 },
  },
  {
    id: "hun_air_arm",
    icon: "plane",
    stats: { rsAirPct: 5, fighterAttackPct: 3 },
  },
  {
    id: "hun_regent_powers",
    icon: "scales",
    stats: { coupResistPct: 20, stabilityBp: 300 },
  },
  {
    id: "hun_holy_crown",
    icon: "crown",
    stats: { stabilityBp: 800, ppGainPct: 5 },
  },
  {
    id: "hun_hungarist_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 1000, recruitablePct: 3, stabilityBp: -300 },
  },
  {
    id: "hun_national_rebirth",
    icon: "ballot",
    stats: { stabilityBp: 500, outputPct: 3 },
  },
  {
    id: "hun_councils_state",
    icon: "fist",
    stats: { stabilityBp: 300, constructionPct: 5 },
  },
  { id: "hun_danube_trade", icon: "ship", stats: { tradeCostPct: 10 } },
  { id: "hun_bauxite_trade", icon: "mine", stats: { consumerGoodsPp: -2 } },
  {
    id: "hun_armed_neutrality_spirit",
    icon: "shield",
    stats: { defensePct: 5, enemyJustifyTimePct: 30 },
  },
  {
    id: "hun_crusade_spirit",
    icon: "sword",
    stats: { warSupportBp: 500, attackPct: 2 },
  },
  {
    id: "hun_seesaw",
    icon: "scales",
    stats: { stabilityBp: 300, warSupportBp: -500 },
  },
  {
    id: "hun_hold_spirit",
    icon: "fort",
    stats: { defensePct: 5, entrenchSpeedPct: 10 },
  },
  {
    id: "hun_resistance_spirit",
    icon: "fist",
    stats: { resistanceTargetPct: 15 },
  },
];
