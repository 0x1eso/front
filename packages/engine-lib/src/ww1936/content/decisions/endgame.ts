// World War 1936 P5 (spec §19.3): the endgame decisions of content lane K5 —
// subjects (spec §9.3), governments in exile (spec §10.4, §10.6), partisans
// and three British decisions of 1940-1941.
//
// A targeted decision checks `among` with self = the candidate and from = the
// deciding country; its effects run with self = the decider and target = the
// chosen country.
import { all, any, not, T } from "../helpers";
import type { DecisionDef } from "../types";

export const ENDGAME_DECISIONS: DecisionDef[] = [
  // ---- subjects (spec §9.3) ----
  {
    id: "gen_request_autonomy",
    category: "political",
    for: "any",
    visible: { kind: "is_subject" },
    available: all(
      { kind: "autonomy_ge", pct: 100 },
      not({ kind: "flag", flag: "independence_denied" }),
    ),
    cooldownDays: 90,
    effects: [
      {
        kind: "fire_event",
        id: "gen_subject_upgrade",
        to: { overlordOf: "self" },
      },
    ],
    ai: { base: 100 },
  },
  {
    id: "gen_demand_autonomy",
    category: "political",
    for: "any",
    visible: { kind: "is_subject" },
    available: { kind: "is_subject" },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [{ kind: "autonomy", pct: 10 }],
    ai: { base: 10 },
  },
  {
    id: "gen_tighten_control",
    category: "political",
    for: "any",
    target: { among: { kind: "subject_of", of: "from" } },
    cost: { pp: 50 },
    cooldownDays: 180,
    days: 90,
    effects: [
      { kind: "set_flag", who: "target", flag: "control_tightened", days: 90 },
    ],
    completeEffects: [
      { kind: "clear_flag", who: "target", flag: "control_tightened" },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_downgrade_subject",
    category: "political",
    for: "any",
    target: {
      among: all(
        { kind: "subject_of", of: "from" },
        not({ kind: "autonomy_ge", pct: 1 }),
        { kind: "subject_level_ge", level: "puppet" },
      ),
    },
    cost: { pp: 25 },
    effects: [{ kind: "make_subject", target: "target", level: "down" }],
    ai: { base: 10 },
  },
  {
    // An integrated puppet with no autonomy left, at peace or fighting only
    // alongside its overlord, is joined to the overlord after 180 days.
    id: "gen_annex_subject",
    category: "annexation",
    for: "any",
    target: {
      among: all(
        { kind: "subject_of", of: "from" },
        not({ kind: "subject_level_ge", level: "puppet" }),
        not({ kind: "autonomy_ge", pct: 1 }),
        any(not({ kind: "at_war" }), { kind: "same_faction", of: "from" }),
      ),
    },
    cost: { pp: 100 },
    days: 180,
    completeEffects: [{ kind: "annex", target: "target", units: "transfer" }],
    ai: { base: 5 },
  },
  {
    id: "gen_release_subject",
    category: "political",
    for: "any",
    target: { among: { kind: "subject_of", of: "from" } },
    effects: [{ kind: "end_subject", target: "target" }],
    ai: { base: 1 },
  },

  // ---- countries without land and governments in exile (spec §10) ----
  {
    // The engine checks spec §10.6 itself: a core region of the target that
    // the decider controls, taken from a legal owner it is at war with.
    id: "gen_restore_country",
    category: "diplomacy",
    for: "any",
    target: { among: all(not({ kind: "exists" }), not({ kind: "is_exile" })) },
    cost: { pp: 50 },
    effects: [{ kind: "restore_country", tag: "target" }],
    ai: { base: 20 },
  },
  {
    id: "gen_exile_resistance",
    category: "military",
    for: "any",
    visible: all({ kind: "is_exile" }, not({ kind: "has_agency" })),
    available: { kind: "is_exile" },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [{ kind: "add_spirit", id: "gen_resistance_support", days: 90 }],
    ai: { base: 30 },
  },
  {
    id: "gen_exile_recruit",
    category: "military",
    for: "any",
    visible: { kind: "is_exile" },
    available: { kind: "is_exile" },
    cost: { pp: 25 },
    cooldownDays: 120,
    effects: [{ kind: "manpower", recruitablePct: 1 }],
    ai: { base: 20 },
  },
  {
    // "An enemy holds my core" is approximated by lost victory points.
    id: "gen_partisan_support",
    category: "military",
    for: "any",
    available: all(
      not({ kind: "is_exile" }),
      { kind: "at_war" },
      { kind: "lost_vp_ge", pct: 5 },
    ),
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "add_spirit", id: "gen_partisan_support_spirit", days: 90 },
    ],
    ai: { base: 15 },
  },

  // ---- the United Kingdom, 1940-1941 ----
  {
    id: "gbr_free_french_recognition",
    category: "diplomacy",
    for: ["GBR"],
    available: { kind: "is_exile", who: T("FRA") },
    cost: { pp: 25 },
    effects: [
      { kind: "exile_legitimacy", who: T("FRA"), pct: 10 },
      { kind: "opinion", of: T("FRA"), value: 30, days: 365 },
      { kind: "opinion", who: T("FRA"), of: "self", value: 30, days: 365 },
    ],
    ai: { base: 20 },
  },
  {
    id: "gbr_occupy_iceland",
    category: "military",
    for: ["GBR"],
    available: all(
      { kind: "exists", who: T("ISL") },
      not({ kind: "at_war_with", of: T("ISL") }),
      any(
        { kind: "capitulated", who: T("DNK") },
        { kind: "is_exile", who: T("DNK") },
        { kind: "subject_of", who: T("DNK"), of: T("DEU") },
      ),
    ),
    cost: { pp: 25 },
    effects: [
      { kind: "fire_event", id: "isl_british_occupation", to: T("ISL") },
    ],
    ai: { base: 10 },
  },
  {
    id: "gbr_levant_intervention",
    category: "military",
    for: ["GBR"],
    available: all(
      { kind: "country_state", tag: "VIC", state: "active" },
      not({ kind: "at_war_with", of: T("VIC") }),
    ),
    cost: { pp: 25 },
    effects: [{ kind: "fire_event", id: "gbr_levant_campaign" }],
    ai: { base: 5 },
  },
];
