// World War 1936 P3 — Soviet national spirits (spec §19.8, lane K4).
// Percent stats are whole percent; stability and war support are bp
// (+5% = 500). The six after sun_surprise_shock carry stats the focus
// table gives without naming a spirit (no effect kind adds stats directly).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_SUN = [
  // The purge in stages (sun_great_purge, then the trial events): huge costs
  // and huge gains together, as the order tree of a state of emergency. The
  // control focuses add their own spirits on top (sun_ctl_*), which shrink the
  // costs and grow the gains; sun_purge_ends removes every one of them and
  // leaves only an aftermath spirit. Stats are whole percent; stability and
  // war support are bp. None of this is scaled.
  {
    id: "sun_purge_1",
    icon: "scales",
    stats: {
      orgPct: -10,
      intelPct: -15,
      researchPct: -5,
      recruitablePct: 3,
      trainPct: 10,
      reinforcePct: 10,
      consumerGoodsPp: -3,
      constructionPct: 10,
      extractionPct: 10,
      ppGainPct: 25,
      focusSpeedPct: 10,
      lawCostPct: -15,
      decisionCostPct: -15,
      stabilityBp: 1000,
      warSupportBp: 500,
      coupResistPct: 30,
      defensePct: 5,
      surrenderPp: 5,
    },
  },
  {
    id: "sun_purge_2",
    icon: "scales",
    stats: {
      orgPct: -25,
      attackPct: -20,
      planSpeedPct: -30,
      generalXpPct: -30,
      airAttackPct: -10,
      intelPct: -25,
      researchPct: -10,
      outputPct: -5,
      diploCostPct: 25,
      recruitablePct: 6,
      trainPct: 25,
      reinforcePct: 20,
      consumerGoodsPp: -8,
      constructionPct: 20,
      extractionPct: 20,
      ppGainPct: 50,
      focusSpeedPct: 25,
      lawCostPct: -30,
      decisionCostPct: -30,
      stabilityBp: 1500,
      warSupportBp: 1000,
      coupResistPct: 60,
      defensePct: 10,
      surrenderPp: 10,
    },
  },
  {
    id: "sun_purge_3",
    icon: "scales",
    stats: {
      orgPct: -40,
      attackPct: -30,
      planSpeedPct: -40,
      generalXpPct: -50,
      airAttackPct: -20,
      navyAttackPct: -20,
      intelPct: -40,
      researchPct: -15,
      outputPct: -10,
      diploCostPct: 50,
      recruitablePct: 10,
      trainPct: 40,
      reinforcePct: 30,
      consumerGoodsPp: -12,
      constructionPct: 30,
      extractionPct: 30,
      ppGainPct: 80,
      focusSpeedPct: 40,
      lawCostPct: -50,
      decisionCostPct: -50,
      stabilityBp: 2500,
      warSupportBp: 2000,
      coupResistPct: 100,
      defensePct: 15,
      surrenderPp: 15,
    },
  },
  // The control focuses, one spirit each (they stack on the stage spirit).
  {
    id: "sun_ctl_nkvd",
    icon: "fist",
    stats: { intelPct: 10, ppGainPct: 10, complianceGainPct: 25 },
  },
  {
    id: "sun_ctl_trials",
    icon: "scales",
    stats: { stabilityBp: 500, warSupportBp: 500 },
  },
  {
    id: "sun_ctl_informers",
    icon: "document",
    stats: { stabilityBp: 500, coupResistPct: 30, resistanceTargetPct: -20 },
  },
  {
    id: "sun_ctl_commissars",
    icon: "star_plain",
    stats: { orgPct: 15, attackPct: 5, defensePct: 10, reinforcePct: 10 },
  },
  {
    id: "sun_ctl_bureaus",
    icon: "flask",
    stats: {
      researchPct: 10,
      rsAirPct: 20,
      rsArmorPct: 20,
      projectSpeedPct: 20,
    },
  },
  {
    id: "sun_ctl_camps",
    icon: "factory_mil",
    stats: {
      outputPct: 5,
      constructionPct: 15,
      extractionPct: 15,
      consumerGoodsPp: -3,
    },
  },
  {
    id: "sun_ctl_personnel",
    icon: "document",
    stats: {
      generalXpPct: 20,
      planSpeedPct: 15,
      airAttackPct: 10,
      navyAttackPct: 10,
      trainPct: 10,
    },
  },
  {
    id: "sun_ctl_dictator",
    icon: "flag",
    stats: {
      orgPct: 10,
      attackPct: 10,
      ppGainPct: 20,
      focusSpeedPct: 15,
      surrenderPp: 10,
    },
  },
  // What the purge leaves behind, by how long it ran (up to one year, up to
  // two, longer). Each one stands alone; sun_winter_war_lessons replaces it.
  {
    id: "sun_purge_aftermath",
    icon: "document",
    stats: { orgPct: -5, generalXpPct: -10, intelPct: -10 },
  },
  {
    id: "sun_purge_aftermath_2",
    icon: "document",
    stats: { orgPct: -10, generalXpPct: -20, intelPct: -10 },
  },
  {
    id: "sun_purge_aftermath_3",
    icon: "document",
    stats: { orgPct: -15, generalXpPct: -30, intelPct: -10 },
  },
  // Timed troubles of a long purge (the events add them for a while).
  { id: "sun_denunciations", icon: "document", stats: { outputPct: -5 } },
  { id: "sun_camp_unrest", icon: "mine", stats: { extractionPct: -15 } },
  { id: "sun_defections", icon: "document", stats: { intelPct: -20 } },
  { id: "sun_bread_lines", icon: "wheat", stats: { consumerGoodsPp: 4 } },
  { id: "sun_flooded_mines", icon: "mine", stats: { extractionPct: -8 } },
  { id: "sun_false_figures", icon: "document", stats: { planSpeedPct: -10 } },
  // The army regime (Red Bonaparte) and its end states.
  {
    id: "sun_army_regime",
    icon: "sword",
    stats: { coupResistPct: 30, warSupportBp: 500, ppGainPct: -10 },
  },
  {
    id: "sun_junta_rule",
    icon: "sword",
    stats: { attackPct: 5, orgPct: 10, recruitablePct: 5, coupResistPct: 60 },
  },
  // The reformers' path.
  {
    id: "sun_deep_operations",
    icon: "sword",
    stats: { attackPct: 5, planSpeedPct: 10 },
  },
  { id: "sun_collective_rule", icon: "ballot", stats: { advisorCostPct: -25 } },
  // Industry.
  {
    id: "sun_third_plan",
    icon: "factory_mil",
    stats: { milConstructionPct: 15, consumerGoodsPp: 3 },
  },
  { id: "sun_power_grid", icon: "tower", stats: { outputPct: 5 } },
  { id: "sun_design_bureau_system", icon: "flask", stats: { researchPct: 10 } },
  {
    id: "sun_labour_heroes",
    icon: "medal",
    stats: { outputPct: 5, stabilityBp: 300 },
  },
  // War with Germany.
  {
    id: "sun_defend_motherland",
    icon: "shield",
    stats: {
      warSupportBp: 2000,
      stabilityBp: 1000,
      surrenderPp: 5,
      recruitablePct: 10,
    },
  },
  {
    id: "sun_surprise_shock",
    icon: "flag",
    stats: { orgPct: -10, stabilityBp: -1000 },
  },
  // Stats of focuses: sun_rkka_expansion, sun_mass_mobilisation,
  // sun_moderate_economy, sun_winter_war_lessons, sun_commander_rebuild and
  // sun_evacuation (180 days).
  { id: "sun_rkka_reserves", icon: "infantry", stats: { recruitablePct: 5 } },
  {
    id: "sun_total_mobilisation",
    icon: "megaphone",
    stats: { recruitablePct: 10 },
  },
  { id: "sun_consumer_line", icon: "wheat", stats: { consumerGoodsPp: 3 } },
  { id: "sun_war_lessons", icon: "document", stats: { orgPct: 5 } },
  {
    id: "sun_commander_corps",
    icon: "star_plain",
    stats: { orgPct: 5, generalXpPct: 25 },
  },
  {
    id: "sun_factory_relocation",
    icon: "rail",
    stats: { milConstructionPct: 10 },
  },
  // The Red Bonaparte's programme: written numbers, a focus counts them x3.
  // The army's gains come with a cost in the same spirit.
  {
    id: "sun_security_split",
    icon: "chain_broken",
    stats: { intelPct: -10, researchPct: 3, ppGainPct: 2 },
  },
  {
    id: "sun_command_unity",
    icon: "star_plain",
    stats: { orgPct: 4, planSpeedPct: 4, reinforcePct: 3 },
  },
  {
    id: "sun_deep_ops_doctrine",
    icon: "compass",
    stats: {
      attackPct: 4,
      planSpeedPct: 6,
      breakthroughPct: 4,
      advanceSpeedPct: 3,
    },
  },
  {
    id: "sun_armoured_spearhead",
    icon: "tank",
    stats: { armorAttackPct: 5, armorBrkPct: 5, rsArmorPct: 8 },
  },
  {
    id: "sun_army_air_arm",
    icon: "plane",
    stats: { airAttackPct: 4, casPct: 6, rsAirPct: 8, stratBombPct: -10 },
  },
  {
    id: "sun_restored_officers",
    icon: "medal",
    stats: { generalXpPct: 12, orgPct: 3, divXpGainPct: 5 },
  },
  {
    id: "sun_general_staff_rule",
    icon: "map",
    stats: { planMaxBp: 600, supplyUsePct: -3, reinforcePct: 3, ppGainPct: -3 },
  },
  {
    id: "sun_party_liaison",
    icon: "handshake",
    stats: { stabilityWeeklyBp: 5, advisorCostPct: -10 },
  },
  {
    id: "sun_grain_deal",
    icon: "wheat",
    stats: { manpowerGrowthPct: 4, consumerGoodsPp: 2 },
  },
  {
    id: "sun_republic_charters",
    icon: "flag",
    stats: {
      garrisonNeedPct: -10,
      complianceGainPct: 10,
      nonCoreManpowerPp: 3,
    },
  },
  // Timed: the answers to the junta's cards.
  {
    id: "sun_eased_quotas",
    icon: "wheat",
    stats: { manpowerGrowthPct: 3, consumerGoodsPp: 2 },
  },
  // The military-rule exit.
  {
    id: "sun_garrison_regime",
    icon: "fort",
    stats: { recruitablePct: 2, trainPct: 6, consumerGoodsPp: 2 },
  },
  {
    id: "sun_marshals_rule",
    icon: "star_plain",
    stats: { coupResistPct: 15, advisorCostPct: -15, decisionCostPct: -10 },
  },
  {
    id: "sun_army_industry",
    icon: "factory_mil",
    stats: { milConstructionPct: 8, consumerGoodsPp: 2 },
  },
  // The return to the NEP.
  {
    id: "sun_amnesty",
    icon: "dove",
    stats: { researchPct: 3, outputPct: 2 },
  },
  {
    id: "sun_party_state",
    icon: "ballot",
    stats: { ppGainPct: 3, coupResistPct: 10 },
  },
  {
    id: "sun_market_plan",
    icon: "industry",
    stats: { outputPct: 3, tradeCostPct: -10, consumerGoodsPp: -1 },
  },
] satisfies SpiritDef[];
