// World War 1936 P3 — generic decisions (spec §13.2, §19.7 last line), any
// country. Texts: ww1936.decision.<id>, ww1936.decision_desc.<id>.
// Targeted decisions: in target.among, self = the candidate and from = the
// decider; in available and the effects, self = the decider and target = the
// chosen country (plan, content guidance 9).
import { WW_MAX_SLOTS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, not, techExchange } from "../helpers";

// ---- gen_tech_exchange: "the faction leader has a technology we lack", branch by branch ----
// Research overhaul (changes §2.6): every researchable tech of the branch,
// the new ones and the support branch included (helpers.techExchange).
const { ahead: AHEAD, effect: TECH_EXCHANGE } = techExchange([
  "infantry",
  "support",
  "artillery",
  "armour",
  "air",
  "industry",
  "electronics",
]);

// ---- gen_rally: the ruling party's drift rides on the hidden party-support spirits ----
const RALLY_DRIFT: Effect = {
  kind: "if",
  cond: { kind: "ruling", ideology: "democratic" },
  then: [{ kind: "add_spirit", id: "gen_party_support_democratic", days: 90 }],
  else: [
    {
      kind: "if",
      cond: { kind: "ruling", ideology: "communist" },
      then: [
        { kind: "add_spirit", id: "gen_party_support_communist", days: 90 },
      ],
      else: [
        {
          kind: "if",
          cond: { kind: "ruling", ideology: "fascist" },
          then: [
            { kind: "add_spirit", id: "gen_party_support_fascist", days: 90 },
          ],
          else: [
            { kind: "add_spirit", id: "gen_party_support_neutral", days: 90 },
          ],
        },
      ],
    },
  ],
};

// ---- gen_coup_*: the coup succeeds when the backed ideology reaches half the target's support ----
const COUP_FAILED: Effect[] = [
  { kind: "stability", who: "target", pct: 5 },
  { kind: "opinion", who: "target", of: "self", value: -50, days: 365 },
];

