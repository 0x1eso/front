// ww229: Greece's decisions. The trade mechanism: the merchant fleet's
// charters (convoys to the charterer, political power and goodwill to us)
// and the tobacco clearing with Germany; once the mainland falls the fleet
// sails under the Allies' orders. The regime and the Venizelists pull the
// balance of power. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const GRC_DECISIONS: DecisionDef[] = [
  {
    id: "grc_island_exile",
    category: "political",
    for: ["GRC"],
    locked: true,
    available: { kind: "ruling", ideology: "neutral" },
    cost: { pp: 40 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: -100 },
      { kind: "popularity", ideology: "communist", pp: -2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "add_spirit", id: "grc_sp_island_exile", days: 180 },
    ],
    ai: {
      base: 5,
      mods: [
        {
          if: any(
            { kind: "bop_range", tag: "GRC", band: 3 },
            { kind: "bop_range", tag: "GRC", band: 4 },
          ),
          factor: 400,
        },
      ],
    },
  },
  {
    id: "grc_purge_the_officers",
    category: "political",
    for: ["GRC"],
    available: all(
      { kind: "ruling", ideology: "neutral" },
      not({ kind: "at_war" }),
    ),
    cost: { pp: 50 },
    cooldownDays: 240,
    effects: [
      { kind: "bop", amount: -150 },
      { kind: "army_xp", amount: -5 },
      { kind: "stability", pct: -1 },
    ],
    ai: {
      base: 2,
      mods: [{ if: { kind: "bop_range", tag: "GRC", band: 4 }, factor: 500 }],
    },
  },
  {
    id: "grc_venizelist_amnesty",
    category: "political",
    for: ["GRC"],
    available: not({ kind: "ruling", ideology: "fascist" }),
    cost: { pp: 30 },
    cooldownDays: 180,
    effects: [
      { kind: "bop", amount: 100 },
      { kind: "stability", pct: 2 },
      { kind: "popularity", ideology: "democratic", pp: 2 },
    ],
    ai: { base: 2 },
  },
  {
    id: "grc_charter_ships_gbr",
    category: "economy",
    for: ["GRC"],
    locked: true,
    available: all(
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      not(flag("grc_charter_gbr")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "grc_charter_gbr", days: 365 },
      { kind: "convoys", amount: -30 },
      { kind: "convoys", who: T("GBR"), amount: 30 },
      { kind: "pp", amount: 40 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "grc_charter_ships_fra",
    category: "economy",
    for: ["GRC"],
    locked: true,
    available: all(
      exists("FRA"),
      not({ kind: "at_war_with", of: T("FRA") }),
      not(flag("grc_charter_fra")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "grc_charter_fra", days: 365 },
      { kind: "convoys", amount: -20 },
      { kind: "convoys", who: T("FRA"), amount: 20 },
      { kind: "pp", amount: 30 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 25, days: 365 },
      { kind: "opinion", who: T("ITA"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 8 },
  },
  {
    id: "grc_tobacco_clearing",
    category: "economy",
    for: ["GRC"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("grc_tobacco_deu")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "grc_tobacco_deu", days: 365 },
      { kind: "pp", amount: 40 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 25, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "grc_fleet_sails_abroad",
    category: "economy",
    for: ["GRC"],
    locked: true,
    available: all(
      { kind: "at_war" },
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      any(
        { kind: "is_exile" },
        not({ kind: "controls_capital_of", of: "self" }),
      ),
      not(flag("grc_fleet_abroad")),
    ),
    effects: [
      { kind: "set_flag", flag: "grc_fleet_abroad" },
      { kind: "convoys", amount: -100 },
      { kind: "convoys", who: T("GBR"), amount: 100 },
      { kind: "exile_legitimacy", pct: 5 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
    ],
    ai: { base: 50 },
  },
  {
    id: "grc_buy_polish_fighters",
    category: "military",
    for: ["GRC"],
    available: all(exists("POL"), not({ kind: "at_war_with", of: T("POL") })),
    cost: { pp: 50 },
    cooldownDays: 720,
    effects: [
      { kind: "equipment", type: "fighter", gen: 1, count: 18 },
      { kind: "opinion", who: T("POL"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 3 },
  },
  {
    id: "grc_arms_exports",
    category: "economy",
    for: ["GRC"],
    available: all(flag("grc_pyrkal"), exists("ESR")),
    cooldownDays: 365,
    effects: [
      {
        kind: "send_equipment",
        to: T("ESR"),
        type: "infantry_equipment",
        count: 1000,
      },
      { kind: "pp", amount: 40 },
      { kind: "opinion", who: T("ESN"), of: "self", value: -10, days: 365 },
    ],
    ai: { base: 3 },
  },
  {
    id: "grc_mobilise_reserves",
    category: "military",
    for: ["GRC"],
    available: any({ kind: "at_war" }, { kind: "wt_ge", pct: 50 }),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", amount: 30000 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 5 },
  },
];
