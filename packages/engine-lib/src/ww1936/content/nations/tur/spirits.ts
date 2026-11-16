// ww229 (design ww227 §3, §5): Turkey's national spirits. Names and texts:
// ww1936.spirit.<id>, ww1936.spirit_desc.<id>. The old pack's
// tur_village_schools, tur_straits_watch and tur_active_neutrality_spirit
// (spirits/pack_west.ts) are reused by the tree.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const TUR_SPIRITS: readonly SpiritDef[] = [
  // ---- start spirits ----
  // The Kemalist revolution: a young republic held together by its founder
  // and the single party; tur_six_arrows_charter writes it into the charter.
  {
    id: "tur_kemalist_revolution",
    icon: "star_plain",
    stats: { stabilityBp: 300, coupResistPct: 15, driftNeuBp: 3 },
  },
  // Twelve years of war (1911-1923): a nation that wants no more of it.
  // tur_mehmetcik turns it into the soldier's pride.
  {
    id: "tur_scars_of_war",
    icon: "medal",
    stats: { warSupportBp: -1000, manpowerGrowthPct: -10 },
  },
  // The restless east: tribal revolts and a costly garrison; ended by the
  // event tur_dersim_rising or the decision tur_eastern_pacification.
  {
    id: "tur_eastern_unrest",
    icon: "map",
    stats: { stabilityBp: -500, ppGainPct: -5 },
  },
  // The Ottoman arsenal: worn guns of a dozen makes and almost no industry
  // to replace them; tur_mke_merger swaps it.
  {
    id: "tur_ottoman_arsenal",
    icon: "artillery",
    stats: { rsArmorPct: -10, rsAirPct: -10, rsArtilleryPct: -5 },
  },
  // ---- politics ----
  {
    id: "tur_six_arrows_constitution",
    icon: "document",
    stats: { stabilityBp: 500, coupResistPct: 25, driftNeuBp: 5 },
  },
  {
    id: "tur_peoples_houses_spirit",
    icon: "megaphone",
    stats: { stabilityBp: 300, warSupportBp: 200, driftNeuBp: 3 },
  },
  {
    id: "tur_national_chief_regime",
    icon: "crown",
    stats: { coupResistPct: 25, ppGainPct: 5, decisionCostPct: -10 },
  },
  {
    id: "tur_liberal_economy",
    icon: "wheat",
    stats: { tradeCostPct: -10, civConstructionPct: 5, stabilityBp: 300 },
  },
  {
    id: "tur_turanist_state",
    icon: "eagle_plain",
    stats: { warSupportBp: 800, justifyTimePct: -15, stabilityBp: -300 },
  },
  {
    id: "tur_peoples_republic",
    icon: "fist",
    stats: { milConstructionPct: 10, consumerGoodsPp: -2, stabilityBp: 300 },
  },
  // ---- industry and science ----
  { id: "tur_emigre_scholars", icon: "research", stats: { researchPct: 4 } },
  {
    id: "tur_state_arsenals",
    icon: "factory_mil",
    stats: { milConstructionPct: 10, rsArtilleryPct: 5 },
  },
  // ---- army and navy ----
  {
    id: "tur_general_staff_tradition",
    icon: "compass",
    stats: { planSpeedPct: 10, defensePct: 2 },
  },
  {
    id: "tur_mehmetcik_spirit",
    icon: "medal",
    stats: { infDefensePct: 5, recoveryPct: 3 },
  },
  {
    id: "tur_deep_defence",
    icon: "shield",
    stats: { defensePct: 5, fortConstructionPct: 15, entrenchSpeedPct: 10 },
  },
  {
    id: "tur_bayonet_charge",
    icon: "sword",
    stats: { infAttackPct: 5, advanceSpeedPct: 3 },
  },
  {
    id: "tur_straits_mines",
    icon: "shield",
    stats: { navyDefensePct: 5, shoreBombardPct: -10 },
  },
  // ---- the straits (decisions) ----
  // The straits are shut to belligerents' warships (Montreux, article 19).
  {
    id: "tur_straits_closed",
    icon: "fort",
    stats: { enemyJustifyTimePct: 20, navyDefensePct: 5 },
  },
  // Transit dues raised on merchant shipping through the Bosporus.
  {
    id: "tur_straits_dues",
    icon: "scales",
    stats: { ppGainPct: 5, tradeCostPct: 5 },
  },
  // ---- war ----
  {
    id: "tur_national_protection",
    icon: "document",
    stats: { milConstructionPct: 10, consumerGoodsPp: -2, stabilityBp: -500 },
  },
  {
    id: "tur_anatolian_redoubt_spirit",
    icon: "fort",
    stats: { defensePct: 5, entrenchSpeedPct: 15 },
  },
  // ---- the National Pact and Turan ----
  {
    id: "tur_pact_restored",
    icon: "star_plain",
    stats: { stabilityBp: 500, warSupportBp: 300 },
  },
  {
    id: "tur_greater_turan",
    icon: "crown",
    stats: { stabilityBp: 300, ppGainPct: 5, nonCoreManpowerPp: 2 },
  },
];
