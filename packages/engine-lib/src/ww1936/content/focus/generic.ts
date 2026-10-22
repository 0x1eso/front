// World War 1936 P3 — the generic national focus tree (spec §19.2), used by
// every country without a tree of its own. Data only: names and descriptions
// are ww1936.focus.<id> / ww1936.focus_desc.<id>.
//
// Columns, left to right: industry 0..4, research 5..6, army 8..11, air 12,
// navy 13, politics and diplomacy 14..19. Prerequisites sit on the row above.
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { all, any, not } from "../helpers";

/** A government that falls behind a movement grown past half the nation (spec §19.2). */
const SHIFT_DEM: Effect = {
  kind: "if",
  cond: all(
    { kind: "pop_ge", ideology: "democratic", pct: 50 },
    not({ kind: "ruling", ideology: "democratic" }),
  ),
  then: [{ kind: "fire_event", id: "gen_government_shift" }],
};
const SHIFT_COM: Effect = {
  kind: "if",
  cond: all(
    { kind: "pop_ge", ideology: "communist", pct: 50 },
    not({ kind: "ruling", ideology: "communist" }),
  ),
  then: [{ kind: "fire_event", id: "gen_government_shift" }],
};
const SHIFT_FAS: Effect = {
  kind: "if",
  cond: all(
    { kind: "pop_ge", ideology: "fascist", pct: 50 },
    not({ kind: "ruling", ideology: "fascist" }),
  ),
  then: [{ kind: "fire_event", id: "gen_government_shift" }],
};

/** CLAIMS (countries.ts, K6): each claimant's groups in table order; the first one it does not hold yet. */
const CLAIMANTS: Condition = any(
  { kind: "tag", tag: "HUN" },
  { kind: "tag", tag: "BGR" },
  { kind: "tag", tag: "POL" },
  { kind: "tag", tag: "TUR" },
  { kind: "tag", tag: "LTU" },
);
const CLAIM_HUN: Effect[] = [
  {
    kind: "if",
    cond: not({ kind: "owns_group", group: "south_slovakia" }),
    then: [
      {
        kind: "war_goal",
        on: { ownerOf: "south_slovakia" },
        type: "claim",
        group: "south_slovakia",
      },
    ],
    else: [
      {
        kind: "if",
        cond: not({ kind: "owns_group", group: "carpathian_ruthenia" }),
        then: [
          {
            kind: "war_goal",
            on: { ownerOf: "carpathian_ruthenia" },
            type: "claim",
            group: "carpathian_ruthenia",
          },
        ],
        else: [
          {
            kind: "if",
            cond: not({ kind: "owns_group", group: "north_transylvania" }),
            then: [
              {
                kind: "war_goal",
                on: { ownerOf: "north_transylvania" },
                type: "claim",
                group: "north_transylvania",
              },
            ],
          },
        ],
      },
    ],
  },
];
/** One claimant's single group, when someone else holds it. */
const CLAIM_BGR: Effect[] = [
  {
    kind: "if",
    cond: not({ kind: "owns_group", group: "south_dobruja" }),
    then: [
      {
        kind: "war_goal",
        on: { ownerOf: "south_dobruja" },
        type: "claim",
        group: "south_dobruja",
      },
    ],
  },
];
const CLAIM_POL: Effect[] = [
  {
    kind: "if",
    cond: not({ kind: "owns_group", group: "zaolzie" }),
    then: [
      {
        kind: "war_goal",
        on: { ownerOf: "zaolzie" },
        type: "claim",
        group: "zaolzie",
      },
    ],
  },
];
const CLAIM_TUR: Effect[] = [
  {
    kind: "if",
    cond: not({ kind: "owns_group", group: "hatay" }),
    then: [
      {
        kind: "war_goal",
        on: { ownerOf: "hatay" },
        type: "claim",
        group: "hatay",
      },
    ],
  },
];
const CLAIM_LTU: Effect[] = [
  {
    kind: "if",
    cond: not({ kind: "owns_group", group: "vilnius" }),
    then: [
      {
        kind: "war_goal",
        on: { ownerOf: "vilnius" },
        type: "claim",
        group: "vilnius",
      },
    ],
  },
];