export const GENERIC_DECISIONS: DecisionDef[] = [
  // ---- political ----
  {
    id: "gen_rally",
    category: "political",
    for: "any",
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "add_spirit", id: "gen_rally_spirit", days: 90 },
      RALLY_DRIFT,
    ],
    ai: { base: 5 },
  },
  {
    id: "gen_suppress_opposition",
    category: "political",
    for: "any",
    available: not({ kind: "ruling", ideology: "democratic" }),
    cost: { pp: 75 },
    cooldownDays: 180,
    effects: [
      { kind: "popularity", ideology: "largest_other", pp: -8 },
      { kind: "stability", pct: -3 },
    ],
    ai: {
      base: 5,
      mods: [{ if: not({ kind: "stability_ge", pct: 40 }), factor: 0 }],
    },
  },
  {
    id: "gen_suspend_elections",
    category: "political",
    for: "any",
    visible: { kind: "ruling", ideology: "democratic" },
    available: all(
      { kind: "ruling", ideology: "democratic" },
      { kind: "at_war" },
    ),
    cost: { pp: 50 },
    effects: [
      { kind: "elections", suspend: true },
      { kind: "set_flag", flag: "elections_suspended" },
      { kind: "stability", pct: -5 },
    ],
    ai: {
      base: 10,
      mods: [
        {
          if: not({ kind: "pop_ge", ideology: "democratic", pct: 50 }),
          factor: 300,
        },
      ],
    },
  },
  {
    id: "gen_martial_law",
    category: "political",
    for: "any",
    available: not({ kind: "stability_ge", pct: 30 }),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [{ kind: "add_spirit", id: "gen_martial_law_spirit", days: 90 }],
    ai: { base: 30 },
  },
  // ---- economy ----
  {
    id: "gen_war_bonds",
    category: "economy",
    for: "any",
    available: { kind: "at_war" },
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [{ kind: "add_spirit", id: "gen_war_bonds_spirit", days: 180 }],
    ai: { base: 20 },
  },
  {
    id: "gen_industrial_subsidy",
    category: "economy",
    for: "any",
    cost: { pp: 75 },
    cooldownDays: 365,
    effects: [
      { kind: "add_spirit", id: "gen_industrial_subsidy_spirit", days: 180 },
    ],
    ai: { base: 15 },
  },
  // Research overhaul (changes §1.3): a research slot, once a game, when the
  // war has run half a year or the world is tense (a situation, not a date).
  {
    id: "gen_science_mobilisation",
    category: "economy",
    for: "any",
    available: all(
      { kind: "factories_ge", count: 10 },
      any({ kind: "war_days_ge", days: 180 }, { kind: "wt_ge", pct: 50 }),
    ),
    cost: { pp: 100 },
    effects: [{ kind: "research_slot", amount: 1 }],
    ai: {
      base: 40,
      mods: [
        {
          if: { kind: "research_slots_ge", count: WW_MAX_SLOTS },
          factor: 0,
        },
      ],
    },
  },
  // ---- military ----
  {
    id: "gen_emergency_draft",
    category: "military",
    for: "any",
    available: { kind: "at_war" },
    cost: { pp: 25 },
    cooldownDays: 365,
    effects: [
      { kind: "manpower", recruitablePct: 2 },
      { kind: "war_support", pct: -3 },
      { kind: "stability", pct: -2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_fortify_border",
    category: "military",
    for: "any",
    available: any({ kind: "justified_against" }, { kind: "at_war" }),
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      { kind: "fort", where: { borderWith: "threat", n: 3 }, amount: 1 },
    ],
    ai: { base: 20 },
  },
  {
    id: "gen_hire_general",
    category: "military",
    for: "any",
    cost: { pp: 25 },
    cooldownDays: 60,
    effects: [{ kind: "add_general" }],
    ai: { base: 3 },
  },
  // ---- diplomacy ----
  {
    id: "gen_tech_exchange",
    category: "diplomacy",
    for: "any",
    available: all(
      { kind: "in_faction" },
      not({ kind: "faction_leader" }),
      any(...AHEAD),
    ),
    cost: { pp: 50 },
    cooldownDays: 365,
    effects: [TECH_EXCHANGE],
    ai: { base: 15 },
  },
  // Party support, one per backed ideology (the decider's own; spec §13.2, §16.5).
  {
    id: "gen_party_support_dem",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "democratic", pct: 10 },
        not({ kind: "ruling", ideology: "democratic" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      {
        kind: "add_spirit",
        who: "target",
        id: "gen_party_support_democratic",
        days: 180,
      },
    ],
    ai: { base: 5 },
  },
  {
    id: "gen_party_support_com",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "communist", pct: 10 },
        not({ kind: "ruling", ideology: "communist" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      {
        kind: "add_spirit",
        who: "target",
        id: "gen_party_support_communist",
        days: 180,
      },
    ],
    ai: { base: 5 },
  },
  {
    id: "gen_party_support_fas",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "fascist", pct: 10 },
        not({ kind: "ruling", ideology: "fascist" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      {
        kind: "add_spirit",
        who: "target",
        id: "gen_party_support_fascist",
        days: 180,
      },
    ],
    ai: { base: 5 },
  },
  {
    id: "gen_party_support_neu",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "neutral", pct: 10 },
        not({ kind: "ruling", ideology: "neutral" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [
      {
        kind: "add_spirit",
        who: "target",
        id: "gen_party_support_neutral",
        days: 180,
      },
    ],
    ai: { base: 5 },
  },
  // Coup support: a 90-day mission, one per backed ideology (spec §13.2).
  {
    id: "gen_coup_dem",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "democratic", pct: 40 },
        not({ kind: "ruling", ideology: "democratic" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 150, equipment: ["infantry_equipment", 1000] },
    cooldownDays: 365,
    days: 90,
    effects: [],
    completeEffects: [
      {
        kind: "if",
        cond: {
          kind: "pop_ge",
          who: "target",
          ideology: "democratic",
          pct: 50,
        },
        then: [
          { kind: "set_government", who: "target", ideology: "democratic" },
          { kind: "fire_event", id: "gen_coup_done", to: "target" },
        ],
        else: COUP_FAILED,
      },
    ],
    ai: { base: 3 },
  },
  {
    id: "gen_coup_com",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "communist", pct: 40 },
        not({ kind: "ruling", ideology: "communist" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 150, equipment: ["infantry_equipment", 1000] },
    cooldownDays: 365,
    days: 90,
    effects: [],
    completeEffects: [
      {
        kind: "if",
        cond: { kind: "pop_ge", who: "target", ideology: "communist", pct: 50 },
        then: [
          { kind: "set_government", who: "target", ideology: "communist" },
          { kind: "fire_event", id: "gen_coup_done", to: "target" },
        ],
        else: COUP_FAILED,
      },
    ],
    ai: { base: 3 },
  },
  {
    id: "gen_coup_fas",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "fascist", pct: 40 },
        not({ kind: "ruling", ideology: "fascist" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 150, equipment: ["infantry_equipment", 1000] },
    cooldownDays: 365,
    days: 90,
    effects: [],
    completeEffects: [
      {
        kind: "if",
        cond: { kind: "pop_ge", who: "target", ideology: "fascist", pct: 50 },
        then: [
          { kind: "set_government", who: "target", ideology: "fascist" },
          { kind: "fire_event", id: "gen_coup_done", to: "target" },
        ],
        else: COUP_FAILED,
      },
    ],
    ai: { base: 3 },
  },
  {
    id: "gen_coup_neu",
    category: "diplomacy",
    for: "any",
    visible: { kind: "always", value: false },
    target: {
      among: all(
        { kind: "pop_ge", ideology: "neutral", pct: 40 },
        not({ kind: "ruling", ideology: "neutral" }),
        not({ kind: "at_war_with", of: "from" }),
      ),
    },
    cost: { pp: 150, equipment: ["infantry_equipment", 1000] },
    cooldownDays: 365,
    days: 90,
    effects: [],
    completeEffects: [
      {
        kind: "if",
        cond: { kind: "pop_ge", who: "target", ideology: "neutral", pct: 50 },
        then: [
          { kind: "set_government", who: "target", ideology: "neutral" },
          { kind: "fire_event", id: "gen_coup_done", to: "target" },
        ],
        else: COUP_FAILED,
      },
    ],
    ai: { base: 3 },
  },
  // Faction requests, opened by the ideology alliance focuses (spec §19.7 last line).
  // Tension gates of spec §14.4: 40% for a democracy or a non-aligned government,
  // 20% for gen_join_allies (the gen_allied_course spirit of gen_pol_dem_ally).
  {
    id: "gen_join_allies",
    category: "diplomacy",
    for: "any",
    locked: true,
    available: all(
      not({ kind: "in_faction" }),
      { kind: "in_faction", who: { tag: "GBR" } },
      any(
        { kind: "ruling", ideology: "communist" },
        { kind: "ruling", ideology: "fascist" },
        { kind: "wt_ge", pct: 20 },
      ),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      {
        kind: "fire_event",
        id: "gen_diplo_faction_request",
        to: { factionLeaderOf: { tag: "GBR" } },
      },
    ],
    ai: { base: 30 },
  },
  {
    id: "gen_join_comintern",
    category: "diplomacy",
    for: "any",
    locked: true,
    available: all(
      not({ kind: "in_faction" }),
      { kind: "in_faction", who: { tag: "SUN" } },
      any(
        { kind: "ruling", ideology: "communist" },
        { kind: "ruling", ideology: "fascist" },
        { kind: "wt_ge", pct: 40 },
      ),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      {
        kind: "fire_event",
        id: "gen_diplo_faction_request",
        to: { factionLeaderOf: { tag: "SUN" } },
      },
    ],
    ai: { base: 30 },
  },
  {
    id: "gen_join_axis",
    category: "diplomacy",
    for: "any",
    locked: true,
    available: all(
      not({ kind: "in_faction" }),
      { kind: "in_faction", who: { tag: "DEU" } },
      any(
        { kind: "ruling", ideology: "communist" },
        { kind: "ruling", ideology: "fascist" },
        { kind: "wt_ge", pct: 40 },
      ),
    ),
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [
      {
        kind: "fire_event",
        id: "gen_diplo_faction_request",
        to: { factionLeaderOf: { tag: "DEU" } },
      },
    ],
    ai: { base: 30 },
  },
  // The regional entente's invitations (gen_pol_neu_league): unaligned, non-aligned neighbours.
  {
    id: "gen_invite_neighbours",
    category: "diplomacy",
    for: "any",
    locked: true,
    available: { kind: "faction_leader" },
    target: {
      among: all(
        { kind: "neighbor_of", of: "from" },
        not({ kind: "in_faction" }),
        { kind: "ruling", ideology: "neutral" },
      ),
    },
    cost: { pp: 25 },
    cooldownDays: 180,
    effects: [{ kind: "invite", of: "target" }],
    ai: { base: 20 },
  },
];
