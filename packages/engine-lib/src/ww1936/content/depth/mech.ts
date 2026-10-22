// World War 1936 P6: the national spirits of the depth systems. Texts:
// ww1936.spirit.<id>, ww1936.spirit_desc.<id>. Percent stats are whole
// percent; stability and war support are bp (100 = 1 point).
//
// - gen_staff_college: the staff college decision, 180 days (spec §4.1).
// - bop_*: the balance-of-power bands (spec §13.2, MechRules BOP_DEFS: band 0
//   and band 4 for China and France, bands 0, 2 and 4 for Japan). "Land
//   research" is the infantry, artillery and armour research branches.
// - fg_*: faction-goal rewards for every member, 365 days (spec §14.2):
//   fg_europe_vp → fg_cohesion, fg_sea_lanes → fg_sea_control,
//   fg_research → fg_science, fg_industry → fg_arsenal.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const DEPTH_SPIRITS: readonly SpiritDef[] = [
  { id: "gen_staff_college", icon: "compass", stats: { cpGainPct: 25 } },

  // ---- China: central government ↔ regional powers ----
  {
    id: "bop_chn_strong_centre",
    icon: "tower",
    stats: { stabilityBp: 1000, ppGainPct: 10 },
  },
  {
    id: "bop_chn_warlords",
    icon: "chain_broken",
    stats: { ppGainPct: -20, recruitablePct: 10 },
  },

  // ---- Japan: army ↔ navy ----
  {
    id: "bop_jpn_army",
    icon: "sword",
    stats: {
      rsInfantryPct: 10,
      rsArtilleryPct: 10,
      rsArmorPct: 10,
      attackPct: 5,
      rsNavalPct: -10,
    },
  },
  { id: "bop_jpn_balance", icon: "scales", stats: { researchPct: 3 } },
  {
    id: "bop_jpn_navy",
    icon: "ship",
    stats: {
      rsNavalPct: 10,
      dockOutputPct: 5,
      rsInfantryPct: -10,
      rsArtilleryPct: -10,
      rsArmorPct: -10,
    },
  },

  // ---- France: Popular Front ↔ national union ----
  {
    id: "bop_fra_popular_front",
    icon: "handshake",
    stats: { consumerGoodsPp: 3, stabilityBp: 500, milConstructionPct: -10 },
  },
  {
    id: "bop_fra_national_union",
    icon: "shield",
    stats: { milConstructionPct: 10, stabilityBp: -500 },
  },

  // ---- faction-goal rewards ----
  { id: "fg_cohesion", icon: "flag", stats: { stabilityBp: 500 } },
  { id: "fg_sea_control", icon: "ship", stats: { convoyLossPct: -10 } },
  { id: "fg_science", icon: "flask", stats: { researchPct: 5 } },
  { id: "fg_arsenal", icon: "factory_mil", stats: { outputPct: 5 } },
];
