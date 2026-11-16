// ww229 (design ww227 §3, §5): Nationalist Spain's events. The base content
// already has the war's start and end (esp_civil_war, esp_civil_war_won,
// esp_civil_war_ends), Madrid, the Ebro and Hendaye (events/spa.ts); these
// add the regime's own crises, the balance between the Falange and the
// Traditionalists, the wolfram and the Iberian union. Triggers read the
// world, not the calendar. Who is who: self = the receiver, from = the
// sender. Data only (ContentPurity).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../../helpers";

const AT_ESR: Condition = { kind: "at_war_with", of: T("ESR") };
const PEACE_AT_HOME: Condition = all(
  not({ kind: "has_spirit", id: "esp_civil_war_nation" }),
  not(AT_ESR),
);
const FASCIST: Condition = { kind: "ruling", ideology: "fascist" };
/** Germany is beaten or gone. */
const AXIS_LOST: Condition = any(
  { kind: "capitulated", who: T("DEU") },
  not(exists("DEU")),
);
const BAND0: Condition = { kind: "bop_range", tag: "ESN", band: 0 };
const BAND1: Condition = { kind: "bop_range", tag: "ESN", band: 1 };
const BAND2: Condition = { kind: "bop_range", tag: "ESN", band: 2 };
const BAND3: Condition = { kind: "bop_range", tag: "ESN", band: 3 };
const BAND4: Condition = { kind: "bop_range", tag: "ESN", band: 4 };

