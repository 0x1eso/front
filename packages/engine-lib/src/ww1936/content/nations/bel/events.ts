// ww229: Belgium's national events. Most wait on a situation (a focus, the
// language balance, a neighbour's war) rather than a date. self = the
// receiver, from = the sender of a fired one. Event numbers are not tripled.
// Data only.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, after, all, any, done, flag, not } from "../../helpers";

export const BEL_EVENTS: EventDef[] = [
  // ---- the parties ----
  {
    // Rex and the Flemish nationalists break through at the polls.
    id: "bel_ev_rex_breakthrough",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(after("1936-05-01"), {
      kind: "ruling",
      ideology: "democratic",
    }),
    mtthDays: 45,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "fascist", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The dock and mine strikes spread across the country.
    id: "bel_ev_summer_strikes",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(after("1936-06-01"), {
      kind: "ruling",
      ideology: "democratic",
    }),
    mtthDays: 60,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "communist", pp: -1 },
          { kind: "pp", amount: -20 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "add_spirit", id: "bel_sp_strike_wave", days: 120 },
          { kind: "popularity", ideology: "communist", pp: 3 },
        ],
      },
    ],
  },
  {
    // Fired by bel_march_on_brussels.
    id: "bel_ev_march_on_brussels",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    // Degrelle forces a by-election in the capital.
    id: "bel_ev_brussels_by_election",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(
      after("1937-01-01"),
      { kind: "ruling", ideology: "democratic" },
      { kind: "pop_ge", ideology: "fascist", pct: 8 },
    ),
    mtthDays: 120,
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 75 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -4 },
          { kind: "popularity", ideology: "democratic", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 25 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // The Prime Minister's past at the National Bank is questioned.
    id: "bel_ev_national_bank_affair",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(
      after("1937-06-01"),
      { kind: "ruling", ideology: "democratic" },
      { kind: "has_advisor", person: "bel_van_zeeland" },
    ),
    mtthDays: 240,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "remove_advisor", person: "bel_van_zeeland" },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 1 },
          { kind: "stability", pct: -1 },
          { kind: "pp", amount: -25 },
        ],
      },
    ],
  },
  {
    // The two fascist movements quarrel once in power.
    id: "bel_ev_rex_vnv_quarrel",
    kind: "country",
    receivers: ["BEL"],
    trigger: { kind: "ruling", ideology: "fascist" },
    mtthDays: 180,
    picture: "table",
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: 100 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },

  // ---- the language balance ----
  {
    // Flemish grievances, again and again.
    id: "bel_ev_flemish_grievance",
    kind: "country",
    receivers: ["BEL"],
    trigger: not({ kind: "bop_range", tag: "BEL", band: 4 }),
    mtthDays: 300,
    once: "never",
    cooldownDays: 365,
    picture: "newspaper",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: 80 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: -40 },
          { kind: "popularity", ideology: "fascist", pp: 1 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // The Walloons answer a Flemish-leaning state.
    id: "bel_ev_walloon_congress",
    kind: "country",
    receivers: ["BEL"],
    trigger: any(
      { kind: "bop_range", tag: "BEL", band: 3 },
      { kind: "bop_range", tag: "BEL", band: 4 },
    ),
    mtthDays: 120,
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -100 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "communist", pp: 1 },
        ],
      },
    ],
  },
  {
    // Fired by bel_amnesty_law.
    id: "bel_ev_amnesty_vote",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "bop", amount: 60 },
          { kind: "popularity", ideology: "fascist", pp: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "bop", amount: -30 },
          { kind: "stability", pct: 1 },
        ],
      },
    ],
  },

  // ---- independence and the guarantors ----
  {
    // Fired by bel_independence: the King's speech to his ministers.
    id: "bel_ev_free_hands",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "bop", amount: 30 },
          { kind: "opinion", of: T("FRA"), value: -10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "opinion", of: T("FRA"), value: 10, days: 365 }],
      },
    ],
  },
  {
    // Brussels asks London or Paris to guarantee it (to = the guarantor).
    id: "bel_ev_guarantee_request",
    kind: "country",
    picture: "document",
    once: "never",
    timeoutSec: 30,
    humanDefault: "b",
    aiDelayDays: [7, 14],
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: {
          base: 50,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 30 }, factor: 200 },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 50 }, factor: 150 },
          ],
        },
        effects: [
          { kind: "guarantee", of: "from" },
          { kind: "opinion", of: "from", value: 10, days: 365 },
          { kind: "fire_event", id: "bel_ev_guarantee_given", to: "from" },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "fire_event", id: "bel_ev_guarantee_refused", to: "from" },
        ],
      },
    ],
  },
  {
    // The guarantor's answer: yes (from = the guarantor).
    id: "bel_ev_guarantee_given",
    kind: "country",
    picture: "newspaper",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "opinion", of: "from", value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    // The guarantor's answer: no (from = the refuser).
    id: "bel_ev_guarantee_refused",
    kind: "country",
    picture: "newspaper",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "opinion", of: "from", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // A German courier plane lands in Belgium with the invasion plans.
    id: "bel_ev_mechelen_incident",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(
      { kind: "exists", who: T("DEU") },
      { kind: "at_war_with", who: T("DEU"), of: T("FRA") },
      not({ kind: "at_war" }),
    ),
    mtthDays: 120,
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "bel_sp_mechelen_alert", days: 180 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "access", of: T("FRA") },
          { kind: "access", of: T("GBR") },
          { kind: "set_flag", flag: "bel_allies_called" },
          { kind: "opinion", of: T("DEU"), value: -30, days: 365 },
        ],
      },
    ],
  },

  // ---- the war ----
  {
    // The King and the government part ways over the war.
    id: "bel_ev_kings_choice",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "lost_vp_ge", pct: 30 },
    ),
    mtthDays: 10,
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "bel_sp_royal_question" },
          { kind: "war_support", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // Where the gold reserve goes when the war comes.
    id: "bel_ev_gold_reserve",
    kind: "country",
    receivers: ["BEL"],
    trigger: { kind: "at_war_with", of: T("DEU") },
    mtthDays: 20,
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "opinion", of: T("FRA"), value: 15, days: 365 },
          { kind: "pp", amount: 15 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "opinion", of: T("GBR"), value: 10, days: 365 },
          { kind: "opinion", of: T("USA"), value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // The Katanga uranium ore and the Americans.
    id: "bel_ev_shinkolobwe_ore",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(
      done("bel_shinkolobwe"),
      { kind: "exists", who: T("USA") },
      any({ kind: "at_war" }, after("1939-09-01")),
    ),
    mtthDays: 180,
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", of: T("USA"), value: 20, days: 730 },
          { kind: "set_flag", flag: "bel_ore_in_new_york" },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "pp", amount: 15 }],
      },
    ],
  },
  {
    // The Force Publique and the Italians in East Africa.
    id: "bel_ev_force_publique_north",
    kind: "country",
    receivers: ["BEL"],
    trigger: all(
      { kind: "at_war_with", of: T("ITA") },
      { kind: "owns_group", group: "bel_congo" },
    ),
    mtthDays: 90,
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "army_xp", amount: 5 },
          { kind: "war_support", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "stability", pct: 1 }],
      },
    ],
  },

  // ---- the Low Countries ----
  {
    // Brussels offers a union (to = Luxembourg or the Netherlands).
    id: "bel_ev_union_offer",
    kind: "country",
    picture: "table",
    once: "never",
    timeoutSec: 30,
    humanDefault: "b",
    aiDelayDays: [7, 14],
    options: [
      {
        id: "a",
        available: not({ kind: "at_war_with", of: "from" }),
        ai: {
          base: 5,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 60 }, factor: 400 },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 60 }, factor: 200 },
            { if: { kind: "is_major" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "bel_lowlands_joined" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 60 },
        effects: [
          { kind: "fire_event", id: "bel_ev_union_refused", to: "from" },
        ],
      },
    ],
  },
  {
    // The answer: no (from = the refuser).
    id: "bel_ev_union_refused",
    kind: "country",
    picture: "document",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 1 },
        effects: [
          { kind: "opinion", of: "from", value: -10, days: 365 },
          { kind: "pp", amount: 20 },
        ],
      },
    ],
  },
  {
    // A union joined: Dutch speakers gain weight in the common state.
    id: "bel_ev_lowlands_news",
    kind: "country",
    receivers: ["BEL"],
    trigger: flag("bel_lowlands_joined"),
    mtthDays: 30,
    picture: "newspaper",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [{ kind: "stability", pct: 2 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "bop", amount: 60 }],
      },
    ],
  },
];
