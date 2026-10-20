// World War 1936 P6 — the national spirits of the Balkan (`bal`) and Nordic
// (`nor`) packs (spec §11.8, §11.9; content lane K3). Names and descriptions
// are ww1936.spirit.<id> / ww1936.spirit_desc.<id>. Spirit ids never repeat a
// focus id (FocusData checks ids across focuses and spirits).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_PACK_NORTH: readonly SpiritDef[] = [
  // ---- Balkans ----
  // bal_arms_imports (720 days): spec "arms-market prices −20%". P6 has no
  // market-price key for the buyer; trade cost −10% stands in.
  { id: "bal_arms_contracts", icon: "document", stats: { tradeCostPct: -10 } },
  // bal_mountain_troops: spec "mountain battalion attack +5%". No key is
  // limited to mountain battalions; infantry attack +3% stands in.
  { id: "bal_highland_drill", icon: "infantry", stats: { infAttackPct: 3 } },
  // bal_partisans: occupied cores of this country resist more (P5 §8.3).
  { id: "bal_partisan_war", icon: "fist", stats: { resistanceTargetPct: 15 } },
  // grc_mountain_war: spec "mountain and hill defence +10%". No terrain key
  // for them; defence +5% stands in.
  { id: "grc_mountain_defense", icon: "shield", stats: { defensePct: 5 } },
  // ---- Nordic ----
  // nor_neutrality: others take 50% longer to justify against us.
  {
    id: "nor_neutrality_spirit",
    icon: "dove",
    stats: { enemyJustifyTimePct: 50 },
  },
  // nor_winter_training: winter penalty −30%.
  {
    id: "nor_winter_warfare",
    icon: "compass",
    stats: { winterPenaltyPct: -30 },
  },
  // nor_ski_troops: spec "forest and snow attack +10%". Winter penalty −10%
  // (the snow half) and infantry attack +3% (the forest half) stand in.
  {
    id: "nor_ski_warfare",
    icon: "infantry",
    stats: { winterPenaltyPct: -10, infAttackPct: 3 },
  },
  // nor_home_guard: recruitable +5%; spec "core defence +5%" has no key of its
  // own, so defence +3% stands in.
  {
    id: "nor_home_guard_spirit",
    icon: "shield",
    stats: { recruitablePct: 5, defensePct: 3 },
  },
  // nor_resistance: occupied cores of the exiled state resist more.
  { id: "nor_home_front", icon: "fist", stats: { resistanceTargetPct: 15 } },
  // swe_iron_ore: trade cost −10%.
  { id: "swe_ore_exports", icon: "mine", stats: { tradeCostPct: -10 } },
  // swe_armed_neutrality: takes the place of the starting gen_armed_neutrality
  // (defence +10%, others justify 50% slower) — defence +15%, war support +10%.
  {
    id: "swe_armed_neutrality_spirit",
    icon: "tower",
    stats: { defensePct: 15, warSupportBp: 1000, enemyJustifyTimePct: 50 },
  },
  // dnk_agriculture: trade cost −10%.
  { id: "dnk_farm_exports", icon: "wheat", stats: { tradeCostPct: -10 } },
  // fin_motti: forest defence +10%. The spec's second half (encircled enemies
  // in forest recover no organisation) has no key or rule (report: DSL gap).
  {
    id: "fin_motti_tactics",
    icon: "sword",
    stats: { forestDefensePct: 10 },
  },
  // fin_civil_guard: recruitable +10%.
  {
    id: "fin_civil_guard_spirit",
    icon: "infantry",
    stats: { recruitablePct: 10 },
  },
];
