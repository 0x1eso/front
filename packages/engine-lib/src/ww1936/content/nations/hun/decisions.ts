// ww229 (design ww227 §5): Hungary's decisions. The Trianon revision runs on
// them: the Revision League's campaign, asking Rome or Berlin to back the
// claims, then a claim on each lost land in turn (the P3 arbitration
// decisions hun_request_arbitration and hun_request_transylvania stay in
// decisions/national.ts and are taken by hun_revision_by_arbitration). Names:
// ww1936.decision.<id>, ww1936.decision_desc.<id>.
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, exists, flag, not, T } from "../../helpers";

export const HUN_DECISIONS: readonly DecisionDef[] = [
  {
    id: "hun_rev_propaganda",
    category: "political",
    for: ["HUN"],
    locked: true,
    cost: { pp: 40 },
    cooldownDays: 180,
    effects: [
      { kind: "war_support", pct: 3 },
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "opinion", who: T("ITA"), of: "self", value: 5, days: 180 },
    ],
    ai: { base: 10 },
  },
  {
    id: "hun_rev_ask_rome",
    category: "diplomacy",
    for: ["HUN"],
    locked: true,
    available: all(
      exists("ITA"),
      not({ kind: "at_war_with", of: T("ITA") }),
      not(flag("hun_rome_backing")),
    ),
    cost: { pp: 30 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "hun_rome_answers", to: T("ITA") }],
    ai: { base: 20 },
  },
  {
    id: "hun_rev_ask_berlin",
    category: "diplomacy",
    for: ["HUN"],
    locked: true,
    available: all(
      exists("DEU"),
      not({ kind: "at_war_with", of: T("DEU") }),
      not(flag("hun_berlin_backing")),
    ),
    cost: { pp: 30 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "hun_berlin_answers", to: T("DEU") }],
    ai: { base: 15 },
  },
  {
    id: "hun_rev_claim_ruthenia",
    category: "annexation",
    for: ["HUN"],
    locked: true,
    available: all(
      not({ kind: "owns_group", group: "carpathian_ruthenia" }),
      not({ kind: "has_war_goal_on", of: { ownerOf: "carpathian_ruthenia" } }),
      any(flag("hun_rome_backing"), flag("hun_berlin_backing")),
    ),
    cost: { pp: 50 },
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "carpathian_ruthenia" },
        type: "claim",
        group: "carpathian_ruthenia",
      },
      { kind: "tension", pct: 2 },
    ],
    ai: { base: 15 },
  },
  {
    id: "hun_rev_claim_transylvania",
    category: "annexation",
    for: ["HUN"],
    locked: true,
    available: all(
      not({ kind: "owns_group", group: "north_transylvania" }),
      not({ kind: "has_war_goal_on", of: { ownerOf: "north_transylvania" } }),
      any(flag("hun_rome_backing"), flag("hun_berlin_backing")),
    ),
    cost: { pp: 75 },
    effects: [
      {
        kind: "war_goal",
        on: { ownerOf: "north_transylvania" },
        type: "claim",
        group: "north_transylvania",
      },
      { kind: "tension", pct: 3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "hun_propose_danube_aut",
    category: "diplomacy",
    for: ["HUN"],
    locked: true,
    available: all(
      exists("AUT"),
      not({ kind: "at_war_with", of: T("AUT") }),
      not({ kind: "is_subject", who: T("AUT") }),
      not({ kind: "in_faction", who: T("AUT") }),
    ),
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "hun_danube_offer", to: T("AUT") }],
    ai: { base: 5 },
  },
  {
    id: "hun_propose_danube_csk",
    category: "diplomacy",
    for: ["HUN"],
    locked: true,
    available: all(
      exists("CSK"),
      not({ kind: "at_war_with", of: T("CSK") }),
      not({ kind: "is_subject", who: T("CSK") }),
      not({ kind: "in_faction", who: T("CSK") }),
    ),
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [{ kind: "fire_event", id: "hun_danube_offer", to: T("CSK") }],
    ai: { base: 3 },
  },
  {
    id: "hun_secret_armistice_talks",
    category: "political",
    for: ["HUN"],
    locked: true,
    available: all(
      { kind: "at_war" },
      any(
        { kind: "at_war_with", of: T("GBR") },
        { kind: "at_war_with", of: T("USA") },
      ),
      not(flag("hun_secret_talks")),
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "set_flag", flag: "hun_secret_talks" },
      { kind: "opinion", who: T("GBR"), of: "self", value: 20, days: 365 },
      { kind: "opinion", who: T("USA"), of: "self", value: 15, days: 365 },
      { kind: "fire_event", id: "hun_talks_discovered", days: 60 },
    ],
    ai: { base: 10 },
  },
  {
    id: "hun_levente_call_up",
    category: "military",
    for: ["HUN"],
    locked: true,
    cost: { pp: 50 },
    effects: [
      { kind: "manpower", recruitablePct: 2 },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "hun_sell_bauxite",
    category: "economy",
    for: ["HUN"],
    locked: true,
    available: all(exists("DEU"), not({ kind: "at_war_with", of: T("DEU") })),
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "hun_bauxite_trade", days: 365 },
      { kind: "opinion", who: T("DEU"), of: "self", value: 15, days: 365 },
    ],
    ai: { base: 10 },
  },
];
