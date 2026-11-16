// ww229 (design ww227): MCK's national focus tree, its history path and branch points. Generated data only
// (ContentPurity); the texts are ww1936.* keys in en.json and ko.json.
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { nationRouteAi } from "../../helpers";

export const MCK_FOCUSES: readonly FocusDef[] = [
  {
    id: "mck_kangde_throne",
    tree: "MCK",
    x: 12,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "mck_pol_core",
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
    id: "mck_general_affairs_board",
    tree: "MCK",
    x: 12,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "mck_pol_core",
    prereq: [["mck_kangde_throne"]],
    effects: [
      {
        kind: "pp",
        amount: 30,
      },
      {
        kind: "add_advisor_candidate",
        person: "mck_hoshino_naoki",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_concordia_association",
    tree: "MCK",
    x: 12,
    y: 2,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "mck_pol_core",
    prereq: [["mck_general_affairs_board"]],
    effects: [
      {
        kind: "stability",
        pct: 3,
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
    id: "mck_question_of_the_state",
    tree: "MCK",
    x: 12,
    y: 3,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "mck_pol_core",
    prereq: [["mck_concordia_association"]],
    effects: [
      {
        kind: "pp",
        amount: 25,
      },
      {
        kind: "stability",
        pct: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_kyowakai_state",
    tree: "MCK",
    x: 10,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "mck_pol_concordia",
    prereq: [["mck_question_of_the_state"]],
    exclusive: ["mck_throne_asserts", "mck_officers_council"],
    effects: [
      {
        kind: "add_spirit",
        id: "mck_concordia_state",
      },
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 5,
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
    id: "mck_five_races_campaign",
    tree: "MCK",
    x: 9,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "mck_pol_concordia",
    prereq: [["mck_kyowakai_state"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "mck_five_races",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "mck_five_races",
            to: "mck_five_races_preached",
          },
        ],
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
    id: "mck_youth_corps",
    tree: "MCK",
    x: 11,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "infantry",
    group: "mck_pol_concordia",
    prereq: [["mck_kyowakai_state"]],
    effects: [
      {
        kind: "war_support",
        pct: 3,
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
    id: "mck_national_foundation_shrine",
    tree: "MCK",
    x: 9,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "mck_pol_concordia",
    prereq: [["mck_five_races_campaign"]],
    effects: [
      {
        kind: "fire_event",
        id: "mck_ev_imperial_rescript",
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
    id: "mck_one_party_order",
    tree: "MCK",
    x: 11,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "shield",
    group: "mck_pol_concordia",
    prereq: [["mck_youth_corps"]],
    effects: [
      {
        kind: "fire_event",
        id: "mck_ev_concordia_congress",
      },
      {
        kind: "popularity",
        ideology: "fascist",
        pp: 4,
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
    id: "mck_imperial_visit_tokyo",
    tree: "MCK",
    x: 10,
    y: 7,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_pol_concordia",
    prereq: [["mck_national_foundation_shrine", "mck_one_party_order"]],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "autonomy",
        pct: -5,
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
    id: "mck_total_concordia",
    tree: "MCK",
    x: 10,
    y: 8,
    days: 105,
    branch: "politics",
    icon: "flag",
    group: "mck_pol_concordia",
    prereq: [["mck_imperial_visit_tokyo"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "mck_concordia_state",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "mck_concordia_state",
            to: "mck_concordia_total",
          },
        ],
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
    id: "mck_throne_asserts",
    tree: "MCK",
    x: 14,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "mck_pol_qing",
    prereq: [["mck_question_of_the_state"]],
    exclusive: ["mck_kyowakai_state", "mck_officers_council"],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 4,
      },
      {
        kind: "fire_event",
        id: "mck_ev_court_intrigue",
      },
    ],
    ai: nationRouteAi("neutral", 2),
  },
  {
    id: "mck_loyalist_court",
    tree: "MCK",
    x: 13,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "mck_pol_qing",
    prereq: [["mck_throne_asserts"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "mck_xi_qia",
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_imperial_guard_oath",
    tree: "MCK",
    x: 15,
    y: 5,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "mck_pol_qing",
    prereq: [["mck_throne_asserts"]],
    effects: [
      {
        kind: "army_xp",
        amount: 5,
      },
      {
        kind: "war_support",
        pct: 2,
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_mandate_of_heaven",
    tree: "MCK",
    x: 13,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "mck_pol_qing",
    prereq: [["mck_loyalist_court"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 5,
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
    id: "mck_qing_restoration",
    tree: "MCK",
    x: 14,
    y: 7,
    days: 105,
    branch: "politics",
    icon: "crown",
    group: "mck_pol_qing",
    prereq: [["mck_mandate_of_heaven"], ["mck_imperial_guard_oath"]],
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
      base: 10,
    },
  },
  {
    id: "mck_dragon_throne",
    tree: "MCK",
    x: 13,
    y: 8,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "mck_pol_qing",
    prereq: [["mck_qing_restoration"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "set_leader",
        person: "mck_puyi_qing",
      },
      {
        kind: "add_spirit",
        id: "mck_qing_mandate",
      },
      {
        kind: "set_name",
        key: "ww1936.rename.mck_great_qing",
      },
      {
        kind: "fire_event",
        id: "mck_ev_qing_proclaimed",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_banners_revived",
    tree: "MCK",
    x: 15,
    y: 8,
    days: 70,
    branch: "army",
    icon: "flag",
    group: "mck_pol_qing",
    prereq: [["mck_qing_restoration"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "add_spirit",
        id: "mck_banner_revival",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_cut_the_leash",
    tree: "MCK",
    x: 14,
    y: 9,
    days: 70,
    branch: "politics",
    icon: "chain_broken",
    group: "mck_pol_qing",
    prereq: [["mck_dragon_throne"], ["mck_banners_revived"]],
    effects: [
      {
        kind: "autonomy",
        pct: 7,
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: -20,
        days: 365,
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
    id: "mck_road_to_beijing",
    tree: "MCK",
    x: 13,
    y: 10,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "mck_qing_claims",
    prereq: [["mck_cut_the_leash"]],
    effects: [
      {
        kind: "war_support",
        pct: 3,
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
    id: "mck_mongol_princes",
    tree: "MCK",
    x: 15,
    y: 10,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_qing_claims",
    prereq: [["mck_cut_the_leash"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "exists",
          who: {
            tag: "MEN",
          },
        },
        then: [
          {
            kind: "opinion",
            of: {
              tag: "MEN",
            },
            value: 30,
            days: 365,
          },
        ],
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
    id: "mck_forbidden_city_claim",
    tree: "MCK",
    x: 13,
    y: 11,
    days: 105,
    branch: "diplomacy",
    icon: "crown",
    group: "mck_qing_claims",
    prereq: [["mck_road_to_beijing"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "subject_of",
          of: {
            tag: "JPN",
          },
        },
        then: [
          {
            kind: "fire_event",
            id: "mck_ev_tokyo_answers_qing",
            to: {
              tag: "JPN",
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
      base: 10,
    },
  },
  {
    id: "mck_chahar_banners",
    tree: "MCK",
    x: 15,
    y: 11,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "mck_qing_claims",
    prereq: [["mck_mongol_princes"]],
    effects: [
      {
        kind: "if",
        cond: {
          not: {
            kind: "is_subject",
          },
        },
        then: [
          {
            kind: "war_goal",
            on: {
              tag: "CHN",
            },
            type: "claim",
            group: "inner_mongolia",
          },
        ],
        else: [
          {
            kind: "opinion",
            of: {
              tag: "JPN",
            },
            value: 10,
            days: 365,
          },
        ],
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
    id: "mck_beyond_the_wall",
    tree: "MCK",
    x: 13,
    y: 12,
    days: 70,
    branch: "diplomacy",
    icon: "sword",
    group: "mck_qing_claims",
    prereq: [["mck_forbidden_city_claim"]],
    available: {
      all: [
        {
          not: {
            kind: "is_subject",
          },
        },
        {
          kind: "exists",
          who: {
            tag: "CHN",
          },
        },
      ],
    },
    effects: [
      {
        kind: "war_goal",
        on: {
          tag: "CHN",
        },
        type: "claim",
        group: "mck_qing_heartland",
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
    id: "mck_qing_empire_reborn",
    tree: "MCK",
    x: 14,
    y: 13,
    days: 105,
    branch: "politics",
    icon: "crown",
    group: "mck_qing_claims",
    prereq: [["mck_beyond_the_wall"]],
    available: {
      kind: "owns_group",
      group: "mck_qing_heartland",
    },
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "mck_qing_mandate",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "mck_qing_mandate",
            to: "mck_qing_empire",
          },
        ],
      },
      {
        kind: "stability",
        pct: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_officers_council",
    tree: "MCK",
    x: 18,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "mck_pol_officers",
    prereq: [["mck_question_of_the_state"]],
    exclusive: ["mck_kyowakai_state", "mck_throne_asserts"],
    effects: [
      {
        kind: "army_xp",
        amount: 5,
      },
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
    ],
    ai: nationRouteAi("neutral", 1),
  },
  {
    id: "mck_manchuria_for_its_peoples",
    tree: "MCK",
    x: 19,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "globe",
    group: "mck_pol_officers",
    prereq: [["mck_officers_council"]],
    effects: [
      {
        kind: "popularity",
        ideology: "neutral",
        pp: 3,
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: -10,
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
    id: "mck_army_holds_the_purse",
    tree: "MCK",
    x: 17,
    y: 5,
    days: 70,
    branch: "army",
    icon: "factory_mil",
    group: "mck_pol_officers",
    prereq: [["mck_officers_council"]],
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
        kind: "army_xp",
        amount: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_officers_coup",
    tree: "MCK",
    x: 18,
    y: 6,
    days: 105,
    branch: "politics",
    icon: "sword",
    group: "mck_pol_officers",
    prereq: [["mck_manchuria_for_its_peoples"], ["mck_army_holds_the_purse"]],
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
      base: 10,
    },
  },
  {
    id: "mck_military_government",
    tree: "MCK",
    x: 17,
    y: 7,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "mck_pol_officers",
    prereq: [["mck_officers_coup"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "set_leader",
        person: "mck_zhang_haipeng",
      },
      {
        kind: "add_spirit",
        id: "mck_junta_order",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_garrison_state",
    tree: "MCK",
    x: 19,
    y: 7,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "mck_pol_officers",
    prereq: [["mck_officers_coup"]],
    available: {
      kind: "ruling",
      ideology: "neutral",
    },
    effects: [
      {
        kind: "fort",
        where: {
          group: "manchukuo_soviet_border",
        },
        amount: 1,
      },
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "autonomy",
        pct: 5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_northeast_exiles",
    tree: "MCK",
    x: 1,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "dove",
    group: "mck_pol_northeast",
    prereq: [["mck_kangde_throne"]],
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
        pp: 3,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: nationRouteAi("democratic", 1),
  },
  {
    id: "mck_young_marshal_letters",
    tree: "MCK",
    x: 0,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "mck_pol_northeast",
    prereq: [["mck_northeast_exiles"]],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 3,
      },
      {
        kind: "fire_event",
        id: "mck_ev_young_marshal_message",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_volunteers_remembered",
    tree: "MCK",
    x: 2,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "mck_pol_northeast",
    prereq: [["mck_northeast_exiles"]],
    effects: [
      {
        kind: "popularity",
        ideology: "democratic",
        pp: 2,
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
    id: "mck_gentry_councils",
    tree: "MCK",
    x: 1,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "mck_pol_northeast",
    prereq: [["mck_young_marshal_letters"], ["mck_volunteers_remembered"]],
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
      base: 10,
    },
  },
  {
    id: "mck_northeast_rising",
    tree: "MCK",
    x: 1,
    y: 7,
    days: 105,
    branch: "politics",
    icon: "fist",
    group: "mck_pol_northeast",
    prereq: [["mck_gentry_councils"]],
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
      base: 10,
    },
  },
  {
    id: "mck_return_to_the_republic",
    tree: "MCK",
    x: 0,
    y: 8,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_pol_northeast",
    prereq: [["mck_northeast_rising"]],
    available: {
      kind: "ruling",
      ideology: "democratic",
    },
    effects: [
      {
        kind: "set_leader",
        person: "mck_zhang_xueliang",
      },
      {
        kind: "add_spirit",
        id: "mck_northeast_restored",
      },
      {
        kind: "if",
        cond: {
          kind: "exists",
          who: {
            tag: "CHN",
          },
        },
        then: [
          {
            kind: "opinion",
            of: {
              tag: "CHN",
            },
            value: 30,
            days: 365,
          },
        ],
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_northeast_army_reborn",
    tree: "MCK",
    x: 2,
    y: 8,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_pol_northeast",
    prereq: [["mck_northeast_rising"]],
    available: {
      kind: "ruling",
      ideology: "democratic",
    },
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "manpower",
        amount: 20000,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_mountain_bases",
    tree: "MCK",
    x: 5,
    y: 4,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "mck_pol_united_army",
    prereq: [["mck_kangde_throne"]],
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
        pp: 3,
      },
      {
        kind: "stability",
        pct: -1,
      },
    ],
    ai: nationRouteAi("communist", 1),
  },
  {
    id: "mck_united_army_founded",
    tree: "MCK",
    x: 4,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "mck_pol_united_army",
    prereq: [["mck_mountain_bases"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
      {
        kind: "war_support",
        pct: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_korean_partisans",
    tree: "MCK",
    x: 6,
    y: 5,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "mck_pol_united_army",
    prereq: [["mck_mountain_bases"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 2,
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
    id: "mck_village_cells",
    tree: "MCK",
    x: 5,
    y: 6,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "mck_pol_united_army",
    prereq: [["mck_united_army_founded"], ["mck_korean_partisans"]],
    effects: [
      {
        kind: "popularity",
        ideology: "communist",
        pp: 4,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_red_northeast",
    tree: "MCK",
    x: 5,
    y: 7,
    days: 105,
    branch: "politics",
    icon: "fist",
    group: "mck_pol_united_army",
    prereq: [["mck_village_cells"]],
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
      base: 10,
    },
  },
  {
    id: "mck_peoples_committees",
    tree: "MCK",
    x: 4,
    y: 8,
    days: 70,
    branch: "politics",
    icon: "star_plain",
    group: "mck_pol_united_army",
    prereq: [["mck_red_northeast"]],
    available: {
      kind: "ruling",
      ideology: "communist",
    },
    effects: [
      {
        kind: "set_leader",
        person: "mck_zhou_baozhong",
      },
      {
        kind: "add_spirit",
        id: "mck_mountain_war",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_land_to_tillers",
    tree: "MCK",
    x: 6,
    y: 8,
    days: 70,
    branch: "industry",
    icon: "wheat",
    group: "mck_pol_united_army",
    prereq: [["mck_red_northeast"]],
    available: {
      kind: "ruling",
      ideology: "communist",
    },
    effects: [
      {
        kind: "stability",
        pct: 5,
      },
      {
        kind: "popularity",
        ideology: "communist",
        pp: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_kwantung_shadow",
    tree: "MCK",
    x: 22,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "chain_broken",
    group: "mck_grip",
    effects: [
      {
        kind: "unlock_decision",
        id: "mck_dec_native_officials",
      },
      {
        kind: "fire_event",
        id: "mck_ev_vice_ministers",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_manchukuo_born_officials",
    tree: "MCK",
    x: 21,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "mck_grip",
    prereq: [["mck_kwantung_shadow"]],
    effects: [
      {
        kind: "autonomy",
        pct: 5,
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
    id: "mck_honour_the_protocol",
    tree: "MCK",
    x: 23,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_grip",
    prereq: [["mck_kwantung_shadow"]],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: 20,
        days: 365,
      },
      {
        kind: "stability",
        pct: 3,
      },
      {
        kind: "autonomy",
        pct: -5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_extraterritoriality_ended",
    tree: "MCK",
    x: 21,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "scales",
    group: "mck_grip",
    prereq: [["mck_manchukuo_born_officials"]],
    effects: [
      {
        kind: "autonomy",
        pct: 5,
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
    id: "mck_railway_zone_handover",
    tree: "MCK",
    x: 23,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "rail",
    group: "mck_grip",
    prereq: [["mck_honour_the_protocol"]],
    effects: [
      {
        kind: "infra",
        where: {
          best: 2,
        },
        amount: 1,
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
    id: "mck_a_voice_of_its_own",
    tree: "MCK",
    x: 22,
    y: 3,
    days: 105,
    branch: "diplomacy",
    icon: "megaphone",
    group: "mck_grip",
    prereq: [["mck_extraterritoriality_ended"], ["mck_railway_zone_handover"]],
    effects: [
      {
        kind: "autonomy",
        pct: 7,
      },
      {
        kind: "fire_event",
        id: "mck_ev_jpn_loyalty_question",
        to: {
          tag: "JPN",
        },
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_own_foreign_service",
    tree: "MCK",
    x: 21,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "mck_grip",
    prereq: [["mck_a_voice_of_its_own"]],
    effects: [
      {
        kind: "add_advisor_candidate",
        person: "mck_xie_jieshi",
      },
      {
        kind: "opinion",
        of: {
          tag: "DEU",
        },
        value: 10,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "ITA",
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
    id: "mck_garrison_terms",
    tree: "MCK",
    x: 23,
    y: 4,
    days: 70,
    branch: "diplomacy",
    icon: "fort",
    group: "mck_grip",
    prereq: [["mck_a_voice_of_its_own"]],
    effects: [
      {
        kind: "autonomy",
        pct: 5,
      },
      {
        kind: "fort",
        where: {
          group: "manchukuo_soviet_border",
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_sovereign_in_deed",
    tree: "MCK",
    x: 22,
    y: 5,
    days: 105,
    branch: "politics",
    icon: "crown",
    group: "mck_grip",
    prereq: [["mck_own_foreign_service"], ["mck_garrison_terms"]],
    effects: [
      {
        kind: "autonomy",
        pct: 7,
      },
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "mck_kwantung_grip_loosened",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "mck_kwantung_grip_loosened",
            to: "mck_state_of_its_own",
          },
        ],
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
    id: "mck_industrial_plan",
    tree: "MCK",
    x: 28,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "mck_industry",
    effects: [
      {
        kind: "add_spirit",
        id: "mck_five_year_plan",
      },
      {
        kind: "add_advisor_candidate",
        person: "mck_kishi_nobusuke",
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
    id: "mck_mangyo",
    tree: "MCK",
    x: 27,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "mck_industry",
    prereq: [["mck_industrial_plan"]],
    exclusive: ["mck_state_enterprise"],
    effects: [
      {
        kind: "fire_event",
        id: "mck_ev_mangyo_founded",
      },
      {
        kind: "build",
        where: {
          best: 1,
        },
        building: "mil",
        count: 1,
      },
      {
        kind: "autonomy",
        pct: -5,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_state_enterprise",
    tree: "MCK",
    x: 29,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "mck_industry",
    prereq: [["mck_industrial_plan"]],
    exclusive: ["mck_mangyo"],
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
        kind: "autonomy",
        pct: 5,
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
    id: "mck_anshan_steel",
    tree: "MCK",
    x: 26,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "steel",
    group: "mck_industry",
    prereq: [["mck_mangyo", "mck_state_enterprise"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [553],
        },
        res: "steel",
        amount: 3,
      },
      {
        kind: "build",
        where: {
          regions: [553],
        },
        building: "smelter",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_fushun_coal",
    tree: "MCK",
    x: 28,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "mine",
    group: "mck_industry",
    prereq: [["mck_mangyo", "mck_state_enterprise"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [553],
        },
        res: "coal",
        amount: 4,
      },
      {
        kind: "build",
        where: {
          regions: [553],
        },
        building: "mine",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_fushun_shale",
    tree: "MCK",
    x: 28,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "oil",
    group: "mck_industry",
    prereq: [["mck_fushun_coal"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [553],
        },
        res: "oil",
        amount: 1,
      },
      {
        kind: "unlock_decision",
        id: "mck_dec_shale_oil",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_benxihu_iron",
    tree: "MCK",
    x: 26,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "steel",
    group: "mck_industry",
    prereq: [["mck_anshan_steel"]],
    effects: [
      {
        kind: "resource",
        where: {
          regions: [553],
        },
        res: "steel",
        amount: 2,
      },
      {
        kind: "build",
        where: {
          regions: [553],
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
    id: "mck_sungari_dam",
    tree: "MCK",
    x: 30,
    y: 2,
    days: 105,
    branch: "industry",
    icon: "industry",
    group: "mck_industry",
    prereq: [["mck_mangyo", "mck_state_enterprise"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [486],
        },
        building: "power_plant",
        count: 1,
      },
      {
        kind: "build",
        where: {
          regions: [486],
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
    id: "mck_hsinking_plan",
    tree: "MCK",
    x: 30,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "mck_industry",
    prereq: [["mck_sungari_dam"]],
    effects: [
      {
        kind: "build",
        where: "capital",
        building: "civ",
        count: 1,
      },
      {
        kind: "infra",
        where: "capital",
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_war_industries",
    tree: "MCK",
    x: 27,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "mck_industry",
    prereq: [["mck_anshan_steel"], ["mck_fushun_coal"]],
    effects: [
      {
        kind: "build",
        where: {
          best: 1,
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
    id: "mck_synthetic_fuel",
    tree: "MCK",
    x: 29,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "oil",
    group: "mck_industry",
    prereq: [["mck_fushun_shale"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [486],
        },
        building: "synthetic_refinery",
        count: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_mukden_arsenal",
    tree: "MCK",
    x: 26,
    y: 5,
    days: 70,
    branch: "research",
    icon: "artillery",
    group: "mck_industry",
    prereq: [["mck_war_industries"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "infantry",
        pct: 50,
        uses: 1,
      },
      {
        kind: "build",
        where: {
          regions: [553],
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
    id: "mck_aircraft_works",
    tree: "MCK",
    x: 28,
    y: 5,
    days: 70,
    branch: "research",
    icon: "plane",
    group: "mck_industry",
    prereq: [["mck_war_industries"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "air",
        pct: 50,
        uses: 1,
      },
      {
        kind: "build",
        where: {
          regions: [553],
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
    id: "mck_second_plan",
    tree: "MCK",
    x: 27,
    y: 6,
    days: 105,
    branch: "industry",
    icon: "industry",
    group: "mck_industry",
    prereq: [["mck_mukden_arsenal"], ["mck_aircraft_works"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "has_spirit",
          id: "mck_five_year_plan",
        },
        then: [
          {
            kind: "swap_spirit",
            from: "mck_five_year_plan",
            to: "mck_plan_quotas",
          },
        ],
      },
      {
        kind: "build",
        where: {
          best: 1,
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
    id: "mck_soybean_economy",
    tree: "MCK",
    x: 33,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "wheat",
    group: "mck_land",
    effects: [
      {
        kind: "pp",
        amount: 25,
      },
      {
        kind: "unlock_decision",
        id: "mck_dec_sell_soybeans",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_million_households",
    tree: "MCK",
    x: 32,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "road",
    group: "mck_land",
    prereq: [["mck_soybean_economy"]],
    exclusive: ["mck_native_land_first"],
    effects: [
      {
        kind: "fire_event",
        id: "mck_ev_settler_plan",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_native_land_first",
    tree: "MCK",
    x: 34,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "wheat",
    group: "mck_land",
    prereq: [["mck_soybean_economy"]],
    exclusive: ["mck_million_households"],
    effects: [
      {
        kind: "stability",
        pct: 4,
      },
      {
        kind: "autonomy",
        pct: 3,
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
        },
        value: -10,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_rail_network",
    tree: "MCK",
    x: 33,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "rail",
    group: "mck_land",
    prereq: [["mck_million_households", "mck_native_land_first"]],
    effects: [
      {
        kind: "rail",
        where: {
          best: 3,
        },
        amount: 1,
      },
      {
        kind: "infra",
        where: {
          best: 2,
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_asia_express",
    tree: "MCK",
    x: 32,
    y: 3,
    days: 35,
    branch: "industry",
    icon: "rail",
    group: "mck_land",
    prereq: [["mck_rail_network"]],
    effects: [
      {
        kind: "stability",
        pct: 2,
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
    id: "mck_harbin_crossroads",
    tree: "MCK",
    x: 34,
    y: 3,
    days: 70,
    branch: "industry",
    icon: "globe",
    group: "mck_land",
    prereq: [["mck_rail_network"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [303],
        },
        building: "civ",
        count: 1,
      },
      {
        kind: "opinion",
        of: {
          tag: "DEU",
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
    id: "mck_hinggan_timber",
    tree: "MCK",
    x: 35,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "mck_land",
    prereq: [["mck_soybean_economy"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [313],
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
    id: "mck_grain_for_the_empire",
    tree: "MCK",
    x: 33,
    y: 4,
    days: 70,
    branch: "industry",
    icon: "wheat",
    group: "mck_land",
    prereq: [["mck_asia_express"], ["mck_harbin_crossroads"]],
    effects: [
      {
        kind: "unlock_decision",
        id: "mck_dec_grain_quota",
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
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
    id: "mck_army_reform",
    tree: "MCK",
    x: 39,
    y: 0,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_army",
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "stability",
        pct: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_one_rifle",
    tree: "MCK",
    x: 38,
    y: 1,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_army",
    prereq: [["mck_army_reform"]],
    effects: [
      {
        kind: "equipment",
        type: "infantry_equipment",
        gen: 1,
        count: 1500,
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
    id: "mck_military_academy",
    tree: "MCK",
    x: 40,
    y: 1,
    days: 70,
    branch: "research",
    icon: "medal",
    group: "mck_army",
    prereq: [["mck_army_reform"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "doctrine",
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
    id: "mck_xingan_army",
    tree: "MCK",
    x: 37,
    y: 2,
    days: 70,
    branch: "army",
    icon: "flag",
    group: "mck_army",
    prereq: [["mck_one_rifle"]],
    effects: [
      {
        kind: "unlock_template",
        template: "mck_tpl_xingan_cavalry",
      },
      {
        kind: "divisions",
        template: "mck_tpl_xingan_cavalry",
        count: 1,
        where: {
          regions: [313],
        },
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_asano_brigade",
    tree: "MCK",
    x: 39,
    y: 2,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_army",
    prereq: [["mck_one_rifle"]],
    effects: [
      {
        kind: "unlock_template",
        template: "mck_tpl_asano_brigade",
      },
      {
        kind: "divisions",
        template: "mck_tpl_asano_brigade",
        count: 1,
        where: {
          regions: [303],
        },
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_officers_trained_at_home",
    tree: "MCK",
    x: 41,
    y: 2,
    days: 70,
    branch: "army",
    icon: "medal",
    group: "mck_army",
    prereq: [["mck_military_academy"]],
    effects: [
      {
        kind: "army_xp",
        amount: 10,
      },
      {
        kind: "autonomy",
        pct: 3,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_national_service_law",
    tree: "MCK",
    x: 38,
    y: 3,
    days: 105,
    branch: "army",
    icon: "infantry",
    group: "mck_army",
    prereq: [["mck_xingan_army", "mck_asano_brigade"]],
    effects: [
      {
        kind: "add_spirit",
        id: "mck_national_service",
      },
      {
        kind: "manpower",
        amount: 30000,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_field_artillery",
    tree: "MCK",
    x: 40,
    y: 3,
    days: 70,
    branch: "army",
    icon: "artillery",
    group: "mck_army",
    prereq: [["mck_military_academy"]],
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
        count: 40,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_kando_special_unit",
    tree: "MCK",
    x: 37,
    y: 4,
    days: 70,
    branch: "army",
    icon: "sword",
    group: "mck_army",
    prereq: [["mck_national_service_law"]],
    effects: [
      {
        kind: "stability",
        pct: 2,
      },
      {
        kind: "popularity",
        ideology: "communist",
        pp: -2,
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
    id: "mck_army_of_two_hundred_thousand",
    tree: "MCK",
    x: 39,
    y: 4,
    days: 105,
    branch: "army",
    icon: "infantry",
    group: "mck_army",
    prereq: [["mck_national_service_law"], ["mck_field_artillery"]],
    effects: [
      {
        kind: "divisions",
        template: "mck_tpl_asano_brigade",
        count: 1,
        where: {
          regions: [553],
        },
      },
      {
        kind: "army_xp",
        amount: 10,
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
    id: "mck_soviet_border",
    tree: "MCK",
    x: 43,
    y: 0,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "mck_border",
    effects: [
      {
        kind: "fort",
        where: {
          group: "manchukuo_soviet_border",
        },
        amount: 1,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_hold_the_border",
    tree: "MCK",
    x: 42,
    y: 1,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "mck_border",
    prereq: [["mck_soviet_border"]],
    exclusive: ["mck_border_truce"],
    effects: [
      {
        kind: "add_spirit",
        id: "mck_border_watch",
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
    id: "mck_border_truce",
    tree: "MCK",
    x: 44,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_border",
    prereq: [["mck_soviet_border"]],
    exclusive: ["mck_hold_the_border"],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "SUN",
        },
        value: 20,
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
    id: "mck_ussuri_fortresses",
    tree: "MCK",
    x: 42,
    y: 2,
    days: 105,
    branch: "army",
    icon: "fort",
    group: "mck_border",
    prereq: [["mck_hold_the_border", "mck_border_truce"]],
    effects: [
      {
        kind: "fort",
        where: {
          group: "manchukuo_soviet_border",
        },
        amount: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_winter_on_the_amur",
    tree: "MCK",
    x: 44,
    y: 2,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_border",
    prereq: [["mck_hold_the_border", "mck_border_truce"]],
    effects: [
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
    id: "mck_lessons_of_khalkha",
    tree: "MCK",
    x: 43,
    y: 3,
    days: 70,
    branch: "research",
    icon: "tank",
    group: "mck_border",
    prereq: [["mck_ussuri_fortresses"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "armour",
        pct: 50,
        uses: 1,
      },
      {
        kind: "add_spirit",
        id: "mck_khalkha_lesson",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_air_corps",
    tree: "MCK",
    x: 46,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "mck_air_river",
    effects: [
      {
        kind: "equipment",
        type: "fighter",
        gen: 1,
        count: 12,
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
    id: "mck_national_airways",
    tree: "MCK",
    x: 45,
    y: 1,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "mck_air_river",
    prereq: [["mck_air_corps"]],
    effects: [
      {
        kind: "build",
        where: "capital",
        building: "air_base",
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
    id: "mck_harbin_flying_school",
    tree: "MCK",
    x: 47,
    y: 1,
    days: 70,
    branch: "air",
    icon: "plane",
    group: "mck_air_river",
    prereq: [["mck_air_corps"]],
    effects: [
      {
        kind: "research_bonus",
        branch: "air",
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
    id: "mck_guns_over_mukden",
    tree: "MCK",
    x: 45,
    y: 2,
    days: 70,
    branch: "air",
    icon: "bomber",
    group: "mck_air_river",
    prereq: [["mck_national_airways"]],
    effects: [
      {
        kind: "build",
        where: {
          regions: [553],
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
    id: "mck_sungari_flotilla",
    tree: "MCK",
    x: 47,
    y: 3,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "mck_air_river",
    effects: [
      {
        kind: "add_spirit",
        id: "mck_river_fleet",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_seek_recognition",
    tree: "MCK",
    x: 50,
    y: 0,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    group: "mck_diplomacy",
    effects: [
      {
        kind: "fire_event",
        id: "mck_ev_recognition",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_rome_and_berlin",
    tree: "MCK",
    x: 49,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_diplomacy",
    prereq: [["mck_seek_recognition"]],
    effects: [
      {
        kind: "opinion",
        of: {
          tag: "ITA",
        },
        value: 25,
        days: 365,
      },
      {
        kind: "opinion",
        of: {
          tag: "DEU",
        },
        value: 25,
        days: 365,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_anti_comintern",
    tree: "MCK",
    x: 49,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    group: "mck_diplomacy",
    prereq: [["mck_rome_and_berlin"]],
    effects: [
      {
        kind: "war_support",
        pct: 3,
      },
      {
        kind: "opinion",
        of: {
          tag: "SUN",
        },
        value: -20,
        days: 365,
      },
      {
        kind: "popularity",
        ideology: "communist",
        pp: -2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_mengjiang_brothers",
    tree: "MCK",
    x: 51,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "mck_diplomacy",
    prereq: [["mck_seek_recognition"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "exists",
          who: {
            tag: "MEN",
          },
        },
        then: [
          {
            kind: "opinion",
            of: {
              tag: "MEN",
            },
            value: 30,
            days: 365,
          },
        ],
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
    id: "mck_nanjing_recognition",
    tree: "MCK",
    x: 51,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "document",
    group: "mck_diplomacy",
    prereq: [["mck_mengjiang_brothers"]],
    effects: [
      {
        kind: "if",
        cond: {
          kind: "exists",
          who: {
            tag: "RNG",
          },
        },
        then: [
          {
            kind: "opinion",
            of: {
              tag: "RNG",
            },
            value: 30,
            days: 365,
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
    id: "mck_greater_east_asia",
    tree: "MCK",
    x: 50,
    y: 3,
    days: 105,
    branch: "diplomacy",
    icon: "globe",
    group: "mck_diplomacy",
    prereq: [["mck_anti_comintern"], ["mck_nanjing_recognition"]],
    effects: [
      {
        kind: "war_support",
        pct: 5,
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
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
    id: "mck_rear_base_of_empire",
    tree: "MCK",
    x: 55,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "mck_war",
    exclusive: ["mck_guard_own_house"],
    available: {
      kind: "at_war",
      who: {
        tag: "JPN",
      },
    },
    effects: [
      {
        kind: "add_spirit",
        id: "mck_rear_base",
      },
      {
        kind: "opinion",
        of: {
          tag: "JPN",
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
    id: "mck_guard_own_house",
    tree: "MCK",
    x: 57,
    y: 0,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "mck_war",
    exclusive: ["mck_rear_base_of_empire"],
    available: {
      kind: "at_war",
      who: {
        tag: "JPN",
      },
    },
    effects: [
      {
        kind: "autonomy",
        pct: 5,
      },
      {
        kind: "add_spirit",
        id: "mck_home_guard",
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_total_mobilisation",
    tree: "MCK",
    x: 56,
    y: 1,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_war",
    prereq: [["mck_rear_base_of_empire", "mck_guard_own_house"]],
    effects: [
      {
        kind: "war_support",
        pct: 5,
      },
      {
        kind: "manpower",
        amount: 30000,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_grain_requisitions",
    tree: "MCK",
    x: 55,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "wheat",
    group: "mck_war",
    prereq: [["mck_total_mobilisation"]],
    effects: [
      {
        kind: "add_spirit",
        id: "mck_grain_deliveries",
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
    id: "mck_tonghua_redoubt",
    tree: "MCK",
    x: 57,
    y: 2,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "mck_war",
    prereq: [["mck_total_mobilisation"]],
    effects: [
      {
        kind: "fort",
        where: {
          regions: [486],
        },
        amount: 2,
      },
    ],
    ai: {
      base: 10,
    },
  },
  {
    id: "mck_last_levy",
    tree: "MCK",
    x: 56,
    y: 3,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "mck_war",
    prereq: [["mck_grain_requisitions", "mck_tonghua_redoubt"]],
    available: {
      kind: "at_war",
    },
    effects: [
      {
        kind: "war_support",
        pct: 3,
      },
      {
        kind: "army_xp",
        amount: 5,
      },
      {
        kind: "manpower",
        amount: 20000,
      },
    ],
    ai: {
      base: 10,
    },
  },
];

export const MCK_PATH: readonly FocusId[] = [
  "mck_kangde_throne",
  "mck_general_affairs_board",
  "mck_kwantung_shadow",
  "mck_industrial_plan",
  "mck_concordia_association",
  "mck_army_reform",
  "mck_soybean_economy",
  "mck_question_of_the_state",
  "mck_kyowakai_state",
  "mck_mangyo",
  "mck_honour_the_protocol",
  "mck_million_households",
  "mck_soviet_border",
  "mck_one_rifle",
  "mck_five_races_campaign",
  "mck_anshan_steel",
  "mck_fushun_coal",
  "mck_seek_recognition",
  "mck_youth_corps",
  "mck_hold_the_border",
  "mck_rail_network",
  "mck_manchukuo_born_officials",
  "mck_railway_zone_handover",
  "mck_extraterritoriality_ended",
  "mck_xingan_army",
  "mck_asano_brigade",
  "mck_rome_and_berlin",
  "mck_national_foundation_shrine",
  "mck_one_party_order",
  "mck_military_academy",
  "mck_air_corps",
  "mck_sungari_dam",
  "mck_fushun_shale",
  "mck_benxihu_iron",
  "mck_war_industries",
  "mck_ussuri_fortresses",
  "mck_lessons_of_khalkha",
  "mck_anti_comintern",
  "mck_imperial_visit_tokyo",
  "mck_national_service_law",
  "mck_asia_express",
  "mck_harbin_crossroads",
  "mck_grain_for_the_empire",
  "mck_mengjiang_brothers",
  "mck_nanjing_recognition",
  "mck_mukden_arsenal",
  "mck_aircraft_works",
  "mck_national_airways",
  "mck_sungari_flotilla",
  "mck_field_artillery",
  "mck_officers_trained_at_home",
  "mck_kando_special_unit",
  "mck_rear_base_of_empire",
  "mck_total_mobilisation",
  "mck_total_concordia",
  "mck_synthetic_fuel",
  "mck_second_plan",
  "mck_army_of_two_hundred_thousand",
  "mck_greater_east_asia",
  "mck_grain_requisitions",
  "mck_hsinking_plan",
  "mck_winter_on_the_amur",
  "mck_guns_over_mukden",
  "mck_harbin_flying_school",
  "mck_hinggan_timber",
  "mck_tonghua_redoubt",
  "mck_last_levy",
];

export const MCK_BRANCH_POINTS: readonly BranchPoint[] = [
  {
    id: "mck_bp_course",
    historical: "mck_kyowakai_state",
    alternatives: ["mck_throne_asserts", "mck_officers_council"],
    political: true,
  },
  {
    id: "mck_bp_settlers",
    historical: "mck_million_households",
    alternatives: ["mck_native_land_first"],
    political: false,
  },
  {
    id: "mck_bp_industry",
    historical: "mck_mangyo",
    alternatives: ["mck_state_enterprise"],
    political: false,
  },
  {
    id: "mck_bp_border",
    historical: "mck_hold_the_border",
    alternatives: ["mck_border_truce"],
    political: false,
  },
  {
    id: "mck_bp_war",
    historical: "mck_rear_base_of_empire",
    alternatives: ["mck_guard_own_house"],
    political: false,
  },
];
