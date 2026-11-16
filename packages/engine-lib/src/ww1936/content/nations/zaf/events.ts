// ww229: South Africa's events. Triggered ones check the situation, never a
// day; the rest are fired by the tree (self = South Africa) or sent to
// London and Lisbon by the Greater South Africa focuses. Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ZAF_EVENTS: EventDef[] = [
  {
    id: "zaf_ev_purified_gains",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1936-09-01",
        },
        {
          kind: "ruling",
          ideology: "democratic",
        },
        {
          not: {
            kind: "at_war",
          },
        },
      ],
    },
    mtthDays: 240,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "bop",
            amount: -100,
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: -2,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "bop",
            amount: 100,
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 2,
          },
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_centenary_trek",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1938-06-01",
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
      ],
    },
    mtthDays: 90,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "bop",
            amount: 150,
          },
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 3,
          },
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 2,
          },
          {
            kind: "stability",
            pct: -1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "bop",
            amount: 50,
          },
          {
            kind: "stability",
            pct: 2,
          },
          {
            kind: "popularity",
            ideology: "democratic",
            pp: 1,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_fusion_strain",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1938-06-01",
        },
        {
          kind: "ruling",
          ideology: "democratic",
        },
        {
          kind: "wt_ge",
          pct: 30,
        },
        {
          not: {
            kind: "at_war",
          },
        },
      ],
    },
    mtthDays: 150,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "bop",
            amount: -150,
          },
          {
            kind: "war_support",
            pct: 3,
          },
          {
            kind: "stability",
            pct: -1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 50,
        },
        effects: [
          {
            kind: "bop",
            amount: 150,
          },
          {
            kind: "war_support",
            pct: -3,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_gold_premium",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1936-03-01",
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
      ],
    },
    mtthDays: 200,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "pp",
            amount: 60,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "build",
            where: {
              group: "zaf_witwatersrand",
            },
            building: "civ",
            count: 1,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_mine_strike",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1940-01-01",
        },
        {
          kind: "pop_ge",
          ideology: "communist",
          pct: 6,
        },
        {
          not: {
            kind: "ruling",
            ideology: "communist",
          },
        },
      ],
    },
    mtthDays: 500,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "stability",
            pct: -2,
          },
          {
            kind: "popularity",
            ideology: "communist",
            pp: -2,
          },
          {
            kind: "pp",
            amount: 20,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "communist",
            pp: 3,
          },
          {
            kind: "stability",
            pct: 2,
          },
          {
            kind: "pp",
            amount: -30,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_ob_founded",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1939-01-01",
        },
        {
          not: {
            kind: "ruling",
            ideology: "fascist",
          },
        },
        {
          not: {
            kind: "flag",
            flag: "zaf_ob_active",
          },
        },
      ],
    },
    mtthDays: 120,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
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
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: -1,
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
      },
    ],
  },
  {
    id: "zaf_ev_stormjaer_sabotage",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "flag",
          flag: "zaf_ob_active",
        },
        {
          kind: "at_war",
        },
        {
          not: {
            kind: "ruling",
            ideology: "fascist",
          },
        },
      ],
    },
    mtthDays: 200,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: -3,
          },
          {
            kind: "stability",
            pct: -1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "stability",
            pct: -3,
          },
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 1,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_hertzog_leaves",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "leader",
          person: "zaf_smuts",
        },
        {
          kind: "ruling",
          ideology: "democratic",
        },
      ],
    },
    mtthDays: 30,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 4,
          },
          {
            kind: "bop",
            amount: 100,
          },
          {
            kind: "stability",
            pct: -2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "neutral",
            pp: 1,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_tobruk_surrender",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "at_war_with",
          of: {
            tag: "DEU",
          },
        },
        {
          kind: "war_days_ge",
          days: 900,
        },
      ],
    },
    mtthDays: 365,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "war_support",
            pct: -4,
          },
          {
            kind: "stability",
            pct: -2,
          },
          {
            kind: "manpower",
            amount: 10000,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "war_support",
            pct: -2,
          },
          {
            kind: "stability",
            pct: -1,
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
        ],
      },
    ],
  },
  {
    id: "zaf_ev_japanese_submarines",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      kind: "at_war_with",
      of: {
        tag: "JPN",
      },
    },
    mtthDays: 200,
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "build",
            where: {
              coastal: true,
              n: 1,
            },
            building: "coastal_fort",
            count: 1,
          },
          {
            kind: "convoys",
            amount: 20,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "equipment",
            type: "naval_bomber",
            gen: 1,
            count: 10,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_swa_germans",
    kind: "country",
    receivers: ["ZAF"],
    trigger: {
      all: [
        {
          kind: "date_ge",
          date: "1937-01-01",
        },
        {
          not: {
            kind: "ruling",
            ideology: "fascist",
          },
        },
        {
          kind: "owns_group",
          group: "zaf_swa",
        },
      ],
    },
    mtthDays: 300,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "stability",
            pct: 1,
          },
          {
            kind: "opinion",
            who: {
              tag: "DEU",
            },
            of: "self",
            value: -10,
            days: 365,
          },
          {
            kind: "popularity",
            ideology: "fascist",
            pp: -1,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "popularity",
            ideology: "fascist",
            pp: 1,
          },
          {
            kind: "opinion",
            who: {
              tag: "DEU",
            },
            of: "self",
            value: 10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_red_oath",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 70,
        },
        effects: [
          {
            kind: "manpower",
            amount: 20000,
          },
          {
            kind: "war_support",
            pct: 2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 30,
        },
        effects: [
          {
            kind: "manpower",
            amount: 10000,
          },
          {
            kind: "stability",
            pct: 1,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_east_africa",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "army_xp",
            amount: 10,
          },
          {
            kind: "war_support",
            pct: 3,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "army_xp",
            amount: 15,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_sixth_armoured",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
        },
        effects: [
          {
            kind: "army_xp",
            amount: 10,
          },
          {
            kind: "war_support",
            pct: 2,
          },
        ],
      },
      {
        id: "b",
        ai: {
          base: 40,
        },
        effects: [
          {
            kind: "stability",
            pct: 2,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_rhodesia_union",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        ai: {
          base: 20,
        },
        effects: [
          {
            kind: "transfer_regions",
            group: "zaf_rhodesia",
            to: {
              tag: "ZAF",
            },
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: {
          base: 80,
        },
        effects: [
          {
            kind: "opinion",
            who: {
              tag: "ZAF",
            },
            of: "self",
            value: -10,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_hct_request",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        ai: {
          base: 15,
        },
        effects: [
          {
            kind: "transfer_regions",
            group: "zaf_hct",
            to: {
              tag: "ZAF",
            },
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: {
          base: 85,
        },
        effects: [
          {
            kind: "opinion",
            who: {
              tag: "ZAF",
            },
            of: "self",
            value: -15,
            days: 365,
          },
        ],
      },
    ],
  },
  {
    id: "zaf_ev_delagoa_offer",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        ai: {
          base: 10,
        },
        effects: [
          {
            kind: "transfer_regions",
            group: "zaf_delagoa",
            to: {
              tag: "ZAF",
            },
          },
          {
            kind: "pp",
            amount: 60,
          },
        ],
      },
      {
        id: "b",
        history: true,
        ai: {
          base: 90,
        },
        effects: [
          {
            kind: "opinion",
            who: {
              tag: "ZAF",
            },
            of: "self",
            value: -10,
            days: 365,
          },
        ],
      },
    ],
  },
];
