// ww229: Sweden's decisions (texts ww1936.decision.<id>,
// ww1936.decision_desc.<id>). The national mechanism, "ore and readiness":
// - the ore contracts, a year at a time, with Germany or the West; each pays
//   in trade and wins the buyer's favour at the other side's expense, and the
//   embargo cuts Germany off once it attacks a Nordic neighbour;
// - the readiness ladder (watch, reinforced, full), climbed as the wars come
//   closer and eased when they move away.
// A decision without cooldownDays is taken once. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const SWE_DECISIONS: readonly DecisionDef[] = [
  // ---- the ore contracts ----
  {
    id: "swe_ore_contract_deu",
    category: "economy",
    for: ["SWE"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("swe_ore_embargoed")),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "swe_coal_from_germany", days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
      { kind: "opinion", who: T("GBR"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "ruling", ideology: "fascist" }, factor: 300 },
        { if: { kind: "same_faction", of: T("GBR") }, factor: 0 },
      ],
    },
  },
  {
    id: "swe_ore_contract_gbr",
    category: "economy",
    for: ["SWE"],
    locked: true,
    // With Norway's coast in German hands the ore cannot sail west.
    available: all(
      exists("GBR"),
      not({ kind: "at_war_with", of: T("GBR") }),
      not({ kind: "controls_capital_of", who: T("DEU"), of: T("NOR") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "swe_western_trade", days: 365 },
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
    id: "swe_ore_embargo",
    category: "economy",
    for: ["SWE"],
    locked: true,
    available: all(
      exists("DEU"),
      not(flag("swe_ore_embargoed")),
      any(
        { kind: "at_war_with", who: T("DEU"), of: T("NOR") },
        { kind: "at_war_with", who: T("DEU"), of: T("DNK") },
        { kind: "at_war_with", who: T("DEU"), of: T("FIN") },
        { kind: "at_war_with", of: T("DEU") },
      ),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "set_flag", flag: "swe_ore_embargoed" },
      { kind: "embargo", on: T("DEU") },
      { kind: "remove_spirit", id: "swe_coal_from_germany" },
      { kind: "opinion", who: T("DEU"), of: "self", value: -30, days: 511 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
      { kind: "war_support", pct: 5 },
    ],
    ai: {
      base: 5,
      mods: [
        { if: { kind: "at_war_with", of: T("DEU") }, factor: 2000 },
        { if: { kind: "ruling", ideology: "fascist" }, factor: 0 },
      ],
    },
  },
  // ---- the readiness ladder ----
  {
    id: "swe_raise_readiness",
    category: "military",
    for: ["SWE"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "swe_readiness_watch" },
      any(
        { kind: "at_war", who: T("DEU") },
        { kind: "at_war", who: T("SUN") },
        { kind: "at_war", who: "self" },
      ),
    ),
    cost: { pp: 50 },
    cooldownDays: 90,
    effects: [
      {
        kind: "swap_spirit",
        from: "swe_readiness_watch",
        to: "swe_readiness_reinforced",
      },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 20 },
  },
  {
    id: "swe_full_readiness",
    category: "military",
    for: ["SWE"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "swe_readiness_reinforced" },
      any(
        { kind: "at_war", who: "self" },
        { kind: "at_war", who: T("NOR") },
        { kind: "at_war", who: T("FIN") },
        { kind: "at_war", who: T("DNK") },
      ),
    ),
    cost: { pp: 75 },
    cooldownDays: 90,
    effects: [
      {
        kind: "swap_spirit",
        from: "swe_readiness_reinforced",
        to: "swe_readiness_full",
      },
    ],
    ai: { base: 20 },
  },
  {
    id: "swe_ease_readiness",
    category: "military",
    for: ["SWE"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "swe_readiness_full" },
      not({ kind: "at_war", who: "self" }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      {
        kind: "swap_spirit",
        from: "swe_readiness_full",
        to: "swe_readiness_reinforced",
      },
      { kind: "stability", pct: 3 },
    ],
    ai: {
      base: 5,
      mods: [
        {
          if: not(
            any(
              { kind: "at_war", who: T("NOR") },
              { kind: "at_war", who: T("FIN") },
              { kind: "at_war", who: T("DNK") },
            ),
          ),
          factor: 400,
        },
      ],
    },
  },
  // ---- Finland and Norway ----
  {
    id: "swe_volunteer_corps",
    category: "military",
    for: ["SWE"],
    locked: true,
    available: all(
      { kind: "at_war_with", who: T("FIN"), of: T("SUN") },
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    cost: { pp: 50, manpower: 8000 },
    effects: [
      { kind: "volunteers", to: T("FIN"), divisions: 2, planes: 12 },
      { kind: "opinion", who: T("FIN"), of: "self", value: 25, days: 511 },
      { kind: "opinion", who: T("SUN"), of: "self", value: -20, days: 365 },
    ],
    ai: { base: 20 },
  },
  {
    id: "swe_arms_to_finland",
    category: "military",
    for: ["SWE"],
    locked: true,
    available: { kind: "at_war_with", who: T("FIN"), of: T("SUN") },
    cost: { pp: 25 },
    cooldownDays: 120,
    effects: [
      {
        kind: "send_equipment",
        to: T("FIN"),
        type: "infantry_equipment",
        count: 2000,
      },
      { kind: "send_equipment", to: T("FIN"), type: "anti_air", count: 30 },
      { kind: "opinion", who: T("FIN"), of: "self", value: 10, days: 365 },
    ],
    ai: { base: 15 },
  },
  {
    id: "swe_train_police_troops",
    category: "military",
    for: ["SWE"],
    locked: true,
    available: all(
      exists("NOR"),
      any(
        { kind: "is_exile", who: T("NOR") },
        { kind: "controls_capital_of", who: T("DEU"), of: T("NOR") },
      ),
    ),
    cost: { pp: 50 },
    effects: [
      {
        kind: "send_equipment",
        to: T("NOR"),
        type: "infantry_equipment",
        count: 1500,
      },
      { kind: "opinion", who: T("NOR"), of: "self", value: 25, days: 511 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -10, days: 365 },
    ],
    ai: { base: 10 },
  },
  // ---- trade and the union ----
  {
    id: "swe_bofors_licences",
    category: "economy",
    for: ["SWE"],
    available: { kind: "has_tech", tech: "anti_air_1" },
    cost: { equipment: ["anti_air", 60] },
    cooldownDays: 365,
    effects: [
      { kind: "pp", amount: 60 },
      { kind: "opinion", of: "all", value: 5, days: 365 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "at_war", who: "self" }, factor: 0 }],
    },
  },
  {
    id: "swe_propose_union",
    category: "diplomacy",
    for: ["SWE"],
    locked: true,
    target: {
      among: all(
        any(
          { kind: "tag", tag: "NOR" },
          { kind: "tag", tag: "DNK" },
          { kind: "tag", tag: "FIN" },
          { kind: "tag", tag: "ISL" },
        ),
        not({ kind: "at_war_with", of: "self" }),
        not({ kind: "is_subject" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [{ kind: "fire_event", id: "swe_union_offer", to: "target" }],
    ai: { base: 10 },
  },
];
