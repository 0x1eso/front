// ww229: Argentina's events. Triggered ones check the situation, never a day;
// the rest are fired by the tree or a decision (self = the receiver). Data
// only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { after, all, any, exists, flag, not, T } from "../../helpers";

export const ARG_EVENTS: EventDef[] = [
  {
    // The Senate's inquiry into the meat trade and the British packers.
    id: "arg_ev_meat_inquiry",
    kind: "country",
    receivers: ["ARG"],
    trigger: { kind: "ruling", ideology: "neutral" },
    mtthDays: 200,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "bop", amount: -50 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // The presidential election of the Concordancia's second term.
    id: "arg_ev_presidential_election",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(after("1937-06-01"), { kind: "ruling", ideology: "neutral" }),
    mtthDays: 90,
    once: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 4 },
          { kind: "popularity", ideology: "democratic", pp: -3 },
          { kind: "stability", pct: -3 },
          { kind: "bop", amount: -100 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 6 },
          { kind: "stability", pct: 2 },
          { kind: "bop", amount: 50 },
        ],
      },
    ],
  },
  {
    // Fired by arg_ortiz_succession: the president's illness.
    id: "arg_ev_ortiz_illness",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "stability", pct: -2 },
          { kind: "bop", amount: -100 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "stability", pct: -1 },
          { kind: "pp", amount: -30 },
        ],
      },
    ],
  },
  {
    // A land deal for the army's El Palomar field shames the government.
    id: "arg_ev_palomar_scandal",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(after("1939-06-01"), { kind: "ruling", ideology: "neutral" }),
    mtthDays: 240,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "bop", amount: 100 },
        ],
      },
    ],
  },
  {
    // The officers' lodge is found out.
    id: "arg_ev_lodge_discovered",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      not({ kind: "ruling", ideology: "fascist" }),
      any(
        { kind: "bop_range", tag: "ARG", band: 3 },
        { kind: "bop_range", tag: "ARG", band: 4 },
      ),
    ),
    mtthDays: 120,
    cooldownDays: 365,
    once: "never",
    picture: "document",
    options: [
      {
        id: "a",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "stability", pct: -2 },
          { kind: "army_xp", amount: -5 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
        ],
      },
    ],
  },
  {
    // The barracks march on the capital.
    id: "arg_ev_barracks_march",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "bop_range", tag: "ARG", band: 4 },
    ),
    mtthDays: 60,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 5 },
          { kind: "civil_war", ideology: "fascist" },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: -300 },
          { kind: "stability", pct: -5 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by arg_german_arms_deal: an envoy to Berlin is taken off his ship.
    id: "arg_ev_spy_scandal",
    kind: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "arg_sp_spy_scandal", days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Washington presses the last neutral republic.
    id: "arg_ev_us_pressure",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not(flag("arg_broke_with_axis")),
      not({ kind: "same_faction", of: T("DEU") }),
      not({ kind: "same_faction", of: T("USA") }),
    ),
    mtthDays: 180,
    once: "never",
    cooldownDays: 365,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", who: T("USA"), of: "self", value: -20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "set_flag", flag: "arg_broke_with_axis" },
          { kind: "opinion", who: T("USA"), of: "self", value: 25, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -25, days: 365 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The packinghouse workers walk out.
    id: "arg_ev_packinghouse_strike",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      { kind: "pop_ge", ideology: "communist", pct: 10 },
      not({ kind: "ruling", ideology: "communist" }),
    ),
    mtthDays: 300,
    once: "never",
    cooldownDays: 540,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: 1 },
          { kind: "popularity", ideology: "communist", pp: -2 },
          { kind: "popularity", ideology: "democratic", pp: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: -25 },
          { kind: "popularity", ideology: "ruling", pp: 2 },
        ],
      },
    ],
  },
  {
    // With no ships to carry it, the harvest piles up in the ports.
    id: "arg_ev_maize_as_fuel",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      any({ kind: "at_war", who: T("GBR") }, { kind: "at_war", who: T("DEU") }),
      not({ kind: "at_war" }),
    ),
    mtthDays: 300,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "fuel", amount: 15000 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: -40 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by arg_united_provinces_offer to Uruguay and Paraguay (from = Argentina).
    id: "arg_ev_union_offer",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: {
          base: 25,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 50 }, factor: 200 },
            {
              if: { kind: "threat_ge", of: { tag: "BRA" }, pct: 50 },
              factor: 150,
            },
          ],
        },
        effects: [
          { kind: "set_gflag", flag: "arg_union_joined" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 75 },
        effects: [
          {
            kind: "if",
            cond: { kind: "tag", tag: "URY" },
            then: [{ kind: "set_gflag", flag: "arg_ury_refused" }],
            else: [{ kind: "set_gflag", flag: "arg_pry_refused" }],
          },
          { kind: "opinion", who: "from", of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // The Antarctic sector and the islands: a note to London.
    id: "arg_ev_malvinas_note",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      flag("arg_malvinas_claimed"),
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    mtthDays: 365,
    once: "never",
    cooldownDays: 720,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 2 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "pp", amount: 20 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // An earthquake levels a provincial capital at the foot of the Andes.
    id: "arg_ev_san_juan_earthquake",
    kind: "country",
    receivers: ["ARG"],
    trigger: after("1942-01-01"),
    mtthDays: 500,
    once: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "ruling", pp: 3 },
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: -30 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "stability", pct: -3 }],
      },
    ],
  },
  {
    // The Chaco peace conference meets in Buenos Aires.
    id: "arg_ev_chaco_conference",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(exists("BOL"), exists("PRY")),
    mtthDays: 90,
    once: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "opinion", who: T("BOL"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("PRY"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "pp", amount: 20 }],
      },
    ],
  },
  {
    // The foreign minister's peace prize.
    id: "arg_ev_peace_prize",
    kind: "country",
    receivers: ["ARG"],
    trigger: { kind: "ruling", ideology: "neutral" },
    mtthDays: 60,
    once: "country",
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "stability", pct: 3 }],
      },
    ],
  },
  {
    // Students against the generals.
    id: "arg_ev_university_protests",
    kind: "country",
    receivers: ["ARG"],
    trigger: { kind: "ruling", ideology: "fascist" },
    mtthDays: 200,
    once: "never",
    cooldownDays: 540,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "democratic", pp: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
  {
    // The colonel of the workers is arrested, and the workers march for him.
    id: "arg_ev_colonel_arrested",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(flag("arg_labour_secretariat"), {
      kind: "ruling",
      ideology: "fascist",
    }),
    mtthDays: 240,
    once: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "set_leader", person: "arg_peron" },
          { kind: "popularity", ideology: "fascist", pp: 5 },
          { kind: "stability", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -5 },
          { kind: "popularity", ideology: "democratic", pp: 3 },
        ],
      },
    ],
  },
  {
    // Brazil arms with American help; the general staff counts the gap.
    id: "arg_ev_brazil_arms",
    kind: "country",
    receivers: ["ARG"],
    trigger: all(
      after("1940-01-01"),
      exists("BRA"),
      not({ kind: "same_faction", of: T("BRA") }),
    ),
    mtthDays: 365,
    once: "country",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "pp", amount: -30 },
          { kind: "army_xp", amount: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("BRA"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },
];