export const GENERIC_FOCUSES: FocusDef[] = [
  // ---- industry ----
  {
    id: "gen_ind_survey",
    tree: "generic",
    x: 2,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "document",
    effects: [
      { kind: "research_bonus", branch: "industry", pct: 50, uses: 1 },
      { kind: "pp", amount: 25 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_ind_civ_1",
    tree: "generic",
    x: 4,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory",
    prereq: [["gen_ind_survey"]],
    effects: [{ kind: "build", where: { best: 2 }, building: "civ", count: 2 }],
    ai: { base: 10 },
  },
  {
    id: "gen_ind_infra",
    tree: "generic",
    x: 2,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "rail",
    prereq: [["gen_ind_survey"]],
    effects: [
      { kind: "infra", where: { best: 3 }, amount: 1 },
      { kind: "rail", where: "capital", amount: 1 },
      { kind: "rail", where: { best: 1 }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_ind_civ_2",
    tree: "generic",
    x: 4,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "industry",
    prereq: [["gen_ind_civ_1"]],
    effects: [
      { kind: "build", where: { best: 2 }, building: "civ", count: 2 },
      { kind: "add_spirit", id: "gen_industrial_zone" },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_ind_mil_1",
    tree: "generic",
    x: 0,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    prereq: [["gen_ind_survey"]],
    effects: [{ kind: "build", where: { best: 2 }, building: "mil", count: 2 }],
    ai: { base: 10 },
  },
  {
    id: "gen_ind_mil_2",
    tree: "generic",
    x: 0,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "steel",
    prereq: [["gen_ind_mil_1"]],
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      { kind: "add_spirit", id: "gen_skilled_workforce" },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_ind_resources",
    tree: "generic",
    x: 2,
    y: 2,
    days: 70,
    branch: "industry",
    icon: "mine",
    prereq: [["gen_ind_infra"]],
    effects: [
      { kind: "add_spirit", id: "gen_mining_drive" },
      // No RegionPick for "regions with resources": the best two regions stand in (report: DSL gap).
      { kind: "infra", where: { best: 2 }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  // ---- research ----
  {
    id: "gen_rs_1",
    tree: "generic",
    x: 6,
    y: 1,
    days: 70,
    branch: "research",
    icon: "research",
    prereq: [["gen_ind_survey"]],
    effects: [{ kind: "research_slot", amount: 1 }],
    ai: { base: 10 },
  },
  {
    id: "gen_rs_2",
    tree: "generic",
    x: 5,
    y: 3,
    days: 70,
    branch: "research",
    icon: "flask",
    prereq: [["gen_rs_1"], ["gen_ind_civ_2"]],
    effects: [
      { kind: "research_slot", amount: 1 },
      { kind: "add_spirit", id: "gen_research_institutes" },
    ],
    ai: { base: 10 },
  },
  // ---- army ----
  {
    id: "gen_army_reform",
    tree: "generic",
    x: 9,
    y: 0,
    days: 70,
    branch: "army",
    icon: "star_plain",
    effects: [{ kind: "army_xp", amount: 25 }, { kind: "add_general" }],
    ai: { base: 10 },
  },
  {
    id: "gen_army_infantry",
    tree: "generic",
    x: 8,
    y: 1,
    days: 70,
    branch: "army",
    icon: "infantry",
    prereq: [["gen_army_reform"]],
    effects: [
      { kind: "research_bonus", branch: "infantry", pct: 100, uses: 1 },
      // Support equipment: the next generation this country still lacks.
      {
        kind: "if",
        cond: not({ kind: "has_tech", tech: "support_eq_1" }),
        then: [
          { kind: "research_bonus", tech: "support_eq_1", pct: 50, uses: 1 },
        ],
        else: [
          { kind: "research_bonus", tech: "support_eq_2", pct: 50, uses: 1 },
        ],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_army_artillery",
    tree: "generic",
    x: 10,
    y: 1,
    days: 70,
    branch: "army",
    icon: "artillery",
    prereq: [["gen_army_reform"]],
    effects: [
      { kind: "research_bonus", branch: "artillery", pct: 100, uses: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_army_doctrine",
    tree: "generic",
    x: 9,
    y: 2,
    days: 70,
    branch: "army",
    icon: "sword",
    prereq: [["gen_army_infantry", "gen_army_artillery"]],
    effects: [{ kind: "doctrine_mastery", domain: "land", amount: 120 }],
    ai: { base: 10 },
  },
  {
    id: "gen_army_fort",
    tree: "generic",
    x: 11,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["gen_army_reform"]],
    effects: [
      { kind: "fort", where: { borderWith: "threat", n: 3 }, amount: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_army_staff",
    tree: "generic",
    x: 9,
    y: 3,
    days: 70,
    branch: "army",
    icon: "compass",
    prereq: [["gen_army_doctrine"]],
    effects: [{ kind: "add_spirit", id: "gen_staff_training" }],
    ai: { base: 10 },
  },
  // ---- air ----
  {
    id: "gen_air_force",
    tree: "generic",
    x: 12,
    y: 0,
    days: 70,
    branch: "air",
    icon: "plane",
    effects: [
      { kind: "research_bonus", branch: "air", pct: 100, uses: 1 },
      { kind: "equipment", type: "fighter", gen: 1, count: 50 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_air_bases",
    tree: "generic",
    x: 12,
    y: 1,
    days: 70,
    branch: "air",
    icon: "tower",
    prereq: [["gen_air_force"]],
    effects: [
      { kind: "research_bonus", branch: "air", pct: 50, uses: 2 },
      { kind: "build", where: { best: 2 }, building: "air_base", count: 1 },
    ],
    ai: { base: 10 },
  },
  // ---- navy ----
  {
    id: "gen_navy_yards",
    tree: "generic",
    x: 13,
    y: 0,
    days: 70,
    branch: "navy",
    icon: "ship",
    // Pre-flight R20: a landlocked country skips the navy branch.
    bypass: { kind: "landlocked" },
    effects: [
      {
        kind: "build",
        where: { coastal: true, n: 1 },
        building: "dock",
        count: 1,
      },
      { kind: "research_bonus", branch: "naval", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_navy_coast",
    tree: "generic",
    x: 13,
    y: 1,
    days: 70,
    branch: "navy",
    icon: "shield",
    prereq: [["gen_navy_yards"]],
    bypass: { kind: "landlocked" },
    effects: [
      {
        kind: "build",
        where: { coastal: true, n: 2 },
        building: "coastal_fort",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
  // ---- politics ----
  {
    id: "gen_pol_unity",
    tree: "generic",
    x: 16,
    y: 0,
    days: 70,
    branch: "politics",
    icon: "flag",
    effects: [
      { kind: "stability", pct: 5 },
      { kind: "pp", amount: 50 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_admin",
    tree: "generic",
    x: 14,
    y: 1,
    days: 35,
    branch: "politics",
    icon: "scales",
    prereq: [["gen_pol_unity"]],
    effects: [{ kind: "add_spirit", id: "gen_efficient_government" }],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_defence_spirit",
    tree: "generic",
    x: 15,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    prereq: [["gen_pol_unity"]],
    effects: [{ kind: "war_support", pct: 10 }],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_dem",
    tree: "generic",
    x: 16,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "ballot",
    prereq: [["gen_pol_unity"]],
    exclusive: ["gen_pol_com", "gen_pol_fas", "gen_pol_neu"],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: 10 },
      { kind: "add_spirit", id: "gen_democratic_movement" },
      SHIFT_DEM,
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "ruling", ideology: "democratic" }, factor: 400 }],
    },
  },
  {
    id: "gen_pol_com",
    tree: "generic",
    x: 17,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "fist",
    prereq: [["gen_pol_unity"]],
    exclusive: ["gen_pol_dem", "gen_pol_fas", "gen_pol_neu"],
    effects: [
      { kind: "popularity", ideology: "communist", pp: 10 },
      { kind: "add_spirit", id: "gen_labour_movement" },
      SHIFT_COM,
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "ruling", ideology: "communist" }, factor: 400 }],
    },
  },
  {
    id: "gen_pol_fas",
    tree: "generic",
    x: 18,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "eagle_plain",
    prereq: [["gen_pol_unity"]],
    exclusive: ["gen_pol_dem", "gen_pol_com", "gen_pol_neu"],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 10 },
      { kind: "add_spirit", id: "gen_renewal_movement" },
      SHIFT_FAS,
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "ruling", ideology: "fascist" }, factor: 400 }],
    },
  },
  {
    id: "gen_pol_neu",
    tree: "generic",
    x: 19,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "dove",
    prereq: [["gen_pol_unity"]],
    exclusive: ["gen_pol_dem", "gen_pol_com", "gen_pol_fas"],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: 10 },
      { kind: "stability", pct: 5 },
      { kind: "add_spirit", id: "gen_neutrality_declared" },
    ],
    ai: {
      base: 5,
      mods: [{ if: { kind: "ruling", ideology: "neutral" }, factor: 400 }],
    },
  },
  // ---- diplomacy (the ideology's alliance, claims) ----
  {
    id: "gen_pol_dem_ally",
    tree: "generic",
    x: 16,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    prereq: [["gen_pol_dem"]],
    effects: [
      { kind: "unlock_decision", id: "gen_join_allies" },
      { kind: "add_spirit", id: "gen_allied_course" },
      {
        kind: "opinion",
        of: { factionLeaderOf: { tag: "GBR" } },
        value: 30,
        days: 365,
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_com_ally",
    tree: "generic",
    x: 17,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "globe",
    prereq: [["gen_pol_com"]],
    effects: [
      { kind: "unlock_decision", id: "gen_join_comintern" },
      { kind: "opinion", of: { tag: "SUN" }, value: 30, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_fas_ally",
    tree: "generic",
    x: 18,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "medal",
    prereq: [["gen_pol_fas"]],
    effects: [
      { kind: "unlock_decision", id: "gen_join_axis" },
      { kind: "opinion", of: { tag: "DEU" }, value: 30, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_neu_league",
    tree: "generic",
    x: 19,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    prereq: [["gen_pol_neu"]],
    effects: [
      { kind: "set_flag", flag: "can_create_faction" },
      { kind: "create_faction" },
      { kind: "unlock_decision", id: "gen_invite_neighbours" },
    ],
    ai: { base: 10 },
  },
  {
    id: "gen_pol_claims",
    tree: "generic",
    x: 15,
    y: 2,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    prereq: [["gen_pol_fas", "gen_pol_com", "gen_pol_neu"]],
    bypass: not(CLAIMANTS),
    effects: [
      {
        kind: "if",
        cond: { kind: "tag", tag: "HUN" },
        then: CLAIM_HUN,
        else: [
          {
            kind: "if",
            cond: { kind: "tag", tag: "BGR" },
            then: CLAIM_BGR,
            else: [
              {
                kind: "if",
                cond: { kind: "tag", tag: "POL" },
                then: CLAIM_POL,
                else: [
                  {
                    kind: "if",
                    cond: { kind: "tag", tag: "TUR" },
                    then: CLAIM_TUR,
                    else: [
                      {
                        kind: "if",
                        cond: { kind: "tag", tag: "LTU" },
                        then: CLAIM_LTU,
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
    ai: { base: 10 },
  },
];

/**
 * The generic history path (spec §19.2). "@ideo" is the ruling ideology's
 * focus and "@ideo_ally" its alliance focus (Task 2 resolves both).
 */
export const GENERIC_PATH: FocusId[] = [
  "gen_ind_survey",
  "gen_ind_civ_1",
  "gen_ind_mil_1",
  "gen_ind_infra",
  "gen_pol_unity",
  "@ideo",
  "gen_rs_1",
  "gen_army_reform",
  "gen_ind_civ_2",
  "gen_ind_mil_2",
  "gen_army_infantry",
  "gen_army_artillery",
  "@ideo_ally",
  "gen_ind_resources",
  "gen_pol_admin",
  "gen_army_doctrine",
  "gen_army_fort",
  "gen_rs_2",
  "gen_pol_defence_spirit",
  "gen_army_staff",
  "gen_air_force",
  "gen_navy_yards",
  "gen_air_bases",
  "gen_navy_coast",
  "gen_pol_claims",
];

/** The political branch point: deviating takes the second most popular ideology (Task 2). */
export const GENERIC_BRANCHES: BranchPoint[] = [
  {
    id: "gen_politics",
    historical: "@ideo",
    alternatives: ["gen_pol_dem", "gen_pol_com", "gen_pol_fas", "gen_pol_neu"],
    political: true,
  },
];
