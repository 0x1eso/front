// ww229: Poland's decisions. The balance of power (core.ts) is worked from
// here: tighten the camp's grip or open to the opposition. The P6 pack's
// pol_order_uprising (locked) is opened by pol_underground_state, and the P3
// pol_zaolzie_ultimatum stays as it is. Data only.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, done, fire, not } from "../../helpers";

export const POL_DECISIONS: DecisionDef[] = [
  // ---- the balance of power ----
  {
    id: "pol_dec_tighten_camp",
    category: "political",
    for: ["POL"],
    available: all(
      { kind: "ruling", ideology: "neutral" },
      not({ kind: "bop_range", tag: "POL", band: 4 }),
    ),
    cost: { pp: 50 },
    cooldownDays: 120,
    effects: [
      { kind: "bop", amount: 120 },
      { kind: "stability", pct: -2 },
    ],
    ai: {
      base: 10,
      mods: [{ if: { kind: "bop_range", tag: "POL", band: 3 }, factor: 30 }],
    },
  },
  {
    id: "pol_dec_open_to_opposition",
    category: "political",
    for: ["POL"],
    available: all(
      { kind: "ruling", ideology: "neutral" },
      not({ kind: "bop_range", tag: "POL", band: 0 }),
    ),
    cost: { pp: 50 },
    cooldownDays: 120,
    effects: [
      { kind: "bop", amount: -120 },
      { kind: "stability", pct: 2 },
      { kind: "popularity", ideology: "democratic", pp: 1 },
    ],
    ai: {
      base: 6,
      mods: [{ if: { kind: "bop_range", tag: "POL", band: 4 }, factor: 300 }],
    },
  },
  {
    // The isolation camp at Bereza Kartuska, for the regime's opponents.
    id: "pol_dec_bereza_camp",
    category: "political",
    for: ["POL"],
    available: { kind: "ruling", ideology: "neutral" },
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "popularity", ideology: "communist", pp: -2 },
      { kind: "popularity", ideology: "fascist", pp: -2 },
      { kind: "stability", pct: -2 },
      { kind: "bop", amount: 80 },
    ],
    ai: {
      base: 4,
      mods: [{ if: { kind: "stability_ge", pct: 50 }, factor: 0 }],
    },
  },

  // ---- the economy ----
  {
    id: "pol_dec_cop_investment",
    category: "economy",
    for: ["POL"],
    available: done("pol_cop_founding"),
    cost: { pp: 75 },
    cooldownDays: 180,
    effects: [
      {
        kind: "build",
        where: { best: 1, of: "sandomierz" },
        building: "civ",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
  {
    // SEPEWE, the state arms-export company: rifles sold abroad for money.
    id: "pol_dec_arms_exports",
    category: "economy",
    for: ["POL"],
    available: not({ kind: "at_war" }),
    cost: { equipment: ["infantry_equipment", 500] },
    cooldownDays: 180,
    effects: [{ kind: "pp", amount: 60 }],
    ai: { base: 4 },
  },
  {
    // The anti-aircraft loan: a public subscription for guns.
    id: "pol_dec_air_defence_loan",
    category: "economy",
    for: ["POL"],
    available: any(
      { kind: "at_war" },
      { kind: "threat_ge", of: T("DEU"), pct: 30 },
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "equipment", type: "anti_air", gen: 1, count: 200 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "pol_dec_navy_collection",
    category: "economy",
    for: ["POL"],
    available: done("pol_maritime_league"),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [{ kind: "navy_xp", amount: 10 }],
    ai: { base: 3 },
  },

  // ---- the army ----
  {
    id: "pol_dec_reinforce_border_corps",
    category: "military",
    for: ["POL"],
    available: done("pol_border_corps"),
    cost: { pp: 40 },
    cooldownDays: 240,
    effects: [
      { kind: "fort", where: { borderWith: T("SUN"), n: 2 }, amount: 1 },
    ],
    ai: { base: 4 },
  },
  {
    // The gold reserve leaves through Romania before the capital falls.
    id: "pol_dec_evacuate_gold",
    category: "national",
    for: ["POL"],
    available: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "lost_vp_ge", pct: 10 },
    ),
    effects: [fire("pol_ev_gold_route"), { kind: "exile_legitimacy", pct: 5 }],
    ai: { base: 50 },
  },
  {
    // The last line along the Romanian border.
    id: "pol_dec_bridgehead_retreat",
    category: "military",
    for: ["POL"],
    available: all(
      { kind: "at_war_with", of: T("DEU") },
      { kind: "lost_vp_ge", pct: 30 },
      not({ kind: "is_exile" }),
    ),
    cost: { pp: 25 },
    effects: [{ kind: "add_spirit", id: "pol_sp_last_stand", days: 120 }],
    ai: { base: 30 },
  },
];
