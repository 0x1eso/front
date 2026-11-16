// ww229: the Chinese Communists' national spirits. Start spirits (in the
// politics row) and event or decision spirits keep their numbers; a focus's
// add_spirit is tripled (FocusScale), so the focus spirits carry small
// numbers. ccp_sp_bases_1..4 are the base-area network's stages
// (decisions.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CCP_SPIRITS: SpiritDef[] = [
  // ---- start ----
  // The Long March cost nine men in ten; the survivors are hard and few.
  {
    id: "ccp_sp_long_march_scars",
    icon: "road",
    stats: { recruitablePct: -5, warSupportBp: 500, orgPct: 5 },
  },
  // Northern Shaanxi is loess, caves and hunger: nothing to tax, little to build with.
  {
    id: "ccp_sp_poor_border_region",
    icon: "wheat",
    stats: { constructionPct: -15, consumerGoodsPp: 1 },
  },
  // A small party of picked cadres who obey.
  {
    id: "ccp_sp_iron_discipline",
    icon: "star_plain",
    stats: { ppGainPct: 10, stabilityBp: 300 },
  },
  // Zhang Guotao's rival central committee is not forgotten.
  {
    id: "ccp_sp_rival_centres",
    icon: "chain_broken",
    stats: { stabilityBp: -500, ppGainPct: -5 },
  },

  // ---- focuses (tripled) ----
  {
    id: "ccp_sp_sinified_marxism",
    icon: "document",
    stats: { ppGainPct: 3, driftComBp: 3 },
  },
  {
    id: "ccp_sp_party_school",
    icon: "research",
    stats: { ppGainPct: 2, advisorCostPct: -3 },
  },
  {
    id: "ccp_sp_rectified",
    icon: "flag",
    stats: { stabilityBp: 150, coupResistPct: 5 },
  },
  {
    id: "ccp_sp_rescue_fear",
    icon: "shield",
    stats: { coupResistPct: 5, researchPct: -1, stabilityBp: -100 },
  },
  {
    id: "ccp_sp_careful_screening",
    icon: "scales",
    stats: { stabilityBp: 100, researchPct: 1 },
  },
  {
    id: "ccp_sp_comintern_backing",
    icon: "radio",
    stats: { ppGainPct: 2, driftComBp: 2 },
  },
  {
    id: "ccp_sp_soviet_model_army",
    icon: "medal",
    stats: { orgPct: 2, trainPct: 3 },
  },
  {
    id: "ccp_sp_three_thirds",
    icon: "ballot",
    stats: { stabilityBp: 100, driftDemBp: 2 },
  },
  {
    id: "ccp_sp_northwest_bloc",
    icon: "handshake",
    stats: { recruitablePct: 2, driftNeuBp: 2 },
  },
  {
    id: "ccp_sp_fourth_front",
    icon: "fist",
    stats: { attackPct: 1, driftFasBp: 2 },
  },
  {
    id: "ccp_sp_unity_and_struggle",
    icon: "scales",
    stats: { stabilityBp: 100, warSupportBp: 100 },
  },
  {
    id: "ccp_sp_soviet_republic",
    icon: "star_plain",
    stats: { recruitablePct: 2, stabilityBp: -100 },
  },
  {
    id: "ccp_sp_independent_guerrilla",
    icon: "compass",
    stats: { defensePct: 1, supplyUsePct: -3 },
  },
  {
    id: "ccp_sp_mobile_war",
    icon: "road",
    stats: { attackPct: 1, speedPct: 2 },
  },
  {
    id: "ccp_sp_protracted_war",
    icon: "document",
    stats: { defensePct: 1, orgPct: 2 },
  },
  {
    id: "ccp_sp_sparrow_war",
    icon: "eagle_plain",
    stats: { attackPct: 1, speedPct: 1 },
  },
  {
    id: "ccp_sp_tunnels",
    icon: "mine",
    stats: { defensePct: 2, entrenchSpeedPct: 3 },
  },
  {
    id: "ccp_sp_mine_war",
    icon: "fort",
    stats: { defensePct: 1, attackPct: 1 },
  },
  {
    id: "ccp_sp_annihilation",
    icon: "sword",
    stats: { attackPct: 2, breakthroughPct: 2 },
  },
  { id: "ccp_sp_arms_from_enemy", icon: "infantry", stats: { capturePct: 3 } },
  {
    id: "ccp_sp_hardened",
    icon: "shield",
    stats: { orgPct: 2, recoveryPct: 2 },
  },
  {
    id: "ccp_sp_kangda",
    icon: "medal",
    stats: { trainPct: 3, generalXpPct: 5 },
  },
  { id: "ccp_sp_militia", icon: "fist", stats: { recruitablePct: 2 } },
  {
    id: "ccp_sp_field_hospitals",
    icon: "flask",
    stats: { casualtyReturnPp: 2 },
  },
  { id: "ccp_sp_staff_work", icon: "map", stats: { planSpeedPct: 3 } },
  {
    id: "ccp_sp_rent_reduction",
    icon: "wheat",
    stats: { stabilityBp: 100, recruitablePct: 1 },
  },
  {
    id: "ccp_sp_land_reform",
    icon: "wheat",
    stats: { recruitablePct: 3, stabilityBp: -100 },
  },
  {
    id: "ccp_sp_cooperatives",
    icon: "handshake",
    stats: { civConstructionPct: 3 },
  },
  {
    id: "ccp_sp_self_reliance",
    icon: "industry",
    stats: { constructionPct: 2, consumerGoodsPp: -1 },
  },
  { id: "ccp_sp_army_farms", icon: "wheat", stats: { consumerGoodsPp: -1 } },
  {
    id: "ccp_sp_crack_troops",
    icon: "scales",
    stats: { ppGainPct: 3, consumerGoodsPp: -1 },
  },

  // ---- events and decisions (not tripled) ----
  // The Nationalist cordon round the Border Region.
  {
    id: "ccp_sp_blockade",
    icon: "chain_broken",
    stats: { constructionPct: -10, tradeCostPct: 20 },
  },
  // The occupier burns, kills and loots the villages of the bases.
  {
    id: "ccp_sp_three_alls",
    icon: "chain_broken",
    stats: { recruitablePct: -5, stabilityBp: -300 },
  },
  // The army that crossed the Yellow River westward was lost.
  {
    id: "ccp_sp_western_route_lost",
    icon: "chain_broken",
    stats: { stabilityBp: -300, warSupportBp: -300 },
  },
  // A foreign surgeon's mobile teams.
  {
    id: "ccp_sp_bethune_teams",
    icon: "flask",
    stats: { casualtyReturnPp: 5 },
  },
  // A good harvest after the production drive.
  {
    id: "ccp_sp_harvest_drive",
    icon: "wheat",
    stats: { constructionPct: 10 },
  },
  // The base-area network, one stage per base behind the enemy's lines.
  {
    id: "ccp_sp_bases_1",
    icon: "map",
    stats: { recruitablePct: 2, ppGainPct: 2 },
  },
  {
    id: "ccp_sp_bases_2",
    icon: "map",
    stats: { recruitablePct: 4, ppGainPct: 4 },
  },
  {
    id: "ccp_sp_bases_3",
    icon: "map",
    stats: { recruitablePct: 6, ppGainPct: 6, resistanceTargetPct: 5 },
  },
  {
    id: "ccp_sp_bases_4",
    icon: "map",
    stats: { recruitablePct: 8, ppGainPct: 8, resistanceTargetPct: 10 },
  },
];
