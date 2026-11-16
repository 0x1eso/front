// ww229 (design ww227): FIN's national focus tree, its history path and branch points. Generated data only
// (ContentPurity); the texts are ww1936.* keys in en.json and ko.json.
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { nationRouteAi } from "../../helpers";

export const FIN_FOCUSES: readonly FocusDef[] = [
  {
    id: "fin_young_republic",
    tree: "FIN",
    x: 6,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "fin_pol_core",
    effects: [
      {
        kind: "pp",
        amount: 40,
      },
      {
        kind: "stability",
        pct: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_heal_the_divide",
    tree: "FIN",
    x: 6,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "dove",
    group: "fin_pol_core",
    prereq: [["fin_young_republic"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "fin_scars_of_1918",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "fin_scars_of_1918",
            to: "fin_scars_fading",
          },
        ],
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_red_earth_coalition",
    tree: "FIN",
    x: 2,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "handshake",
    group: "fin_pol_dem",
    prereq: [["fin_heal_the_divide"]],
    exclusive: ["fin_patriotic_front", "fin_marshal_call"],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 5,
      },
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "fire_event",
        id: "fin_ev_red_earth",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_presidential_electors",
    tree: "FIN",
    x: 1,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "fin_pol_dem",
    prereq: [["fin_red_earth_coalition"]],
    effects: [
      {
        kind: "pp",
        amount: 25,
      },
      {
        kind: "fire_event",
        id: "fin_ev_presidential_election",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_lex_kekkonen",
    tree: "FIN",
    x: 3,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "fin_pol_dem",
    prereq: [["fin_red_earth_coalition"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: -3,
      },
      {
        kind: "fire_event",
        id: "fin_ev_ikl_ban",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_january_engagement",
    tree: "FIN",
    x: 1,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "handshake",
    group: "fin_pol_dem",
    prereq: [["fin_presidential_electors"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_labour_peace",
      },
      {
        kind: "stability",
        pct: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_cooperative_finland",
    tree: "FIN",
    x: 3,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "wheat",
    group: "fin_pol_dem",
    prereq: [["fin_lex_kekkonen"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "civ",
        count: 1,
      },
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_republic_for_all",
    tree: "FIN",
    x: 2,
    y: 5,
    days: 105,
    branch: "politics",
    icon: "shield",
    group: "fin_pol_dem",
    prereq: [["fin_january_engagement"], ["fin_cooperative_finland"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_democratic_unity",
      },
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_dem_free_press",
    tree: "FIN",
    x: 0,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "fin_pol_dem",
    available: {
      not: {
        kind: "ruling",
        ideology: "democratic",
      },
    },
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 5,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: nationRouteAi("democratic", 1),
  },
  {
    id: "fin_dem_legal_front",
    tree: "FIN",
    x: 0,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "fin_pol_dem",
    prereq: [["fin_dem_free_press"]],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 4,
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
    id: "fin_dem_restore_parliament",
    tree: "FIN",
    x: 0,
    y: 8,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "fin_pol_dem",
    prereq: [["fin_dem_legal_front"]],
    available: {
      all: [
        {
          not: {
            kind: "ruling",
            ideology: "democratic",
          },
        },
        {
          kind: "pop_ge",
          ideology: "democratic",
          pct: 25,
        },
      ],
    },
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
      {
        kind: "civil_war",
        ideology: "democratic",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: {
            kind: "stability_ge",
            pct: 40,
          },
          factor: 0,
        },
      ],
    },
  },
  {
    id: "fin_patriotic_front",
    tree: "FIN",
    x: 6,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "eagle_plain",
    group: "fin_pol_ikl",
    prereq: [["fin_heal_the_divide"]],
    exclusive: ["fin_red_earth_coalition", "fin_marshal_call"],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 5,
      },
    ],
    ai: nationRouteAi("fascist", 1),
  },
  {
    id: "fin_blue_black_youth",
    tree: "FIN",
    x: 5,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "fin_pol_ikl",
    prereq: [["fin_patriotic_front"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 4,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_court_the_guards",
    tree: "FIN",
    x: 7,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "infantry",
    group: "fin_pol_ikl",
    prereq: [["fin_patriotic_front"]],
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
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_lapua_march",
    tree: "FIN",
    x: 6,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "fin_pol_ikl",
    prereq: [["fin_blue_black_youth"], ["fin_court_the_guards"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
      {
        kind: "stability",
        pct: -2,
      },
      {
        kind: "fire_event",
        id: "fin_ev_peasant_march",
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_ikl_rising",
    tree: "FIN",
    x: 6,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "sword",
    group: "fin_pol_ikl",
    prereq: [["fin_lapua_march"]],
    available: {
      all: [
        {
          not: {
            kind: "ruling",
            ideology: "fascist",
          },
        },
        {
          kind: "pop_ge",
          ideology: "fascist",
          pct: 25,
        },
      ],
    },
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
      {
        kind: "civil_war",
        ideology: "fascist",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: {
            kind: "stability_ge",
            pct: 40,
          },
          factor: 0,
        },
      ],
    },
  },
  {
    id: "fin_ikl_new_order",
    tree: "FIN",
    x: 6,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "eagle_plain",
    group: "fin_pol_ikl",
    prereq: [["fin_ikl_rising"]],
    available: {
      kind: "ruling",
      ideology: "fascist",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "fin_patriotic_state",
      },
      {
        kind: "law_step",
        law: "conscription",
        steps: 1,
      },
      {
        kind: "fire_event",
        id: "fin_ev_new_order_leader",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_marshal_call",
    tree: "FIN",
    x: 9,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "fin_pol_marshal",
    prereq: [["fin_heal_the_divide"]],
    exclusive: ["fin_red_earth_coalition", "fin_patriotic_front"],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 5,
      },
      {
        kind: "war_support",
        pct: 3,
      },
    ],
    ai: nationRouteAi("neutral", 1),
  },
  {
    id: "fin_defence_cabinet",
    tree: "FIN",
    x: 8,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "shield",
    group: "fin_pol_marshal",
    prereq: [["fin_marshal_call"]],
    exclusive: ["fin_crown_question"],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_marshal_rises",
    tree: "FIN",
    x: 8,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "sword",
    group: "fin_pol_marshal",
    prereq: [["fin_defence_cabinet"]],
    available: {
      all: [
        {
          not: {
            kind: "ruling",
            ideology: "neutral",
          },
        },
        {
          kind: "pop_ge",
          ideology: "neutral",
          pct: 25,
        },
      ],
    },
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
      {
        kind: "civil_war",
        ideology: "neutral",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: {
            kind: "stability_ge",
            pct: 40,
          },
          factor: 0,
        },
      ],
    },
  },
  {
    id: "fin_regent_mannerheim",
    tree: "FIN",
    x: 8,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "fin_pol_marshal",
    prereq: [["fin_marshal_rises"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "set_leader",
        person: "fin_mannerheim_regent",
      },
      {
        kind: "add_spirit",
        id: "fin_marshal_rule",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_crown_question",
    tree: "FIN",
    x: 10,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "fin_pol_crown",
    prereq: [["fin_marshal_call"]],
    exclusive: ["fin_defence_cabinet"],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_monarchist_league",
    tree: "FIN",
    x: 10,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "fin_pol_crown",
    prereq: [["fin_crown_question"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
      {
        kind: "fire_event",
        id: "fin_ev_kingdom_offer",
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_kingdom_proclaimed",
    tree: "FIN",
    x: 10,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "fin_pol_crown",
    prereq: [["fin_monarchist_league"]],
    available: {
      all: [
        {
          not: {
            kind: "ruling",
            ideology: "neutral",
          },
        },
        {
          kind: "pop_ge",
          ideology: "neutral",
          pct: 25,
        },
      ],
    },
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
      {
        kind: "civil_war",
        ideology: "neutral",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: {
            kind: "stability_ge",
            pct: 40,
          },
          factor: 0,
        },
      ],
    },
  },
  {
    id: "fin_kingdom_of_finland",
    tree: "FIN",
    x: 10,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "fin_pol_crown",
    prereq: [["fin_kingdom_proclaimed"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "set_name",
        key: "ww1936.rename.kingdom_of_finland",
      },
      {
        kind: "add_spirit",
        id: "fin_crown_restored",
      },
      {
        kind: "set_leader",
        person: "fin_paasikivi",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_skp_underground",
    tree: "FIN",
    x: 13,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "fin_pol_skp",
    available: {
      not: {
        kind: "ruling",
        ideology: "communist",
      },
    },
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 4,
      },
    ],
    ai: nationRouteAi("communist", 1),
  },
  {
    id: "fin_skp_front_groups",
    tree: "FIN",
    x: 13,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "fin_pol_skp",
    prereq: [["fin_skp_underground"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 4,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_skp_union_left",
    tree: "FIN",
    x: 12,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "factory",
    group: "fin_pol_skp",
    prereq: [["fin_skp_front_groups"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
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
    id: "fin_skp_free_prisoners",
    tree: "FIN",
    x: 14,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "chain_broken",
    group: "fin_pol_skp",
    prereq: [["fin_skp_front_groups"]],
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
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_skp_rising",
    tree: "FIN",
    x: 13,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "fin_pol_skp",
    prereq: [["fin_skp_union_left"], ["fin_skp_free_prisoners"]],
    available: {
      all: [
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
        {
          kind: "pop_ge",
          ideology: "communist",
          pct: 25,
        },
      ],
    },
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
      {
        kind: "civil_war",
        ideology: "communist",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: {
            kind: "stability_ge",
            pct: 40,
          },
          factor: 0,
        },
      ],
    },
  },
  {
    id: "fin_skp_workers_republic",
    tree: "FIN",
    x: 13,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "fin_pol_skp",
    prereq: [["fin_skp_rising"]],
    available: {
      kind: "ruling",
      ideology: "communist",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "fin_peoples_democracy",
      },
      {
        kind: "opinion",
        of: {
          tag: "SUN",
        },
        value: 30,
        days: 365,
      },
      {
        kind: "fire_event",
        id: "fin_ev_red_government",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_nordic_orientation",
    tree: "FIN",
    x: 16,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "fin_dipl_nordic",
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "SWE",
        },
        value: 25,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "NOR",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "DNK",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_aland_plan",
    tree: "FIN",
    x: 15,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "fort",
    group: "fin_dipl_nordic",
    prereq: [["fin_nordic_orientation"]],
    available: {
      kind: "exists",
      who: {
        tag: "SWE",
      },
    },
    bypass: {
      not: {
        kind: "exists",
        who: {
          tag: "SWE",
        },
      },
    },
    effects: [
      {
        kind: "fire_event",
        id: "fin_ev_aland_proposal",
        to: {
          tag: "SWE",
        },
      },
      {
        kind: "build",
        where: {
          regions: [169],
        },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_nordic_talks",
    tree: "FIN",
    x: 17,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "fin_dipl_nordic",
    prereq: [["fin_nordic_orientation"]],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "SWE",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "NOR",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "set_flag",
        flag: "fin_nordic_talks",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_swedish_volunteer_corps",
    tree: "FIN",
    x: 15,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "infantry",
    group: "fin_dipl_nordic",
    prereq: [["fin_aland_plan"]],
    effects: [
      {
        kind: "unlock_decision",
        id: "fin_dec_swedish_volunteers",
      },
      {
        kind: "opinion",
        of: {
          tag: "SWE",
        },
        value: 10,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_nordic_defence_union",
    tree: "FIN",
    x: 17,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    group: "fin_dipl_nordic",
    prereq: [["fin_nordic_talks"]],
    available: {
      not: {
        kind: "in_faction",
      },
    },
    effects: [
      {
        kind: "if",
        cond: {
          kind: "gflag",
          flag: "nordic_union_formed",
        },
        then: [
          {
            kind: "if",
            cond: {
              kind: "flag",
              flag: "nor_union_founder",
              who: {
                tag: "SWE",
              },
            },
            then: [
              {
                kind: "join_faction",
                of: {
                  tag: "SWE",
                },
              },
            ],
            else: [
              {
                kind: "if",
                cond: {
                  kind: "flag",
                  flag: "nor_union_founder",
                  who: {
                    tag: "NOR",
                  },
                },
                then: [
                  {
                    kind: "join_faction",
                    of: {
                      tag: "NOR",
                    },
                  },
                ],
                else: [
                  {
                    kind: "if",
                    cond: {
                      kind: "flag",
                      flag: "nor_union_founder",
                      who: {
                        tag: "DNK",
                      },
                    },
                    then: [
                      {
                        kind: "join_faction",
                        of: {
                          tag: "DNK",
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        else: [
          {
            kind: "set_flag",
            flag: "can_create_faction",
          },
          {
            kind: "create_faction",
            name: "nordic_defence",
          },
          {
            kind: "set_flag",
            flag: "nor_union_founder",
          },
          {
            kind: "set_gflag",
            flag: "nordic_union_formed",
          },
          {
            kind: "invite",
            of: {
              tag: "SWE",
            },
          },
          {
            kind: "invite",
            of: {
              tag: "NOR",
            },
          },
          {
            kind: "invite",
            of: {
              tag: "DNK",
            },
          },
        ],
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "fin_nordic_arms_pool",
    tree: "FIN",
    x: 16,
    y: 3,
    days: 70,
    branch: "research",
    icon: "flask",
    group: "fin_dipl_nordic",
    prereq: [["fin_swedish_volunteer_corps"], ["fin_nordic_defence_union"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "artillery",
        pct: 50,
        uses: 1,
      },
      {
        kind: "opinion",
        of: {
          tag: "SWE",
        },
        value: 10,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_keep_the_pact",
    tree: "FIN",
    x: 20,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "document",
    group: "fin_dipl_soviet",
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "SUN",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_moscow_back_channel",
    tree: "FIN",
    x: 20,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "radio",
    group: "fin_dipl_soviet",
    prereq: [["fin_keep_the_pact"]],
    available: {
      kind: "exists",
      who: {
        tag: "SUN",
      },
    },
    bypass: {
      not: {
        kind: "exists",
        who: {
          tag: "SUN",
        },
      },
    },
    effects: [
      {
        kind: "fire_event",
        id: "fin_ev_quiet_envoy",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_refuse_the_bases",
    tree: "FIN",
    x: 19,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    group: "fin_dipl_soviet",
    prereq: [["fin_moscow_back_channel"]],
    exclusive: ["fin_lease_the_islands"],
    effects: [
      {
        kind: "war_support",
        pct: 7,
      },
      {
        kind: "set_flag",
        flag: "fin_refused_bases",
      },
      {
        kind: "opinion",
        of: {
          tag: "SUN",
        },
        value: -20,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_lease_the_islands",
    tree: "FIN",
    x: 21,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "dove",
    group: "fin_dipl_soviet",
    prereq: [["fin_moscow_back_channel"]],
    exclusive: ["fin_refuse_the_bases"],
    effects: [
      {
        kind: "opinion",
        of: "self",
        value: 35,
        days: 365,
        who: {
          tag: "SUN",
        },
      },
      {
        kind: "war_support",
        pct: -5,
      },
      {
        kind: "set_flag",
        flag: "fin_islands_leased",
      },
      {
        kind: "add_spirit",
        id: "fin_paasikivi_course",
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "fin_moscow_trade_treaty",
    tree: "FIN",
    x: 21,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "wheat",
    group: "fin_dipl_soviet",
    prereq: [["fin_lease_the_islands"]],
    effects: [
      {
        kind: "pp",
        amount: 30,
      },
      {
        kind: "opinion",
        of: "self",
        value: 20,
        days: 365,
        who: {
          tag: "SUN",
        },
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_friendship_treaty",
    tree: "FIN",
    x: 21,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "fin_dipl_soviet",
    prereq: [["fin_moscow_trade_treaty"]],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "SUN",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "SUN",
            },
          },
        },
      ],
    },
    effects: [
      {
        kind: "nap",
        of: {
          tag: "SUN",
        },
      },
      {
        kind: "set_flag",
        flag: "fin_soviet_treaty",
      },
      {
        kind: "stability",
        pct: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_german_trade",
    tree: "FIN",
    x: 24,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "fin_dipl_germany",
    available: {
      kind: "exists",
      who: {
        tag: "DEU",
      },
    },
    bypass: {
      not: {
        kind: "exists",
        who: {
          tag: "DEU",
        },
      },
    },
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "DEU",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "pp",
        amount: 20,
      },
    ],
    ai: {
      base: 8,
    },
  },
  {
    id: "fin_transit_agreement",
    tree: "FIN",
    x: 24,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "rail",
    group: "fin_dipl_germany",
    prereq: [["fin_german_trade"]],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "DEU",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "DEU",
            },
          },
        },
      ],
    },
    effects: [
      {
        kind: "fire_event",
        id: "fin_ev_transit_request",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_brothers_in_arms",
    tree: "FIN",
    x: 23,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "sword",
    group: "fin_dipl_germany",
    prereq: [["fin_transit_agreement"]],
    exclusive: ["fin_western_hope"],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "DEU",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "DEU",
            },
          },
        },
      ],
    },
    effects: [
      {
        kind: "add_spirit",
        id: "fin_brotherhood_in_arms",
      },
      {
        kind: "opinion",
        of: {
          tag: "DEU",
        },
        value: 30,
        days: 365,
      },
      {
        kind: "opinion",
        of: "self",
        value: 30,
        days: 365,
        who: {
          tag: "DEU",
        },
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_win_back_karelia",
    tree: "FIN",
    x: 23,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "fin_dipl_germany",
    prereq: [["fin_brothers_in_arms"]],
    available: {
      any: [
        {
          kind: "at_war_with",
          of: {
            tag: "SUN",
          },
        },
        {
          kind: "at_war_with",
          of: {
            tag: "SUN",
          },
          who: {
            tag: "DEU",
          },
        },
      ],
    },
    bypass: {
      all: [
        {
          kind: "owns_group",
          group: "karelian_isthmus",
        },
        {
          kind: "owns_group",
          group: "ladoga_karelia",
        },
      ],
    },
    effects: [
      {
        kind: "if",
        cond: {
          not: {
            kind: "owns_group",
            group: "karelian_isthmus",
          },
        },
        then: [
          {
            kind: "war_goal",
            on: {
              ownerOf: "karelian_isthmus",
            },
            type: "claim",
            group: "karelian_isthmus",
          },
        ],
        else: [
          {
            kind: "war_goal",
            on: {
              ownerOf: "ladoga_karelia",
            },
            type: "claim",
            group: "ladoga_karelia",
          },
        ],
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_cross_the_old_border",
    tree: "FIN",
    x: 22,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "fin_dipl_germany",
    prereq: [["fin_win_back_karelia"]],
    exclusive: ["fin_stop_at_the_old_border"],
    available: {
      kind: "exists",
      who: {
        tag: "SUN",
      },
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          tag: "SUN",
        },
        type: "claim",
        group: "fin_east_karelia",
      },
      {
        kind: "war_support",
        pct: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_stop_at_the_old_border",
    tree: "FIN",
    x: 24,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "dove",
    group: "fin_dipl_germany",
    prereq: [["fin_win_back_karelia"]],
    exclusive: ["fin_cross_the_old_border"],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "GBR",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "USA",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "stability",
        pct: 5,
      },
      {
        kind: "set_flag",
        flag: "fin_old_border",
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "fin_east_karelian_rule",
    tree: "FIN",
    x: 22,
    y: 5,
    days: 70,
    branch: "diplomacy",
    icon: "document",
    group: "fin_dipl_germany",
    prereq: [["fin_cross_the_old_border"]],
    available: {
      kind: "controls_group",
      group: "fin_east_karelia",
    },
    effects: [
      {
        kind: "compliance",
        group: "fin_east_karelia",
        pct: 7,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_greater_finland",
    tree: "FIN",
    x: 22,
    y: 6,
    days: 70,
    branch: "diplomacy",
    icon: "flag",
    group: "fin_dipl_germany",
    prereq: [["fin_east_karelian_rule"]],
    available: {
      kind: "controls_group",
      group: "fin_east_karelia",
    },
    effects: [
      {
        kind: "annex_occupied",
        group: "fin_east_karelia",
      },
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_separate_peace",
    tree: "FIN",
    x: 24,
    y: 5,
    days: 70,
    branch: "diplomacy",
    icon: "dove",
    group: "fin_dipl_germany",
    prereq: [["fin_cross_the_old_border", "fin_stop_at_the_old_border"]],
    exclusive: ["fin_fight_on"],
    available: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "SUN",
          },
        },
        {
          kind: "war_days_ge",
          days: 365,
        },
      ],
    },
    effects: [
      {
        kind: "fire_event",
        id: "fin_ev_armistice_terms",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_fight_on",
    tree: "FIN",
    x: 26,
    y: 5,
    days: 70,
    branch: "diplomacy",
    icon: "sword",
    group: "fin_dipl_germany",
    prereq: [["fin_cross_the_old_border", "fin_stop_at_the_old_border"]],
    exclusive: ["fin_separate_peace"],
    available: {
      kind: "at_war_with",
      of: {
        tag: "SUN",
      },
    },
    effects: [
      {
        kind: "war_support",
        pct: 7,
      },
      {
        kind: "opinion",
        of: {
          tag: "DEU",
        },
        value: 20,
        days: 365,
      },
    ],
    ai: {
      base: 3,
    },
  },
  {
    id: "fin_league_faith",
    tree: "FIN",
    x: 28,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "scales",
    group: "fin_dipl_west",
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "GBR",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "FRA",
        },
        value: 15,
        days: 365,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_ask_london_paris",
    tree: "FIN",
    x: 27,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "document",
    group: "fin_dipl_west",
    prereq: [["fin_league_faith"]],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "GBR",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "FRA",
        },
        value: 20,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_american_credit",
    tree: "FIN",
    x: 29,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "fin_dipl_west",
    prereq: [["fin_league_faith"]],
    available: {
      kind: "exists",
      who: {
        tag: "USA",
      },
    },
    bypass: {
      not: {
        kind: "exists",
        who: {
          tag: "USA",
        },
      },
    },
    effects: [
      {
        kind: "pp",
        amount: 30,
      },
      {
        kind: "opinion",
        of: {
          tag: "USA",
        },
        value: 20,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_western_hope",
    tree: "FIN",
    x: 27,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "fin_dipl_west",
    prereq: [["fin_ask_london_paris"]],
    exclusive: ["fin_brothers_in_arms"],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "GBR",
        },
        value: 30,
        days: 365,
      },
      {
        kind: "opinion",
        of: "self",
        value: 30,
        days: 365,
        who: {
          tag: "GBR",
        },
      },
      {
        kind: "add_spirit",
        id: "fin_western_sympathy",
      },
    ],
    ai: {
      base: 4,
    },
  },
  {
    id: "fin_buy_american_fighters",
    tree: "FIN",
    x: 29,
    y: 2,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "fin_dipl_west",
    prereq: [["fin_american_credit"]],
    effects: [
      {
        kind: "equipment",
        type: "fighter",
        gen: 1,
        count: 40,
      },
    ],
    ai: {
      base: 8,
    },
  },
  {
    id: "fin_gulf_cooperation",
    tree: "FIN",
    x: 26,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "ship",
    group: "fin_dipl_baltic",
    available: {
      kind: "exists",
      who: {
        tag: "EST",
      },
    },
    bypass: {
      not: {
        kind: "exists",
        who: {
          tag: "EST",
        },
      },
    },
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "EST",
        },
        value: 25,
        days: 365,
      },
      {
        kind: "opinion",
        of: "self",
        value: 25,
        days: 365,
        who: {
          tag: "EST",
        },
      },
      {
        kind: "build",
        where: {
          regions: [162],
        },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_kindred_estonia",
    tree: "FIN",
    x: 26,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "fin_dipl_baltic",
    prereq: [["fin_gulf_cooperation"]],
    effects: [
      {
        kind: "unlock_decision",
        id: "fin_dec_estonian_union",
      },
      {
        kind: "opinion",
        of: {
          tag: "EST",
        },
        value: 15,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_guard_the_southern_shore",
    tree: "FIN",
    x: 26,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    group: "fin_dipl_baltic",
    prereq: [["fin_kindred_estonia"]],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "EST",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "EST",
            },
          },
        },
      ],
    },
    effects: [
      {
        kind: "guarantee",
        of: {
          tag: "EST",
        },
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_green_gold",
    tree: "FIN",
    x: 31,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "fin_ind_forest",
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "civ",
        count: 1,
      },
      {
        kind: "pp",
        amount: 20,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_paper_mills",
    tree: "FIN",
    x: 30,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "fin_ind_forest",
    prereq: [["fin_green_gold"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_timber_exports",
    tree: "FIN",
    x: 32,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "ship",
    group: "fin_ind_forest",
    prereq: [["fin_green_gold"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_timber_trade",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_port_towns",
    tree: "FIN",
    x: 31,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "ship",
    group: "fin_ind_forest",
    prereq: [["fin_paper_mills"], ["fin_timber_exports"]],
    effects: [
      {
        kind: "build",
        where: {
          coastal: true,
          n: 1,
        },
        building: "dock",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_wood_gas",
    tree: "FIN",
    x: 30,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "oil",
    group: "fin_ind_forest",
    prereq: [["fin_port_towns"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_gengas",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_border_roads",
    tree: "FIN",
    x: 32,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "road",
    group: "fin_ind_roads",
    prereq: [["fin_port_towns"]],
    effects: [
      {
        kind: "infra",
        where: {
          borderWith: {
            tag: "SUN",
          },
          n: 3,
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_salla_railway",
    tree: "FIN",
    x: 32,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "rail",
    group: "fin_ind_roads",
    prereq: [["fin_border_roads"]],
    effects: [
      {
        kind: "rail",
        where: {
          regions: [108, 85],
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_imatra_power",
    tree: "FIN",
    x: 34,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "fin_ind_power",
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_outokumpu_copper",
    tree: "FIN",
    x: 33,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "fin_ind_power",
    prereq: [["fin_imatra_power"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "industry",
        pct: 50,
        uses: 1,
      },
      {
        kind: "build",
        where: {
          regions: [140],
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_petsamo_nickel",
    tree: "FIN",
    x: 35,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "fin_ind_power",
    prereq: [["fin_imatra_power"]],
    available: {
      kind: "owns_group",
      group: "petsamo",
    },
    bypass: {
      not: {
        kind: "owns_group",
        group: "petsamo",
      },
    },
    effects: [
      {
        kind: "unlock_decision",
        id: "fin_dec_nickel_concession",
      },
      {
        kind: "pp",
        amount: 20,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_rural_power",
    tree: "FIN",
    x: 34,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "fin_ind_power",
    prereq: [["fin_outokumpu_copper", "fin_petsamo_nickel"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_power_grid",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_industrial_south",
    tree: "FIN",
    x: 34,
    y: 3,
    days: 105,
    branch: "industry",
    icon: "factory",
    group: "fin_ind_power",
    prereq: [["fin_rural_power"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "civ",
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_state_arsenals",
    tree: "FIN",
    x: 37,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "fin_ind_arms",
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "mil",
        count: 1,
      },
      {
        kind: "research_bonus",
        branch: "infantry",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_suomi_gun",
    tree: "FIN",
    x: 36,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "infantry",
    group: "fin_ind_arms",
    prereq: [["fin_state_arsenals"]],
    effects: [
      {
        kind: "equipment",
        type: "infantry_equipment",
        gen: 1,
        count: 1500,
        item: "fin_suomi_kp31",
      },
      {
        kind: "research_bonus",
        tech: "inf_eq_2",
        pct: 70,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_tampella_guns",
    tree: "FIN",
    x: 38,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "artillery",
    group: "fin_ind_arms",
    prereq: [["fin_state_arsenals"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "artillery",
        pct: 50,
        uses: 1,
      },
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "mil",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_end_shell_hunger",
    tree: "FIN",
    x: 37,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "artillery",
    group: "fin_ind_arms",
    prereq: [["fin_suomi_gun"], ["fin_tampella_guns"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "fin_empty_arsenal",
        },
        then: [
          {
            kind: "remove_spirit",
            id: "fin_empty_arsenal",
          },
        ],
      },
      {
        kind: "equipment",
        type: "artillery",
        gen: 1,
        count: 40,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_lahti_workshop",
    tree: "FIN",
    x: 36,
    y: 3,
    days: 70,
    branch: "research",
    icon: "research",
    group: "fin_ind_arms",
    prereq: [["fin_end_shell_hunger"]],
    effects: [
      {
        kind: "equipment",
        type: "anti_tank",
        gen: 1,
        count: 60,
        item: "fin_lahti_l39",
      },
      {
        kind: "research_bonus",
        tech: "anti_tank_1",
        pct: 70,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_bofors_licences",
    tree: "FIN",
    x: 38,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "artillery",
    group: "fin_ind_arms",
    prereq: [["fin_end_shell_hunger"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "anti_air_1",
        pct: 70,
        uses: 1,
      },
      {
        kind: "equipment",
        type: "anti_tank",
        gen: 1,
        count: 40,
        item: "fin_37pstk36",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_war_industry",
    tree: "FIN",
    x: 37,
    y: 4,
    days: 105,
    branch: "industry",
    icon: "factory_mil",
    group: "fin_ind_arms",
    prereq: [["fin_lahti_workshop"], ["fin_bofors_licences"]],
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
        kind: "law_step",
        law: "economy",
        steps: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_isthmus_survey",
    tree: "FIN",
    x: 40,
    y: 0,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "fin_army_line",
    available: {
      kind: "owns_group",
      group: "karelian_isthmus",
    },
    bypass: {
      not: {
        kind: "owns_group",
        group: "karelian_isthmus",
      },
    },
    effects: [
      {
        kind: "unlock_decision",
        id: "fin_dec_line_1",
      },
      {
        kind: "fort",
        where: {
          group: "karelian_isthmus",
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_concrete_bunkers",
    tree: "FIN",
    x: 39,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "fin_army_line",
    prereq: [["fin_isthmus_survey"]],
    bypass: {
      not: {
        kind: "owns_group",
        group: "karelian_isthmus",
      },
    },
    effects: [
      {
        kind: "fort",
        where: {
          group: "karelian_isthmus",
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_ladoga_line",
    tree: "FIN",
    x: 41,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "fin_army_line",
    prereq: [["fin_isthmus_survey"]],
    bypass: {
      not: {
        kind: "owns_group",
        group: "ladoga_karelia",
      },
    },
    effects: [
      {
        kind: "fort",
        where: {
          group: "ladoga_karelia",
        },
        amount: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_granite_obstacles",
    tree: "FIN",
    x: 40,
    y: 2,
    days: 70,
    branch: "army",
    icon: "tower",
    group: "fin_army_line",
    prereq: [["fin_concrete_bunkers"], ["fin_ladoga_line"]],
    effects: [
      {
        kind: "fort",
        where: {
          group: "karelian_isthmus",
        },
        amount: 1,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_coastal_batteries",
    tree: "FIN",
    x: 40,
    y: 3,
    days: 70,
    branch: "army",
    icon: "artillery",
    group: "fin_army_line",
    prereq: [["fin_granite_obstacles"]],
    effects: [
      {
        kind: "build",
        where: {
          group: "karelian_isthmus",
        },
        building: "coastal_fort",
        count: 1,
      },
      {
        kind: "build",
        where: {
          regions: [162],
        },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_forest_war_school",
    tree: "FIN",
    x: 43,
    y: 0,
    days: 70,
    branch: "army",
    icon: "compass",
    group: "fin_army_doctrine",
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "add_spirit",
        id: "fin_forest_war",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_ski_jaegers",
    tree: "FIN",
    x: 42,
    y: 1,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "fin_army_doctrine",
    prereq: [["fin_forest_war_school"]],
    effects: [
      {
        kind: "if",
        cond: {
          not: {
            kind: "has_tech",
            tech: "mountaineers",
          },
        },
        then: [
          {
            kind: "add_tech",
            tech: "mountaineers",
          },
        ],
      },
      {
        kind: "unlock_template",
        template: "fin_ski_brigade",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_motti_doctrine",
    tree: "FIN",
    x: 44,
    y: 1,
    days: 70,
    branch: "army",
    icon: "sword",
    group: "fin_army_doctrine",
    prereq: [["fin_forest_war_school"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_motti_spirit",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_sissi_raids",
    tree: "FIN",
    x: 42,
    y: 2,
    days: 70,
    branch: "army",
    icon: "compass",
    group: "fin_army_doctrine",
    prereq: [["fin_ski_jaegers"]],
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "research_bonus",
        branch: "doctrine",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_sisu",
    tree: "FIN",
    x: 44,
    y: 2,
    days: 70,
    branch: "army",
    icon: "medal",
    group: "fin_army_doctrine",
    prereq: [["fin_motti_doctrine"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_sisu_spirit",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_light_detachments",
    tree: "FIN",
    x: 43,
    y: 3,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "fin_army_doctrine",
    prereq: [["fin_sissi_raids"], ["fin_sisu"]],
    effects: [
      {
        kind: "divisions",
        template: "fin_ski_brigade",
        count: 2,
        where: "capital",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_defence_in_depth",
    tree: "FIN",
    x: 43,
    y: 4,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "fin_army_doctrine",
    prereq: [["fin_light_detachments"]],
    effects: [
      {
        kind: "doctrine_mastery",
        domain: "land",
        amount: 30,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_civil_guard_corps",
    tree: "FIN",
    x: 47,
    y: 0,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "fin_army_guard",
    effects: [
      {
        kind: "unlock_decision",
        id: "fin_dec_guard_exercises",
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_lotta_svard",
    tree: "FIN",
    x: 46,
    y: 1,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "fin_army_guard",
    prereq: [["fin_civil_guard_corps"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_lotta_spirit",
      },
      {
        kind: "fire_event",
        id: "fin_ev_lotta_drive",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_parish_ranges",
    tree: "FIN",
    x: 48,
    y: 1,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "fin_army_guard",
    prereq: [["fin_civil_guard_corps"]],
    effects: [
      {
        kind: "equipment",
        type: "infantry_equipment",
        gen: 1,
        count: 2000,
        item: "fin_m28_30",
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_mobilisation_plan",
    tree: "FIN",
    x: 47,
    y: 2,
    days: 70,
    branch: "army",
    icon: "document",
    group: "fin_army_guard",
    prereq: [["fin_lotta_svard"], ["fin_parish_ranges"]],
    effects: [
      {
        kind: "unlock_decision",
        id: "fin_dec_call_civil_guards",
      },
      {
        kind: "law_step",
        law: "conscription",
        steps: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_nine_divisions",
    tree: "FIN",
    x: 47,
    y: 3,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "fin_army_guard",
    prereq: [["fin_mobilisation_plan"]],
    effects: [
      {
        kind: "manpower",
        recruitablePct: 3,
      },
      {
        kind: "army_xp",
        amount: 10,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_guns_for_the_army",
    tree: "FIN",
    x: 49,
    y: 0,
    days: 70,
    branch: "army",
    icon: "artillery",
    group: "fin_army_arms",
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
        count: 30,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_small_tank_arm",
    tree: "FIN",
    x: 49,
    y: 1,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "fin_army_arms",
    prereq: [["fin_guns_for_the_army"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "armour",
        pct: 50,
        uses: 1,
      },
      {
        kind: "equipment",
        type: "light_tank",
        gen: 1,
        count: 16,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_anti_tank_arm",
    tree: "FIN",
    x: 50,
    y: 1,
    days: 70,
    branch: "army",
    icon: "artillery",
    group: "fin_army_arms",
    prereq: [["fin_guns_for_the_army"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "inf_at_1",
        pct: 70,
        uses: 1,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_war_booty",
    tree: "FIN",
    x: 49,
    y: 2,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "fin_army_arms",
    prereq: [["fin_small_tank_arm"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "add_spirit",
        id: "fin_captured_arms",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_coastal_navy",
    tree: "FIN",
    x: 52,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "fin_navy",
    effects: [
      {
        kind: "navy_xp",
        amount: 10,
      },
      {
        kind: "build",
        where: {
          regions: [169],
        },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_armoured_ships",
    tree: "FIN",
    x: 51,
    y: 1,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "fin_navy",
    prereq: [["fin_coastal_navy"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "naval",
        pct: 50,
        uses: 1,
      },
      {
        kind: "navy_xp",
        amount: 10,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_submarine_flotilla",
    tree: "FIN",
    x: 53,
    y: 1,
    days: 70,
    branch: "navy",
    icon: "submarine",
    group: "fin_navy",
    prereq: [["fin_coastal_navy"]],
    effects: [
      {
        kind: "ships",
        cls: "ss",
        gen: 1,
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_gulf_minefields",
    tree: "FIN",
    x: 52,
    y: 2,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "fin_navy",
    prereq: [["fin_armoured_ships"], ["fin_submarine_flotilla"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_mine_barrages",
      },
      {
        kind: "research_bonus",
        tech: "mine_warfare_1",
        pct: 70,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_air_force",
    tree: "FIN",
    x: 55,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "fin_air",
    effects: [
      {
        kind: "build",
        where: "capital",
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
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_fokker_licence",
    tree: "FIN",
    x: 54,
    y: 1,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "fin_air",
    prereq: [["fin_air_force"]],
    effects: [
      {
        kind: "equipment",
        type: "fighter",
        gen: 1,
        count: 30,
        item: "fin_fokker_dxxi",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_blenheim_licence",
    tree: "FIN",
    x: 56,
    y: 1,
    days: 70,
    branch: "air",
    icon: "bomber",
    group: "fin_air",
    prereq: [["fin_air_force"]],
    effects: [
      {
        kind: "equipment",
        type: "bomber",
        gen: 1,
        count: 12,
      },
      {
        kind: "research_bonus",
        tech: "bomber_1",
        pct: 70,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_state_aircraft_factory",
    tree: "FIN",
    x: 55,
    y: 2,
    days: 70,
    branch: "air",
    icon: "factory_mil",
    group: "fin_air",
    prereq: [["fin_fokker_licence"], ["fin_blenheim_licence"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "mil",
        count: 1,
      },
      {
        kind: "research_bonus",
        branch: "air",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_parvi_tactics",
    tree: "FIN",
    x: 54,
    y: 3,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "fin_air",
    prereq: [["fin_state_aircraft_factory"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_parvi_formation",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_myrsky",
    tree: "FIN",
    x: 56,
    y: 3,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "fin_air",
    prereq: [["fin_state_aircraft_factory"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "fighter_2",
        pct: 70,
        uses: 1,
      },
      {
        kind: "equipment",
        type: "fighter",
        gen: 2,
        count: 10,
        item: "fin_vl_myrsky",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_total_defence",
    tree: "FIN",
    x: 40,
    y: 6,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "fin_war",
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "war_support",
        pct: 7,
      },
      {
        kind: "law_step",
        law: "economy",
        steps: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_evacuate_karelia",
    tree: "FIN",
    x: 39,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "map",
    group: "fin_war",
    prereq: [["fin_total_defence"]],
    available: {
      kind: "at_war_with",
      of: {
        tag: "SUN",
      },
    },
    effects: [
      {
        kind: "if",
        cond: {
          not: {
            kind: "has_spirit",
            id: "fin_karelian_evacuees",
          },
        },
        then: [
          {
            kind: "add_spirit",
            id: "fin_karelian_evacuees",
          },
        ],
      },
      {
        kind: "unlock_decision",
        id: "fin_dec_resettle_karelians",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_home_front",
    tree: "FIN",
    x: 41,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "factory",
    group: "fin_war",
    prereq: [["fin_total_defence"]],
    effects: [
      {
        kind: "add_spirit",
        id: "fin_home_front_spirit",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "fin_reparations_industry",
    tree: "FIN",
    x: 40,
    y: 8,
    days: 105,
    branch: "industry",
    icon: "factory_mil",
    group: "fin_war",
    prereq: [["fin_evacuate_karelia", "fin_home_front"]],
    available: {
      all: [
        {
          kind: "flag",
          flag: "fin_winter_war_fought",
        },
        {
          not: {
            kind: "at_war",
          },
        },
      ],
    },
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
        kind: "build",
        where: {
          best: 1,
        },
        building: "civ",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
];

export const FIN_PATH: readonly FocusId[] = [
  "fin_young_republic",
  "fin_heal_the_divide",
  "fin_red_earth_coalition",
  "fin_presidential_electors",
  "fin_nordic_orientation",
  "fin_keep_the_pact",
  "fin_isthmus_survey",
  "fin_civil_guard_corps",
  "fin_green_gold",
  "fin_state_arsenals",
  "fin_lex_kekkonen",
  "fin_aland_plan",
  "fin_nordic_talks",
  "fin_concrete_bunkers",
  "fin_ladoga_line",
  "fin_forest_war_school",
  "fin_motti_doctrine",
  "fin_ski_jaegers",
  "fin_lotta_svard",
  "fin_parish_ranges",
  "fin_paper_mills",
  "fin_timber_exports",
  "fin_suomi_gun",
  "fin_tampella_guns",
  "fin_league_faith",
  "fin_gulf_cooperation",
  "fin_coastal_navy",
  "fin_air_force",
  "fin_fokker_licence",
  "fin_blenheim_licence",
  "fin_imatra_power",
  "fin_outokumpu_copper",
  "fin_petsamo_nickel",
  "fin_moscow_back_channel",
  "fin_refuse_the_bases",
  "fin_granite_obstacles",
  "fin_coastal_batteries",
  "fin_mobilisation_plan",
  "fin_january_engagement",
  "fin_cooperative_finland",
  "fin_republic_for_all",
  "fin_end_shell_hunger",
  "fin_sisu",
  "fin_sissi_raids",
  "fin_armoured_ships",
  "fin_submarine_flotilla",
  "fin_swedish_volunteer_corps",
  "fin_guns_for_the_army",
  "fin_small_tank_arm",
  "fin_anti_tank_arm",
  "fin_port_towns",
  "fin_border_roads",
  "fin_ask_london_paris",
  "fin_american_credit",
  "fin_buy_american_fighters",
  "fin_total_defence",
  "fin_evacuate_karelia",
  "fin_home_front",
  "fin_german_trade",
  "fin_transit_agreement",
  "fin_brothers_in_arms",
  "fin_win_back_karelia",
  "fin_cross_the_old_border",
  "fin_lahti_workshop",
  "fin_bofors_licences",
  "fin_war_industry",
  "fin_state_aircraft_factory",
  "fin_parvi_tactics",
  "fin_myrsky",
  "fin_light_detachments",
  "fin_nine_divisions",
  "fin_gulf_minefields",
  "fin_east_karelian_rule",
  "fin_separate_peace",
  "fin_reparations_industry",
  "fin_salla_railway",
  "fin_rural_power",
  "fin_industrial_south",
  "fin_defence_in_depth",
];

export const FIN_BRANCH_POINTS: readonly BranchPoint[] = [
  {
    id: "fin_bp_course",
    historical: "fin_red_earth_coalition",
    alternatives: ["fin_patriotic_front", "fin_marshal_call"],
    political: true,
  },
  {
    id: "fin_bp_bases",
    historical: "fin_refuse_the_bases",
    alternatives: ["fin_lease_the_islands"],
    political: false,
  },
  {
    id: "fin_bp_ally",
    historical: "fin_brothers_in_arms",
    alternatives: ["fin_western_hope"],
    political: false,
  },
  {
    id: "fin_bp_border",
    historical: "fin_cross_the_old_border",
    alternatives: ["fin_stop_at_the_old_border"],
    political: false,
  },
  {
    id: "fin_bp_endgame",
    historical: "fin_separate_peace",
    alternatives: ["fin_fight_on"],
    political: false,
  },
];
