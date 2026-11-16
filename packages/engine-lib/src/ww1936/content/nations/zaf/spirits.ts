// ww229: South Africa's spirits: four at the start, the focus ones, and the
// five bands of the Smuts-Hertzog balance of power (core.ts). Data only.
import type { SpiritDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ZAF_START_SPIRITS = [
  "zaf_sp_rand_gold",
  "zaf_sp_fusion",
  "zaf_sp_two_streams",
  "zaf_sp_white_service",
];

export const ZAF_SPIRITS: SpiritDef[] = [
  {
    id: "zaf_sp_rand_gold",
    icon: "mine",
    stats: {
      ppGainPct: 5,
      civConstructionPct: 5,
    },
  },
  {
    id: "zaf_sp_fusion",
    icon: "handshake",
    stats: {
      stabilityBp: 500,
      warSupportBp: -500,
    },
  },
  {
    id: "zaf_sp_two_streams",
    icon: "scales",
    stats: {
      warSupportBp: -1000,
      driftNeuBp: 2,
    },
  },
  {
    id: "zaf_sp_white_service",
    icon: "shield",
    stats: {
      manpowerGrowthPct: -25,
    },
  },
  {
    id: "zaf_sp_liberal_union",
    icon: "dove",
    stats: {
      stabilityBp: 500,
      manpowerGrowthPct: 15,
      driftDemBp: 3,
    },
  },
  {
    id: "zaf_sp_volksrepubliek",
    icon: "flag",
    stats: {
      stabilityBp: 500,
      driftNeuBp: 3,
      warSupportBp: -500,
    },
  },
  {
    id: "zaf_sp_ossewa_state",
    icon: "fist",
    stats: {
      warSupportBp: 1000,
      stabilityBp: -500,
      driftFasBp: 5,
    },
  },
  {
    id: "zaf_sp_new_order",
    icon: "factory_mil",
    stats: {
      milConstructionPct: 10,
      consumerGoodsPp: -2,
      driftFasBp: 3,
    },
  },
  {
    id: "zaf_sp_workers_republic",
    icon: "star_plain",
    stats: {
      driftComBp: 5,
      civConstructionPct: 5,
      stabilityBp: -300,
    },
  },
  {
    id: "zaf_sp_southern_union",
    icon: "crown",
    stats: {
      stabilityBp: 500,
      civConstructionPct: 5,
    },
  },
  {
    id: "zaf_sp_iscor",
    icon: "steel",
    stats: {
      milConstructionPct: 5,
      civConstructionPct: 5,
    },
  },
  {
    id: "zaf_sp_war_supplies",
    icon: "factory_mil",
    stats: {
      milConstructionPct: 10,
      consumerGoodsPp: -1,
    },
  },
  {
    id: "zaf_sp_africa_oath",
    icon: "flag",
    stats: {
      orgPct: 5,
      warSupportBp: 300,
    },
  },
  {
    id: "zaf_sp_corps_armed",
    icon: "shield",
    stats: {
      manpowerGrowthPct: 15,
      stabilityBp: -200,
    },
  },
  {
    id: "zaf_sp_air_training",
    icon: "plane",
    stats: {
      rsAirPct: 10,
      airAttackPct: 5,
    },
  },
  {
    id: "zaf_sp_cape_route",
    icon: "ship",
    stats: {
      ppGainPct: 5,
      dockOutputPct: 10,
    },
  },
  {
    id: "zaf_bop_empire_loyal",
    icon: "crown",
    stats: {
      warSupportBp: 1000,
      stabilityBp: -500,
    },
  },
  {
    id: "zaf_bop_smuts_leads",
    icon: "handshake",
    stats: {
      warSupportBp: 500,
    },
  },
  {
    id: "zaf_bop_fusion_holds",
    icon: "scales",
    stats: {
      stabilityBp: 500,
    },
  },
  {
    id: "zaf_bop_hertzog_leads",
    icon: "flag",
    stats: {
      warSupportBp: -500,
      ppGainPct: 5,
    },
  },
  {
    id: "zaf_bop_republican_tide",
    icon: "fist",
    stats: {
      warSupportBp: -1000,
      stabilityBp: -300,
      driftNeuBp: 3,
    },
  },
];
