// World War 1936 P3 — generic decisions (spec §13.2, §19.7 last line), any
// country. Texts: ww1936.decision.<id>, ww1936.decision_desc.<id>.
// Targeted decisions: in target.among, self = the candidate and from = the
// decider; in available and the effects, self = the decider and target = the
// chosen country (plan, content guidance 9).
import type {
  Condition,
  Effect,
  Selector,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { DecisionDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, not } from "../helpers";

// ---- gen_tech_exchange: "the faction leader has a technology we lack", branch by branch ----
const LEADER: Selector = { factionLeaderOf: "self" };
const AHEAD_INFANTRY: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "inf_eq_1" },
    not({ kind: "has_tech", tech: "inf_eq_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "inf_eq_2" },
    not({ kind: "has_tech", tech: "inf_eq_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "inf_eq_3" },
    not({ kind: "has_tech", tech: "inf_eq_3" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "support_eq_1" },
    not({ kind: "has_tech", tech: "support_eq_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "support_eq_2" },
    not({ kind: "has_tech", tech: "support_eq_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "motorized_1" },
    not({ kind: "has_tech", tech: "motorized_1" }),
  ),
);
const AHEAD_ARTILLERY: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "artillery_1" },
    not({ kind: "has_tech", tech: "artillery_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "artillery_2" },
    not({ kind: "has_tech", tech: "artillery_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "artillery_3" },
    not({ kind: "has_tech", tech: "artillery_3" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "anti_tank_1" },
    not({ kind: "has_tech", tech: "anti_tank_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "anti_tank_2" },
    not({ kind: "has_tech", tech: "anti_tank_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "anti_air_1" },
    not({ kind: "has_tech", tech: "anti_air_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "anti_air_2" },
    not({ kind: "has_tech", tech: "anti_air_2" }),
  ),
);
const AHEAD_ARMOUR: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "light_tank_1" },
    not({ kind: "has_tech", tech: "light_tank_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "light_tank_2" },
    not({ kind: "has_tech", tech: "light_tank_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "medium_tank_1" },
    not({ kind: "has_tech", tech: "medium_tank_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "medium_tank_2" },
    not({ kind: "has_tech", tech: "medium_tank_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "medium_tank_3" },
    not({ kind: "has_tech", tech: "medium_tank_3" }),
  ),
);
const AHEAD_AIR: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "fighter_1" },
    not({ kind: "has_tech", tech: "fighter_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "fighter_2" },
    not({ kind: "has_tech", tech: "fighter_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "fighter_3" },
    not({ kind: "has_tech", tech: "fighter_3" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "bomber_1" },
    not({ kind: "has_tech", tech: "bomber_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "bomber_2" },
    not({ kind: "has_tech", tech: "bomber_2" }),
  ),
);
const AHEAD_INDUSTRY: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "construction_1" },
    not({ kind: "has_tech", tech: "construction_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "construction_2" },
    not({ kind: "has_tech", tech: "construction_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "construction_3" },
    not({ kind: "has_tech", tech: "construction_3" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "tools_1" },
    not({ kind: "has_tech", tech: "tools_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "tools_2" },
    not({ kind: "has_tech", tech: "tools_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "tools_3" },
    not({ kind: "has_tech", tech: "tools_3" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "tools_4" },
    not({ kind: "has_tech", tech: "tools_4" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "output_1" },
    not({ kind: "has_tech", tech: "output_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "output_2" },
    not({ kind: "has_tech", tech: "output_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "excavation_1" },
    not({ kind: "has_tech", tech: "excavation_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "excavation_2" },
    not({ kind: "has_tech", tech: "excavation_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "flexible_line" },
    not({ kind: "has_tech", tech: "flexible_line" }),
  ),
);
const AHEAD_ELECTRONICS: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "electronics_1" },
    not({ kind: "has_tech", tech: "electronics_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "computing_1" },
    not({ kind: "has_tech", tech: "computing_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "computing_2" },
    not({ kind: "has_tech", tech: "computing_2" }),
  ),
);
const AHEAD_DOCTRINE: Condition = any(
  all(
    { kind: "has_tech", who: LEADER, tech: "mobile_1" },
    not({ kind: "has_tech", tech: "mobile_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "mobile_2" },
    not({ kind: "has_tech", tech: "mobile_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "firepower_1" },
    not({ kind: "has_tech", tech: "firepower_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "firepower_2" },
    not({ kind: "has_tech", tech: "firepower_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "battleplan_1" },
    not({ kind: "has_tech", tech: "battleplan_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "battleplan_2" },
    not({ kind: "has_tech", tech: "battleplan_2" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "mass_1" },
    not({ kind: "has_tech", tech: "mass_1" }),
  ),
  all(
    { kind: "has_tech", who: LEADER, tech: "mass_2" },
    not({ kind: "has_tech", tech: "mass_2" }),
  ),
);
/** The first branch (TECH_BRANCHES order) where the leader is ahead gets +100% once (plan: branch chain). */
const TECH_EXCHANGE: Effect = {
  kind: "if",
  cond: AHEAD_INFANTRY,
  then: [{ kind: "research_bonus", branch: "infantry", pct: 100, uses: 1 }],
  else: [
    {
      kind: "if",
      cond: AHEAD_ARTILLERY,
      then: [
        { kind: "research_bonus", branch: "artillery", pct: 100, uses: 1 },
      ],
      else: [
        {
          kind: "if",
          cond: AHEAD_ARMOUR,
          then: [
            { kind: "research_bonus", branch: "armour", pct: 100, uses: 1 },
          ],
          else: [
            {
              kind: "if",
              cond: AHEAD_AIR,
              then: [
                { kind: "research_bonus", branch: "air", pct: 100, uses: 1 },
              ],
              else: [
                {
                  kind: "if",
                  cond: AHEAD_INDUSTRY,
                  then: [
                    {
                      kind: "research_bonus",
                      branch: "industry",
                      pct: 100,
                      uses: 1,
                    },
                  ],
                  else: [
                    {
                      kind: "if",
                      cond: AHEAD_ELECTRONICS,
                      then: [
                        {
                          kind: "research_bonus",
                          branch: "electronics",
                          pct: 100,
                          uses: 1,
                        },
                      ],
                      else: [
                        {
                          kind: "if",
                          cond: AHEAD_DOCTRINE,
                          then: [
                            {
                              kind: "research_bonus",
                              branch: "doctrine",
                              pct: 100,
                              uses: 1,
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

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
      any(
        AHEAD_INFANTRY,
        AHEAD_ARTILLERY,
        AHEAD_ARMOUR,
        AHEAD_AIR,
        AHEAD_INDUSTRY,
        AHEAD_ELECTRONICS,
        AHEAD_DOCTRINE,
      ),
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
    visible: { kind: "ruling", ideology: "democratic" },
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
    visible: { kind: "ruling", ideology: "communist" },
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
    visible: { kind: "ruling", ideology: "fascist" },
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
    visible: { kind: "ruling", ideology: "neutral" },
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
    visible: { kind: "ruling", ideology: "democratic" },
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
    visible: { kind: "ruling", ideology: "communist" },
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
    visible: { kind: "ruling", ideology: "fascist" },
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
    visible: { kind: "ruling", ideology: "neutral" },
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
