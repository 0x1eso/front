// ww229: Bulgaria's decisions. The lost lands: bands in Macedonia, claims
// on Macedonia and Western Thrace, a great power's award (Southern Dobruja
// keeps the base bgr_demand_dobruja); Neuilly: the labour-service draft and
// the German arms credit; the tobacco crop sold to one buyer a year; the
// communist Balkan federation. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, fire, flag, not, T } from "../../helpers";

export const BGR_DECISIONS: DecisionDef[] = [
  {
    id: "bgr_dec_macedonian_bands",
    category: "military",
    for: ["BGR"],
    locked: true,
    available: all(
      not({ kind: "owns_group", group: "vardar_macedonia" }),
      { kind: "exists", who: { ownerOf: "vardar_macedonia" } },
      not(flag("bgr_bands_active")),
    ),
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "bgr_bands_active", days: 365 },
      { kind: "war_support", pct: 2 },
      {
        kind: "opinion",
        of: { ownerOf: "vardar_macedonia" },
        value: -15,
        days: 365,
      },
      fire("bgr_ev_border_incident", { ownerOf: "vardar_macedonia" }),
    ],
    ai: { base: 3 },
  },
  {
    id: "bgr_dec_claim_macedonia",
    category: "annexation",
    for: ["BGR"],
    locked: true,
    available: all(
      not({ kind: "owns_group", group: "vardar_macedonia" }),
      { kind: "exists", who: { ownerOf: "vardar_macedonia" } },
      not({ kind: "has_war_goal_on", of: { ownerOf: "vardar_macedonia" } }),
    ),
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "vardar_macedonia" },
        type: "claim",
        group: "vardar_macedonia",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: { kind: "at_war", who: { ownerOf: "vardar_macedonia" } },
          factor: 500,
        },
      ],
    },
  },
  {
    id: "bgr_dec_claim_thrace",
    category: "annexation",
    for: ["BGR"],
    locked: true,
    available: all(
      not({ kind: "owns_group", group: "greek_thrace" }),
      { kind: "exists", who: { ownerOf: "greek_thrace" } },
      not({ kind: "has_war_goal_on", of: { ownerOf: "greek_thrace" } }),
    ),
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "greek_thrace" },
        type: "claim",
        group: "greek_thrace",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: { kind: "at_war", who: { ownerOf: "greek_thrace" } },
          factor: 500,
        },
      ],
    },
  },
  {
    // One card per possible arbiter: Berlin or Rome.
    id: "bgr_dec_seek_award",
    category: "diplomacy",
    for: ["BGR"],
    locked: true,
    target: {
      among: all(
        any({ kind: "tag", tag: "DEU" }, { kind: "tag", tag: "ITA" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    available: not({ kind: "gflag", flag: "bgr_award_backed" }),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [fire("bgr_ev_award_request", "target")],
    ai: { base: 8 },
  },
  {
    id: "bgr_dec_german_arms_credit",
    category: "economy",
    for: ["BGR"],
    locked: true,
    available: all(exists("DEU"), not({ kind: "at_war_with", of: T("DEU") })),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 1000 },
      { kind: "equipment", type: "artillery", gen: 1, count: 60 },
      { kind: "equipment", type: "anti_tank", gen: 1, count: 40 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 8 },
  },
  {
    id: "bgr_dec_labour_conscripts",
    category: "military",
    for: ["BGR"],
    available: any(
      { kind: "has_spirit", id: "bgr_sp_neuilly_chains" },
      { kind: "has_spirit", id: "bgr_sp_hidden_army" },
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", amount: 15000 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 6 },
  },
  {
    id: "bgr_dec_tobacco_to_germany",
    category: "economy",
    for: ["BGR"],
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("bgr_tobacco_sold")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "bgr_tobacco_sold", days: 365 },
      { kind: "pp", amount: 40 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "bgr_dec_tobacco_for_currency",
    category: "economy",
    for: ["BGR"],
    available: not(flag("bgr_tobacco_sold")),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "bgr_tobacco_sold", days: 365 },
      { kind: "pp", amount: 25 },
      { kind: "stability", pct: 1 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 5 },
  },
  {
    id: "bgr_dec_federation_offer",
    category: "diplomacy",
    for: ["BGR"],
    locked: true,
    target: {
      among: all(
        { kind: "tag", tag: "YUG" },
        { kind: "ruling", ideology: "communist" },
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    available: { kind: "ruling", ideology: "communist" },
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [fire("bgr_ev_federation_proposal", "target")],
    ai: { base: 10 },
  },
  {
    id: "bgr_dec_ban_legion_rallies",
    category: "political",
    for: ["BGR"],
    available: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "pop_ge", ideology: "fascist", pct: 10 },
    ),
    cost: { pp: 30 },
    cooldownDays: 180,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: -3 },
      { kind: "stability", pct: -1 },
    ],
    ai: {
      base: 2,
      mods: [
        { if: { kind: "pop_ge", ideology: "fascist", pct: 20 }, factor: 400 },
      ],
    },
  },
];
