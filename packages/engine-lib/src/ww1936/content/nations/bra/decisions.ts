// ww229: Brazil's decisions. The mechanism of pragmatic equidistance: a
// German compensation-mark deal and an American coffee deal, each a year
// long; holding both at once opens the dividend of playing one against the
// other. The palace and the green shirts pull the balance of power; coffee,
// rubber and the bulge of the northeast are the rest. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const BRA_DECISIONS: DecisionDef[] = [
  {
    id: "bra_rule_by_decree",
    category: "political",
    for: ["BRA"],
    available: { kind: "ruling", ideology: "neutral" },
    cost: { pp: 50 },
    cooldownDays: 120,
    effects: [
      { kind: "bop", amount: -100 },
      { kind: "stability", pct: 2 },
    ],
    // The palace governs by decree-law when the green shirts fill the streets.
    ai: {
      base: 5,
      mods: [
        {
          if: any(
            { kind: "bop_range", tag: "BRA", band: 3 },
            { kind: "bop_range", tag: "BRA", band: 4 },
          ),
          factor: 400,
        },
      ],
    },
  },
  {
    id: "bra_court_the_green_shirts",
    category: "political",
    for: ["BRA"],
    available: all(
      not({ kind: "ruling", ideology: "fascist" }),
      not(flag("bra_aib_banned")),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: 150 },
      { kind: "stability", pct: 2 },
      { kind: "popularity", ideology: "fascist", pp: 2 },
    ],
    ai: { base: 2 },
  },
  {
    id: "bra_compensation_deal_deu",
    category: "economy",
    for: ["BRA"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("bra_deal_deu")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "bra_deal_deu", days: 365 },
      { kind: "pp", amount: 35 },
      { kind: "equipment", type: "artillery", gen: 1, count: 30 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "bra_coffee_deal_usa",
    category: "economy",
    for: ["BRA"],
    locked: true,
    available: all(
      exists("USA"),
      not({ kind: "at_war_with", of: T("USA") }),
      not(flag("bra_deal_usa")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "bra_deal_usa", days: 365 },
      { kind: "pp", amount: 35 },
      { kind: "stability", pct: 2 },
      { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    // Both buyers at once: each pays more to keep Brazil from the other.
    id: "bra_play_both_sides",
    category: "diplomacy",
    for: ["BRA"],
    locked: true,
    available: all(flag("bra_deal_deu"), flag("bra_deal_usa")),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "bra_sp_equidistance_dividend", days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
    ],
    ai: { base: 15 },
  },
  {
    id: "bra_burn_coffee_stocks",
    category: "economy",
    for: ["BRA"],
    available: not({ kind: "at_war" }),
    cost: { pp: 30 },
    cooldownDays: 365,
    effects: [
      { kind: "stability", pct: 3 },
      { kind: "popularity", ideology: "ruling", pp: 1 },
    ],
    ai: { base: 3 },
  },
  {
    id: "bra_buy_krupp_guns",
    category: "military",
    for: ["BRA"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not({ kind: "at_war_with", who: T("GBR"), of: T("DEU") }),
    ),
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      { kind: "equipment", type: "artillery", gen: 1, count: 60 },
      { kind: "equipment", type: "anti_air", gen: 1, count: 20 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 5 },
  },
  {
    // The rubber soldiers: northeastern migrants sent to the Amazon groves.
    id: "bra_rubber_soldiers",
    category: "economy",
    for: ["BRA"],
    available: any({ kind: "at_war" }, flag("bra_with_usa")),
    cost: { pp: 50, manpower: 3000 },
    cooldownDays: 365,
    effects: [
      {
        kind: "resource",
        where: { regions: [1119] },
        res: "rubber",
        amount: 1,
      },
      { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 4 },
  },
  {
    id: "bra_fortify_the_bulge",
    category: "military",
    for: ["BRA"],
    available: any({ kind: "at_war" }, flag("bra_with_usa")),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      {
        kind: "build",
        where: { regions: [1157, 1167] },
        building: "coastal_fort",
        count: 1,
      },
      {
        kind: "build",
        where: { regions: [1157] },
        building: "air_base",
        count: 1,
      },
    ],
    ai: { base: 4 },
  },
  {
    id: "bra_lend_lease_request",
    category: "military",
    for: ["BRA"],
    locked: true,
    available: all(
      exists("USA"),
      any({ kind: "same_faction", of: T("USA") }, flag("bra_with_usa")),
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "equipment", type: "infantry_equipment", gen: 1, count: 2000 },
      { kind: "equipment", type: "fighter", gen: 1, count: 10 },
      { kind: "opinion", who: T("USA"), of: "self", value: 5, days: 365 },
    ],
    ai: { base: 8 },
  },
];
