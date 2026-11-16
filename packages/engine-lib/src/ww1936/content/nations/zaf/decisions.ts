// ww229: South Africa's decisions: the two wings of Fusion pull the balance
// of power (core.ts), gold, wool and chrome sales, and the war years.
// Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const ZAF_DECISIONS: DecisionDef[] = [
  {
    id: "zaf_smuts_speaking_tour",
    category: "political",
    for: ["ZAF"],
    available: {
      kind: "ruling",
      ideology: "democratic",
    },
    cost: {
      pp: 50,
    },
    cooldownDays: 150,
    effects: [
      {
        kind: "bop",
        amount: -100,
      },
      {
        kind: "war_support",
        pct: 2,
      },
    ],
    ai: {
      base: 5,
      mods: [
        {
          if: {
            any: [
              {
                kind: "bop_range",
                tag: "ZAF",
                band: 3,
              },
              {
                kind: "bop_range",
                tag: "ZAF",
                band: 4,
              },
            ],
          },
          factor: 300,
        },
      ],
    },
  },
  {
    id: "zaf_hertzog_compromise",
    category: "political",
    for: ["ZAF"],
    available: {
      kind: "ruling",
      ideology: "democratic",
    },
    cost: {
      pp: 50,
    },
    cooldownDays: 150,
    effects: [
      {
        kind: "bop",
        amount: 100,
      },
      {
        kind: "stability",
        pct: 2,
      },
    ],
    ai: {
      base: 3,
      mods: [
        {
          if: {
            any: [
              {
                kind: "bop_range",
                tag: "ZAF",
                band: 0,
              },
              {
                kind: "bop_range",
                tag: "ZAF",
                band: 1,
              },
            ],
          },
          factor: 300,
        },
      ],
    },
  },
  {
    id: "zaf_gold_sale_london",
    category: "economy",
    for: ["ZAF"],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "GBR",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "GBR",
            },
          },
        },
      ],
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "pp",
        amount: 40,
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
    ai: {
      base: 10,
    },
  },
  {
    id: "zaf_gold_sale_washington",
    category: "economy",
    for: ["ZAF"],
    available: {
      all: [
        {
          kind: "exists",
          who: {
            tag: "USA",
          },
        },
        {
          not: {
            kind: "at_war_with",
            of: {
              tag: "USA",
            },
          },
        },
      ],
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "pp",
        amount: 40,
      },
      {
        kind: "opinion",
        who: {
          tag: "USA",
        },
        of: "self",
        value: 15,
        days: 365,
      },
    ],
    ai: {
      base: 6,
    },
  },
  {
    id: "zaf_wool_barter",
    category: "economy",
    for: ["ZAF"],
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
        {
          not: {
            kind: "at_war",
          },
        },
      ],
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "pp",
        amount: 25,
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
          tag: "GBR",
        },
        of: "self",
        value: -5,
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
    id: "zaf_chrome_contract",
    category: "economy",
    for: ["ZAF"],
    available: {
      kind: "focus_done",
      id: "zaf_bushveld_chrome",
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "pp",
        amount: 30,
      },
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
          tag: "GBR",
        },
        of: "self",
        value: 10,
        days: 365,
      },
    ],
    ai: {
      base: 8,
    },
  },
  {
    id: "zaf_recruiting_drive",
    category: "military",
    for: ["ZAF"],
    available: {
      kind: "at_war",
    },
    cost: {
      pp: 25,
    },
    cooldownDays: 180,
    effects: [
      {
        kind: "manpower",
        amount: 15000,
      },
      {
        kind: "war_support",
        pct: -1,
      },
    ],
    ai: {
      base: 6,
    },
  },
  {
    id: "zaf_koffiefontein_internment",
    category: "political",
    for: ["ZAF"],
    available: {
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
    cost: {
      pp: 50,
    },
    cooldownDays: 365,
    effects: [
      {
        kind: "popularity",
        ideology: "fascist",
        pp: -3,
      },
      {
        kind: "stability",
        pct: -2,
      },
      {
        kind: "bop",
        amount: -100,
      },
    ],
    ai: {
      base: 5,
    },
  },
  {
    id: "zaf_cape_convoy_service",
    category: "military",
    for: ["ZAF"],
    available: {
      all: [
        {
          kind: "at_war",
        },
        {
          kind: "focus_done",
          id: "zaf_cape_sea_route",
        },
      ],
    },
    cost: {
      pp: 30,
    },
    cooldownDays: 180,
    effects: [
      {
        kind: "convoys",
        amount: 20,
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
    ai: {
      base: 6,
    },
  },
];
