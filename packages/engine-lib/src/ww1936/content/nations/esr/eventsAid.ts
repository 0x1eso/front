// ww229 (design ww227 §3, §6): Republican Spain's events of the war and
// the foreign aid, as it came: nothing at the start, the first Soviet tanks
// and aircraft some months into the war once the gold has gone to Moscow,
// then shipments while the war lasts, at the mercy of the submarines in
// the Mediterranean. Triggers read the world, not the calendar. Who is who:
// self = the receiver, from = the sender. Data only (ContentPurity).
import type { EventDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../../helpers";
import { AT_ESN, PARIS_GOLD, SOVIET_GOLD } from "./conds";

export const ESR_EVENTS_AID: EventDef[] = [
  {
    // Fired by esr_arm_the_people.
    id: "esr_arms_for_unions",
    kind: "country",
    picture: "crowd",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "add_spirit", id: "esr_militia_columns" },
          {
            kind: "divisions",
            template: "esr_militia_column",
            count: 2,
            where: "capital",
          },
          { kind: "bop", amount: 100 },
          { kind: "stability", pct: -3 },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          {
            kind: "divisions",
            template: "infantry",
            count: 1,
            where: "capital",
          },
          { kind: "bop", amount: -50 },
          { kind: "stability", pct: 2 },
        ],
      },
    ],
  },
  {
    id: "esr_komsomol_arrives",
    kind: "country",
    picture: "document",
    receivers: ["ESR"],
    trigger: all(AT_ESN, SOVIET_GOLD, exists("SUN"), {
      kind: "war_days_ge",
      days: 60,
    }),
    mtthDays: 15,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: 50 },
          { kind: "bop", amount: -50 },
        ],
      },
    ],
  },
  {
    id: "esr_soviet_planes",
    kind: "country",
    picture: "document",
    receivers: ["ESR"],
    trigger: all(AT_ESN, SOVIET_GOLD, exists("SUN"), {
      kind: "war_days_ge",
      days: 100,
    }),
    mtthDays: 20,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "equipment", type: "fighter", gen: 1, count: 60 },
          { kind: "equipment", type: "bomber", gen: 1, count: 15 },
          { kind: "bop", amount: -50 },
        ],
      },
    ],
  },
  {
    id: "esr_soviet_shipments",
    kind: "country",
    picture: "factory",
    receivers: ["ESR"],
    trigger: all(AT_ESN, SOVIET_GOLD, exists("SUN"), {
      kind: "war_days_ge",
      days: 200,
    }),
    mtthDays: 60,
    once: "never",
    cooldownDays: 240,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 70 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: 20 },
          { kind: "equipment", type: "fighter", gen: 1, count: 20 },
          { kind: "equipment", type: "artillery", gen: 1, count: 100 },
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 1500,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: 30 },
          { kind: "equipment", type: "fighter", gen: 1, count: 30 },
          { kind: "pp", amount: -40 },
          { kind: "bop", amount: -100 },
        ],
      },
    ],
  },
  {
    id: "esr_bt_regiment",
    kind: "country",
    picture: "column",
    receivers: ["ESR"],
    trigger: all(AT_ESN, SOVIET_GOLD, exists("SUN"), {
      kind: "war_days_ge",
      days: 380,
    }),
    mtthDays: 30,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: 50 },
          { kind: "army_xp", amount: 5 },
        ],
      },
    ],
  },
  {
    id: "esr_paris_purchases",
    kind: "country",
    picture: "document",
    receivers: ["ESR"],
    trigger: all(AT_ESN, PARIS_GOLD, { kind: "war_days_ge", days: 90 }),
    mtthDays: 45,
    once: "never",
    cooldownDays: 240,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "equipment", type: "fighter", gen: 1, count: 10 },
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 1000,
          },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 2000,
          },
          { kind: "opinion", who: T("FRA"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    id: "esr_ships_sunk",
    kind: "country",
    picture: "newspaper",
    receivers: ["ESR"],
    trigger: all(
      AT_ESN,
      any(SOVIET_GOLD, PARIS_GOLD),
      exists("ITA"),
      not({ kind: "at_war_with", of: T("ITA") }),
      { kind: "war_days_ge", days: 330 },
    ),
    mtthDays: 60,
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: -10 },
          { kind: "equipment", type: "fighter", gen: 1, count: -10 },
          { kind: "war_support", pct: 3 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "equipment", type: "light_tank", gen: 1, count: -5 },
          { kind: "pp", amount: -30 },
          { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by esr_mexican_rifles.
    id: "esr_mexican_shipment",
    kind: "country",
    picture: "document",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 2000,
          },
          { kind: "opinion", of: T("MEX"), value: 20, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by esr_french_frontier.
    id: "esr_french_border",
    kind: "country",
    picture: "border",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          {
            kind: "equipment",
            type: "infantry_equipment",
            gen: 1,
            count: 1000,
          },
          { kind: "equipment", type: "artillery", gen: 1, count: 50 },
          { kind: "pp", amount: -20 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "equipment", type: "fighter", gen: 1, count: 15 },
          { kind: "opinion", who: T("FRA"), of: "self", value: -10, days: 365 },
        ],
      },
    ],
  },
  {
    // Fired by esr_kirovabad.
    id: "esr_kirovabad_pilots",
    kind: "country",
    picture: "column",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 1 },
        effects: [{ kind: "add_spirit", id: "esr_spanish_pilots" }],
      },
    ],
  },
  {
    // Fired by esr_moroccan_offer to the Nationalists.
    id: "esr_rif_rising",
    kind: "country",
    picture: "map",
    options: [
      {
        id: "a",
        history: true,
        ai: { base: 60 },
        effects: [
          { kind: "add_spirit", id: "esr_rif_unrest", days: 180 },
          { kind: "manpower", amount: -10000 },
        ],
      },
      {
        id: "b",
        ai: { base: 40 },
        effects: [
          { kind: "stability", pct: -3 },
          { kind: "pp", amount: -30 },
        ],
      },
    ],
  },
];