export const ESN_EVENTS: EventDef[] = [
  {
    // Fired by esn_unification_decree.
    id: "esn_unification_crisis",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "bop", amount: 50 },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "c",
        ai: { base: 10 },
        effects: [
          { kind: "bop", amount: 150 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Fired by esn_foreign_aid: the German trading company that paid for
    // arms with Spanish ore.
    id: "esn_hisma_offer",
    kind: "country",
    picture: "factory",
    options: [
      {
        id: "a",
        history: true,
        available: exists("DEU"),
        ai: { base: 70 },
        effects: [
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 1500,
          },
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: 30 },
          {
            kind: "if",
            cond: exists("DEU"),
            then: [
              {
                kind: "opinion",
                who: T("DEU"),
                of: "self",
                value: -10,
                days: 365,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    // A banker's credit pays for the first months of the war.
    id: "esn_banker_credit",
    kind: "country",
    picture: "document",
    receivers: ["ESN"],
    trigger: AT_ESR,
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    id: "esn_carlist_defiance",
    kind: "country",
    picture: "crowd",
    receivers: ["ESN"],
    trigger: all(FASCIST, any(BAND3, BAND4)),
    mtthDays: 60,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: 50 },
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: -30 },
        ],
      },
    ],
  },
  {
    id: "esn_old_shirts",
    kind: "country",
    picture: "crowd",
    receivers: ["ESN"],
    trigger: all(FASCIST, any(BAND0, BAND1)),
    mtthDays: 60,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: 150 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 50 },
        effects: [
          { kind: "bop", amount: -50 },
          { kind: "popularity", ideology: "fascist", pp: 4 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // A grenade at a Carlist gathering, thrown by Falangists.
    id: "esn_shrine_incident",
    kind: "country",
    picture: "newspaper",
    receivers: ["ESN"],
    trigger: all(FASCIST, PEACE_AT_HOME, any(BAND1, BAND2, BAND3)),
    mtthDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "pp", amount: -30 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "bop", amount: 150 },
          { kind: "popularity", ideology: "fascist", pp: -3 },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    id: "esn_hungry_years",
    kind: "country",
    picture: "crowd",
    receivers: ["ESN"],
    trigger: all(FASCIST, PEACE_AT_HOME),
    mtthDays: 90,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 50 },
        effects: [{ kind: "stability", pct: -4 }],
      },
      {
        id: "b",
        available: all(
          exists("ARG"),
          not({ kind: "at_war_with", of: T("ARG") }),
        ),
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: 3 },
          { kind: "pp", amount: -40 },
          { kind: "opinion", who: T("ARG"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by esn_tangier.
    id: "esn_tangier_zone",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "opinion", who: T("GBR"), of: "self", value: -20, days: 365 },
          { kind: "opinion", who: T("FRA"), of: "self", value: -20, days: 365 },
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    id: "esn_rock_offer",
    kind: "country",
    picture: "table",
    receivers: ["ESN"],
    trigger: all(
      exists("DEU"),
      { kind: "at_war_with", who: T("DEU"), of: T("GBR") },
      not({ kind: "at_war" }),
      not({ kind: "in_faction" }),
      PEACE_AT_HOME,
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        available: { kind: "owns_group", who: T("GBR"), group: "gibraltar" },
        ai: {
          base: 20,
          mods: [{ if: { kind: "character", is: "revisionist" }, factor: 200 }],
        },
        effects: [
          { kind: "unlock_decision", id: "gen_join_axis" },
          { kind: "war_goal", on: T("GBR"), type: "claim", group: "gibraltar" },
          { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
        ],
      },
      {
        id: "c",
        ai: { base: 10 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
        ],
      },
    ],
  },
  {
    id: "esn_oil_pressure",
    kind: "country",
    picture: "document",
    receivers: ["ESN"],
    trigger: all(
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      { kind: "has_spirit", id: "spa_wolfram_trade" },
      not({ kind: "at_war" }),
    ),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "remove_spirit", id: "spa_wolfram_trade" },
          { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "fuel", amount: -5000 },
          { kind: "stability", pct: -3 },
        ],
      },
    ],
  },
  {
    id: "esn_pretender_manifesto",
    kind: "country",
    picture: "newspaper",
    receivers: ["ESN"],
    trigger: all(FASCIST, AXIS_LOST),
    mtthDays: 60,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 3 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 8 },
          { kind: "bop", amount: 100 },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "popularity", ideology: "neutral", pp: -3 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    id: "esn_world_turns_away",
    kind: "country",
    picture: "newspaper",
    receivers: ["ESN"],
    trigger: all(FASCIST, AXIS_LOST, PEACE_AT_HOME),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "war_support", pct: 3 },
          { kind: "opinion", who: T("USA"), of: "self", value: -15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 4 },
          { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    id: "esn_sierra_raids",
    kind: "country",
    picture: "column",
    receivers: ["ESN"],
    trigger: all(FASCIST, PEACE_AT_HOME, {
      kind: "pop_ge",
      ideology: "communist",
      pct: 10,
    }),
    mtthDays: 120,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: -4 },
          { kind: "stability", pct: -2 },
          { kind: "army_xp", amount: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 2 },
          { kind: "stability", pct: 3 },
        ],
      },
    ],
  },
  {
    id: "esn_generals_letter",
    kind: "country",
    picture: "document",
    receivers: ["ESN"],
    trigger: all(FASCIST, PEACE_AT_HOME, {
      kind: "pop_ge",
      ideology: "neutral",
      pct: 25,
    }),
    mtthDays: 180,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: -2 },
          { kind: "popularity", ideology: "neutral", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 5 },
          { kind: "bop", amount: 100 },
        ],
      },
      {
        id: "c",
        ai: { base: 10 },
        effects: [
          { kind: "stability", pct: -4 },
          { kind: "war_support", pct: -3 },
        ],
      },
    ],
  },
  {
    // Fired by esn_union_offer to Portugal; from = Spain. Lisbon weighs its
    // opinion of Madrid and the danger it is in.
    id: "esn_iberian_union",
    kind: "country",
    picture: "table",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: {
          base: 5,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 60 }, factor: 400 },
            {
              if: { kind: "strength_ratio_ge", vs: "from", permille: 1000 },
              factor: 20,
            },
          ],
        },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: 30, days: 365 },
          {
            kind: "annex",
            who: "from",
            target: "self",
            units: "transfer",
            core: true,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 90 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
        ],
      },
      {
        id: "c",
        ai: { base: 5 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -25, days: 365 },
          { kind: "war_support", pct: 5 },
        ],
      },
    ],
  },
  {
    id: "esn_eastern_volunteers",
    kind: "country",
    picture: "column",
    receivers: ["ESN"],
    trigger: all(
      FASCIST,
      exists("DEU"),
      { kind: "at_war_with", who: T("DEU"), of: T("SUN") },
      not({ kind: "at_war" }),
    ),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "unlock_decision", id: "spa_send_eastern_division" },
          { kind: "popularity", ideology: "fascist", pp: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
];
