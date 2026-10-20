// World War 1936 P3 — generic national spirits (spec §19.8 "일반", §5.8,
// §13.2). Texts: ww1936.spirit.<id>, ww1936.spirit_desc.<id> (hidden ones have none).
// Percent stats are whole percent; stability and war support are bp.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_GEN: SpiritDef[] = [
  // ---- from the generic focus tree ----
  {
    id: "gen_industrial_zone",
    stats: { constructionPct: 5 },
    icon: "industry",
  },
  { id: "gen_skilled_workforce", stats: { effCapBp: 500 }, icon: "factory" },
  { id: "gen_mining_drive", stats: { extractionPct: 10 }, icon: "mine" },
  { id: "gen_research_institutes", stats: { researchPct: 3 }, icon: "flask" },
  {
    id: "gen_staff_training",
    stats: { planSpeedPct: 10, armyXpMilli: 100 },
    icon: "compass",
  },
  { id: "gen_efficient_government", stats: { ppGainPct: 10 }, icon: "scales" },
  { id: "gen_democratic_movement", stats: { driftDemBp: 5 }, icon: "ballot" },
  { id: "gen_labour_movement", stats: { driftComBp: 5 }, icon: "fist" },
  { id: "gen_renewal_movement", stats: { driftFasBp: 5 }, icon: "eagle_plain" },
  {
    id: "gen_neutrality_declared",
    stats: { enemyJustifyTimePct: 25 },
    icon: "dove",
  },
  /** gen_pol_dem_ally: this country's tension gate for factions is 20 points lower. */
  {
    id: "gen_allied_course",
    stats: {},
    icon: "handshake",
    hidden: true,
    rules: [{ factionGateMinusPp: 20 }],
  },
  // ---- from civil_war (Task 4 adds it for 180 days, spec §5.8) ----
  {
    id: "gen_civil_strife",
    stats: { outputPct: -20, constructionPct: -20 },
    icon: "chain_broken",
  },
  // ---- from generic decisions and events ----
  /** gen_rally: the ruling party's daily gain itself comes from a hidden gen_party_support_* spirit. */
  { id: "gen_rally_spirit", stats: {}, icon: "megaphone" },
  {
    id: "gen_war_bonds_spirit",
    stats: { warSupportBp: 800, consumerGoodsPp: 2 },
    icon: "document",
  },
  {
    id: "gen_industrial_subsidy_spirit",
    stats: { civConstructionPct: 15 },
    icon: "factory",
  },
  {
    id: "gen_martial_law_spirit",
    stats: { stabilityBp: 1500, outputPct: -10 },
    icon: "shield",
  },
  { id: "gen_strike_losses", stats: { outputPct: -10 }, icon: "factory" },
  // Party support from abroad (gen_party_support_*) and gen_rally: +15 bp a day for one ideology.
  {
    id: "gen_party_support_democratic",
    stats: { driftDemBp: 15 },
    icon: "megaphone",
    hidden: true,
  },
  {
    id: "gen_party_support_communist",
    stats: { driftComBp: 15 },
    icon: "megaphone",
    hidden: true,
  },
  {
    id: "gen_party_support_fascist",
    stats: { driftFasBp: 15 },
    icon: "megaphone",
    hidden: true,
  },
  {
    id: "gen_party_support_neutral",
    stats: { driftNeuBp: 15 },
    icon: "megaphone",
    hidden: true,
  },
  /** move_buildings (Task 4): the engine sets the stopped factories' share itself. */
  { id: "gen_relocating", stats: {}, icon: "factory_mil", hidden: true },
];
