// ww229: Nationalist China's national events. Most wait on a situation (a
// focus, the balance of the provinces, the war's length) rather than a date;
// the older pack and world events (the Xi'an incident, the united-front
// offer, the Burma Road, the American volunteers, a clique's answer) still
// fire beside them. chn_ev_south_anhui and chn_dec_front_conference work the
// united front's three states (uneasy, working, broken). self = the
// receiver, from = the sender of a fired one. Event numbers are not
// tripled. Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";

export const CHN_EVENTS: EventDef[] = [
  {
    id: "chn_ev_young_marshal",
    kind: "country",
    receivers: ["CHN"],
    picture: "table",
    trigger: {
      all: [
        { kind: "date_ge", date: "1937-01-01" },
        { kind: "nap_with", of: { tag: "CCP" } },
        { kind: "ruling", ideology: "neutral" },
      ],
    },
    mtthDays: 60,
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [
          { kind: "bop", amount: -60 },
          { kind: "stability", pct: 2 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: 60 },
          { kind: "war_support", pct: 4 },
          { kind: "opinion", of: { tag: "CCP" }, value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_red_army_renamed",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
          { kind: "opinion", of: "from", value: 20, days: 365 },
          { kind: "war_support", pct: 3 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", of: "from", value: -20, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_south_anhui",
    kind: "country",
    receivers: ["CHN"],
    picture: "column",
    trigger: {
      all: [
        { kind: "has_spirit", id: "chn_sp_front_uneasy" },
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "war_days_ge", days: 700 },
        { kind: "exists", who: { tag: "CCP" } },
      ],
    },
    mtthDays: 240,
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          {
            kind: "swap_spirit",
            from: "chn_sp_front_uneasy",
            to: "chn_sp_front_broken",
          },
          { kind: "opinion", of: { tag: "CCP" }, value: -35, days: 730 },
          { kind: "bop", amount: -40 },
          {
            kind: "fire_event",
            id: "ccp_new_fourth_clash",
            to: { tag: "CCP" },
          },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          {
            kind: "swap_spirit",
            from: "chn_sp_front_uneasy",
            to: "chn_sp_front_solid",
          },
          { kind: "stability", pct: -2 },
          { kind: "opinion", of: { tag: "CCP" }, value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_one_army_offer",
    kind: "country",
    picture: "document",
    humanDefault: "b",
    options: [
      {
        id: "a",
        ai: { base: 5 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: 30, days: 730 },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 95 },
        effects: [
          { kind: "opinion", of: "from", value: -15, days: 365 },
          { kind: "opinion", who: "from", of: "self", value: -15, days: 365 },
        ],
        history: true,
      },
    ],
  },
  {
    id: "chn_ev_soviet_credit",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        ai: {
          base: 70,
          mods: [
            { if: { kind: "at_war_with", of: { tag: "JPN" } }, factor: 150 },
          ],
        },
        effects: [
          { kind: "send_equipment", to: "from", type: "fighter", count: 60 },
          { kind: "send_equipment", to: "from", type: "light_tank", count: 40 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
        ],
        history: true,
        available: { not: { kind: "at_war_with", of: { tag: "CHN" } } },
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 180 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_ask_soviet_pilots",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [
          { kind: "volunteers", to: "from", planes: 60 },
          { kind: "opinion", who: "from", of: "self", value: 20, days: 365 },
        ],
        history: true,
        available: { not: { kind: "at_war_with", of: { tag: "CHN" } } },
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 180 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_berlin_choice",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        ai: {
          base: 25,
          mods: [
            { if: { kind: "same_faction", of: { tag: "JPN" } }, factor: 10 },
          ],
        },
        effects: [
          {
            kind: "send_equipment",
            to: "from",
            type: "infantry_equipment",
            count: 2000,
          },
          { kind: "opinion", of: "from", value: 25, days: 730 },
          { kind: "opinion", who: "from", of: "self", value: 25, days: 730 },
        ],
      },
      {
        id: "b",
        ai: { base: 75 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "fire_event", id: "chn_ev_advisers_recalled", to: "from" },
        ],
        history: true,
      },
    ],
  },
  {
    id: "chn_ev_advisers_recalled",
    kind: "country",
    receivers: ["CHN"],
    picture: "newspaper",
    trigger: {
      all: [
        { kind: "has_spirit", id: "chn_advisor_training" },
        {
          any: [
            { kind: "same_faction", who: { tag: "DEU" }, of: { tag: "JPN" } },
            { kind: "at_war_with", of: { tag: "DEU" } },
          ],
        },
      ],
    },
    mtthDays: 90,
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [
          { kind: "remove_spirit", id: "chn_advisor_training" },
          { kind: "stability", pct: -2 },
          { kind: "opinion", of: { tag: "DEU" }, value: -15, days: 365 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "remove_spirit", id: "chn_advisor_training" },
          { kind: "army_xp", amount: 10 },
          { kind: "opinion", of: { tag: "DEU" }, value: -30, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_inflation",
    kind: "country",
    receivers: ["CHN"],
    picture: "crowd",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "war_days_ge", days: 500 },
        { not: { kind: "has_spirit", id: "chn_sp_inflation" } },
      ],
    },
    mtthDays: 300,
    once: "never",
    cooldownDays: 720,
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: 80 },
          { kind: "add_spirit", id: "chn_sp_inflation", days: 365 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -4 },
          { kind: "war_support", pct: -2 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_henan_famine",
    kind: "country",
    receivers: ["CHN"],
    picture: "crowd",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "war_days_ge", days: 1500 },
      ],
    },
    mtthDays: 400,
    options: [
      {
        id: "a",
        ai: { base: 55 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "manpower", amount: -20000 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 45 },
        effects: [
          { kind: "pp", amount: -60 },
          { kind: "stability", pct: -1 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_road_closed",
    kind: "country",
    receivers: ["CHN"],
    picture: "map",
    trigger: {
      all: [
        { kind: "focus_done", id: "chn_road_to_burma" },
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "exists", who: { tag: "GBR" } },
        {
          not: { kind: "at_war_with", who: { tag: "GBR" }, of: { tag: "JPN" } },
        },
      ],
    },
    mtthDays: 360,
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: -2 },
          { kind: "opinion", of: { tag: "GBR" }, value: -10, days: 365 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "opinion", of: { tag: "USA" }, value: 10, days: 365 },
          { kind: "opinion", of: { tag: "GBR" }, value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_warlords_defiant",
    kind: "country",
    receivers: ["CHN"],
    picture: "border",
    trigger: {
      all: [
        { kind: "bop_range", tag: "CHN", band: 4 },
        { kind: "ruling", ideology: "neutral" },
      ],
    },
    mtthDays: 120,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "pp", amount: -40 },
          { kind: "bop", amount: -60 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -120 },
          { kind: "stability", pct: -3 },
          { kind: "army_xp", amount: 10 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_provinces_submit",
    kind: "country",
    receivers: ["CHN"],
    picture: "table",
    trigger: {
      all: [
        { kind: "bop_range", tag: "CHN", band: 0 },
        { kind: "ruling", ideology: "neutral" },
      ],
    },
    mtthDays: 120,
    once: "never",
    cooldownDays: 720,
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: 40 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "army_xp", amount: 10 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_no_more_concessions",
    kind: "country",
    receivers: ["CHN"],
    picture: "crowd",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { not: { kind: "war_days_ge", days: 60 } },
      ],
    },
    mtthDays: 10,
    options: [
      {
        id: "a",
        ai: { base: 80 },
        effects: [
          { kind: "war_support", pct: 6 },
          { kind: "stability", pct: 2 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_mediation",
    kind: "country",
    receivers: ["CHN"],
    picture: "document",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "war_days_ge", days: 150 },
        { kind: "exists", who: { tag: "DEU" } },
        { not: { kind: "at_war_with", of: { tag: "DEU" } } },
        { not: { kind: "focus_done", id: "chn_hear_the_terms" } },
      ],
    },
    mtthDays: 60,
    options: [
      {
        id: "a",
        ai: { base: 75 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: { tag: "JPN" }, value: -10, days: 365 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "war_support", pct: -4 },
          { kind: "opinion", of: { tag: "JPN" }, value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_vice_chairman_leaves",
    kind: "country",
    receivers: ["CHN"],
    picture: "newspaper",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "pop_ge", ideology: "fascist", pct: 15 },
        { not: { kind: "ruling", ideology: "fascist" } },
        { not: { kind: "focus_done", id: "chn_peace_government" } },
      ],
    },
    mtthDays: 500,
    options: [
      {
        id: "a",
        ai: { base: 65 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -4 },
          { kind: "stability", pct: -2 },
          { kind: "war_support", pct: 2 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_national_salvation",
    kind: "country",
    receivers: ["CHN"],
    picture: "crowd",
    trigger: {
      all: [
        { kind: "date_lt", date: "1938-01-01" },
        { kind: "pop_ge", ideology: "democratic", pct: 10 },
        { not: { kind: "at_war_with", of: { tag: "JPN" } } },
      ],
    },
    mtthDays: 200,
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "war_support", pct: 3 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_american_chief_of_staff",
    kind: "country",
    receivers: ["CHN"],
    picture: "table",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "same_faction", of: { tag: "USA" } },
        { kind: "focus_done", id: "chn_join_the_allies" },
      ],
    },
    mtthDays: 360,
    options: [
      {
        id: "a",
        ai: { base: 55 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", of: { tag: "USA" }, value: -15, days: 365 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 45 },
        effects: [
          { kind: "army_xp", amount: 15 },
          { kind: "stability", pct: -2 },
          { kind: "opinion", of: { tag: "USA" }, value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    id: "chn_ev_victory_at_the_canal",
    kind: "country",
    receivers: ["CHN"],
    picture: "column",
    trigger: {
      all: [
        { kind: "at_war_with", of: { tag: "JPN" } },
        { kind: "war_days_ge", days: 250 },
        { kind: "focus_done", id: "chn_space_for_time" },
      ],
    },
    mtthDays: 200,
    options: [
      {
        id: "a",
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "army_xp", amount: 15 },
        ],
        history: true,
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
];
