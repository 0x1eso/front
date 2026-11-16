// ww229: Mexico's decisions. The oil mechanism: after the expropriation the
// companies' boycott leaves the oil without buyers; the barter contracts
// (Germany, Italy, Japan) sell it for goods and goodwill at Washington's
// cost, the settlement with the United States opens the American market
// (mex_oil_to_allies), and the tree's oil focuses walk the stage spirits
// from foreign oil through the boycott to a grown Pemex. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const MEX_DECISIONS: DecisionDef[] = [
  // ---- the oil ----
  {
    id: "mex_barter_oil_deu",
    category: "economy",
    for: ["MEX"],
    locked: true,
    available: all(
      flag("mex_oil_nationalised"),
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("mex_oil_deu")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "mex_oil_deu", days: 365 },
      { kind: "fuel", amount: -10000 },
      { kind: "fuel", who: T("DEU"), amount: 10000 },
      { kind: "pp", amount: 35 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -10, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [{ if: flag("mex_oil_settled"), factor: 20 }],
    },
  },
  {
    id: "mex_barter_oil_ita",
    category: "economy",
    for: ["MEX"],
    locked: true,
    available: all(
      flag("mex_oil_nationalised"),
      exists("ITA"),
      not({ kind: "at_war_with", of: T("ITA") }),
      not(flag("mex_oil_ita")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "mex_oil_ita", days: 365 },
      { kind: "fuel", amount: -8000 },
      { kind: "fuel", who: T("ITA"), amount: 8000 },
      { kind: "pp", amount: 30 },
      { kind: "convoys", amount: 5 },
      { kind: "opinion", who: T("ITA"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [{ if: flag("mex_oil_settled"), factor: 20 }],
    },
  },
  {
    id: "mex_barter_oil_jpn",
    category: "economy",
    for: ["MEX"],
    locked: true,
    available: all(
      flag("mex_oil_nationalised"),
      exists("JPN"),
      not({ kind: "at_war_with", of: T("JPN") }),
      not(flag("mex_oil_jpn")),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "set_flag", flag: "mex_oil_jpn", days: 365 },
      { kind: "fuel", amount: -8000 },
      { kind: "fuel", who: T("JPN"), amount: 8000 },
      { kind: "pp", amount: 30 },
      { kind: "opinion", who: T("JPN"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -15, days: 365 },
    ],
    ai: {
      base: 6,
      mods: [{ if: flag("mex_oil_settled"), factor: 20 }],
    },
  },
  {
    // Unlocked by mex_oil_for_the_nation: oil for the Arsenal of Democracy.
    id: "mex_oil_to_allies",
    category: "economy",
    for: ["MEX"],
    locked: true,
    available: all(
      flag("mex_oil_settled"),
      exists("USA"),
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    cooldownDays: 365,
    effects: [
      { kind: "fuel", amount: -10000 },
      { kind: "fuel", who: T("USA"), amount: 10000 },
      { kind: "pp", amount: 30 },
      { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
    ],
    ai: { base: 10 },
  },
  // ---- the land and the party ----
  {
    // Unlocked by mex_laguna_ejidos: presidential land grants to villages.
    id: "mex_ejido_grants",
    category: "political",
    for: ["MEX"],
    locked: true,
    available: { kind: "ruling", ideology: "neutral" },
    cost: { pp: 30 },
    cooldownDays: 180,
    effects: [
      { kind: "stability", pct: 2 },
      { kind: "popularity", ideology: "neutral", pp: 1 },
      { kind: "manpower", amount: 3000 },
    ],
    ai: {
      base: 6,
      mods: [
        { if: not({ kind: "stability_ge", pct: 50 }), factor: 300 },
      ],
    },
  },
  {
    // The party's discipline: unruly governors and union bosses brought in line.
    id: "mex_party_discipline",
    category: "political",
    for: ["MEX"],
    available: all(
      { kind: "ruling", ideology: "neutral" },
      { kind: "has_spirit", id: "mex_sp_corporate_party" },
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "stability", pct: 2 },
      { kind: "popularity", ideology: "neutral", pp: 2 },
    ],
    ai: { base: 3 },
  },
  {
    id: "mex_curb_the_sinarquistas",
    category: "political",
    for: ["MEX"],
    available: all(
      not({ kind: "ruling", ideology: "fascist" }),
      { kind: "pop_ge", ideology: "fascist", pct: 15 },
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "popularity", ideology: "fascist", pp: -3 },
      { kind: "stability", pct: -1 },
    ],
    ai: {
      base: 4,
      mods: [
        { if: { kind: "pop_ge", ideology: "fascist", pct: 22 }, factor: 300 },
      ],
    },
  },
  // ---- the army ----
  {
    // Unlocked by mex_defensas_rurales: the ejidatarios' rural militias.
    id: "mex_arm_the_ejidos",
    category: "military",
    for: ["MEX"],
    locked: true,
    cost: { pp: 40 },
    effects: [
      { kind: "add_spirit", id: "mex_sp_defensas_rurales" },
      { kind: "manpower", amount: 5000 },
    ],
    ai: { base: 10 },
  },
  // ---- the isthmus and Belize (ahistorical) ----
  {
    // Unlocked by mex_union_of_the_isthmus: a union offered to a neighbour.
    id: "mex_isthmus_union_offer",
    category: "diplomacy",
    for: ["MEX"],
    locked: true,
    target: {
      among: all(
        any(
          { kind: "tag", tag: "GTM" },
          { kind: "tag", tag: "HND" },
          { kind: "tag", tag: "SLV" },
          { kind: "tag", tag: "NIC" },
          { kind: "tag", tag: "CRI" },
        ),
        not({ kind: "at_war_with", of: "from" }),
        not({ kind: "is_subject" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "mex_ev_isthmus_offer", to: "target" }],
    ai: { base: 4 },
  },
  {
    // Unlocked by mex_claim_british_honduras: Mexico's old reservation on Belize.
    id: "mex_claim_belize",
    category: "annexation",
    for: ["MEX"],
    locked: true,
    available: all(
      not({ kind: "owns_group", group: "mex_belize" }),
      not({ kind: "has_war_goal_on", of: { ownerOf: "mex_belize" } }),
      not({ kind: "same_faction", of: { ownerOf: "mex_belize" } }),
    ),
    cost: { pp: 50 },
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "mex_belize" },
        type: "claim",
        group: "mex_belize",
      },
    ],
    ai: {
      base: 2,
      mods: [
        {
          if: any(
            { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
            { kind: "at_war_with", who: T("GBR"), of: T("JPN") },
          ),
          factor: 300,
        },
      ],
    },
  },
];
