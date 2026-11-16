// ww229 (design ww227 §5): Nationalist Spain's decisions. The first three
// move the balance between the Falange (−) and the Traditionalists (+)
// (core.ts BOP row); the rest are the regime's levers: welfare, wolfram,
// Moroccan recruits, grain, the hunt for the guerrillas. Data only
// (ContentPurity).
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../../helpers";

const BAND0: Condition = { kind: "bop_range", tag: "ESN", band: 0 };
const BAND1: Condition = { kind: "bop_range", tag: "ESN", band: 1 };
const BAND2: Condition = { kind: "bop_range", tag: "ESN", band: 2 };
const BAND3: Condition = { kind: "bop_range", tag: "ESN", band: 3 };
const BAND4: Condition = { kind: "bop_range", tag: "ESN", band: 4 };
/** The balance is on (any band). */
const BOP_ON: Condition = any(BAND0, BAND1, BAND2, BAND3, BAND4);

export const ESN_DECISIONS: DecisionDef[] = [
  {
    id: "esn_favour_falange",
    category: "political",
    for: ["ESN"],
    available: BOP_ON,
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      { kind: "bop", amount: -150 },
      { kind: "popularity", ideology: "fascist", pp: 2 },
    ],
    ai: {
      base: 5,
      mods: [
        { if: any(BAND0, BAND1), factor: 0 },
        { if: BAND4, factor: 400 },
      ],
    },
  },
  {
    id: "esn_favour_traditionalists",
    category: "political",
    for: ["ESN"],
    available: BOP_ON,
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      { kind: "bop", amount: 150 },
      { kind: "popularity", ideology: "neutral", pp: 2 },
    ],
    ai: {
      base: 5,
      mods: [
        { if: any(BAND3, BAND4), factor: 0 },
        { if: BAND0, factor: 400 },
      ],
    },
  },
  {
    // The army steps in: whichever side leads loses ground.
    id: "esn_army_arbitrates",
    category: "political",
    for: ["ESN"],
    available: all(BOP_ON, not(BAND2)),
    cost: { pp: 40 },
    cooldownDays: 120,
    effects: [
      {
        kind: "if",
        cond: any(BAND0, BAND1),
        then: [{ kind: "bop", amount: 150 }],
        else: [{ kind: "bop", amount: -150 }],
      },
      { kind: "stability", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esn_social_aid",
    category: "political",
    for: ["ESN"],
    available: { kind: "ruling", ideology: "fascist" },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "stability", pct: 3 },
      { kind: "popularity", ideology: "fascist", pp: 2 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "stability_ge", pct: 60 }, factor: 0 }],
    },
  },
  {
    id: "esn_wolfram_to_germany",
    category: "economy",
    for: ["ESN"],
    available: all(exists("DEU"), not({ kind: "at_war_with", of: T("DEU") })),
    cost: { pp: 20 },
    cooldownDays: 120,
    effects: [
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 800 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 180 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 180 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esn_wolfram_to_allies",
    category: "economy",
    for: ["ESN"],
    available: all(exists("GBR"), not({ kind: "at_war_with", of: T("GBR") })),
    cost: { pp: 20 },
    cooldownDays: 120,
    effects: [
      { kind: "fuel", amount: 4000 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 180 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 180 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esn_moroccan_recruits",
    category: "military",
    for: ["ESN"],
    available: { kind: "owns_group", group: "spanish_morocco" },
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [{ kind: "manpower", amount: 20000 }],
    ai: {
      base: 10,
      mods: [{ if: not({ kind: "at_war" }), factor: 20 }],
    },
  },
  {
    id: "esn_call_up_requetes",
    category: "military",
    for: ["ESN"],
    available: { kind: "at_war" },
    cost: { pp: 20 },
    cooldownDays: 180,
    effects: [
      { kind: "manpower", amount: 15000 },
      { kind: "bop", amount: 50 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esn_hunt_the_maquis",
    category: "political",
    for: ["ESN"],
    available: all(not({ kind: "ruling", ideology: "communist" }), {
      kind: "pop_ge",
      ideology: "communist",
      pct: 8,
    }),
    cost: { pp: 30 },
    cooldownDays: 120,
    effects: [
      { kind: "popularity", ideology: "communist", pp: -4 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esn_argentine_wheat",
    category: "economy",
    for: ["ESN"],
    available: all(exists("ARG"), not({ kind: "at_war_with", of: T("ARG") })),
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      { kind: "stability", pct: 4 },
      { kind: "opinion", who: T("ARG"), of: "self", value: 10, days: 365 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "stability_ge", pct: 50 }, factor: 0 }],
    },
  },
];
