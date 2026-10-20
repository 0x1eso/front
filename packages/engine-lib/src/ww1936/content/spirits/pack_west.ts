// World War 1936 P6 — national spirits of the Spanish, Polish and Turkish packs
// (spec §11.5–§11.7). Stats use the P3–P6 WwStats keys: stability in bp
// (100 = 1%p), tradeCostPct is the trade units per factory (P3 spec §3.2: +
// is more, so "trade cost −10%" is +10). Region- or unit-type effects the
// stat table cannot hold are country-wide and halved (lane report,
// approximations).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const SPIRITS_PACK_WEST: SpiritDef[] = [
  // ---- Spain ----
  // spa_madrid_defense (365 days): "defence +10% in the capital's region" —
  // country-wide +5%.
  { id: "spa_capital_holds", icon: "fort", stats: { defensePct: 5 } },
  // spa_ebro (120 days): readiness cap +10%p, attack +5%.
  {
    id: "spa_ebro_offensive",
    icon: "map",
    stats: { planMaxBp: 1000, attackPct: 5 },
  },
  // spa_strait_airlift (60 days): airlift preparation −50%.
  { id: "spa_airlift_ready", icon: "plane", stats: { paradropPrepPct: -50 } },
  // spa_unified_command (365 days): readiness speed +10%.
  { id: "spa_unified_staff", icon: "medal", stats: { planSpeedPct: 10 } },
  // spa_northern_campaign (90 days): "attack in mountains +10%" — no terrain
  // key for mountains, so attack +5% everywhere.
  { id: "spa_northern_offensive", icon: "map", stats: { attackPct: 5 } },
  // spa_non_belligerence: others justify 50% slower, stability +10%.
  {
    id: "spa_non_belligerent",
    icon: "scales",
    stats: { enemyJustifyTimePct: 50, stabilityBp: 1000 },
  },
  // spa_wolfram: trade cost −10%.
  { id: "spa_wolfram_trade", icon: "mine", stats: { tradeCostPct: 10 } },
  // spa_rebuild_army (365 days): "every division +5 experience" — division
  // experience gain +10% for a year.
  { id: "spa_army_rebuilt", icon: "medal", stats: { divXpGainPct: 10 } },

  // ---- Poland ----
  // pol_gdynia: trade cost −10%.
  { id: "pol_gdynia_trade", icon: "ship", stats: { tradeCostPct: 10 } },
  // pol_cavalry: "cavalry battalions attack +10%" — no cavalry key, so
  // attack +5% everywhere.
  { id: "pol_cavalry_drill", icon: "sword", stats: { attackPct: 5 } },
  // pol_share_enigma / pol_pyry_meeting: marks that the cipher work was
  // shared (no stats).
  { id: "pol_enigma_shared", icon: "radio", hidden: true, stats: {} },
  // pol_balance: stability +5%.
  { id: "pol_balanced_course", icon: "scales", stats: { stabilityBp: 500 } },
  // pol_home_army: resistance target in occupied home regions +15%p.
  {
    id: "pol_home_army_support",
    icon: "shield",
    stats: { resistanceTargetPct: 15 },
  },

  // ---- Turkey ----
  // tur_active_neutrality: others justify 50% slower, trade cost −10%.
  {
    id: "tur_active_neutrality_spirit",
    icon: "scales",
    stats: { enemyJustifyTimePct: 50, tradeCostPct: 10 },
  },
  // tur_village_institutes: research +3%.
  { id: "tur_village_schools", icon: "research", stats: { researchPct: 3 } },
  // tur_straits_guardian: defence +5%, stability +5%.
  {
    id: "tur_straits_watch",
    icon: "shield",
    stats: { defensePct: 5, stabilityBp: 500 },
  },
];
