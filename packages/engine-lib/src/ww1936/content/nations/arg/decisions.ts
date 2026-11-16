// ww229: Argentina's decisions. The balance of power: the ballot boxes pull
// toward the Concordancia, courting the lodges toward the officers. The
// export market: a year's beef or grain contract per buyer (political power
// and goodwill, coldness from the buyer's rivals). The River Plate union
// repeats its offer. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, gflag, not, T } from "../../helpers";

export const ARG_DECISIONS: DecisionDef[] = [
  {
    id: "arg_manage_ballot_boxes",
    category: "political",
    for: ["ARG"],
    available: { kind: "ruling", ideology: "neutral" },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: -100 },
      { kind: "stability", pct: 2 },
      { kind: "popularity", ideology: "democratic", pp: -2 },
    ],
    // The Concordancia leans on its machines when the barracks stir.
    ai: {
      base: 5,
      mods: [
        {
          if: any(
            { kind: "bop_range", tag: "ARG", band: 3 },
            { kind: "bop_range", tag: "ARG", band: 4 },
          ),
          factor: 400,
        },
      ],
    },
  },
  {
    id: "arg_court_the_lodges",
    category: "political",
    for: ["ARG"],
    available: not({ kind: "ruling", ideology: "fascist" }),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: 100 },
      { kind: "army_xp", amount: 5 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "arg_beef_contract_gbr",
    category: "economy",
    for: ["ARG"],
    available: all(
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      not(flag("arg_beef_gbr")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "arg_beef_gbr", days: 365 },
      { kind: "pp", amount: 30 },
      { kind: "stability", pct: 1 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "arg_grain_contract_deu",
    category: "economy",
    for: ["ARG"],
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("arg_grain_deu")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "arg_grain_deu", days: 365 },
      { kind: "pp", amount: 30 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 6 },
  },
  {
    id: "arg_grain_contract_ita",
    category: "economy",
    for: ["ARG"],
    available: all(
      exists("ITA"),
      not({ kind: "at_war_with", of: T("ITA") }),
      not(flag("arg_grain_ita")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "arg_grain_ita", days: 365 },
      { kind: "pp", amount: 30 },
      { kind: "opinion", who: T("ITA"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 6 },
  },
  {
    id: "arg_linseed_contract_usa",
    category: "economy",
    for: ["ARG"],
    available: all(
      exists("USA"),
      not({ kind: "at_war_with", of: T("USA") }),
      not(flag("arg_linseed_usa")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "arg_linseed_usa", days: 365 },
      { kind: "pp", amount: 20 },
      { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 6 },
  },
  {
    id: "arg_ypf_drilling",
    category: "economy",
    for: ["ARG"],
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "fuel", amount: 15000 },
      { kind: "resource", where: { regions: [1326] }, res: "oil", amount: 1 },
    ],
    ai: {
      base: 4,
      mods: [{ if: { kind: "fuel_ratio_below", pct: 40 }, factor: 300 }],
    },
  },
  {
    id: "arg_buy_arms_abroad",
    category: "military",
    for: ["ARG"],
    cost: { pp: 50 },
    cooldownDays: 365,
    available: any(
      all(exists("USA"), not({ kind: "at_war", who: T("USA") })),
      all(exists("DEU"), not({ kind: "at_war", who: T("DEU") })),
      all(exists("ITA"), not({ kind: "at_war", who: T("ITA") })),
    ),
    effects: [
      { kind: "equipment", type: "fighter", gen: 1, count: 20 },
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 1000 },
    ],
    ai: {
      base: 3,
      mods: [{ if: { kind: "at_war" }, factor: 300 }],
    },
  },
  {
    id: "arg_malvinas_protest",
    category: "diplomacy",
    for: ["ARG"],
    visible: flag("arg_malvinas_claimed"),
    available: all(exists("GBR"), not({ kind: "at_war_with", of: T("GBR") })),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "war_support", pct: 2 },
      { kind: "stability", pct: 1 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -10, days: 365 },
    ],
    ai: { base: 3 },
  },
  {
    id: "arg_plata_union_appeal",
    category: "diplomacy",
    for: ["ARG"],
    locked: true,
    available: all(
      any(exists("URY"), exists("PRY")),
      not(gflag("arg_union_joined")),
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      {
        kind: "if",
        cond: exists("URY"),
        then: [{ kind: "fire_event", id: "arg_ev_union_offer", to: T("URY") }],
      },
      {
        kind: "if",
        cond: exists("PRY"),
        then: [{ kind: "fire_event", id: "arg_ev_union_offer", to: T("PRY") }],
      },
    ],
    ai: { base: 2 },
  },
];
