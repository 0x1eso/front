// World War 1936 P6 — the new-state pack `new` (spec §11.12): 8 focuses
// beside the generic tree for the dormant slots P5 wakes (Slovakia, Croatia,
// Vichy, the Social Republic, Nanjing, Mengjiang, Burma, the Philippines and
// the civil-war slots). Every text is the same neutral wording for all of
// them and names no one (spec §24-7): heads of state are shown by title in
// the country data, never here. Data only (ContentPurity).
import type {
  BranchPoint,
  FocusDef,
  FocusId,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

export const NEW_FOCUSES: FocusDef[] = [
  {
    id: "new_administration",
    tree: "new",
    x: 21,
    y: 0,
    days: 35,
    branch: "politics",
    icon: "document",
    effects: [
      { kind: "stability", pct: 10 },
      { kind: "pp", amount: 25 },
    ],
    ai: { base: 10 },
  },
  {
    // "Basic template": the generic minor division, nine infantry battalions.
    id: "new_army",
    tree: "new",
    x: 24,
    y: 0,
    days: 35,
    branch: "army",
    icon: "infantry",
    effects: [
      { kind: "unlock_template", template: "new_infantry_division" },
      {
        kind: "divisions",
        template: "new_infantry_division",
        count: 2,
        where: "capital",
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "new_industry",
    tree: "new",
    x: 27,
    y: 0,
    days: 70,
    branch: "industry",
    icon: "factory",
    effects: [
      { kind: "build", where: { best: 1 }, building: "civ", count: 1 },
      { kind: "build", where: { best: 1 }, building: "mil", count: 1 },
    ],
    ai: { base: 10 },
  },
  {
    // "Every country at peace": opinion `all` (P3 decision 21; report: approximation).
    id: "new_recognition",
    tree: "new",
    x: 20,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    prereq: [["new_administration"]],
    effects: [{ kind: "opinion", of: "all", value: 20, days: 365 }],
    ai: { base: 10 },
  },
  {
    // The overlord's opinion is half of its lend-lease answer score (P5).
    id: "new_alignment",
    tree: "new",
    x: 21,
    y: 1,
    days: 70,
    branch: "diplomacy",
    icon: "flag",
    prereq: [["new_administration"]],
    exclusive: ["new_autonomy"],
    effects: [
      {
        kind: "if",
        cond: { kind: "is_subject" },
        then: [
          {
            kind: "opinion",
            who: { overlordOf: "self" },
            of: "self",
            value: 30,
            days: 365,
          },
          { kind: "autonomy", pct: -10 },
        ],
        else: [{ kind: "stability", pct: 5 }],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "new_autonomy",
    tree: "new",
    x: 22,
    y: 1,
    days: 70,
    branch: "politics",
    icon: "compass",
    prereq: [["new_administration"]],
    exclusive: ["new_alignment"],
    effects: [
      {
        kind: "if",
        cond: { kind: "is_subject" },
        then: [{ kind: "autonomy", pct: 15 }],
        else: [{ kind: "stability", pct: 5 }],
      },
    ],
    ai: { base: 5 },
  },
  {
    id: "new_defense",
    tree: "new",
    x: 24,
    y: 1,
    days: 70,
    branch: "army",
    icon: "fort",
    prereq: [["new_army"]],
    effects: [{ kind: "fort", where: "capital", amount: 1 }],
    ai: { base: 10 },
  },
  {
    id: "new_economy",
    tree: "new",
    x: 27,
    y: 1,
    days: 70,
    branch: "industry",
    icon: "globe",
    prereq: [["new_industry"]],
    effects: [
      { kind: "resource", where: { best: 1 }, res: "steel", amount: 1 },
      { kind: "add_spirit", id: "new_trade_terms" },
    ],
    ai: { base: 10 },
  },
];

/** The pack's history path, generic focuses included (P3 historyPath resolves "@ideo"). */
export const NEW_PATH: FocusId[] = [
  "new_administration",
  "new_army",
  "new_alignment",
  "new_industry",
  "gen_ind_survey",
  "new_defense",
  "new_recognition",
  "new_economy",
  "gen_ind_civ_1",
  "gen_ind_mil_1",
  "gen_pol_unity",
  "@ideo",
  "gen_ind_infra",
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

export const NEW_BRANCHES: BranchPoint[] = [
  // The generic political branch point, kept for the pack tree.
  {
    id: "new_politics",
    historical: "@ideo",
    alternatives: ["gen_pol_dem", "gen_pol_com", "gen_pol_fas", "gen_pol_neu"],
    political: true,
  },
  {
    id: "new_course",
    historical: "new_alignment",
    alternatives: ["new_autonomy"],
    political: true,
  },
];
