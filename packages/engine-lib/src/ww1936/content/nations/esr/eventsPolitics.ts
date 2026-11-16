// ww229 (design ww227 §3, §5): Republican Spain's political events: the
// balance between the Communists and the anarchists, the fighting in the
// rear, the north cut off, the officers' plot for peace and what victory
// would mean. Data only (ContentPurity).
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../../helpers";
import { AT_ESN, BAND0, BAND4, BOP_ON, NOT_NEU } from "./conds";

export const ESR_EVENTS_POLITICS: EventDef[] = [
  {
    id: "esr_may_days",
    kind: "country",
    picture: "crowd",
    receivers: ["ESR"],
    trigger: all(AT_ESN, BOP_ON, { kind: "war_days_ge", days: 280 }),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -200 },
          { kind: "stability", pct: -3 },
          { kind: "pp", amount: 30 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "bop", amount: -50 },
          { kind: "stability", pct: -2 },
        ],
      },
      {
        id: "c",
        ai: { base: 10 },
        effects: [
          { kind: "bop", amount: 200 },
          { kind: "opinion", who: T("SUN"), of: "self", value: -20, days: 365 },
        ],
      },
    ],
  },
  {
    // The revolution's band: the committees run the rear.
    id: "esr_committees_rule",
    kind: "country",
    picture: "crowd",
    receivers: ["ESR"],
    trigger: BAND4,
    mtthDays: 60,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -150 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: -3 },
          { kind: "popularity", ideology: "communist", pp: 3 },
        ],
      },
    ],
  },
  {
    // The Communists' band: the party asks for the key ministries.
    id: "esr_pce_demands",
    kind: "country",
    picture: "table",
    receivers: ["ESR"],
    trigger: BAND0,
    mtthDays: 60,
    once: "never",
    cooldownDays: 365,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "bop", amount: -50 },
          { kind: "popularity", ideology: "communist", pp: 3 },
          { kind: "opinion", who: T("SUN"), of: "self", value: 15, days: 365 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "bop", amount: 150 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    id: "esr_north_cut_off",
    kind: "country",
    picture: "map",
    receivers: ["ESR"],
    trigger: all(AT_ESN, not({ kind: "controls_group", group: "esr_north" }), {
      kind: "war_days_ge",
      days: 30,
    }),
    mtthDays: 10,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "manpower", amount: 20000 },
          { kind: "war_support", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "add_spirit", id: "esr_guerrilleros", days: 180 },
          { kind: "stability", pct: -2 },
        ],
      },
    ],
  },
  {
    // Fired by esr_farewell_brigades.
    id: "esr_brigades_farewell",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "stability", pct: 2 },
          { kind: "war_support", pct: 3 },
        ],
      },
    ],
  },
  {
    // Fired by esr_thirteen_points.
    id: "esr_peace_feelers",
    kind: "country",
    picture: "table",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "war_support", pct: 3 },
          { kind: "stability", pct: -1 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 5 },
          { kind: "war_support", pct: -5 },
        ],
      },
    ],
  },
  {
    // A long war and a shaken rear: the officers want out.
    id: "esr_officers_plot",
    kind: "country",
    picture: "table",
    receivers: ["ESR"],
    trigger: all(AT_ESN, NOT_NEU, not({ kind: "stability_ge", pct: 35 }), {
      kind: "war_days_ge",
      days: 600,
    }),
    mtthDays: 60,
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "popularity", ideology: "neutral", pp: -5 },
        ],
      },
      {
        id: "b",
        history: true,
        ai: { base: 50 },
        effects: [
          { kind: "popularity", ideology: "neutral", pp: 8 },
          { kind: "war_support", pct: -5 },
        ],
      },
    ],
  },
  {
    // The Republic has won its war: what kind of Republic now?
    id: "esr_after_victory",
    kind: "country",
    picture: "crowd",
    receivers: ["ESR"],
    trigger: all(
      not({ kind: "has_spirit", id: "esp_civil_war_nation" }),
      not(AT_ESN),
      any(not(exists("ESN")), { kind: "capitulated", who: T("ESN") }),
    ),
    mtthDays: 10,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "stability", pct: 5 },
          { kind: "popularity", ideology: "democratic", pp: 5 },
        ],
      },
      {
        id: "b",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 8 },
          { kind: "bop", amount: 150 },
        ],
      },
      {
        id: "c",
        ai: { base: 20 },
        effects: [
          { kind: "popularity", ideology: "communist", pp: 8 },
          { kind: "bop", amount: -150 },
        ],
      },
    ],
  },
];
