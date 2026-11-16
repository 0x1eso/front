// ww229: the Netherlands' events. Texts ww1936.event_title.<id>,
// ww1936.event_desc.<id>, ww1936.event_opt.<id>.<option>. Inside a fired
// event self is the receiver and from the sender. No event waits for a
// calendar day: each one fires when its situation arises (the AI judges it).
// Effects that can make a country vanish (annex) come last.
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, done, exists, flag, not, T } from "../../helpers";

export const NLD_EVENTS: readonly EventDef[] = [
  {
    // Fired by nld_gold_bloc: the bankers want the guilder kept on gold.
    id: "nld_bankers_letter",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "stability", pct: 2 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "pp", amount: 40 },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // Fired by nld_lunteren_rallies: the NSB's summer day on its own field.
    id: "nld_lunteren_day",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 40 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -2 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by nld_jordaan_remembered: the unemployed march again.
    id: "nld_unemployed_march",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        ai: { base: 60 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "popularity", ideology: "communist", pp: -1 },
        ],
      },
    ],
  },
  {
    // Fired by nld_north_east_polder: the new land lies dry.
    id: "nld_polder_falls_dry",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "manpower", recruitablePct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "build", where: { best: 1 }, building: "civ", count: 1 },
        ],
      },
    ],
  },
  {
    // Fired by nld_oslo_states: the small neutral traders meet again.
    id: "nld_oslo_convention",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "opinion", who: T("SWE"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("NOR"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("DNK"), of: "self", value: 15, days: 365 },
          { kind: "opinion", who: T("BEL"), of: "self", value: 15, days: 365 },
          { kind: "pp", amount: 20 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "pp", amount: 40 }],
      },
    ],
  },
  {
    // Fired by nld_volksraad_petition: the Volksraad asks for self-rule in
    // ten years.
    id: "nld_soetardjo_petition",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "pp", amount: 30 },
          { kind: "popularity", ideology: "communist", pp: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "add_spirit", id: "nld_indies_commonwealth" },
          { kind: "stability", pct: -1 },
        ],
      },
    ],
  },
  {
    // The confessional cabinet breaks over money; the socialists are asked in.
    id: "nld_cabinet_falls",
    kind: "country",
    picture: "table",
    receivers: ["NLD"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      not(done("nld_socialists_in_cabinet")),
      done("nld_which_netherlands"),
    ),
    mtthDays: 300,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "popularity", ideology: "democratic", pp: 3 },
          { kind: "stability", pct: 2 },
          { kind: "add_advisor_candidate", person: "nld_drees" },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "pp", amount: 50 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // The NSB stands at the polls again; the churches speak against it.
    id: "nld_nsb_at_the_polls",
    kind: "country",
    picture: "newspaper",
    receivers: ["NLD"],
    trigger: all(
      { kind: "ruling", ideology: "democratic" },
      { kind: "pop_ge", ideology: "fascist", pct: 5 },
    ),
    mtthDays: 400,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: -3 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "fascist", pp: 2 },
          { kind: "pp", amount: 30 },
        ],
      },
    ],
  },
  {
    // The queen has reigned forty years; the country turns orange.
    id: "nld_queens_jubilee",
    kind: "country",
    picture: "crowd",
    receivers: ["NLD"],
    trigger: all(
      not({ kind: "at_war" }),
      not({ kind: "ruling", ideology: "communist" }),
      done("nld_crisis_cabinet"),
    ),
    mtthDays: 700,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [{ kind: "stability", pct: 3 }],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [{ kind: "pp", amount: 40 }],
      },
    ],
  },
  {
    // Germany goes to war; The Hague must decide how far to mobilise.
    id: "nld_mobilisation_question",
    kind: "country",
    picture: "column",
    receivers: ["NLD"],
    trigger: all(
      exists("DEU"),
      { kind: "at_war", who: T("DEU") },
      not({ kind: "at_war" }),
    ),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "nld_mobilised" },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: 1 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    // German agents lure British officers to the border at Venlo.
    id: "nld_venlo_incident",
    kind: "country",
    picture: "border",
    receivers: ["NLD"],
    trigger: all(
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("DEU") }),
      not({ kind: "same_faction", of: T("GBR") }),
    ),
    mtthDays: 120,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "stability", pct: -1 },
          { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "opinion", who: T("DEU"), of: "self", value: -15, days: 365 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // Belgium, as uneasy as the Netherlands, proposes secret staff talks.
    id: "nld_belgian_proposal",
    kind: "country",
    picture: "map",
    receivers: ["NLD"],
    trigger: all(
      exists("BEL"),
      exists("DEU"),
      { kind: "ruling", who: T("DEU"), ideology: "fascist" },
      not({ kind: "at_war" }),
      not(done("nld_joint_defence")),
    ),
    mtthDays: 400,
    options: [
      {
        id: "a",
        history: true,
        ai: {
          base: 60,
          mods: [{ if: done("nld_western_talks"), factor: 30 }],
        },
        effects: [
          { kind: "opinion", who: T("BEL"), of: "self", value: -5, days: 365 },
          { kind: "stability", pct: 1 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "opinion", who: T("BEL"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // German columns cross the border; the defence falls back on the water.
    id: "nld_invasion",
    kind: "country",
    picture: "column",
    receivers: ["NLD"],
    trigger: { kind: "at_war_with", of: T("DEU") },
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "stability", pct: 2 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "war_support", pct: -3 },
          { kind: "stability", pct: 3 },
        ],
      },
    ],
  },
  {
    // The bombers stand over Rotterdam; a threat lies on the table.
    id: "nld_rotterdam_threat",
    kind: "country",
    picture: "newspaper",
    receivers: ["NLD"],
    trigger: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "war_days_ge", days: 4 },
      not({ kind: "is_exile" }),
    ),
    mtthDays: 10,
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "war_support", pct: -3 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "war_support", pct: 4 },
          { kind: "stability", pct: -5 },
        ],
      },
    ],
  },
  {
    // Occupied Amsterdam stops work for the persecuted.
    id: "nld_february_strike",
    kind: "country",
    picture: "crowd",
    receivers: ["NLD"],
    trigger: { kind: "controls_capital_of", who: T("DEU"), of: "self" },
    mtthDays: 200,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "resistance", group: "nld_holland", pct: 10 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [{ kind: "stability", pct: 2 }],
      },
    ],
  },
  {
    // Tokyo sends a delegation to Batavia and asks for oil.
    id: "nld_japanese_demands",
    kind: "country",
    picture: "document",
    receivers: ["NLD"],
    trigger: all(
      exists("JPN"),
      { kind: "at_war", who: T("JPN") },
      not({ kind: "at_war_with", of: T("JPN") }),
      done("nld_indies_question"),
    ),
    mtthDays: 200,
    options: [
      {
        id: "a",
        ai: {
          base: 35,
          mods: [{ if: flag("nld_assets_frozen"), factor: 0 }],
        },
        effects: [
          { kind: "opinion", who: T("JPN"), of: "self", value: 20, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
          { kind: "pp", amount: 25 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "opinion", who: T("JPN"), of: "self", value: -10, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Japanese landings in the Indies.
    id: "nld_indies_invaded",
    kind: "country",
    picture: "map",
    receivers: ["NLD"],
    trigger: { kind: "at_war_with", of: T("JPN") },
    timeoutSec: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 65 },
        effects: [
          { kind: "war_support", pct: 5 },
          { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
          { kind: "opinion", who: T("AUS"), of: "self", value: 10, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 35 },
        effects: [
          { kind: "fort", where: { regions: [1094] }, amount: 2 },
          { kind: "war_support", pct: 2 },
        ],
      },
    ],
  },
  {
    // Fired by nld_union_belgium / nld_union_luxembourg / nld_propose_union
    // to the neighbour: join the Netherlands in one state.
    id: "nld_union_offer",
    kind: "country",
    picture: "document",
    once: "never",
    humanDefault: "b",
    options: [
      {
        id: "a",
        ai: {
          base: 20,
          mods: [
            { if: { kind: "opinion_ge", of: "from", value: 60 }, factor: 300 },
            { if: { kind: "same_faction", of: "from" }, factor: 200 },
            { if: { kind: "threat_ge", of: T("DEU"), pct: 50 }, factor: 200 },
            { if: { kind: "is_human" }, factor: 0 },
          ],
        },
        effects: [
          { kind: "set_flag", who: "from", flag: "nld_union_grew" },
          { kind: "annex", who: "from", target: "self", units: "transfer" },
        ],
      },
      {
        id: "b",
        ai: { base: 80 },
        effects: [
          { kind: "opinion", who: "from", of: "self", value: -10, days: 365 },
          { kind: "fire_event", id: "nld_union_refused", to: "from" },
        ],
      },
    ],
  },
  {
    // Fired back to The Hague by a neighbour that said no.
    id: "nld_union_refused",
    kind: "country",
    picture: "newspaper",
    once: "never",
    options: [
      {
        id: "a",
        ai: { base: 80 },
        effects: [{ kind: "stability", pct: -1 }],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "pp", amount: 20 },
          { kind: "opinion", of: "from", value: -15, days: 365 },
        ],
      },
    ],
  },
];
