// ww229: the Netherlands' decisions (texts ww1936.decision.<id>,
// ww1936.decision_desc.<id>). The national mechanism, "the water and the
// Indies":
// - the water line: ready the sluices, flood the polders before an enemy
//   when Germany marches (strong defence, dear in goods and calm), and drain
//   them again once the danger passes;
// - the Indies oil: a contract a year with Japan or with the West, each
//   winning one buyer at the other's expense, and the freezing of Japanese
//   assets that ends the trade with Tokyo.
// A decision without cooldownDays is taken once. Data only.
import type { Condition } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

/** A war that can reach the homeland by land: the water line is for this one. */
const HOME_WAR: Condition = any(
  { kind: "at_war_with", of: T("DEU") },
  { kind: "at_war_with", of: T("BEL") },
  { kind: "at_war_with", of: T("FRA") },
);

export const NLD_DECISIONS: readonly DecisionDef[] = [
  // ---- the water line ----
  {
    id: "nld_prepare_inundations",
    category: "military",
    for: ["NLD"],
    locked: true,
    available: all(
      not({ kind: "has_spirit", id: "nld_sluices_ready" }),
      not({ kind: "has_spirit", id: "nld_water_line_flooded" }),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "add_spirit", id: "nld_sluices_ready" },
      { kind: "fort", where: { regions: [305] }, amount: 1 },
    ],
    ai: { base: 20 },
  },
  {
    id: "nld_inundate_water_line",
    category: "military",
    for: ["NLD"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "nld_sluices_ready" },
      any(HOME_WAR, { kind: "threat_ge", of: T("DEU"), pct: 70 }),
    ),
    cost: { pp: 50 },
    cooldownDays: 90,
    effects: [
      {
        kind: "swap_spirit",
        from: "nld_sluices_ready",
        to: "nld_water_line_flooded",
      },
      { kind: "war_support", pct: 3 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "at_war_with", of: T("DEU") }, factor: 2000 }],
    },
  },
  {
    id: "nld_drain_the_polders",
    category: "military",
    for: ["NLD"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "nld_water_line_flooded" },
      not(HOME_WAR),
      not({ kind: "threat_ge", of: T("DEU"), pct: 70 }),
    ),
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      {
        kind: "swap_spirit",
        from: "nld_water_line_flooded",
        to: "nld_sluices_ready",
      },
      { kind: "stability", pct: 2 },
    ],
    ai: { base: 20 },
  },
  // ---- the Indies oil ----
  {
    id: "nld_oil_contract_japan",
    category: "economy",
    for: ["NLD"],
    locked: true,
    available: all(
      exists("JPN"),
      not({ kind: "at_war_with", of: T("JPN") }),
      not(flag("nld_assets_frozen")),
      // One buyer a year: the oil cannot go both ways.
      not({ kind: "has_spirit", id: "nld_oil_for_allies" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nld_oil_for_yen", days: 365 },
      { kind: "opinion", who: T("JPN"), of: "self", value: 15, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "same_faction", of: T("GBR") }, factor: 0 },
        { if: { kind: "same_faction", of: T("USA") }, factor: 0 },
        { if: { kind: "at_war", who: T("JPN") }, factor: 30 },
      ],
    },
  },
  {
    id: "nld_oil_contract_allies",
    category: "economy",
    for: ["NLD"],
    locked: true,
    available: all(
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      not({ kind: "at_war_with", of: T("USA") }),
      not({ kind: "has_spirit", id: "nld_oil_for_yen" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "nld_oil_for_allies", days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("JPN"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "ruling", ideology: "democratic" }, factor: 150 },
        { if: { kind: "same_faction", of: T("JPN") }, factor: 0 },
      ],
    },
  },
  {
    id: "nld_freeze_japanese_assets",
    category: "economy",
    for: ["NLD"],
    locked: true,
    available: all(exists("JPN"), not(flag("nld_assets_frozen")), {
      kind: "at_war",
      who: T("JPN"),
    }),
    cost: { pp: 50 },
    effects: [
      { kind: "set_flag", flag: "nld_assets_frozen" },
      { kind: "embargo", on: T("JPN") },
      { kind: "remove_spirit", id: "nld_oil_for_yen" },
      { kind: "opinion", who: T("JPN"), of: "self", value: -30, days: 511 },
      { kind: "opinion", who: T("USA"), of: "self", value: 20, days: 365 },
    ],
    ai: {
      base: 5,
      mods: [
        { if: { kind: "at_war_with", of: T("JPN") }, factor: 2000 },
        { if: { kind: "same_faction", of: T("USA") }, factor: 400 },
        { if: { kind: "ruling", ideology: "fascist" }, factor: 0 },
      ],
    },
  },
  // ---- the army and the war ----
  {
    id: "nld_reinforce_knil",
    category: "military",
    for: ["NLD"],
    locked: true,
    available: exists("NLD"),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "fort", where: { group: "dutch_east_indies" }, amount: 1 },
      { kind: "manpower", amount: 10000 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "threat_ge", of: T("JPN"), pct: 50 }, factor: 400 }],
    },
  },
  {
    id: "nld_call_up_reserves",
    category: "military",
    for: ["NLD"],
    locked: true,
    available: any(
      { kind: "at_war", who: "self" },
      { kind: "at_war", who: T("DEU") },
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "manpower", recruitablePct: 2 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 30 },
  },
  {
    // Abroad or occupied: the merchant fleet sails under Allied orders.
    id: "nld_sail_for_the_allies",
    category: "diplomacy",
    for: ["NLD"],
    locked: true,
    available: all(
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      any(
        { kind: "is_exile" },
        { kind: "controls_capital_of", who: T("DEU"), of: "self" },
      ),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 511 },
      { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
      { kind: "exile_legitimacy", pct: 5 },
    ],
    ai: { base: 30 },
  },
  // ---- the Low Countries union ----
  {
    id: "nld_propose_union",
    category: "diplomacy",
    for: ["NLD"],
    locked: true,
    target: {
      among: all(
        any({ kind: "tag", tag: "BEL" }, { kind: "tag", tag: "LUX" }),
        not({ kind: "at_war_with", of: "self" }),
        not({ kind: "is_subject" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [{ kind: "fire_event", id: "nld_union_offer", to: "target" }],
    ai: { base: 10 },
  },
];
