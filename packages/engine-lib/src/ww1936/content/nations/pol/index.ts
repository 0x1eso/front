// ww229 (design ww227): POL's national content, tier A. The tree, path and
// branch points are in focuses.ts, the rest in its own file; core.ts holds
// the generals, the balance of power and the equipment. Data only.
import type { NationDef } from "../types";
import { POL_DECISIONS } from "./decisions";
import { POL_EVENTS } from "./events";
import { POL_BRANCH_POINTS, POL_FOCUSES, POL_PATH } from "./focuses";
import { POL_PERSONS } from "./people";
import { POL_SPIRITS } from "./spirits";

export const NATION_POL: NationDef = {
  tag: "POL",
  tier: "A",
  sheet: {
    situation:
      "Piłsudski died in 1935 and his camp rules on without him, split between President Mościcki's men and Marshal Rydz-Śmigły's. Poland stands between Germany and the Soviet Union with pacts with both, a French alliance and an army rich in men and poor in machines. The state builds a new industrial district in the interior while a third of its citizens are minorities and the countryside is overcrowded.",
    startSpirits: [
      "pol_between",
      "pol_sp_after_marshal",
      "pol_sp_land_hunger",
      "pol_sp_borderland_tension",
    ],
    dilemmas: [
      {
        branchPoint: "pol_regime_course",
        note: "The Marshal's camp of national unity or the Castle's technocrats; history: the Camp of National Unity.",
      },
      {
        branchPoint: "pol_economy_course",
        note: "Kwiatkowski's investment plan or arms first; history: the investment plan.",
      },
      {
        branchPoint: "pol_foreign_course",
        note: "Beck's equal distance from Berlin and Moscow or a bloc of the states between them; history: equal distance.",
      },
      {
        branchPoint: "pol_war_plan",
        note: "Plan West against Germany or Plan East against the Soviet Union; history: Plan West, drawn up last.",
      },
      {
        branchPoint: "pol_opposition_road",
        note: "The opposition by agreement (the Morges Front) or by the villages (the peasant strike); history: neither won power.",
      },
    ],
    mechanism:
      "The balance of power between the ruling camp and the opposition (bands from the opposition ruling to the colonels alone), worked by decisions and events; plus the Central Industrial District's build decision.",
    patrons: ["FRA", "GBR"],
    rivals: ["DEU", "SUN", "LTU", "CSK"],
    unions: ["LTU"],
    claims: ["zaolzie"],
    people: [
      "pol_rydz",
      "pol_skladkowski",
      "pol_beck",
      "pol_kwiatkowski",
      "pol_koc",
      "pol_starzynski",
      "pol_stachiewicz",
      "pol_kutrzeba_staff",
      "pol_sosnkowski",
      "pol_rayski",
      "pol_swirski",
      "pol_rejewski",
      "pol_dabrowski",
      "pol_sikorski",
      "pol_paderewski",
      "pol_mikolajczyk",
      "pol_gomulka",
      "pol_bierut",
      "pol_piasecki",
      "pol_mosdorf",
      "juliusz_rommel",
      "bortnowski",
      "kleeberg",
      "szylling",
      "dab_biernacki",
      "fabrycy",
    ],
    equipment: [
      "pol_tks",
      "pol_wz34",
      "pol_7tp",
      "pol_pzl_p7a",
      "pol_pzl_p11c",
      "pol_pzl_p24",
      "pol_pzl23_karas",
      "pol_pzl37_los",
      "pol_wicher",
      "pol_grom",
      "pol_wilk",
      "pol_orzel",
      "pol_wz29",
      "pol_fiat621",
      "pol_wz14_19",
      "pol_bofors_wz36",
      "pol_ur_wz35",
      "pol_bofors_40",
      "fra_ft17",
    ],
  },
  character: {
    lean: "status_quo",
    patrons: ["FRA", "GBR"],
    routeBias: { democratic: 2, fascist: 1, communist: 1 },
  },
  politics: {
    spirits: [
      "pol_between",
      "pol_sp_after_marshal",
      "pol_sp_land_hunger",
      "pol_sp_borderland_tension",
    ],
    leaders: {
      democratic: "pol_witos",
      communist: "pol_gomulka",
      fascist: "pol_piasecki",
      neutral: "leader_pol",
    },
  },
  focuses: POL_FOCUSES,
  path: POL_PATH,
  branchPoints: POL_BRANCH_POINTS,
  events: POL_EVENTS,
  decisions: POL_DECISIONS,
  spirits: POL_SPIRITS,
  persons: POL_PERSONS,
  flags: ["pol_ltu_relations", "pol_union_done"],
  groups: [],
  claims: [],
  templates: [
    // pol_black_brigade: the 10th Motorised Cavalry Brigade, motor rifles
    // with tanks, motorised guns and anti-tank guns (width 21).
    {
      id: "pol_tpl_black_brigade",
      country: "POL",
      battalions: [
        "motorized",
        "motorized",
        "motorized",
        "light_armor",
        "light_armor",
        "mot_artillery",
        "anti_tank",
      ],
      support: ["recon", "engineer"],
    },
    // pol_podhale_rifles: the mountain infantry of the southern border.
    {
      id: "pol_tpl_podhale",
      country: "POL",
      battalions: [
        "mountain",
        "mountain",
        "mountain",
        "mountain",
        "mountain",
        "mountain",
        "artillery",
      ],
      support: ["engineer", "recon"],
    },
  ],
  aliases: {},
  dropped: [],
};
