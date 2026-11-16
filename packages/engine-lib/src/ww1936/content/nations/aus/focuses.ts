// ww229 (design ww227): AUS's national focus tree, its history path and branch points. Generated data only
// (ContentPurity); the texts are ww1936.* keys in en.json and ko.json.
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { nationRouteAi } from "../../helpers";

export const AUS_FOCUSES: readonly FocusDef[] = [
  {
    id: "aus_commonwealth_crossroads",
    tree: "AUS",
    x: 6,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "aus_pol_core",
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
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_sound_finance",
    tree: "AUS",
    x: 6,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "aus_pol_core",
    prereq: [["aus_commonwealth_crossroads"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "aus_depression_scars",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "aus_depression_scars",
            to: "aus_slow_recovery",
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
    id: "aus_westminster_debate",
    tree: "AUS",
    x: 5,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "aus_pol_core",
    prereq: [["aus_sound_finance"]],
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            {
              kind: "is_subject",
            },
            {
              not: {
                kind: "flag",
                flag: "gbr_crown_control",
              },
            },
          ],
        },
        then: [
          {
            kind: "autonomy",
            pct: 10,
          },
        ],
      },
      {
        kind: "fire_event",
        id: "aus_ev_westminster",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_imperial_partner",
    tree: "AUS",
    x: 7,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "handshake",
    group: "aus_pol_core",
    prereq: [["aus_sound_finance"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "GBR",
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
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_uap_coalition",
    tree: "AUS",
    x: 1,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "aus_pol_dem",
    prereq: [["aus_westminster_debate", "aus_imperial_partner"]],
    exclusive: ["aus_labor_reunion", "aus_national_emergency"],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 4,
      },
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "set_flag",
        flag: "aus_uap_years",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_labor_reunion",
    tree: "AUS",
    x: 3,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "handshake",
    group: "aus_pol_dem",
    prereq: [["aus_westminster_debate", "aus_imperial_partner"]],
    exclusive: ["aus_uap_coalition", "aus_national_emergency"],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 5,
      },
      {
        kind: "stability",
        pct: 2,
      },
      {
        kind: "add_advisor_candidate",
        person: "aus_chifley",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_national_register",
    tree: "AUS",
    x: 0,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "aus_pol_dem",
    prereq: [["aus_uap_coalition"]],
    effects: [
      {
        kind: "manpower",
        recruitablePct: 1,
      },
      {
        kind: "pp",
        amount: 25,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_curtin_program",
    tree: "AUS",
    x: 3,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "aus_pol_dem",
    prereq: [["aus_labor_reunion"]],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
      {
        kind: "add_spirit",
        id: "aus_labor_program",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_independents_decide",
    tree: "AUS",
    x: 1,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "aus_pol_dem",
    prereq: [["aus_national_register", "aus_curtin_program"]],
    effects: [
      {
        kind: "fire_event",
        id: "aus_ev_curtin_government",
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
    id: "aus_advisory_war_council",
    tree: "AUS",
    x: 0,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "aus_pol_dem",
    prereq: [["aus_independents_decide"]],
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
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_uniform_tax",
    tree: "AUS",
    x: 2,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "aus_pol_dem",
    prereq: [["aus_independents_decide"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_uniform_taxation",
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_reconstruction",
    tree: "AUS",
    x: 1,
    y: 7,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "aus_pol_dem",
    prereq: [["aus_advisory_war_council", "aus_uniform_tax"]],
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
        kind: "stability",
        pct: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_dem_free_press",
    tree: "AUS",
    x: 0,
    y: 9,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "aus_pol_dem",
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
    id: "aus_dem_union_halls",
    tree: "AUS",
    x: 0,
    y: 10,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "aus_pol_dem",
    prereq: [["aus_dem_free_press"]],
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
    id: "aus_dem_restore_parliament",
    tree: "AUS",
    x: 0,
    y: 11,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "aus_pol_dem",
    prereq: [["aus_dem_union_halls"]],
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
    id: "aus_national_emergency",
    tree: "AUS",
    x: 5,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "shield",
    group: "aus_pol_neu",
    prereq: [["aus_westminster_debate", "aus_imperial_partner"]],
    exclusive: ["aus_uap_coalition", "aus_labor_reunion"],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_national_government",
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_emergency_powers",
    tree: "AUS",
    x: 5,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "aus_pol_neu",
    prereq: [["aus_national_emergency"]],
    effects: [
      {
        kind: "elections",
        postponeDays: 180,
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_hughes_returns",
    tree: "AUS",
    x: 5,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "aus_pol_neu",
    prereq: [["aus_emergency_powers"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "aus_hughes",
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
      {
        kind: "war_support",
        pct: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_neu_country_movement",
    tree: "AUS",
    x: 6,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "wheat",
    group: "aus_pol_neu",
    available: {
      not: {
        kind: "ruling",
        ideology: "neutral",
      },
    },
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 5,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: nationRouteAi("neutral", 1),
  },
  {
    id: "aus_neu_strong_man",
    tree: "AUS",
    x: 5,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "aus_pol_neu",
    prereq: [["aus_hughes_returns", "aus_neu_country_movement"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
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
    id: "aus_neu_national_authority",
    tree: "AUS",
    x: 5,
    y: 8,
    days: 70,
    branch: "politics",
    icon: "shield",
    group: "aus_pol_neu",
    prereq: [["aus_neu_strong_man"]],
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
    id: "aus_com_militant_unions",
    tree: "AUS",
    x: 8,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "aus_pol_com",
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
        pp: 5,
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: nationRouteAi("communist", 1),
  },
  {
    id: "aus_com_waterfront",
    tree: "AUS",
    x: 8,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "ship",
    group: "aus_pol_com",
    prereq: [["aus_com_militant_unions"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 4,
      },
      {
        kind: "war_support",
        pct: -2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_com_legal_party",
    tree: "AUS",
    x: 7,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "aus_pol_com",
    prereq: [["aus_com_waterfront"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 4,
      },
      {
        kind: "stability",
        pct: -2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_com_general_strike",
    tree: "AUS",
    x: 8,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "factory",
    group: "aus_pol_com",
    prereq: [["aus_com_legal_party"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
      {
        kind: "stability",
        pct: -3,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "aus_com_workers_commonwealth",
    tree: "AUS",
    x: 8,
    y: 8,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "aus_pol_com",
    prereq: [["aus_com_general_strike"]],
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
    id: "aus_fas_new_guard",
    tree: "AUS",
    x: 10,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "eagle_plain",
    group: "aus_pol_fas",
    available: {
      not: {
        kind: "ruling",
        ideology: "fascist",
      },
    },
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 5,
      },
      {
        kind: "stability",
        pct: -2,
      },
      {
        kind: "fire_event",
        id: "aus_ev_new_guard_rally",
      },
    ],
    ai: nationRouteAi("fascist", 1),
  },
  {
    id: "aus_fas_australia_first",
    tree: "AUS",
    x: 9,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "aus_pol_fas",
    prereq: [["aus_fas_new_guard"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 4,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_fas_the_publicist",
    tree: "AUS",
    x: 10,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "aus_pol_fas",
    prereq: [["aus_fas_australia_first"]],
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
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
    id: "aus_fas_march_on_canberra",
    tree: "AUS",
    x: 10,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "sword",
    group: "aus_pol_fas",
    prereq: [["aus_fas_the_publicist"]],
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
    id: "aus_crown_loyal_leagues",
    tree: "AUS",
    x: 12,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "aus_pol_crown",
    available: {
      not: {
        kind: "ruling",
        ideology: "neutral",
      },
    },
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
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
    ai: nationRouteAi("neutral", 1),
  },
  {
    id: "aus_crown_royal_governor",
    tree: "AUS",
    x: 12,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "aus_pol_crown",
    prereq: [["aus_crown_loyal_leagues"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
      {
        kind: "stability",
        pct: 2,
      },
      {
        kind: "add_advisor_candidate",
        person: "aus_gloucester",
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "aus_crown_takes_charge",
    tree: "AUS",
    x: 12,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "shield",
    group: "aus_pol_crown",
    prereq: [["aus_crown_royal_governor"]],
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
    id: "aus_crown_kingdom",
    tree: "AUS",
    x: 12,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "aus_pol_crown",
    prereq: [["aus_crown_takes_charge"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "set_name",
        key: "ww1936.rename.kingdom_of_australia",
      },
      {
        kind: "add_spirit",
        id: "aus_crown_rule",
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
    id: "aus_defence_talks",
    tree: "AUS",
    x: 15,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "aus_dip_empire",
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 15,
        days: 365,
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
    id: "aus_trust_singapore",
    tree: "AUS",
    x: 14,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "ship",
    group: "aus_dip_empire",
    prereq: [["aus_defence_talks"]],
    exclusive: ["aus_self_reliance"],
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
        kind: "unlock_decision",
        id: "aus_dec_empire_1",
      },
      {
        kind: "set_flag",
        flag: "aus_singapore_trusted",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_self_reliance",
    tree: "AUS",
    x: 16,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    group: "aus_dip_empire",
    prereq: [["aus_defence_talks"]],
    exclusive: ["aus_trust_singapore"],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "aus_singapore_strategy",
        },
        then: [
          {
            kind: "remove_spirit",
            id: "aus_singapore_strategy",
          },
        ],
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_pacific_1",
      },
      {
        kind: "war_support",
        pct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_imperial_preference",
    tree: "AUS",
    x: 15,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "wheat",
    group: "aus_dip_empire",
    prereq: [["aus_trust_singapore", "aus_self_reliance"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_empire_trade",
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
      base: 10,
    },
  },
  {
    id: "aus_empire_together",
    tree: "AUS",
    x: 14,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "flag",
    group: "aus_dip_empire",
    prereq: [["aus_imperial_preference"]],
    exclusive: ["aus_look_to_america"],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 30,
        days: 365,
      },
      {
        kind: "war_support",
        pct: 3,
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_empire_1",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_own_legations",
    tree: "AUS",
    x: 18,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "aus_dip_pacific",
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "opinion",
        who: {
          tag: "JPN",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "opinion",
        who: {
          tag: "CHN",
        },
        of: "self",
        value: 10,
        days: 365,
      },
      {
        kind: "pp",
        amount: 15,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_trade_diversion",
    tree: "AUS",
    x: 17,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "scales",
    group: "aus_dip_pacific",
    prereq: [["aus_own_legations"]],
    effects: [
      {
        kind: "fire_event",
        id: "aus_ev_trade_diversion",
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
    id: "aus_washington_legation",
    tree: "AUS",
    x: 19,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "aus_dip_pacific",
    prereq: [["aus_own_legations"]],
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
        kind: "add_advisor_candidate",
        person: "aus_casey",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_iron_ore_embargo",
    tree: "AUS",
    x: 17,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "steel",
    group: "aus_dip_pacific",
    prereq: [["aus_trade_diversion"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "JPN",
        },
        of: "self",
        value: -15,
        days: 365,
      },
      {
        kind: "resource",
        where: {
          regions: [1276],
        },
        res: "steel",
        amount: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_anzac_pact",
    tree: "AUS",
    x: 19,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "aus_dip_pacific",
    prereq: [["aus_washington_legation"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "NZL",
        },
        of: "self",
        value: 25,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "NZL",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "set_flag",
        flag: "aus_anzac_pact",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_look_to_america",
    tree: "AUS",
    x: 18,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "compass",
    group: "aus_dip_pacific",
    prereq: [["aus_washington_legation"], ["aus_imperial_preference"]],
    exclusive: ["aus_empire_together"],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 30,
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
        kind: "if",
        cond: {
          all: [
            {
              kind: "is_subject",
            },
            {
              not: {
                kind: "flag",
                flag: "gbr_crown_control",
              },
            },
          ],
        },
        then: [
          {
            kind: "autonomy",
            pct: 10,
          },
        ],
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_pacific_1",
      },
      {
        kind: "fire_event",
        id: "aus_ev_look_to_america",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_pacific_war_council",
    tree: "AUS",
    x: 18,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "aus_dip_pacific",
    prereq: [["aus_look_to_america"]],
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 20,
        days: 365,
      },
      {
        kind: "unlock_decision",
        id: "aus_dec_pacific_2",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_near_north",
    tree: "AUS",
    x: 21,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "aus_dip_sphere",
    effects: [
      {
        kind: "set_flag",
        flag: "aus_near_north",
      },
      {
        kind: "pp",
        amount: 25,
      },
      {
        kind: "opinion",
        who: {
          tag: "NZL",
        },
        of: "self",
        value: 10,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_mandate_works",
    tree: "AUS",
    x: 20,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "road",
    group: "aus_dip_sphere",
    prereq: [["aus_near_north"]],
    effects: [
      {
        kind: "infra",
        where: {
          group: "aus_new_guinea",
        },
        amount: 1,
      },
      {
        kind: "build",
        where: {
          group: "aus_new_guinea",
        },
        building: "naval_base",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_tasman_union",
    tree: "AUS",
    x: 22,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "aus_dip_sphere",
    prereq: [["aus_near_north"]],
    effects: [
      {
        kind: "unlock_decision",
        id: "aus_dec_tasman_union",
      },
      {
        kind: "opinion",
        who: {
          tag: "NZL",
        },
        of: "self",
        value: 20,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_australasia",
    tree: "AUS",
    x: 22,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "flag",
    group: "aus_dip_sphere",
    prereq: [["aus_tasman_union"]],
    available: {
      all: [
        {
          kind: "flag",
          flag: "aus_nzl_agreed",
        },
        {
          kind: "exists",
          who: {
            tag: "NZL",
          },
        },
      ],
    },
    effects: [
      {
        kind: "annex",
        target: {
          tag: "NZL",
        },
        units: "transfer",
      },
      {
        kind: "set_name",
        key: "ww1936.rename.australasia",
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
    id: "aus_timor_question",
    tree: "AUS",
    x: 20,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "aus_dip_sphere",
    prereq: [["aus_mandate_works"]],
    available: {
      all: [
        {
          kind: "at_war",
        },
        {
          not: {
            kind: "owns_group",
            group: "aus_timor",
          },
        },
      ],
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          ownerOf: "aus_timor",
        },
        type: "claim",
        group: "aus_timor",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_dutch_new_guinea",
    tree: "AUS",
    x: 20,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "aus_dip_sphere",
    prereq: [["aus_timor_question"]],
    available: {
      all: [
        {
          any: [
            {
              kind: "capitulated",
              who: {
                tag: "NLD",
              },
            },
            {
              not: {
                kind: "exists",
                who: {
                  tag: "NLD",
                },
              },
            },
          ],
        },
        {
          not: {
            kind: "owns_group",
            group: "aus_dutch_new_guinea",
          },
        },
      ],
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          ownerOf: "aus_dutch_new_guinea",
        },
        type: "claim",
        group: "aus_dutch_new_guinea",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_noumea",
    tree: "AUS",
    x: 21,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "ship",
    group: "aus_dip_sphere",
    prereq: [["aus_near_north"]],
    available: {
      all: [
        {
          any: [
            {
              kind: "capitulated",
              who: {
                tag: "FRA",
              },
            },
            {
              not: {
                kind: "exists",
                who: {
                  tag: "FRA",
                },
              },
            },
          ],
        },
        {
          not: {
            kind: "owns_group",
            group: "aus_new_caledonia",
          },
        },
      ],
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          ownerOf: "aus_new_caledonia",
        },
        type: "claim",
        group: "aus_new_caledonia",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_pacific_power",
    tree: "AUS",
    x: 21,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "star_plain",
    group: "aus_dip_sphere",
    prereq: [["aus_australasia", "aus_dutch_new_guinea", "aus_noumea"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_pacific_power",
      },
      {
        kind: "pp",
        amount: 30,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_bhp_newcastle",
    tree: "AUS",
    x: 25,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "steel",
    group: "aus_ind_steel",
    effects: [
      {
        kind: "resource",
        where: {
          regions: [1283],
        },
        res: "steel",
        amount: 2,
      },
      {
        kind: "build",
        where: {
          regions: [1283],
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
    id: "aus_whyalla",
    tree: "AUS",
    x: 24,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "aus_ind_steel",
    prereq: [["aus_bhp_newcastle"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [1276],
        },
        res: "steel",
        amount: 2,
      },
      {
        kind: "build",
        where: {
          regions: [1276],
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
    id: "aus_port_kembla",
    tree: "AUS",
    x: 26,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "aus_ind_steel",
    prereq: [["aus_bhp_newcastle"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [1283],
        },
        building: "smelter",
        count: 1,
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
  {
    id: "aus_coal_power",
    tree: "AUS",
    x: 25,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "aus_ind_steel",
    prereq: [["aus_whyalla", "aus_port_kembla"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [1283],
        },
        res: "coal",
        amount: 2,
      },
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "power_plant",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_steel_nation",
    tree: "AUS",
    x: 25,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "steel",
    group: "aus_ind_steel",
    prereq: [["aus_coal_power"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_steel_mills",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_munitions_board",
    tree: "AUS",
    x: 28,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "aus_ind_munitions",
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
    id: "aus_lithgow_arsenal",
    tree: "AUS",
    x: 27,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "infantry",
    group: "aus_ind_munitions",
    prereq: [["aus_munitions_board"]],
    effects: [
      {
        kind: "equipment",
        type: "infantry_equipment",
        gen: 1,
        count: 2000,
      },
      {
        kind: "build",
        where: {
          regions: [1283],
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
    id: "aus_maribyrnong",
    tree: "AUS",
    x: 29,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "artillery",
    group: "aus_ind_munitions",
    prereq: [["aus_munitions_board"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [1305],
        },
        building: "mil",
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_director_of_munitions",
    tree: "AUS",
    x: 28,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "aus_ind_munitions",
    prereq: [["aus_lithgow_arsenal", "aus_maribyrnong"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "aus_lewis",
      },
      {
        kind: "add_spirit",
        id: "aus_munitions_directorate",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_owen_gun",
    tree: "AUS",
    x: 27,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "infantry",
    group: "aus_ind_munitions",
    prereq: [["aus_director_of_munitions"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "inf_eq_2",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_munitions_annexes",
    tree: "AUS",
    x: 29,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "aus_ind_munitions",
    prereq: [["aus_director_of_munitions"]],
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
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_war_industry",
    tree: "AUS",
    x: 28,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "aus_ind_munitions",
    prereq: [["aus_owen_gun", "aus_munitions_annexes"]],
    effects: [
      {
        kind: "law_step",
        law: "economy",
        steps: 1,
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
    id: "aus_motor_industry",
    tree: "AUS",
    x: 30,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "road",
    group: "aus_ind_motor",
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
        kind: "research_bonus",
        branch: "armour",
        pct: 40,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_gmh_war_work",
    tree: "AUS",
    x: 30,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "aus_ind_motor",
    prereq: [["aus_motor_industry"]],
    effects: [
      {
        kind: "equipment",
        type: "motorized",
        gen: 1,
        count: 300,
      },
      {
        kind: "build",
        where: {
          regions: [1305],
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
    id: "aus_cruiser_tank",
    tree: "AUS",
    x: 31,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "tank",
    group: "aus_ind_motor",
    prereq: [["aus_gmh_war_work"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "medium_tank_1",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_chullora_shops",
    tree: "AUS",
    x: 31,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "tank",
    group: "aus_ind_motor",
    prereq: [["aus_cruiser_tank"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [1283],
        },
        building: "mil",
        count: 1,
      },
      {
        kind: "equipment",
        type: "medium_tank",
        gen: 1,
        count: 20,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_csir",
    tree: "AUS",
    x: 33,
    y: 0,
    days: 70,
    branch: "research",
    icon: "flask",
    group: "aus_ind_science",
    effects: [
      {
        kind: "research_bonus",
        branch: "industry",
        pct: 50,
        uses: 1,
      },
      {
        kind: "add_advisor_candidate",
        person: "aus_rivett",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_tungsten",
    tree: "AUS",
    x: 32,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "aus_ind_science",
    prereq: [["aus_csir"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [1320],
        },
        res: "tungsten",
        amount: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_radiophysics",
    tree: "AUS",
    x: 33,
    y: 1,
    days: 70,
    branch: "research",
    icon: "radio",
    group: "aus_ind_science",
    prereq: [["aus_csir"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "electronics",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_shale_oil",
    tree: "AUS",
    x: 32,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "oil",
    group: "aus_ind_science",
    prereq: [["aus_tungsten"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [1283],
        },
        res: "oil",
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_militia_camps",
    tree: "AUS",
    x: 36,
    y: 0,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "aus_army_force",
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "manpower",
        recruitablePct: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_second_aif",
    tree: "AUS",
    x: 35,
    y: 1,
    days: 70,
    branch: "army",
    icon: "flag",
    group: "aus_army_force",
    prereq: [["aus_militia_camps"]],
    exclusive: ["aus_home_army"],
    effects: [
      {
        kind: "divisions",
        template: "dom_infantry_division",
        count: 2,
        where: "capital",
      },
      {
        kind: "war_support",
        pct: 3,
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
      base: 10,
    },
  },
  {
    id: "aus_home_army",
    tree: "AUS",
    x: 37,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "aus_army_force",
    prereq: [["aus_militia_camps"]],
    exclusive: ["aus_second_aif"],
    effects: [
      {
        kind: "build",
        where: {
          coastal: true,
          n: 2,
        },
        building: "coastal_fort",
        count: 2,
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
    id: "aus_sixth_division",
    tree: "AUS",
    x: 35,
    y: 2,
    days: 70,
    branch: "army",
    icon: "ship",
    group: "aus_army_force",
    prereq: [["aus_second_aif"]],
    effects: [
      {
        kind: "army_xp",
        amount: 15,
      },
      {
        kind: "add_spirit",
        id: "aus_aif_spirit",
      },
      {
        kind: "fire_event",
        id: "aus_ev_convoy_sails",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_militia_training",
    tree: "AUS",
    x: 36,
    y: 2,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "aus_army_force",
    prereq: [["aus_second_aif", "aus_home_army"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "aus_citizen_militia",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "aus_citizen_militia",
            to: "aus_trained_militia",
          },
        ],
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
    id: "aus_overseas_service",
    tree: "AUS",
    x: 36,
    y: 3,
    days: 70,
    branch: "army",
    icon: "map",
    group: "aus_army_force",
    prereq: [["aus_militia_training"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "law_step",
        law: "conscription",
        steps: 1,
      },
      {
        kind: "stability",
        pct: -3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_armoured_division",
    tree: "AUS",
    x: 37,
    y: 3,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "aus_army_force",
    prereq: [["aus_militia_training"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "armour",
        pct: 50,
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
    id: "aus_staff_college",
    tree: "AUS",
    x: 39,
    y: 0,
    days: 70,
    branch: "army",
    icon: "document",
    group: "aus_army_craft",
    effects: [
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
    id: "aus_rats_of_tobruk",
    tree: "AUS",
    x: 38,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "aus_army_craft",
    prereq: [["aus_staff_college"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_tobruk_defence",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_bardia",
    tree: "AUS",
    x: 40,
    y: 1,
    days: 70,
    branch: "army",
    icon: "sword",
    group: "aus_army_craft",
    prereq: [["aus_staff_college"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_set_piece",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_jungle_lessons",
    tree: "AUS",
    x: 39,
    y: 2,
    days: 70,
    branch: "army",
    icon: "map",
    group: "aus_army_craft",
    prereq: [["aus_rats_of_tobruk", "aus_bardia"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_jungle_craft",
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
    id: "aus_canungra",
    tree: "AUS",
    x: 39,
    y: 3,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "aus_army_craft",
    prereq: [["aus_jungle_lessons"]],
    effects: [
      {
        kind: "unlock_template",
        template: "aus_jungle_division",
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
    id: "aus_independent_companies",
    tree: "AUS",
    x: 38,
    y: 4,
    days: 70,
    branch: "army",
    icon: "sword",
    group: "aus_army_craft",
    prereq: [["aus_canungra"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_independent_companies",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_jungle_divisions",
    tree: "AUS",
    x: 40,
    y: 4,
    days: 70,
    branch: "army",
    icon: "medal",
    group: "aus_army_craft",
    prereq: [["aus_canungra"]],
    effects: [
      {
        kind: "divisions",
        template: "aus_jungle_division",
        count: 2,
        where: "capital",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_northern_defence",
    tree: "AUS",
    x: 42,
    y: 0,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "aus_army_north",
    effects: [
      {
        kind: "build",
        where: {
          group: "darwin",
        },
        building: "naval_base",
        count: 1,
      },
      {
        kind: "build",
        where: {
          group: "darwin",
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
    id: "aus_north_south_road",
    tree: "AUS",
    x: 41,
    y: 1,
    days: 70,
    branch: "army",
    icon: "road",
    group: "aus_army_north",
    prereq: [["aus_northern_defence"]],
    effects: [
      {
        kind: "rail",
        where: {
          regions: [1194, 1218],
        },
        amount: 1,
      },
      {
        kind: "infra",
        where: {
          group: "darwin",
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_brisbane_line",
    tree: "AUS",
    x: 43,
    y: 1,
    days: 70,
    branch: "army",
    icon: "map",
    group: "aus_army_north",
    prereq: [["aus_northern_defence"]],
    effects: [
      {
        kind: "fort",
        where: {
          regions: [1233],
        },
        amount: 2,
      },
      {
        kind: "fire_event",
        id: "aus_ev_brisbane_line",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_observer_unit",
    tree: "AUS",
    x: 42,
    y: 2,
    days: 70,
    branch: "army",
    icon: "tower",
    group: "aus_army_north",
    prereq: [["aus_north_south_road", "aus_brisbane_line"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_northern_watch",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_fortress_darwin",
    tree: "AUS",
    x: 42,
    y: 3,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "aus_army_north",
    prereq: [["aus_observer_unit"]],
    effects: [
      {
        kind: "fort",
        where: {
          group: "darwin",
        },
        amount: 2,
      },
      {
        kind: "build",
        where: {
          group: "darwin",
        },
        building: "anti_air",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_ran_squadron",
    tree: "AUS",
    x: 46,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "aus_navy",
    effects: [
      {
        kind: "navy_xp",
        amount: 10,
      },
      {
        kind: "build",
        where: {
          regions: [1283],
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
    id: "aus_cockatoo_island",
    tree: "AUS",
    x: 45,
    y: 1,
    days: 70,
    branch: "navy",
    icon: "factory",
    group: "aus_navy",
    prereq: [["aus_ran_squadron"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [1283],
        },
        building: "dock",
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_leander_cruisers",
    tree: "AUS",
    x: 47,
    y: 1,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "aus_navy",
    prereq: [["aus_ran_squadron"]],
    effects: [
      {
        kind: "ships",
        cls: "cl",
        gen: 2,
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_tribal_destroyers",
    tree: "AUS",
    x: 45,
    y: 2,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "aus_navy",
    prereq: [["aus_cockatoo_island"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "dd_3",
        pct: 50,
        uses: 1,
      },
      {
        kind: "ships",
        cls: "dd",
        gen: 2,
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_coastwatchers",
    tree: "AUS",
    x: 47,
    y: 2,
    days: 70,
    branch: "navy",
    icon: "radio",
    group: "aus_navy",
    prereq: [["aus_leander_cruisers"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_coastwatch",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_graving_dock",
    tree: "AUS",
    x: 45,
    y: 3,
    days: 70,
    branch: "navy",
    icon: "factory",
    group: "aus_navy",
    prereq: [["aus_tribal_destroyers"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [1283],
        },
        building: "dock",
        count: 1,
      },
      {
        kind: "add_spirit",
        id: "aus_graving_dock",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_bathurst_corvettes",
    tree: "AUS",
    x: 46,
    y: 3,
    days: 70,
    branch: "navy",
    icon: "submarine",
    group: "aus_navy",
    prereq: [["aus_tribal_destroyers", "aus_coastwatchers"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "sonar_1",
        pct: 50,
        uses: 1,
      },
      {
        kind: "ships",
        cls: "dd",
        gen: 1,
        count: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_island_bases",
    tree: "AUS",
    x: 47,
    y: 3,
    days: 70,
    branch: "navy",
    icon: "map",
    group: "aus_navy",
    prereq: [["aus_coastwatchers"]],
    effects: [
      {
        kind: "build",
        where: {
          group: "aus_new_guinea",
        },
        building: "naval_base",
        count: 1,
      },
      {
        kind: "navy_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_two_ocean_navy",
    tree: "AUS",
    x: 46,
    y: 4,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "aus_navy",
    prereq: [
      ["aus_graving_dock", "aus_bathurst_corvettes", "aus_island_bases"],
    ],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_two_oceans",
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
    id: "aus_raaf_expansion",
    tree: "AUS",
    x: 51,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "aus_air",
    effects: [
      {
        kind: "build",
        where: {
          best: 2,
        },
        building: "air_base",
        count: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_cac",
    tree: "AUS",
    x: 50,
    y: 1,
    days: 70,
    branch: "air",
    icon: "factory",
    group: "aus_air",
    prereq: [["aus_raaf_expansion"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [1305],
        },
        building: "mil",
        count: 1,
      },
      {
        kind: "add_advisor_candidate",
        person: "aus_wackett",
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
    id: "aus_eats",
    tree: "AUS",
    x: 52,
    y: 1,
    days: 70,
    branch: "air",
    icon: "research",
    group: "aus_air",
    prereq: [["aus_raaf_expansion"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_air_training",
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
      base: 10,
    },
  },
  {
    id: "aus_wirraway",
    tree: "AUS",
    x: 50,
    y: 2,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "aus_air",
    prereq: [["aus_cac"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "cas_1",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_boomerang",
    tree: "AUS",
    x: 50,
    y: 3,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "aus_air",
    prereq: [["aus_wirraway"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "fighter_2",
        pct: 50,
        uses: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_beaufort",
    tree: "AUS",
    x: 51,
    y: 3,
    days: 70,
    branch: "air",
    icon: "bomber",
    group: "aus_air",
    prereq: [["aus_wirraway"]],
    effects: [
      {
        kind: "research_bonus",
        tech: "naval_bomber_1",
        pct: 60,
        uses: 1,
      },
      {
        kind: "build",
        where: {
          regions: [1283],
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
    id: "aus_squadrons_overseas",
    tree: "AUS",
    x: 52,
    y: 2,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "aus_air",
    prereq: [["aus_eats"]],
    effects: [
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
        kind: "add_spirit",
        id: "aus_raaf_overseas",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_tactical_air_force",
    tree: "AUS",
    x: 52,
    y: 4,
    days: 70,
    branch: "air",
    icon: "bomber",
    group: "aus_air",
    prereq: [["aus_boomerang", "aus_beaufort", "aus_squadrons_overseas"]],
    effects: [
      {
        kind: "add_spirit",
        id: "aus_tactical_air",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_war_book",
    tree: "AUS",
    x: 57,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "aus_war",
    effects: [
      {
        kind: "pp",
        amount: 25,
      },
      {
        kind: "war_support",
        pct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_also_at_war",
    tree: "AUS",
    x: 56,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "aus_war",
    prereq: [["aus_war_book"]],
    available: {
      kind: "at_war",
      who: {
        tag: "GBR",
      },
    },
    effects: [
      {
        kind: "war_support",
        pct: 5,
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
    id: "aus_manpower_directorate",
    tree: "AUS",
    x: 58,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "infantry",
    group: "aus_war",
    prereq: [["aus_war_book"]],
    effects: [
      {
        kind: "manpower",
        recruitablePct: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_bring_them_home",
    tree: "AUS",
    x: 55,
    y: 2,
    days: 70,
    branch: "army",
    icon: "ship",
    group: "aus_war",
    prereq: [["aus_also_at_war"]],
    exclusive: ["aus_divisions_to_burma"],
    available: {
      kind: "at_war_with",
      of: {
        tag: "JPN",
      },
    },
    effects: [
      {
        kind: "war_support",
        pct: 5,
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
        kind: "divisions",
        template: "dom_infantry_division",
        count: 2,
        where: "capital",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_divisions_to_burma",
    tree: "AUS",
    x: 57,
    y: 2,
    days: 70,
    branch: "army",
    icon: "map",
    group: "aus_war",
    prereq: [["aus_also_at_war"]],
    exclusive: ["aus_bring_them_home"],
    available: {
      kind: "at_war_with",
      of: {
        tag: "JPN",
      },
    },
    effects: [
      {
        kind: "opinion",
        who: {
          tag: "GBR",
        },
        of: "self",
        value: 25,
        days: 365,
      },
      {
        kind: "army_xp",
        amount: 15,
      },
      {
        kind: "stability",
        pct: -3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_women_at_war",
    tree: "AUS",
    x: 59,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "aus_war",
    prereq: [["aus_manpower_directorate"]],
    effects: [
      {
        kind: "manpower",
        recruitablePct: 2,
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
    id: "aus_allied_base",
    tree: "AUS",
    x: 55,
    y: 3,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "aus_war",
    prereq: [["aus_bring_them_home"]],
    available: {
      kind: "at_war_with",
      of: {
        tag: "JPN",
      },
    },
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
        kind: "add_spirit",
        id: "aus_allied_base",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_total_mobilisation",
    tree: "AUS",
    x: 58,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "factory_mil",
    group: "aus_war",
    prereq: [
      [
        "aus_manpower_directorate",
        "aus_bring_them_home",
        "aus_divisions_to_burma",
      ],
    ],
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
        kind: "add_spirit",
        id: "aus_total_war",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "aus_up_the_islands",
    tree: "AUS",
    x: 56,
    y: 4,
    days: 70,
    branch: "army",
    icon: "medal",
    group: "aus_war",
    prereq: [["aus_allied_base", "aus_total_mobilisation"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "army_xp",
        amount: 20,
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
];

export const AUS_PATH: readonly FocusId[] = [
  "aus_commonwealth_crossroads",
  "aus_sound_finance",
  "aus_imperial_partner",
  "aus_westminster_debate",
  "aus_uap_coalition",
  "aus_defence_talks",
  "aus_trust_singapore",
  "aus_raaf_expansion",
  "aus_cac",
  "aus_munitions_board",
  "aus_bhp_newcastle",
  "aus_own_legations",
  "aus_trade_diversion",
  "aus_militia_camps",
  "aus_ran_squadron",
  "aus_leander_cruisers",
  "aus_iron_ore_embargo",
  "aus_imperial_preference",
  "aus_wirraway",
  "aus_port_kembla",
  "aus_whyalla",
  "aus_csir",
  "aus_national_register",
  "aus_war_book",
  "aus_northern_defence",
  "aus_eats",
  "aus_also_at_war",
  "aus_second_aif",
  "aus_sixth_division",
  "aus_staff_college",
  "aus_bardia",
  "aus_lithgow_arsenal",
  "aus_maribyrnong",
  "aus_director_of_munitions",
  "aus_washington_legation",
  "aus_cockatoo_island",
  "aus_coastwatchers",
  "aus_motor_industry",
  "aus_gmh_war_work",
  "aus_radiophysics",
  "aus_tungsten",
  "aus_shale_oil",
  "aus_coal_power",
  "aus_rats_of_tobruk",
  "aus_squadrons_overseas",
  "aus_militia_training",
  "aus_cruiser_tank",
  "aus_armoured_division",
  "aus_independents_decide",
  "aus_look_to_america",
  "aus_bring_them_home",
  "aus_allied_base",
  "aus_manpower_directorate",
  "aus_munitions_annexes",
  "aus_owen_gun",
  "aus_north_south_road",
  "aus_brisbane_line",
  "aus_tribal_destroyers",
  "aus_bathurst_corvettes",
  "aus_beaufort",
  "aus_boomerang",
  "aus_uniform_tax",
  "aus_advisory_war_council",
  "aus_total_mobilisation",
  "aus_women_at_war",
  "aus_overseas_service",
  "aus_jungle_lessons",
  "aus_canungra",
  "aus_jungle_divisions",
  "aus_independent_companies",
  "aus_observer_unit",
  "aus_fortress_darwin",
  "aus_pacific_war_council",
  "aus_war_industry",
  "aus_chullora_shops",
  "aus_steel_nation",
  "aus_island_bases",
  "aus_graving_dock",
  "aus_two_ocean_navy",
  "aus_tactical_air_force",
  "aus_up_the_islands",
  "aus_anzac_pact",
  "aus_reconstruction",
];

export const AUS_BRANCH_POINTS: readonly BranchPoint[] = [
  {
    id: "aus_bp_government",
    historical: "aus_uap_coalition",
    alternatives: ["aus_labor_reunion", "aus_national_emergency"],
    political: true,
  },
  {
    id: "aus_bp_singapore",
    historical: "aus_trust_singapore",
    alternatives: ["aus_self_reliance"],
    political: false,
  },
  {
    id: "aus_bp_aif",
    historical: "aus_second_aif",
    alternatives: ["aus_home_army"],
    political: false,
  },
  {
    id: "aus_bp_ally",
    historical: "aus_look_to_america",
    alternatives: ["aus_empire_together"],
    political: false,
  },
  {
    id: "aus_bp_recall",
    historical: "aus_bring_them_home",
    alternatives: ["aus_divisions_to_burma"],
    political: false,
  },
];
