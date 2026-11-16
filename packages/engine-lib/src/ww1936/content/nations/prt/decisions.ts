// ww229: Portugal's decisions (texts ww1936.decision.<id>,
// ww1936.decision_desc.<id>). The national mechanism, "wolfram and the
// islands":
// - the wolfram contracts, a year at a time, with Germany or the Allies;
//   each pays in trade and wins the buyer at the other side's expense, and
//   the embargo stops the German trade for good;
// - the Azores: leased to Britain (then to America) for the alliance's
//   arms and goodwill, or fortified against all comers.
// A decision without cooldownDays is taken once. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const PRT_DECISIONS: readonly DecisionDef[] = [
  // ---- the wolfram contracts ----
  {
    id: "prt_wolfram_sale_deu",
    category: "economy",
    for: ["PRT"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("prt_wolfram_embargoed")),
    ),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "prt_german_contracts", days: 365 },
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
    id: "prt_wolfram_sale_allies",
    category: "economy",
    for: ["PRT"],
    locked: true,
    available: all(exists("GBR"), not({ kind: "at_war_with", of: T("GBR") })),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "prt_allied_contracts", days: 365 },
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
    id: "prt_wolfram_embargo",
    category: "economy",
    for: ["PRT"],
    locked: true,
    available: all(
      exists("DEU"),
      not(flag("prt_wolfram_embargoed")),
      any(
        { kind: "at_war_with", of: T("DEU") },
        { kind: "same_faction", of: T("GBR") },
        { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      ),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "set_flag", flag: "prt_wolfram_embargoed" },
      { kind: "remove_spirit", id: "prt_german_contracts" },
      { kind: "opinion", who: T("DEU"), of: "self", value: -30, days: 511 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
      { kind: "embargo", on: T("DEU") },
    ],
    ai: {
      base: 5,
      mods: [
        { if: { kind: "at_war_with", of: T("DEU") }, factor: 2000 },
        { if: { kind: "ruling", ideology: "fascist" }, factor: 0 },
      ],
    },
  },
  // ---- the Atlantic islands ----
  {
    id: "prt_azores_lease_gbr",
    category: "diplomacy",
    for: ["PRT"],
    locked: true,
    available: all(
      exists("GBR"),
      not(flag("prt_azores_leased")),
      { kind: "at_war_with", who: T("GBR"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("GBR") }),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "set_flag", flag: "prt_azores_leased" },
      { kind: "access", of: T("GBR") },
      { kind: "add_spirit", id: "prt_atlantic_bases" },
      { kind: "equipment", type: "fighter", gen: 2, count: 30 },
      { kind: "opinion", who: T("GBR"), of: "self", value: 25, days: 511 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -20, days: 365 },
    ],
    ai: {
      base: 10,
      mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 0 }],
    },
  },
  {
    id: "prt_azores_lease_usa",
    category: "diplomacy",
    for: ["PRT"],
    visible: flag("prt_azores_leased"),
    available: all(
      flag("prt_azores_leased"),
      not(flag("prt_azores_us")),
      exists("USA"),
      { kind: "at_war_with", who: T("USA"), of: T("DEU") },
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "set_flag", flag: "prt_azores_us" },
      { kind: "access", of: T("USA") },
      { kind: "opinion", who: T("USA"), of: "self", value: 25, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "prt_fortify_azores",
    category: "military",
    for: ["PRT"],
    locked: true,
    available: not(flag("prt_azores_leased")),
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "fort", where: { group: "prt_azores" }, amount: 1 },
      {
        kind: "build",
        where: { group: "prt_atlantic_islands" },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: {
      base: 3,
      mods: [
        { if: { kind: "at_war", who: T("DEU") }, factor: 300 },
        { if: { kind: "at_war" }, factor: 300 },
      ],
    },
  },
  // ---- the war years ----
  {
    id: "prt_legion_mobilisation",
    category: "military",
    for: ["PRT"],
    locked: true,
    available: any(
      { kind: "at_war" },
      { kind: "at_war", who: T("ESN") },
      { kind: "at_war", who: T("ESR") },
      { kind: "at_war", who: T("DEU") },
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "prt_legion_mobilised", days: 180 },
      { kind: "war_support", pct: 3 },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "at_war" }, factor: 600 }],
    },
  },
  {
    id: "prt_refugee_transit",
    category: "political",
    for: ["PRT"],
    locked: true,
    available: all(exists("DEU"), { kind: "at_war", who: T("DEU") }),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "prt_refugee_port", days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: 10, days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: -5, days: 365 },
    ],
    ai: {
      base: 8,
      mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 0 }],
    },
  },
  {
    id: "prt_viriatos",
    category: "military",
    for: ["PRT"],
    locked: true,
    available: all(exists("ESN"), exists("ESR"), {
      kind: "at_war_with",
      who: T("ESN"),
      of: T("ESR"),
    }),
    cost: { pp: 50 },
    effects: [
      { kind: "volunteers", to: T("ESN"), divisions: 1 },
      { kind: "add_spirit", id: "prt_spanish_volunteers", days: 365 },
      { kind: "opinion", who: T("ESN"), of: "self", value: 15, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "prt_colonial_garrison",
    category: "military",
    for: ["PRT"],
    visible: { kind: "focus_done", id: "prt_colonial_battalions" },
    available: all(
      { kind: "focus_done", id: "prt_colonial_battalions" },
      { kind: "owns_group", group: "prt_angola" },
    ),
    cost: { pp: 25, manpower: 4000 },
    cooldownDays: 365,
    effects: [
      {
        kind: "divisions",
        template: "prt_colonial_column",
        count: 1,
        where: { group: "prt_angola" },
      },
    ],
    ai: {
      base: 3,
      mods: [{ if: { kind: "at_war" }, factor: 300 }],
    },
  },
  // ---- the Iberian union ----
  {
    id: "prt_propose_union",
    category: "diplomacy",
    for: ["PRT"],
    locked: true,
    target: {
      among: all(
        any({ kind: "tag", tag: "ESN" }, { kind: "tag", tag: "ESR" }),
        not({ kind: "at_war_with", of: "self" }),
        not({ kind: "is_subject" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "fire_event", id: "prt_iberian_union_offer", to: "target" },
    ],
    ai: { base: 10 },
  },
];
