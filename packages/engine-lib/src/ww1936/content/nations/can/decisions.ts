// ww229: Canada's decisions (texts ww1936.decision.<id>,
// ww1936.decision_desc.<id>). The national mechanism, the conscription
// question, is a ladder of spirits the decisions climb:
//   can_kings_pledge (start: no conscription for overseas service)
//   -> can_home_defence_draft (the mobilization act: conscripts for home only)
//   -> can_pledge_released (the plebiscite, then Bill 80)
//   -> can_overseas_conscription (the draft goes overseas: men, and Quebec's anger)
// or, at any step before the last, can_volunteer_army (the pledge kept for good).
// The war-economy decisions beside it (bonds, prices, gifts, uranium) come
// from the war-production and diplomacy focuses. A decision without
// cooldownDays is taken once. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const CAN_DECISIONS: readonly DecisionDef[] = [
  // ---- the conscription question ----
  {
    id: "can_nrma_act",
    category: "military",
    for: ["CAN"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "can_kings_pledge" },
      { kind: "at_war" },
    ),
    cost: { pp: 50 },
    effects: [
      {
        kind: "swap_spirit",
        from: "can_kings_pledge",
        to: "can_home_defence_draft",
      },
      { kind: "law_step", law: "conscription", steps: 1 },
      { kind: "manpower", amount: 30000 },
      { kind: "stability", pct: -2 },
    ],
    ai: {
      base: 20,
      mods: [{ if: { kind: "war_days_ge", days: 200 }, factor: 300 }],
    },
  },
  {
    id: "can_plebiscite",
    category: "political",
    for: ["CAN"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "can_home_defence_draft" },
      { kind: "war_days_ge", days: 600 },
    ),
    cost: { pp: 50 },
    effects: [{ kind: "fire_event", id: "can_plebiscite_result" }],
    ai: {
      base: 10,
      mods: [{ if: { kind: "war_days_ge", days: 800 }, factor: 300 }],
    },
  },
  {
    id: "can_bill_80",
    category: "political",
    for: ["CAN"],
    locked: true,
    available: all(
      { kind: "has_spirit", id: "can_pledge_released" },
      not(flag("can_bill_80_passed")),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "set_flag", flag: "can_bill_80_passed" },
      { kind: "war_support", pct: 2 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 20 },
  },
  {
    id: "can_overseas_draft",
    category: "military",
    for: ["CAN"],
    locked: true,
    available: all(
      flag("can_bill_80_passed"),
      { kind: "has_spirit", id: "can_pledge_released" },
      { kind: "at_war" },
    ),
    cost: { pp: 75 },
    effects: [
      {
        kind: "swap_spirit",
        from: "can_pledge_released",
        to: "can_overseas_conscription",
      },
      { kind: "manpower", amount: 16000 },
      { kind: "stability", pct: -5 },
      { kind: "popularity", ideology: "neutral", pp: 5 },
      { kind: "add_spirit", id: "can_quebec_unrest", days: 256 },
    ],
    ai: {
      base: 2,
      mods: [
        { if: flag("can_volunteer_drive_tried"), factor: 2000 },
        { if: { kind: "war_days_ge", days: 1500 }, factor: 1000 },
        { if: { kind: "stability_ge", pct: 45 }, factor: 200 },
      ],
    },
  },
  {
    id: "can_keep_volunteers",
    category: "political",
    for: ["CAN"],
    locked: true,
    available: any(
      { kind: "has_spirit", id: "can_kings_pledge" },
      { kind: "has_spirit", id: "can_home_defence_draft" },
      { kind: "has_spirit", id: "can_pledge_released" },
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "remove_spirit", id: "can_kings_pledge" },
      { kind: "remove_spirit", id: "can_home_defence_draft" },
      { kind: "remove_spirit", id: "can_pledge_released" },
      { kind: "add_spirit", id: "can_volunteer_army" },
      { kind: "stability", pct: 3 },
      { kind: "war_support", pct: -2 },
    ],
    ai: { base: 15 },
  },
  // ---- the war economy ----
  {
    id: "can_victory_bonds",
    category: "economy",
    for: ["CAN"],
    locked: true,
    available: { kind: "at_war" },
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "can_victory_bond_drive", days: 180 },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "can_price_ceiling",
    category: "economy",
    for: ["CAN"],
    locked: true,
    available: { kind: "at_war" },
    cost: { pp: 50 },
    effects: [
      { kind: "add_spirit", id: "can_price_controls" },
      { kind: "stability", pct: 2 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "war_days_ge", days: 500 }, factor: 400 }],
    },
  },
  {
    id: "can_billion_dollar_gift",
    category: "diplomacy",
    for: ["CAN"],
    locked: true,
    available: all(
      exists("GBR"),
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    cost: { pp: 50 },
    effects: [
      {
        kind: "send_equipment",
        to: T("GBR"),
        type: "infantry_equipment",
        count: 1500,
      },
      { kind: "send_equipment", to: T("GBR"), type: "motorized", count: 200 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 511 },
    ],
    ai: { base: 10 },
  },
  {
    id: "can_tanks_for_russia",
    category: "diplomacy",
    for: ["CAN"],
    locked: true,
    available: all(
      exists("SUN"),
      { kind: "at_war_with", who: T("SUN"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "send_equipment", to: T("SUN"), type: "medium_tank", count: 40 },
      { kind: "opinion", who: T("SUN"), of: "self", value: 15, days: 365 },
    ],
    ai: {
      base: 8,
      mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 0 }],
    },
  },
  {
    id: "can_uranium_contract",
    category: "economy",
    for: ["CAN"],
    locked: true,
    available: all(
      any(exists("USA"), exists("GBR")),
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "opinion", who: T("USA"), of: "self", value: 25, days: 511 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 10, days: 365 },
      { kind: "pp", amount: 75 },
    ],
    ai: { base: 10 },
  },
  {
    id: "can_halifax_convoys",
    category: "military",
    for: ["CAN"],
    available: all(
      { kind: "at_war" },
      { kind: "has_spirit", id: "can_escort_force" },
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "convoys", amount: 30 },
      { kind: "navy_xp", amount: 5 },
    ],
    ai: { base: 8 },
  },
];
