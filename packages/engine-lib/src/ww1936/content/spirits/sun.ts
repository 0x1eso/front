// World War 1936 P3 — Soviet national spirits (spec §19.8, lane K4).
// Percent stats are whole percent; stability and war support are bp
// (+5% = 500). The six after sun_surprise_shock carry stats the focus
// table gives without naming a spirit (no effect kind adds stats directly).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_SUN = [
  // The purge in stages (sun_great_purge, then the trial events). No stage
  // rewards anything (controller ruling on final review B M7: the purge is
  // never a choice that pays): only its costs to the army.
  {
    id: "sun_purge_1",
    icon: "scales",
    stats: { orgPct: -5 },
  },
  {
    id: "sun_purge_2",
    icon: "scales",
    stats: { orgPct: -15, attackPct: -10, planSpeedPct: -20 },
  },
  {
    id: "sun_purge_3",
    icon: "scales",
    stats: { orgPct: -20, attackPct: -15, generalXpPct: -30 },
  },
  {
    id: "sun_purge_aftermath",
    icon: "document",
    stats: { orgPct: -10, generalXpPct: -20 },
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
] satisfies SpiritDef[];
