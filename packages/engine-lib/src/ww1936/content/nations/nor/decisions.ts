// ww229: Norway's decisions (texts ww1936.decision.<id>,
// ww1936.decision_desc.<id>). The national mechanism, "the merchant fleet
// and heavy water":
// - the fleet: charters a year at a time to Britain or Germany, each paying
//   in trade and winning the charterer's favour at the other's expense; once
//   the homeland is lost the fleet is requisitioned abroad (Nortraship) and
//   sails for the side that still fights; a whaling season in peace;
// - heavy water: Vemork's output sold, a year at a time, to the buyer the
//   tree chose (France or Germany);
// - the neutrality watch called up when the war comes near, and a general
//   mobilisation once it arrives.
// A decision without cooldownDays is taken once. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const NOR_DECISIONS: readonly DecisionDef[] = [
  // ---- the merchant fleet ----
  {
    id: "nor_charter_to_britain",
    category: "economy",
    for: ["NOR"],
    locked: true,
    available: all(
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      not(flag("nor_nortraship")),
      not({ kind: "has_spirit", id: "nor_charter_east" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nor_charter_west", days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 15, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "ruling", ideology: "democratic" }, factor: 150 },
        { if: { kind: "same_faction", of: T("DEU") }, factor: 0 },
      ],
    },
  },
  {
    id: "nor_charter_to_germany",
    category: "economy",
    for: ["NOR"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("nor_nortraship")),
      not({ kind: "has_spirit", id: "nor_charter_west" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nor_charter_east", days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 6,
      mods: [
        { if: { kind: "ruling", ideology: "fascist" }, factor: 400 },
        { if: { kind: "same_faction", of: T("GBR") }, factor: 0 },
      ],
    },
  },
  {
    // Nortraship: the fleet abroad goes under the government's own shipping
    // office and sails for the side still at war.
    id: "nor_requisition_fleet",
    category: "national",
    for: ["NOR"],
    locked: true,
    available: all(
      { kind: "at_war" },
      not(flag("nor_nortraship")),
      any(
        { kind: "is_exile" },
        { kind: "controls_capital_of", who: T("DEU"), of: "self" },
        { kind: "controls_capital_of", who: T("SUN"), of: "self" },
      ),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "set_flag", flag: "nor_nortraship" },
      { kind: "add_spirit", id: "nor_nortraship_spirit" },
      { kind: "convoys", amount: 30 },
    ],
    ai: { base: 50 },
  },
  {
    id: "nor_whaling_expedition",
    category: "economy",
    for: ["NOR"],
    locked: true,
    available: not({ kind: "at_war" }),
    cost: { pp: 15 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nor_whale_oil", days: 365 },
      { kind: "fuel", amount: 3000 },
    ],
    ai: { base: 8 },
  },
  // ---- heavy water ----
  {
    id: "nor_sell_heavy_water_west",
    category: "economy",
    for: ["NOR"],
    locked: true,
    available: all(
      flag("nor_heavy_water"),
      any(exists("FRA"), exists("GBR")),
      not({ kind: "controls_capital_of", who: T("DEU"), of: "self" }),
    ),
    cost: { pp: 10 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nor_heavy_water_trade", days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 5, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "nor_sell_heavy_water_east",
    category: "economy",
    for: ["NOR"],
    locked: true,
    available: all(
      flag("nor_heavy_water"),
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
    ),
    cost: { pp: 10 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nor_heavy_water_trade", days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: -5, days: 365 },
    ],
    ai: { base: 10 },
  },
  // ---- the watch and the call-up ----
  {
    id: "nor_call_up_the_watch",
    category: "military",
    for: ["NOR"],
    locked: true,
    available: all(
      not({ kind: "has_spirit", id: "nor_watch_called_up" }),
      any(
        { kind: "at_war", who: T("DEU") },
        { kind: "at_war", who: T("GBR") },
        { kind: "at_war", who: T("SUN") },
      ),
    ),
    cost: { pp: 40 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nor_watch_called_up", days: 365 },
      { kind: "war_support", pct: 2 },
    ],
    ai: {
      base: 15,
      mods: [{ if: { kind: "threat_ge", of: T("DEU"), pct: 40 }, factor: 200 }],
    },
  },
  {
    id: "nor_general_mobilisation",
    category: "military",
    for: ["NOR"],
    available: { kind: "at_war" },
    cost: { pp: 50 },
    effects: [
      { kind: "manpower", recruitablePct: 3 },
      { kind: "war_support", pct: 5 },
      { kind: "stability", pct: -3 },
      { kind: "remove_spirit", id: "nor_defence_cuts" },
    ],
    ai: { base: 40 },
  },
  // ---- the old unions ----
  {
    id: "nor_propose_union",
    category: "diplomacy",
    for: ["NOR"],
    locked: true,
    target: {
      among: all(
        any({ kind: "tag", tag: "DNK" }, { kind: "tag", tag: "ISL" }),
        not({ kind: "at_war_with", of: "self" }),
        not({ kind: "is_subject" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [{ kind: "fire_event", id: "nor_union_offer", to: "target" }],
    ai: { base: 8 },
  },
];
