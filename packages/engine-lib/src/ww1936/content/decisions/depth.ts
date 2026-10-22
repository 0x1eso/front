// World War 1936 P6: the decisions of the depth systems. Texts:
// ww1936.decision.<id>, ww1936.decision_desc.<id>.
//
// - gen_expand_staff_college (spec §4.1): any country, 50 PP, the spirit
//   gen_staff_college (command power gain +25%) for 180 days, once a year.
// - usa_* (spec §13.1, the "Congress" tab): congress {pp} moves the support
//   of Congress in percentage points.
// - chn_*, jpn_*, fra_* (spec §13.2): bop {amount} moves the balance in ‰
//   (− left, + right). The spec gives no cooldown; 90 days is this lane's
//   choice so a decision cannot outrun a whole band in a season. Japan's
//   balance stops in 1945-08 and France's when its government changes or it
//   capitulates (the mechanisms lane turns the balance off; the decisions
//   go with it).
// - AI weights follow spec §13.2 "AI(역사)": China toward the centre, Japan
//   toward the army until 1940 and back to the balance from 1941, France to
//   the right from 1938.
import { after, all, any, before, not } from "../helpers";
import type { DecisionDef } from "../types";

export const DEPTH_DECISIONS: readonly DecisionDef[] = [
  {
    // The spirit keeps the id gen_staff_college (Phase B: decision ids
    // differ from focus and spirit ids).
    id: "gen_expand_staff_college",
    category: "military",
    for: "any",
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [{ kind: "add_spirit", id: "gen_staff_college", days: 180 }],
    ai: { base: 10, mods: [{ if: { kind: "at_war" }, factor: 300 }] },
  },

  // ---- United States: Congress ----
  {
    id: "usa_lobby_congress",
    category: "political",
    for: ["USA"],
    cost: { pp: 25 },
    cooldownDays: 60,
    effects: [{ kind: "congress", pp: 8 }],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "congress_above", pct: 60 }, factor: 10 },
        { if: { kind: "wt_ge", pct: 40 }, factor: 300 },
      ],
    },
  },
  {
    id: "usa_fireside_chat",
    category: "political",
    for: ["USA"],
    cost: { pp: 50 },
    cooldownDays: 120,
    effects: [
      { kind: "congress", pp: 12 },
      { kind: "war_support", pct: 3 },
    ],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "congress_above", pct: 60 }, factor: 10 },
        { if: { kind: "wt_ge", pct: 40 }, factor: 300 },
      ],
    },
  },
  {
    id: "usa_defense_bill",
    category: "economy",
    for: ["USA"],
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      { kind: "congress", pp: -5 },
    ],
    ai: {
      base: 10,
      mods: [{ if: not({ kind: "congress_above", pct: 45 }), factor: 20 }],
    },
  },

  // ---- China: central government ↔ regional powers ----
  {
    id: "chn_central_officers",
    category: "political",
    for: ["CHN"],
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [{ kind: "bop", amount: -80 }],
    ai: {
      base: 20,
      mods: [{ if: { kind: "bop_range", tag: "CHN", band: 0 }, factor: 10 }],
    },
  },
  {
    id: "chn_regional_appeasement",
    category: "political",
    for: ["CHN"],
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [
      { kind: "bop", amount: 80 },
      { kind: "stability", pct: 3 },
    ],
    ai: {
      base: 2,
      mods: [{ if: not({ kind: "stability_ge", pct: 30 }), factor: 500 }],
    },
  },

  // ---- Japan: army ↔ navy ----
  {
    id: "jpn_army_budget",
    category: "military",
    for: ["JPN"],
    available: before("1945-08-01"),
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [{ kind: "bop", amount: -100 }],
    ai: {
      base: 10,
      mods: [
        { if: { kind: "bop_range", tag: "JPN", band: 0 }, factor: 10 },
        {
          if: all(
            after("1941-01-01"),
            any(
              { kind: "bop_range", tag: "JPN", band: 0 },
              { kind: "bop_range", tag: "JPN", band: 1 },
              { kind: "bop_range", tag: "JPN", band: 2 },
            ),
          ),
          factor: 0,
        },
      ],
    },
  },
  {
    id: "jpn_navy_budget",
    category: "military",
    for: ["JPN"],
    available: before("1945-08-01"),
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [{ kind: "bop", amount: 100 }],
    ai: {
      base: 2,
      mods: [
        {
          if: all(
            after("1941-01-01"),
            any(
              { kind: "bop_range", tag: "JPN", band: 0 },
              { kind: "bop_range", tag: "JPN", band: 1 },
            ),
          ),
          factor: 1000,
        },
      ],
    },
  },

  // ---- France: Popular Front ↔ national union ----
  {
    id: "fra_social_reform",
    category: "political",
    for: ["FRA"],
    available: all(not({ kind: "capitulated" }), {
      kind: "ruling",
      ideology: "democratic",
    }),
    cost: { pp: 25 },
    cooldownDays: 90,
    effects: [{ kind: "bop", amount: -100 }],
    ai: {
      base: 10,
      mods: [{ if: after("1938-01-01"), factor: 0 }],
    },
  },
  {
    id: "fra_rearmament_act",
    category: "military",
    for: ["FRA"],
    available: all(not({ kind: "capitulated" }), {
      kind: "ruling",
      ideology: "democratic",
    }),
    cost: { pp: 50 },
    cooldownDays: 90,
    effects: [{ kind: "bop", amount: 150 }],
    ai: {
      base: 2,
      mods: [{ if: after("1938-01-01"), factor: 1000 }],
    },
  },
];
