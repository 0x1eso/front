// ww229 (design ww227 §3, §5): Republican Spain's spirits. Start spirits
// (with the base esp_civil_war_nation), the five bands of the PCE ↔ CNT-FAI
// balance (core.ts BOP row), then the focus and event spirits. Stats use the
// WwStats keys (stabilityBp: 100 = 1%p; tradeCostPct: + is more trade units
// per factory). Data only (ContentPurity).
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ESR_SPIRITS: SpiritDef[] = [
  // ---- start ----
  // The Bank of Spain's gold, among the largest reserves in the world
  // (spent by esr_gold_to_moscow or esr_gold_to_paris).
  { id: "esr_gold_reserve", icon: "scales", stats: { tradeCostPct: 10 } },
  // Madrid, Barcelona, Valencia and the north's mines and yards.
  {
    id: "esr_industrial_cities",
    icon: "factory",
    stats: { outputPct: 3, milConstructionPct: 5 },
  },
  // Strikes, land seizures, burnt churches and street fighting (removed by
  // esr_restore_order).
  {
    id: "esr_revolutionary_rear",
    icon: "fist",
    stats: { stabilityBp: -500, outputPct: -5 },
  },
  // Half the officer corps cannot be trusted (removed by
  // esr_war_schools).
  {
    id: "esr_divided_officers",
    icon: "medal",
    stats: { planSpeedPct: -15, divXpGainPct: -10, coupResistPct: -10 },
  },
  // The party and union columns of the first months (removed by
  // esr_popular_army).
  {
    id: "esr_militia_columns",
    icon: "flag",
    stats: { orgPct: -10, manpowerGrowthPct: 10, warSupportBp: 300 },
  },

  // ---- the balance of power: PCE (−) ↔ CNT-FAI (+) ----
  {
    id: "esr_bop_pce_hegemony",
    icon: "star_plain",
    stats: { orgPct: 5, ppGainPct: 5, stabilityBp: -500 },
  },
  { id: "esr_bop_pce_lead", icon: "star_plain", stats: { orgPct: 3 } },
  {
    id: "esr_bop_popular_front",
    icon: "handshake",
    stats: { stabilityBp: 500 },
  },
  {
    id: "esr_bop_cnt_lead",
    icon: "fist",
    stats: { manpowerGrowthPct: 5 },
  },
  {
    id: "esr_bop_revolution",
    icon: "fist",
    stats: { manpowerGrowthPct: 10, orgPct: -5, outputPct: -5 },
  },

  // ---- the war ----
  {
    id: "esr_loyal_commands",
    icon: "shield",
    stats: { coupResistPct: 20, stabilityBp: 200 },
  },
  {
    id: "esr_volunteer_columns",
    icon: "flag",
    stats: { attackPct: 3, manpowerGrowthPct: 5, orgPct: -5 },
  },
  {
    id: "esr_mixed_brigades",
    icon: "infantry",
    stats: { orgPct: 5, defensePct: 3 },
  },
  {
    id: "esr_brigadistas",
    icon: "globe",
    stats: { attackPct: 3, divXpGainPct: 10 },
  },
  {
    id: "esr_veteran_brigades",
    icon: "globe",
    stats: { attackPct: 3, defensePct: 3 },
  },
  {
    id: "esr_summer_offensive",
    icon: "sword",
    stats: { attackPct: 5, breakthroughPct: 5 },
  },
  {
    id: "esr_winter_offensive",
    icon: "sword",
    stats: { attackPct: 5, orgPct: 5 },
  },
  {
    id: "esr_maneuver_army",
    icon: "map",
    stats: { breakthroughPct: 5, planSpeedPct: 10 },
  },
  {
    id: "esr_resistir",
    icon: "fort",
    stats: { warSupportBp: 500, defensePct: 5 },
  },
  {
    id: "esr_war_commissars",
    icon: "megaphone",
    stats: { orgPct: 5, warSupportBp: 300 },
  },
  {
    id: "esr_soviet_tank_crews",
    icon: "tank",
    stats: { armorAttackPct: 5, armorDefensePct: 5 },
  },
  { id: "esr_guerrilleros", icon: "compass", stats: { reconPct: 10 } },
  {
    id: "esr_general_staff_spirit",
    icon: "map",
    stats: { planSpeedPct: 10, planMaxBp: 500 },
  },
  {
    id: "esr_professional_army",
    icon: "medal",
    stats: { orgPct: 5, trainPct: 10 },
  },

  // ---- the state ----
  {
    id: "esr_defence_ministry_spirit",
    icon: "document",
    stats: { decisionCostPct: -10, planSpeedPct: 5 },
  },
  {
    id: "esr_restored_republic",
    icon: "ballot",
    stats: { stabilityBp: 500, ppGainPct: 5 },
  },
  {
    id: "esr_land_reform",
    icon: "wheat",
    stats: { stabilityBp: 300, manpowerGrowthPct: 5 },
  },
  {
    id: "esr_public_schools_spirit",
    icon: "research",
    stats: { researchPct: 3 },
  },
  {
    id: "esr_awaiting_europe",
    icon: "globe",
    stats: { warSupportBp: 500, stabilityBp: -200 },
  },

  // ---- the routes ----
  {
    id: "esr_soviet_advisers_spirit",
    icon: "star_plain",
    stats: { planSpeedPct: 5, rsArmorPct: 5 },
  },
  {
    id: "esr_sim",
    icon: "shield",
    stats: { coupResistPct: 25, stabilityBp: -300 },
  },
  {
    id: "esr_peoples_democracy_spirit",
    icon: "star_plain",
    stats: { stabilityBp: 500, ppGainPct: 5, outputPct: 3 },
  },
  {
    id: "esr_collectives_spirit",
    icon: "wheat",
    stats: { outputPct: -3, stabilityBp: 300 },
  },
  {
    id: "esr_free_communes_spirit",
    icon: "fist",
    stats: { manpowerGrowthPct: 10, stabilityBp: 300, outputPct: -3 },
  },
  {
    id: "esr_defence_council_spirit",
    icon: "dove",
    stats: { stabilityBp: 500, warSupportBp: -500 },
  },
  {
    id: "esr_national_syndicalism",
    icon: "eagle_plain",
    stats: { warSupportBp: 500, outputPct: 3 },
  },

  // ---- industry ----
  {
    id: "esr_war_industry_commission",
    icon: "factory_mil",
    stats: { milConstructionPct: 10, outputPct: 3 },
  },
  {
    id: "esr_workers_control",
    icon: "factory",
    stats: { outputPct: -3, stabilityBp: 300, consumerGoodsPp: -1 },
  },
  {
    id: "esr_cave_factories_spirit",
    icon: "mine",
    stats: { bombDamageTakenPct: -15 },
  },
  { id: "esr_mercury_exports", icon: "mine", stats: { tradeCostPct: 10 } },

  // ---- air and sea ----
  {
    id: "esr_soviet_pilots",
    icon: "plane",
    stats: { airAttackPct: 5, sortieEffPct: 5 },
  },
  { id: "esr_deca_spirit", icon: "tower", stats: { aaPct: 10 } },
  {
    id: "esr_spanish_pilots",
    icon: "plane",
    stats: { fighterAttackPct: 5 },
  },
  {
    id: "esr_air_doctrine_spirit",
    icon: "plane",
    stats: { sortieEffPct: 5, airDefensePct: 5 },
  },
  {
    id: "esr_restored_command_spirit",
    icon: "ship",
    stats: { navyAttackPct: 5, navalOrg: 5 },
  },
  {
    id: "esr_convoy_escorts",
    icon: "ship",
    stats: { convoyEscortPct: 10 },
  },
  {
    id: "esr_night_torpedoes",
    icon: "ship",
    stats: { torpedoPct: 10, navalDetectPct: 5 },
  },
  {
    id: "esr_landing_staff",
    icon: "map",
    stats: { invasionPrepPct: -15 },
  },
  {
    id: "esr_nyon_patrols_spirit",
    icon: "ship",
    stats: { convoyLossPct: -10 },
  },

  // ---- abroad ----
  {
    id: "esr_exile_cause",
    icon: "globe",
    stats: { legitimacyGainPct: 10 },
  },
  {
    id: "esr_iberian_republic_spirit",
    icon: "globe",
    stats: { manpowerGrowthPct: 5, stabilityBp: -300 },
  },
  // Given to the Nationalists by esr_rif_rising (the Republic's offer of
  // Moroccan independence).
  {
    id: "esr_rif_unrest",
    icon: "fist",
    stats: { stabilityBp: -300, manpowerGrowthPct: -5 },
  },
];
