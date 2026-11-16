// ww229: Belgium's decisions. The language balance (core.ts) is worked from
// here: concessions to Flanders or the unitary line; then the forts, the
// guarantors, the Allies' invitation, the colony and the Low Countries
// union (locked until its focuses open it). Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, done, exists, flag, not } from "../../helpers";

export const BEL_DECISIONS: DecisionDef[] = [
  // ---- the language balance ----
  {
    id: "bel_dec_language_concession",
    category: "political",
    for: ["BEL"],
    available: not({ kind: "bop_range", tag: "BEL", band: 4 }),
    cost: { pp: 50 },
    cooldownDays: 150,
    effects: [
      { kind: "bop", amount: 120 },
      { kind: "stability", pct: 1 },
    ],
    ai: {
      base: 6,
      mods: [
        { if: { kind: "bop_range", tag: "BEL", band: 0 }, factor: 400 },
        { if: { kind: "bop_range", tag: "BEL", band: 1 }, factor: 200 },
      ],
    },
  },
  {
    id: "bel_dec_unitary_line",
    category: "political",
    for: ["BEL"],
    available: not({ kind: "bop_range", tag: "BEL", band: 0 }),
    cost: { pp: 50 },
    cooldownDays: 150,
    effects: [
      { kind: "bop", amount: -120 },
      { kind: "stability", pct: -1 },
    ],
    ai: {
      base: 4,
      mods: [
        { if: { kind: "bop_range", tag: "BEL", band: 4 }, factor: 400 },
        { if: { kind: "bop_range", tag: "BEL", band: 3 }, factor: 200 },
      ],
    },
  },
  {
    id: "bel_dec_ban_militias",
    category: "political",
    for: ["BEL"],
    available: all(
      { kind: "ruling", ideology: "democratic" },
      any(
        { kind: "pop_ge", ideology: "fascist", pct: 10 },
        { kind: "pop_ge", ideology: "communist", pct: 10 },
      ),
    ),
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: -2 },
      { kind: "popularity", ideology: "communist", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: {
      base: 4,
      mods: [
        { if: { kind: "pop_ge", ideology: "fascist", pct: 20 }, factor: 300 },
      ],
    },
  },

  // ---- the forts ----
  {
    id: "bel_dec_strengthen_liege",
    category: "military",
    for: ["BEL"],
    available: done("bel_liege_position"),
    cost: { pp: 40 },
    cooldownDays: 365,
    days: 120,
    completeEffects: [
      { kind: "fort", where: { borderWith: T("DEU"), n: 1 }, amount: 1 },
    ],
    ai: {
      base: 8,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 300 }],
    },
  },

  // ---- the guarantors and the Allies ----
  {
    id: "bel_dec_ask_london",
    category: "diplomacy",
    for: ["BEL"],
    available: all(
      exists("GBR"),
      not({ kind: "guaranteed_by", of: T("GBR") }),
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "fire_event", id: "bel_ev_guarantee_request", to: T("GBR") },
    ],
    ai: {
      base: 6,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 300 }],
    },
  },
  {
    id: "bel_dec_ask_paris",
    category: "diplomacy",
    for: ["BEL"],
    available: all(
      exists("FRA"),
      not({ kind: "guaranteed_by", of: T("FRA") }),
      not({ kind: "at_war_with", of: T("FRA") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "fire_event", id: "bel_ev_guarantee_request", to: T("FRA") },
    ],
    ai: {
      base: 6,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 300 }],
    },
  },
  {
    // Let the Allied armies in before the enemy comes.
    id: "bel_dec_call_the_allies",
    category: "diplomacy",
    for: ["BEL"],
    available: all(
      exists("FRA"),
      not(flag("bel_allies_called")),
      not({ kind: "at_war_with", of: T("FRA") }),
      any(
        { kind: "has_war_goal_on", who: T("DEU"), of: "self" },
        { kind: "justifying_on", who: T("DEU"), of: "self" },
        { kind: "threat_ge", of: T("DEU"), pct: 60 },
      ),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "access", of: T("FRA") },
      { kind: "access", of: T("GBR") },
      { kind: "set_flag", flag: "bel_allies_called" },
      { kind: "remove_spirit", id: "bel_sp_independence" },
      { kind: "opinion", of: T("DEU"), value: -30, days: 365 },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: { kind: "has_war_goal_on", who: T("DEU"), of: "self" },
          factor: 1000,
        },
      ],
    },
  },

  // ---- the economy and the colony ----
  {
    id: "bel_dec_fn_exports",
    category: "economy",
    for: ["BEL"],
    available: all(done("bel_fn_herstal"), not({ kind: "at_war" })),
    cost: { equipment: ["infantry_equipment", 500] },
    cooldownDays: 180,
    effects: [
      { kind: "pp", amount: 30 },
      { kind: "stability", pct: 1 },
    ],
    ai: { base: 4 },
  },
  {
    id: "bel_dec_congo_levies",
    category: "military",
    for: ["BEL"],
    available: all(
      { kind: "at_war" },
      { kind: "owns_group", group: "bel_congo" },
    ),
    cost: { pp: 30 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", amount: 8000 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 8 },
  },
  {
    id: "bel_dec_uranium_to_america",
    category: "economy",
    for: ["BEL"],
    available: all(
      done("bel_shinkolobwe"),
      exists("USA"),
      not(flag("bel_ore_in_new_york")),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "set_flag", flag: "bel_ore_in_new_york" },
      { kind: "opinion", of: T("USA"), value: 25, days: 730 },
      { kind: "opinion", of: T("GBR"), value: 10, days: 365 },
    ],
    ai: { base: 3 },
  },

  // ---- the Low Countries ----
  {
    id: "bel_dec_union_lux",
    category: "annexation",
    for: ["BEL"],
    locked: true,
    available: all(
      exists("LUX"),
      not({ kind: "at_war_with", of: T("LUX") }),
      not({ kind: "in_faction", who: T("LUX") }),
      { kind: "opinion_ge", who: T("LUX"), of: "self", value: 30 },
    ),
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "bel_ev_union_offer", to: T("LUX") }],
    ai: { base: 10 },
  },
  {
    id: "bel_dec_union_nld",
    category: "annexation",
    for: ["BEL"],
    locked: true,
    available: all(
      exists("NLD"),
      not({ kind: "at_war_with", of: T("NLD") }),
      not({ kind: "in_faction", who: T("NLD") }),
      { kind: "opinion_ge", who: T("NLD"), of: "self", value: 30 },
    ),
    cost: { pp: 100 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "bel_ev_union_offer", to: T("NLD") }],
    ai: { base: 8 },
  },
];
