// ww229 (design ww227): South Africa's national tree, tier A (103 focuses).
// Columns left to right: the routes 0-11 (the Union restored, Malan's
// nationalists, the Ossewabrandwag, the New Order, the Communist Party) with
// the Afrikaner republic under them, Fusion 13-17, diplomacy and a Greater
// South Africa 19-25 around the opening 22-24, gold and minerals 27-30,
// industry 31-35, the army 37-40, the air force 44-46, the navy 49-51, the
// war 55-57. Data only (ContentPurity).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  AiWeight,
  FocusDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, nationRouteAi, not } from "../../helpers";

// ---- the routes (ww226 rules: the movement at 25%, another government) ----
const NOT_DEM: Condition = not({ kind: "ruling", ideology: "democratic" });
const NOT_COM: Condition = not({ kind: "ruling", ideology: "communist" });
const NOT_FAS: Condition = not({ kind: "ruling", ideology: "fascist" });
const NOT_NEU: Condition = not({ kind: "ruling", ideology: "neutral" });
const READY_DEM: Condition = all(NOT_DEM, {
  kind: "pop_ge",
  ideology: "democratic",
  pct: 25,
});
const READY_COM: Condition = all(NOT_COM, {
  kind: "pop_ge",
  ideology: "communist",
  pct: 25,
});
const READY_FAS: Condition = all(NOT_FAS, {
  kind: "pop_ge",
  ideology: "fascist",
  pct: 25,
});
const READY_NEU: Condition = all(NOT_NEU, {
  kind: "pop_ge",
  ideology: "neutral",
  pct: 25,
});
/** A route's middle steps: once started, the AI carries on. */
const AI_ON: AiWeight = { base: 5 };
/** The rising itself: only a shaken country. */
const AI_RISE: AiWeight = {
  base: 2,
  mods: [{ if: { kind: "stability_ge", pct: 40 }, factor: 0 }],
};
const AI: AiWeight = { base: 10 };
/** Autonomy moves only for a dominion the Crown does not hold (gbr_crown_control). */
const FREE_DOMINION: Condition = all(
  { kind: "is_subject" },
  not({ kind: "flag", flag: "gbr_crown_control" }),
);
export const ZAF_FOCUSES: FocusDef[] = [
  {
    id: "zaf_union_of_south_africa",
    tree: "ZAF",
    x: 23,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "map",
    group: "zaf_situation",
    effects: [
      {
        kind: "pp",
        amount: 40,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_status_of_the_union",
    tree: "ZAF",
    x: 22,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "zaf_situation",
    prereq: [["zaf_union_of_south_africa"]],
    effects: [
      {
        kind: "if",
        cond: FREE_DOMINION,
        then: [
          {
            kind: "autonomy",
            pct: 10,
          },
        ],
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_pirow_defence_plan",
    tree: "ZAF",
    x: 24,
    y: 1,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "zaf_situation",
    prereq: [["zaf_union_of_south_africa"]],
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_gold_pays",
    tree: "ZAF",
    x: 23,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "scales",
    group: "zaf_situation",
    prereq: [["zaf_status_of_the_union", "zaf_pirow_defence_plan"]],
    effects: [
      {
        kind: "pp",
        amount: 50,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_fusion_cabinet",
    tree: "ZAF",
    x: 15,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "handshake",
    group: "zaf_fusion",
    prereq: [["zaf_union_of_south_africa"]],
    effects: [
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_native_trust_land_act",
    tree: "ZAF",
    x: 13,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "zaf_fusion",
    prereq: [["zaf_fusion_cabinet"]],
    effects: [
      {
        kind: "stability",
        pct: 2,
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 2,
      },
      {
        kind: "pp",
        amount: 25,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_hofmeyr_portfolios",
    tree: "ZAF",
    x: 15,
    y: 2,
    days: 35,
    branch: "politics",
    icon: "document",
    group: "zaf_fusion",
    prereq: [["zaf_fusion_cabinet"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "zaf_hofmeyr",
      },
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_general_election",
    tree: "ZAF",
    x: 17,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "zaf_fusion",
    prereq: [["zaf_fusion_cabinet"]],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 2,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_ob_ban_servants",
    tree: "ZAF",
    x: 14,
    y: 3,
    days: 35,
    branch: "politics",
    icon: "chain_broken",
    group: "zaf_fusion",
    prereq: [["zaf_native_trust_land_act", "zaf_hofmeyr_portfolios"]],
    exclusive: ["zaf_ob_tolerate"],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_ob_banned",
      },
      {
        kind: "popularity",
        ideology: "fascist",
        pp: -3,
      },
      {
        kind: "bop",
        amount: -100,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_ob_tolerate",
    tree: "ZAF",
    x: 16,
    y: 3,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "zaf_fusion",
    prereq: [["zaf_native_trust_land_act", "zaf_hofmeyr_portfolios"]],
    exclusive: ["zaf_ob_ban_servants"],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_ob_tolerated",
      },
      {
        kind: "stability",
        pct: 2,
      },
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 2,
      },
      {
        kind: "bop",
        amount: 100,
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_war_cabinet",
    tree: "ZAF",
    x: 15,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "zaf_fusion",
    prereq: [["zaf_ob_ban_servants", "zaf_ob_tolerate"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "war_support",
        pct: 5,
      },
      {
        kind: "pp",
        amount: 40,
      },
      {
        kind: "add_advisor_candidate",
        person: "zaf_reitz",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_social_security_report",
    tree: "ZAF",
    x: 15,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "dove",
    group: "zaf_fusion",
    prereq: [
      ["zaf_war_cabinet", "zaf_general_election"],
      ["zaf_hofmeyr_portfolios"],
    ],
    effects: [
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_dem_united_party_regroups",
    tree: "ZAF",
    x: 0,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "ballot",
    group: "zaf_dem_route",
    available: NOT_DEM,
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
    ],
    ai: nationRouteAi("democratic", 1),
  },
  {
    id: "zaf_dem_springbok_legion",
    tree: "ZAF",
    x: 0,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "medal",
    group: "zaf_dem_route",
    prereq: [["zaf_dem_united_party_regroups"]],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_dem_restore_union",
    tree: "ZAF",
    x: 0,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "zaf_dem_route",
    prereq: [["zaf_dem_springbok_legion"]],
    available: READY_DEM,
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 2,
      },
      {
        kind: "civil_war",
        ideology: "democratic",
      },
    ],
    ai: AI_RISE,
  },
  {
    id: "zaf_dem_liberal_union",
    tree: "ZAF",
    x: 0,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "dove",
    group: "zaf_dem_route",
    prereq: [["zaf_dem_restore_union"]],
    available: {
      kind: "ruling",
      ideology: "democratic",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_liberal_union",
      },
      {
        kind: "stability",
        pct: 4,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_neu_purified_nationalists",
    tree: "ZAF",
    x: 3,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "zaf_neu_route",
    available: NOT_NEU,
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
    ],
    ai: nationRouteAi("neutral", 2),
  },
  {
    id: "zaf_neu_volkskongres",
    tree: "ZAF",
    x: 2,
    y: 1,
    days: 35,
    branch: "industry",
    icon: "factory",
    group: "zaf_neu_route",
    prereq: [["zaf_neu_purified_nationalists"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_neu_hereniging",
    tree: "ZAF",
    x: 4,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "handshake",
    group: "zaf_neu_route",
    prereq: [["zaf_neu_purified_nationalists"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
      {
        kind: "bop",
        amount: 100,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_neu_republic_referendum",
    tree: "ZAF",
    x: 3,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "zaf_neu_route",
    prereq: [["zaf_neu_volkskongres"], ["zaf_neu_hereniging"]],
    available: READY_NEU,
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 2,
      },
      {
        kind: "civil_war",
        ideology: "neutral",
      },
    ],
    ai: AI_RISE,
  },
  {
    id: "zaf_neu_republic_proclaimed",
    tree: "ZAF",
    x: 3,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "zaf_neu_route",
    prereq: [["zaf_neu_republic_referendum"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "set_name",
        key: "ww1936.rename.zaf_republic",
      },
      {
        kind: "add_spirit",
        id: "zaf_sp_volksrepubliek",
      },
      {
        kind: "stability",
        pct: 3,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_fas_ox_wagon_spirit",
    tree: "ZAF",
    x: 5,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "zaf_ob_route",
    exclusive: ["zaf_fas_new_order_study"],
    available: NOT_FAS,
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
      {
        kind: "set_flag",
        flag: "zaf_ob_active",
      },
    ],
    ai: nationRouteAi("fascist", 1),
  },
  {
    id: "zaf_fas_ob_commandos",
    tree: "ZAF",
    x: 5,
    y: 1,
    days: 35,
    branch: "army",
    icon: "medal",
    group: "zaf_ob_route",
    prereq: [["zaf_fas_ox_wagon_spirit"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_fas_stormjaers",
    tree: "ZAF",
    x: 5,
    y: 2,
    days: 35,
    branch: "politics",
    icon: "chain_broken",
    group: "zaf_ob_route",
    prereq: [["zaf_fas_ob_commandos"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 2,
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_fas_ob_rising",
    tree: "ZAF",
    x: 5,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "zaf_ob_route",
    prereq: [["zaf_fas_stormjaers"]],
    available: READY_FAS,
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 2,
      },
      {
        kind: "civil_war",
        ideology: "fascist",
      },
    ],
    ai: AI_RISE,
  },
  {
    id: "zaf_fas_volkstaat",
    tree: "ZAF",
    x: 5,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "zaf_ob_route",
    prereq: [["zaf_fas_ob_rising"]],
    available: {
      kind: "ruling",
      ideology: "fascist",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_ossewa_state",
      },
      {
        kind: "war_support",
        pct: 5,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_fas_new_order_study",
    tree: "ZAF",
    x: 7,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "document",
    group: "zaf_new_order_route",
    exclusive: ["zaf_fas_ox_wagon_spirit"],
    available: NOT_FAS,
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
    ],
    ai: nationRouteAi("fascist", 1),
  },
  {
    id: "zaf_fas_greyshirts_merge",
    tree: "ZAF",
    x: 7,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    group: "zaf_new_order_route",
    prereq: [["zaf_fas_new_order_study"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_fas_new_order_cabinet",
    tree: "ZAF",
    x: 7,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "zaf_new_order_route",
    prereq: [["zaf_fas_greyshirts_merge"]],
    available: READY_FAS,
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 2,
      },
      {
        kind: "civil_war",
        ideology: "fascist",
      },
    ],
    ai: AI_RISE,
  },
  {
    id: "zaf_fas_corporate_union",
    tree: "ZAF",
    x: 7,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "zaf_new_order_route",
    prereq: [["zaf_fas_new_order_cabinet"]],
    available: {
      kind: "ruling",
      ideology: "fascist",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_new_order",
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_com_cpsa_reorganised",
    tree: "ZAF",
    x: 10,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "star_plain",
    group: "zaf_red_route",
    available: NOT_COM,
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
    ],
    ai: nationRouteAi("communist", 1),
  },
  {
    id: "zaf_com_mine_workers_union",
    tree: "ZAF",
    x: 9,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "zaf_red_route",
    prereq: [["zaf_com_cpsa_reorganised"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_com_non_european_front",
    tree: "ZAF",
    x: 11,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "handshake",
    group: "zaf_red_route",
    prereq: [["zaf_com_cpsa_reorganised"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
    ],
    ai: AI_ON,
  },
  {
    id: "zaf_com_general_strike",
    tree: "ZAF",
    x: 10,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "chain_broken",
    group: "zaf_red_route",
    prereq: [["zaf_com_mine_workers_union"], ["zaf_com_non_european_front"]],
    available: READY_COM,
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 2,
      },
      {
        kind: "civil_war",
        ideology: "communist",
      },
    ],
    ai: AI_RISE,
  },
  {
    id: "zaf_com_peoples_republic",
    tree: "ZAF",
    x: 10,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "zaf_red_route",
    prereq: [["zaf_com_general_strike"]],
    available: {
      kind: "ruling",
      ideology: "communist",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_workers_republic",
      },
      {
        kind: "stability",
        pct: 3,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_com_land_to_the_tiller",
    tree: "ZAF",
    x: 10,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "wheat",
    group: "zaf_red_route",
    prereq: [["zaf_com_peoples_republic"]],
    effects: [
      {
        kind: "manpower",
        recruitablePct: 2,
      },
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "remove_spirit",
        id: "zaf_sp_white_service",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_rep_leave_commonwealth",
    tree: "ZAF",
    x: 4,
    y: 5,
    days: 70,
    branch: "diplomacy",
    icon: "chain_broken",
    group: "zaf_republic",
    prereq: [
      [
        "zaf_neu_republic_proclaimed",
        "zaf_fas_volkstaat",
        "zaf_fas_corporate_union",
      ],
    ],
    effects: [
      {
        kind: "if",
        cond: FREE_DOMINION,
        then: [
          {
            kind: "autonomy",
            pct: 25,
          },
        ],
      },
      {
        kind: "if",
        cond: {
          kind: "same_faction",
          of: {
            tag: "GBR",
          },
        },
        then: [
          {
            kind: "leave_faction",
          },
        ],
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: -25,
        days: 365,
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "zaf_rep_die_stem",
    tree: "ZAF",
    x: 2,
    y: 6,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    group: "zaf_republic",
    prereq: [["zaf_rep_leave_commonwealth"]],
    effects: [
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "war_support",
        pct: 3,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_rep_volk_economy",
    tree: "ZAF",
    x: 4,
    y: 6,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "zaf_republic",
    prereq: [["zaf_rep_leave_commonwealth"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 2,
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_rep_kommando_army",
    tree: "ZAF",
    x: 6,
    y: 6,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "zaf_republic",
    prereq: [["zaf_rep_leave_commonwealth"]],
    effects: [
      {
        kind: "army_xp",
        amount: 15,
      },
      {
        kind: "manpower",
        amount: 20000,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_rep_swa_province",
    tree: "ZAF",
    x: 2,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "map",
    group: "zaf_republic",
    prereq: [["zaf_rep_die_stem"]],
    effects: [
      {
        kind: "stability",
        pct: 2,
      },
      {
        kind: "manpower",
        amount: 10000,
      },
      {
        kind: "infra",
        where: {
          group: "zaf_swa",
        },
        amount: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_rep_protectorates",
    tree: "ZAF",
    x: 4,
    y: 7,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "zaf_republic",
    prereq: [["zaf_rep_volk_economy"], ["zaf_rep_kommando_army"]],
    available: {
      not: {
        kind: "is_subject",
      },
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          tag: "GBR",
        },
        type: "claim",
        group: "zaf_hct",
      },
      {
        kind: "war_support",
        pct: 3,
      },
    ],
    ai: {
      base: 3,
    },
  },
  {
    id: "zaf_rep_german_friendship",
    tree: "ZAF",
    x: 6,
    y: 7,
    days: 35,
    branch: "diplomacy",
    icon: "handshake",
    group: "zaf_republic",
    prereq: [["zaf_rep_kommando_army"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "DEU",
        },
        of: "self",
        value: 25,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "DEU",
        },
        value: 15,
        days: 365,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "zaf_rep_axis_alignment",
    tree: "ZAF",
    x: 6,
    y: 8,
    days: 70,
    branch: "diplomacy",
    icon: "eagle_plain",
    group: "zaf_republic",
    prereq: [["zaf_rep_german_friendship"]],
    available: {
      kind: "ruling",
      ideology: "fascist",
    },
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            {
              not: {
                kind: "in_faction",
              },
            },
            {
              kind: "faction_leader",
              who: {
                tag: "DEU",
              },
            },
          ],
        },
        then: [
          {
            kind: "join_faction",
            of: {
              tag: "DEU",
            },
          },
        ],
      },
      {
        kind: "war_support",
        pct: 4,
      },
    ],
    ai: {
      base: 2,
    },
  },
  {
    id: "zaf_imperial_conference",
    tree: "ZAF",
    x: 23,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "zaf_diplomacy",
    prereq: [["zaf_gold_pays"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 20,
        days: 365,
      },
      {
        kind: "opinion",
        who: {
          tag: "CAN",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "opinion",
        who: {
          tag: "AUS",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "pp",
        amount: 20,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_hct_patience",
    tree: "ZAF",
    x: 20,
    y: 4,
    days: 35,
    branch: "diplomacy",
    icon: "handshake",
    group: "zaf_diplomacy",
    prereq: [["zaf_imperial_conference"]],
    exclusive: ["zaf_hct_demand"],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 20,
        days: 365,
      },
      {
        kind: "stability",
        pct: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_hct_demand",
    tree: "ZAF",
    x: 21,
    y: 4,
    days: 35,
    branch: "diplomacy",
    icon: "document",
    group: "zaf_diplomacy",
    prereq: [["zaf_imperial_conference"]],
    exclusive: ["zaf_hct_patience"],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_hct_demanded",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: -15,
        days: 365,
      },
      {
        kind: "bop",
        amount: 50,
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 2,
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_swa_mandate",
    tree: "ZAF",
    x: 22,
    y: 5,
    days: 35,
    branch: "diplomacy",
    icon: "document",
    group: "zaf_diplomacy",
    prereq: [["zaf_imperial_conference"]],
    exclusive: ["zaf_swa_fifth_province"],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_swa_mandate",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_swa_fifth_province",
    tree: "ZAF",
    x: 23,
    y: 5,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "zaf_diplomacy",
    prereq: [["zaf_imperial_conference"]],
    exclusive: ["zaf_swa_mandate"],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_swa_province",
      },
      {
        kind: "infra",
        where: {
          group: "zaf_swa",
        },
        amount: 1,
      },
      {
        kind: "manpower",
        amount: 10000,
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: -10,
        days: 365,
      },
      {
        kind: "bop",
        amount: 50,
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_mozambique_convention",
    tree: "ZAF",
    x: 25,
    y: 4,
    days: 35,
    branch: "diplomacy",
    icon: "rail",
    group: "zaf_diplomacy",
    prereq: [["zaf_imperial_conference"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "PRT",
        },
        of: "self",
        value: 25,
        days: 365,
      },
      {
        kind: "rail",
        where: {
          group: "zaf_witwatersrand",
        },
        amount: 1,
      },
      {
        kind: "pp",
        amount: 25,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_pirow_european_tour",
    tree: "ZAF",
    x: 24,
    y: 6,
    days: 35,
    branch: "diplomacy",
    icon: "compass",
    group: "zaf_diplomacy",
    prereq: [["zaf_mozambique_convention", "zaf_imperial_conference"]],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_pirow_tour",
      },
      {
        kind: "opinion",
        who: {
          tag: "DEU",
        },
        of: "self",
        value: 15,
        days: 365,
      },
      {
        kind: "opinion",
        who: {
          tag: "ITA",
        },
        of: "self",
        value: 15,
        days: 365,
      },
      {
        kind: "opinion",
        who: {
          tag: "PRT",
        },
        of: "self",
        value: 15,
        days: 365,
      },
      {
        kind: "bop",
        amount: 50,
      },
    ],
    ai: {
      base: 6,
    },
  },
  {
    id: "zaf_wool_for_machines",
    tree: "ZAF",
    x: 25,
    y: 6,
    days: 35,
    branch: "industry",
    icon: "factory",
    group: "zaf_diplomacy",
    prereq: [["zaf_mozambique_convention"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "DEU",
        },
        of: "self",
        value: 15,
        days: 365,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 1,
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: -5,
        days: 365,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "zaf_gold_to_washington",
    tree: "ZAF",
    x: 22,
    y: 7,
    days: 35,
    branch: "diplomacy",
    icon: "scales",
    group: "zaf_diplomacy",
    prereq: [["zaf_swa_mandate", "zaf_swa_fifth_province"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 25,
        days: 365,
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_gsa_greater_union",
    tree: "ZAF",
    x: 20,
    y: 8,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "zaf_greater_union",
    prereq: [["zaf_hct_demand", "zaf_swa_fifth_province"]],
    effects: [
      {
        kind: "set_flag",
        flag: "zaf_greater_union",
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_gsa_rhodesia_offer",
    tree: "ZAF",
    x: 19,
    y: 9,
    days: 35,
    branch: "diplomacy",
    icon: "handshake",
    group: "zaf_greater_union",
    prereq: [["zaf_gsa_greater_union"]],
    available: {
      all: [
        {
          not: {
            kind: "owns_group",
            group: "zaf_rhodesia",
          },
        },
        {
          kind: "exists",
          who: {
            tag: "GBR",
          },
        },
      ],
    },
    effects: [
      {
        kind: "fire_event",
        id: "zaf_ev_rhodesia_union",
        to: {
          tag: "GBR",
        },
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 10,
        days: 365,
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_gsa_protectorates_transfer",
    tree: "ZAF",
    x: 21,
    y: 9,
    days: 35,
    branch: "diplomacy",
    icon: "document",
    group: "zaf_greater_union",
    prereq: [["zaf_gsa_greater_union"], ["zaf_hct_demand"]],
    available: {
      all: [
        {
          not: {
            kind: "owns_group",
            group: "zaf_hct",
          },
        },
        {
          kind: "exists",
          who: {
            tag: "GBR",
          },
        },
      ],
    },
    effects: [
      {
        kind: "fire_event",
        id: "zaf_ev_hct_request",
        to: {
          tag: "GBR",
        },
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_gsa_delagoa_bay",
    tree: "ZAF",
    x: 20,
    y: 10,
    days: 35,
    branch: "diplomacy",
    icon: "ship",
    group: "zaf_greater_union",
    prereq: [["zaf_gsa_greater_union"]],
    available: {
      all: [
        {
          not: {
            kind: "owns_group",
            group: "zaf_delagoa",
          },
        },
        {
          kind: "exists",
          who: {
            tag: "PRT",
          },
        },
      ],
    },
    effects: [
      {
        kind: "fire_event",
        id: "zaf_ev_delagoa_offer",
        to: {
          tag: "PRT",
        },
      },
    ],
    ai: {
      base: 3,
    },
  },
  {
    id: "zaf_gsa_northern_development",
    tree: "ZAF",
    x: 19,
    y: 11,
    days: 70,
    branch: "industry",
    icon: "road",
    group: "zaf_greater_union",
    prereq: [["zaf_gsa_rhodesia_offer"]],
    available: {
      kind: "owns_group",
      group: "zaf_rhodesia",
    },
    effects: [
      {
        kind: "build",
        where: {
          group: "zaf_rhodesia",
        },
        building: "civ",
        count: 2,
      },
      {
        kind: "infra",
        where: {
          group: "zaf_rhodesia",
        },
        amount: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_gsa_union_of_southern_africa",
    tree: "ZAF",
    x: 20,
    y: 12,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "zaf_greater_union",
    prereq: [
      [
        "zaf_gsa_northern_development",
        "zaf_gsa_delagoa_bay",
        "zaf_gsa_protectorates_transfer",
      ],
    ],
    available: {
      any: [
        {
          kind: "owns_group",
          group: "zaf_rhodesia",
        },
        {
          kind: "owns_group",
          group: "zaf_hct",
        },
        {
          kind: "owns_group",
          group: "zaf_delagoa",
        },
      ],
    },
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_southern_union",
      },
      {
        kind: "stability",
        pct: 5,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_rand_deep_levels",
    tree: "ZAF",
    x: 28,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "zaf_rand",
    prereq: [["zaf_gold_pays"]],
    effects: [
      {
        kind: "pp",
        amount: 40,
      },
      {
        kind: "build",
        where: {
          group: "zaf_witwatersrand",
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_far_east_rand",
    tree: "ZAF",
    x: 27,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "zaf_rand",
    prereq: [["zaf_rand_deep_levels"]],
    effects: [
      {
        kind: "build",
        where: {
          group: "zaf_witwatersrand",
        },
        building: "civ",
        count: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_bushveld_chrome",
    tree: "ZAF",
    x: 29,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "zaf_rand",
    prereq: [["zaf_rand_deep_levels"]],
    effects: [
      {
        kind: "resource",
        where: {
          best: 1,
        },
        res: "chromium",
        amount: 3,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_postmasburg_manganese",
    tree: "ZAF",
    x: 30,
    y: 5,
    days: 70,
    branch: "industry",
    icon: "steel",
    group: "zaf_rand",
    prereq: [["zaf_bushveld_chrome"]],
    effects: [
      {
        kind: "resource",
        where: {
          best: 1,
        },
        res: "steel",
        amount: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_witbank_coal",
    tree: "ZAF",
    x: 28,
    y: 5,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "zaf_rand",
    prereq: [["zaf_far_east_rand", "zaf_bushveld_chrome"]],
    effects: [
      {
        kind: "resource",
        where: {
          best: 1,
        },
        res: "coal",
        amount: 3,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_satmar_oil_shale",
    tree: "ZAF",
    x: 28,
    y: 6,
    days: 70,
    branch: "industry",
    icon: "oil",
    group: "zaf_rand",
    prereq: [["zaf_witbank_coal"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "synthetic_refinery",
        count: 1,
      },
      {
        kind: "research_bonus",
        tech: "synthetic_oil_1",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_chamber_of_mines",
    tree: "ZAF",
    x: 27,
    y: 7,
    days: 35,
    branch: "politics",
    icon: "scales",
    group: "zaf_rand",
    prereq: [["zaf_far_east_rand"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "zaf_oppenheimer",
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_iscor_state",
    tree: "ZAF",
    x: 32,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "steel",
    group: "zaf_industry",
    prereq: [["zaf_gold_pays"]],
    exclusive: ["zaf_mining_capital"],
    effects: [
      {
        kind: "resource",
        where: {
          best: 1,
        },
        res: "steel",
        amount: 3,
      },
      {
        kind: "add_spirit",
        id: "zaf_sp_iscor",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_mining_capital",
    tree: "ZAF",
    x: 34,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "zaf_industry",
    prereq: [["zaf_gold_pays"]],
    exclusive: ["zaf_iscor_state"],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 3,
      },
      {
        kind: "pp",
        amount: 20,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "zaf_escom_power",
    tree: "ZAF",
    x: 33,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "zaf_industry",
    prereq: [["zaf_iscor_state", "zaf_mining_capital"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "power_plant",
        count: 1,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_pretoria_steelworks",
    tree: "ZAF",
    x: 31,
    y: 5,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "zaf_industry",
    prereq: [["zaf_escom_power"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 2,
      },
      {
        kind: "resource",
        where: {
          best: 1,
        },
        res: "steel",
        amount: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_modderfontein_explosives",
    tree: "ZAF",
    x: 33,
    y: 5,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "zaf_industry",
    prereq: [["zaf_escom_power"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_port_elizabeth_assembly",
    tree: "ZAF",
    x: 35,
    y: 5,
    days: 70,
    branch: "industry",
    icon: "road",
    group: "zaf_industry",
    prereq: [["zaf_escom_power"]],
    effects: [
      {
        kind: "equipment",
        type: "motorized",
        gen: 1,
        count: 400,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_railway_workshops",
    tree: "ZAF",
    x: 32,
    y: 6,
    days: 70,
    branch: "industry",
    icon: "rail",
    group: "zaf_industry",
    prereq: [["zaf_pretoria_steelworks", "zaf_modderfontein_explosives"]],
    effects: [
      {
        kind: "rail",
        where: "capital",
        amount: 1,
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_war_supplies_directorate",
    tree: "ZAF",
    x: 33,
    y: 7,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "zaf_industry",
    prereq: [["zaf_railway_workshops"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "zaf_van_der_bijl",
      },
      {
        kind: "add_spirit",
        id: "zaf_sp_war_supplies",
      },
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_scientific_research_council",
    tree: "ZAF",
    x: 35,
    y: 7,
    days: 70,
    branch: "research",
    icon: "research",
    group: "zaf_industry",
    prereq: [["zaf_port_elizabeth_assembly"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "zaf_schonland",
      },
      {
        kind: "research_bonus",
        branch: "electronics",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_active_citizen_force",
    tree: "ZAF",
    x: 38,
    y: 3,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "zaf_army",
    prereq: [["zaf_pirow_defence_plan"]],
    effects: [
      {
        kind: "manpower",
        amount: 15000,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_special_service_battalion",
    tree: "ZAF",
    x: 40,
    y: 3,
    days: 70,
    branch: "army",
    icon: "medal",
    group: "zaf_army",
    prereq: [["zaf_pirow_defence_plan"]],
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "research_bonus",
        branch: "infantry",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_artillery_regiments",
    tree: "ZAF",
    x: 37,
    y: 4,
    days: 70,
    branch: "army",
    icon: "artillery",
    group: "zaf_army",
    prereq: [["zaf_active_citizen_force"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "artillery",
        pct: 50,
        uses: 1,
      },
      {
        kind: "equipment",
        type: "artillery",
        gen: 1,
        count: 100,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_marmon_herrington_order",
    tree: "ZAF",
    x: 39,
    y: 4,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "zaf_army",
    prereq: [["zaf_active_citizen_force", "zaf_special_service_battalion"]],
    effects: [
      {
        kind: "equipment",
        type: "light_tank",
        gen: 1,
        count: 60,
        item: "zaf_mh_mk2",
      },
      {
        kind: "research_bonus",
        branch: "armour",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_africa_oath",
    tree: "ZAF",
    x: 38,
    y: 5,
    days: 35,
    branch: "army",
    icon: "flag",
    group: "zaf_army",
    prereq: [["zaf_artillery_regiments", "zaf_marmon_herrington_order"]],
    exclusive: ["zaf_conscription_bill"],
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_africa_oath",
      },
      {
        kind: "war_support",
        pct: 3,
      },
      {
        kind: "fire_event",
        id: "zaf_ev_red_oath",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_conscription_bill",
    tree: "ZAF",
    x: 40,
    y: 5,
    days: 70,
    branch: "army",
    icon: "document",
    group: "zaf_army",
    prereq: [["zaf_artillery_regiments", "zaf_marmon_herrington_order"]],
    exclusive: ["zaf_africa_oath"],
    effects: [
      {
        kind: "law_step",
        law: "conscription",
        steps: 1,
      },
      {
        kind: "stability",
        pct: -5,
      },
      {
        kind: "bop",
        amount: 100,
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 2,
      },
    ],
    ai: {
      base: 3,
    },
  },
  {
    id: "zaf_springbok_divisions",
    tree: "ZAF",
    x: 39,
    y: 6,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "zaf_army",
    prereq: [["zaf_africa_oath", "zaf_conscription_bill"]],
    effects: [
      {
        kind: "unlock_template",
        template: "zaf_infantry_division",
      },
      {
        kind: "army_xp",
        amount: 10,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_cape_corps_nmc",
    tree: "ZAF",
    x: 37,
    y: 7,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "zaf_army",
    prereq: [["zaf_springbok_divisions"]],
    effects: [
      {
        kind: "manpower",
        amount: 20000,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_arm_the_corps",
    tree: "ZAF",
    x: 37,
    y: 8,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "zaf_army",
    prereq: [["zaf_cape_corps_nmc"]],
    effects: [
      {
        kind: "remove_spirit",
        id: "zaf_sp_white_service",
      },
      {
        kind: "add_spirit",
        id: "zaf_sp_corps_armed",
      },
      {
        kind: "stability",
        pct: -2,
      },
      {
        kind: "bop",
        amount: -50,
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "zaf_sixth_armoured_division",
    tree: "ZAF",
    x: 40,
    y: 7,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "zaf_army",
    prereq: [["zaf_springbok_divisions"]],
    effects: [
      {
        kind: "unlock_template",
        template: "zaf_armoured_division",
      },
      {
        kind: "research_bonus",
        branch: "armour",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_saaf_expansion",
    tree: "ZAF",
    x: 45,
    y: 3,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "zaf_air",
    prereq: [["zaf_pirow_defence_plan"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "air_base",
        count: 1,
      },
      {
        kind: "research_bonus",
        branch: "air",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_roberts_heights_depot",
    tree: "ZAF",
    x: 44,
    y: 4,
    days: 70,
    branch: "air",
    icon: "factory_mil",
    group: "zaf_air",
    prereq: [["zaf_saaf_expansion"]],
    effects: [
      {
        kind: "equipment",
        type: "cas",
        gen: 1,
        count: 40,
        item: "zaf_hartbees",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_hurricane_squadrons",
    tree: "ZAF",
    x: 46,
    y: 4,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "zaf_air",
    prereq: [["zaf_saaf_expansion"]],
    effects: [
      {
        kind: "equipment",
        type: "fighter",
        gen: 1,
        count: 40,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_joint_air_training",
    tree: "ZAF",
    x: 45,
    y: 5,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "zaf_air",
    prereq: [["zaf_roberts_heights_depot", "zaf_hurricane_squadrons"]],
    effects: [
      {
        kind: "add_spirit",
        id: "zaf_sp_air_training",
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 15,
        days: 365,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_maritime_patrol",
    tree: "ZAF",
    x: 44,
    y: 6,
    days: 70,
    branch: "air",
    icon: "ship",
    group: "zaf_air",
    prereq: [["zaf_joint_air_training"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "naval_bomber_1",
        pct: 50,
        uses: 1,
      },
      {
        kind: "equipment",
        type: "naval_bomber",
        gen: 1,
        count: 20,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_desert_air_wings",
    tree: "ZAF",
    x: 46,
    y: 6,
    days: 70,
    branch: "air",
    icon: "bomber",
    group: "zaf_air",
    prereq: [["zaf_joint_air_training"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "research_bonus",
        branch: "air",
        pct: 50,
        uses: 2,
      },
      {
        kind: "equipment",
        type: "fighter",
        gen: 1,
        count: 30,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_seaward_defence_force",
    tree: "ZAF",
    x: 50,
    y: 3,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "zaf_navy",
    prereq: [["zaf_pirow_defence_plan"]],
    effects: [
      {
        kind: "navy_xp",
        amount: 10,
      },
      {
        kind: "build",
        where: {
          coastal: true,
          n: 1,
        },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_simonstown_base",
    tree: "ZAF",
    x: 49,
    y: 4,
    days: 70,
    branch: "navy",
    icon: "fort",
    group: "zaf_navy",
    prereq: [["zaf_seaward_defence_force"]],
    effects: [
      {
        kind: "build",
        where: {
          group: "zaf_cape",
        },
        building: "naval_base",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_durban_graving_dock",
    tree: "ZAF",
    x: 51,
    y: 4,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "zaf_navy",
    prereq: [["zaf_seaward_defence_force"]],
    effects: [
      {
        kind: "build",
        where: {
          group: "zaf_natal",
        },
        building: "dock",
        count: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_minesweeping_whalers",
    tree: "ZAF",
    x: 50,
    y: 5,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "zaf_navy",
    prereq: [["zaf_simonstown_base", "zaf_durban_graving_dock"]],
    effects: [
      {
        kind: "convoys",
        amount: 30,
      },
      {
        kind: "research_bonus",
        branch: "naval",
        pct: 50,
        uses: 1,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_naval_forces",
    tree: "ZAF",
    x: 50,
    y: 6,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "zaf_navy",
    prereq: [["zaf_minesweeping_whalers"]],
    effects: [
      {
        kind: "ships",
        cls: "dd",
        gen: 1,
        count: 2,
      },
      {
        kind: "navy_xp",
        amount: 15,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_east_africa_campaign",
    tree: "ZAF",
    x: 55,
    y: 7,
    days: 70,
    branch: "army",
    icon: "map",
    group: "zaf_war",
    prereq: [["zaf_springbok_divisions"]],
    available: {
      kind: "at_war_with",
      of: {
        tag: "ITA",
      },
    },
    effects: [
      {
        kind: "army_xp",
        amount: 15,
      },
      {
        kind: "war_support",
        pct: 3,
      },
      {
        kind: "fire_event",
        id: "zaf_ev_east_africa",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_desert_brigades",
    tree: "ZAF",
    x: 55,
    y: 8,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "zaf_war",
    prereq: [["zaf_east_africa_campaign", "zaf_springbok_divisions"]],
    available: {
      any: [
        {
          kind: "at_war_with",
          of: {
            tag: "DEU",
          },
        },
        {
          kind: "at_war_with",
          of: {
            tag: "ITA",
          },
        },
      ],
    },
    effects: [
      {
        kind: "army_xp",
        amount: 15,
      },
      {
        kind: "manpower",
        amount: 15000,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_cape_sea_route",
    tree: "ZAF",
    x: 57,
    y: 7,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "zaf_war",
    prereq: [["zaf_minesweeping_whalers"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "convoys",
        amount: 50,
      },
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 20,
        days: 365,
      },
      {
        kind: "add_spirit",
        id: "zaf_sp_cape_route",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_madagascar_landings",
    tree: "ZAF",
    x: 57,
    y: 8,
    days: 70,
    branch: "army",
    icon: "ship",
    group: "zaf_war",
    prereq: [["zaf_cape_sea_route"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "navy_xp",
        amount: 10,
      },
      {
        kind: "army_xp",
        amount: 10,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "zaf_home_front_economy",
    tree: "ZAF",
    x: 56,
    y: 9,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "zaf_war",
    prereq: [["zaf_desert_brigades", "zaf_madagascar_landings"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "law_step",
        law: "economy",
        steps: 1,
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_italy_armoured",
    tree: "ZAF",
    x: 55,
    y: 10,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "zaf_war",
    prereq: [["zaf_home_front_economy"], ["zaf_sixth_armoured_division"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "army_xp",
        amount: 20,
      },
      {
        kind: "war_support",
        pct: 3,
      },
      {
        kind: "fire_event",
        id: "zaf_ev_sixth_armoured",
      },
    ],
    ai: AI,
  },
  {
    id: "zaf_total_war_effort",
    tree: "ZAF",
    x: 57,
    y: 10,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "zaf_war",
    prereq: [["zaf_home_front_economy"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "mil",
        count: 3,
      },
      {
        kind: "war_support",
        pct: 3,
      },
    ],
    ai: AI,
  },
];

export const ZAF_PATH = [
  "zaf_union_of_south_africa",
  "zaf_pirow_defence_plan",
  "zaf_fusion_cabinet",
  "zaf_status_of_the_union",
  "zaf_gold_pays",
  "zaf_native_trust_land_act",
  "zaf_rand_deep_levels",
  "zaf_iscor_state",
  "zaf_imperial_conference",
  "zaf_hofmeyr_portfolios",
  "zaf_general_election",
  "zaf_bushveld_chrome",
  "zaf_active_citizen_force",
  "zaf_special_service_battalion",
  "zaf_saaf_expansion",
  "zaf_escom_power",
  "zaf_hct_patience",
  "zaf_swa_mandate",
  "zaf_mozambique_convention",
  "zaf_far_east_rand",
  "zaf_witbank_coal",
  "zaf_pretoria_steelworks",
  "zaf_seaward_defence_force",
  "zaf_pirow_european_tour",
  "zaf_roberts_heights_depot",
  "zaf_artillery_regiments",
  "zaf_marmon_herrington_order",
  "zaf_chamber_of_mines",
  "zaf_modderfontein_explosives",
  "zaf_gold_to_washington",
  "zaf_postmasburg_manganese",
  "zaf_ob_ban_servants",
  "zaf_war_cabinet",
  "zaf_africa_oath",
  "zaf_springbok_divisions",
  "zaf_hurricane_squadrons",
  "zaf_railway_workshops",
  "zaf_war_supplies_directorate",
  "zaf_simonstown_base",
  "zaf_durban_graving_dock",
  "zaf_joint_air_training",
  "zaf_east_africa_campaign",
  "zaf_minesweeping_whalers",
  "zaf_cape_sea_route",
  "zaf_desert_brigades",
  "zaf_cape_corps_nmc",
  "zaf_port_elizabeth_assembly",
  "zaf_satmar_oil_shale",
  "zaf_maritime_patrol",
  "zaf_desert_air_wings",
  "zaf_madagascar_landings",
  "zaf_home_front_economy",
  "zaf_naval_forces",
  "zaf_sixth_armoured_division",
  "zaf_scientific_research_council",
  "zaf_total_war_effort",
  "zaf_italy_armoured",
  "zaf_social_security_report",
  "zaf_wool_for_machines",
];

export const ZAF_BRANCH_POINTS = [
  {
    id: "zaf_ob_question",
    historical: "zaf_ob_ban_servants",
    alternatives: ["zaf_ob_tolerate"],
    political: true,
  },
  {
    id: "zaf_protectorates",
    historical: "zaf_hct_patience",
    alternatives: ["zaf_hct_demand"],
    political: false,
  },
  {
    id: "zaf_south_west",
    historical: "zaf_swa_mandate",
    alternatives: ["zaf_swa_fifth_province"],
    political: false,
  },
  {
    id: "zaf_industry_course",
    historical: "zaf_iscor_state",
    alternatives: ["zaf_mining_capital"],
    political: false,
  },
  {
    id: "zaf_service_oath",
    historical: "zaf_africa_oath",
    alternatives: ["zaf_conscription_bill"],
    political: true,
  },
];
