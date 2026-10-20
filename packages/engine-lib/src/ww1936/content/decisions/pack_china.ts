// World War 1936 P6 (spec §11.2–§11.3): the China pack decisions.
// Inside target.among: self = the candidate, from = the decider. The two
// balance-of-power decisions of China are K5's (decisions/depth.ts).
//
// The lend-lease request goes through the P5 event gen_diplo_lend_lease;
// the spec's "Soviet AI accepts ×2" is the Soviet opinion of China raised
// first (P5 llRequestScore counts opinion / 2). A request fired from
// content carries no contract yet (lane K1 report, "DSL gaps").
// Data only (tests/ww1936/ContentPurity): the helpers come from ../helpers.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, fire, not, T } from "../helpers";

export const PACK_CHINA_DECISIONS: DecisionDef[] = [
  {
    // Opened by the four integration focuses; each focus makes its clique
    // a candidate. Success is the clique's answer (chn_warlord_joins).
    id: "chn_integrate_warlord",
    category: "annexation",
    for: ["CHN"],
    locked: true,
    target: {
      among: all(
        any(
          all(
            { kind: "tag", tag: "GXC" },
            { kind: "focus_done", who: "from", id: "chn_integrate_guangxi" },
          ),
          all(
            { kind: "tag", tag: "YUN" },
            { kind: "focus_done", who: "from", id: "chn_integrate_yunnan" },
          ),
          all(
            { kind: "tag", tag: "SXI" },
            { kind: "focus_done", who: "from", id: "chn_integrate_shanxi" },
          ),
          all(
            { kind: "tag", tag: "XBM" },
            { kind: "focus_done", who: "from", id: "chn_integrate_northwest" },
          ),
          all(
            { kind: "tag", tag: "SIK" },
            { kind: "focus_done", who: "from", id: "chn_integrate_northwest" },
          ),
        ),
        any(
          { kind: "opinion_ge", of: "from", value: 50 },
          { kind: "at_war_with", of: "from" },
        ),
      ),
    },
    cost: { pp: 100 },
    cooldownDays: 90,
    effects: [fire("chn_warlord_joins", "target")],
    ai: { base: 30 },
  },
  {
    // Opened by chn_soviet_aid.
    id: "chn_request_soviet_aid",
    category: "diplomacy",
    for: ["CHN"],
    locked: true,
    available: all(
      { kind: "exists", who: T("SUN") },
      not({ kind: "at_war_with", of: T("SUN") }),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      { kind: "opinion", who: T("SUN"), of: "self", value: 30, days: 180 },
      fire("gen_diplo_lend_lease", T("SUN")),
    ],
    ai: {
      base: 20,
      mods: [{ if: { kind: "at_war_with", of: T("JPN") }, factor: 300 }],
    },
  },
  {
    // Opened by ccp_base_areas. "Uprising threshold -10 points" has no
    // effect kind: the uprising fires here at 70% resistance, ten points
    // under the P5 threshold of 80% (lane K1 report).
    id: "ccp_new_base_area",
    category: "military",
    for: ["CCP"],
    locked: true,
    available: all(
      { kind: "at_war_with", of: T("JPN") },
      { kind: "occupied_by", group: "east_china_occupied", of: T("JPN") },
    ),
    cost: { pp: 50 },
    cooldownDays: 120,
    effects: [
      { kind: "resistance", group: "east_china_occupied", pct: 10 },
      { kind: "compliance", group: "east_china_occupied", pct: -10 },
      {
        kind: "if",
        cond: {
          kind: "resistance_ge",
          group: "east_china_occupied",
          pct: 70,
        },
        then: [{ kind: "uprising", group: "east_china_occupied" }],
      },
    ],
    ai: { base: 30 },
  },
];
