// ww229 (design ww227 §5): Republican Spain's decisions. The first three
// move the balance between the Communists (−) and the anarchists (+)
// (core.ts BOP row); then the arms bought with the gold (unlocked by
// esr_gold_to_moscow or esr_gold_to_paris) and the war's levers: the last
// call-up, the children sent abroad, the mercury of Almadén, the front's
// trenches. Data only (ContentPurity).
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, exists, not } from "../../helpers";
import {
  AT_ESN,
  BAND0,
  BAND1,
  BAND2,
  BAND3,
  BAND4,
  BOP_ON,
  PARIS_GOLD,
  SOVIET_GOLD,
} from "./conds";

export const ESR_DECISIONS: DecisionDef[] = [
  {
    id: "esr_favour_pce",
    category: "political",
    for: ["ESR"],
    available: BOP_ON,
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      { kind: "bop", amount: -150 },
      { kind: "popularity", ideology: "communist", pp: 1 },
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
    id: "esr_favour_cnt",
    category: "political",
    for: ["ESR"],
    available: BOP_ON,
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      { kind: "bop", amount: 150 },
      { kind: "manpower", amount: 5000 },
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
    // The President and the socialists hold the middle.
    id: "esr_president_mediates",
    category: "political",
    for: ["ESR"],
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
    id: "esr_order_from_moscow",
    category: "military",
    for: ["ESR"],
    locked: true,
    available: all(AT_ESN, SOVIET_GOLD, exists("SUN")),
    cost: { pp: 50 },
    cooldownDays: 120,
    effects: [
      { kind: "equipment", type: "light_tank", gen: 1, count: 15 },
      { kind: "equipment", type: "fighter", gen: 1, count: 15 },
      { kind: "equipment", type: "artillery", gen: 1, count: 50 },
      { kind: "bop", amount: -50 },
    ],
    ai: { base: 20 },
  },
  {
    id: "esr_buy_through_paris",
    category: "military",
    for: ["ESR"],
    locked: true,
    available: all(AT_ESN, PARIS_GOLD),
    cost: { pp: 40 },
    cooldownDays: 120,
    effects: [
      { kind: "equipment", type: "fighter", gen: 1, count: 8 },
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 1000 },
      { kind: "equipment", type: "artillery", gen: 1, count: 30 },
    ],
    ai: { base: 20 },
  },
  {
    // The last age classes, down to seventeen.
    id: "esr_youngest_levy",
    category: "military",
    for: ["ESR"],
    available: all(AT_ESN, { kind: "war_days_ge", days: 500 }),
    cost: { pp: 20 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", amount: 40000 },
      { kind: "war_support", pct: -3 },
      { kind: "stability", pct: -2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esr_children_abroad",
    category: "political",
    for: ["ESR"],
    available: AT_ESN,
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "stability", pct: 3 },
      { kind: "war_support", pct: 2 },
      { kind: "opinion", who: T("SUN"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esr_mercury_contracts",
    category: "economy",
    for: ["ESR"],
    available: { kind: "controls_group", group: "esr_almaden" },
    cost: { pp: 30 },
    cooldownDays: 180,
    effects: [
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 800 },
      { kind: "fuel", amount: 5000 },
    ],
    ai: { base: 10 },
  },
  {
    id: "esr_dig_in",
    category: "military",
    for: ["ESR"],
    available: AT_ESN,
    cost: { pp: 30 },
    cooldownDays: 180,
    effects: [
      { kind: "fort", where: { borderWith: T("ESN"), n: 2 }, amount: 1 },
    ],
    ai: { base: 10 },
  },
];
