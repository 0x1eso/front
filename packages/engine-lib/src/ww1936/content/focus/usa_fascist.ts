// World War 1936: the United States' fascist path (an addition to the tree
// in usa.ts). A human road: Long's pledge, the strongmen, the seizure (legal
// or by coup, both dissolving Congress and splitting the country), the new
// order and its last fork. Data only (ContentPurity).
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, any, done, not } from "../helpers";

/** The seizure is done: either final focus has been taken. */
export const USA_FASCIST_RULE: Condition = any(
  done("usa_suspend_congress"),
  done("usa_seize_washington"),
);
/** The democratic politics of the tree close once it is. */
export const USA_OPEN_DEMOCRACY: Condition = not(USA_FASCIST_RULE);

/**
 * The seizure's effects, in this order. No civil war is started here: the
 * flag usa_regime_seized is what the uprising event keys on. The congress
 * flag hides the congress decisions while it is dissolved; the engine clears
 * both when the congress sits again.
 */
const SEIZURE: Effect[] = [
  { kind: "set_government", ideology: "fascist" },
  { kind: "congress_dissolve" },
  { kind: "set_flag", flag: "usa_congress_gone" },
  { kind: "set_flag", flag: "usa_regime_seized" },
];

/** The uprising: democratic popularity at or over this share (percent) ... */
export const USA_UPRISING_POP_PCT = 20;
/** ... mean days to the event once the trigger holds ... */
export const USA_UPRISING_MTTH_DAYS = 60;
/** ... at least this many days between two of them ... */
export const USA_UPRISING_COOLDOWN_DAYS = 90;
/** ... and at this stability or more the regime can suppress it; below, civil war. */
export const USA_UPRISING_STABILITY = 25;

/** No civil war against a breakaway state is running. */
export const NO_CIVIL_WAR: Condition = not(
  any(
    { kind: "at_war_with", of: T("CW1") },
    { kind: "at_war_with", of: T("CW2") },
    { kind: "at_war_with", of: T("CW3") },
    { kind: "at_war_with", of: T("CW4") },
    { kind: "at_war_with", of: T("CW5") },
    { kind: "at_war_with", of: T("CW6") },
  ),
);

const ANY_STRONGMAN = [
  [
    "usa_radio_priest",
    "usa_silver_shirts",
    "usa_veterans_league",
    "usa_business_backers",
  ],
] as const;
const EITHER_END = [["usa_suspend_congress", "usa_seize_washington"]] as const;

export const USA_FASCIST_FOCUSES: FocusDef[] = [
  // ---- usa_strongman: building strength (rows 13-14) ----
  {
    id: "usa_share_wealth",
    tree: "USA",
    x: 3,
    y: 13,
    days: 70,
    branch: "politics",
    icon: "megaphone",
    group: "usa_strongman",
    prereq: [["usa_long_populism"]],
    // Taking preparedness first closes this door; after it, the war branches
    // behind preparedness stay reachable, so no exclusive.
    available: not(done("usa_preparedness")),
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -2 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 1 },
  },
  {
    id: "usa_radio_priest",
    tree: "USA",
    x: 1,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "radio",
    group: "usa_strongman",
    prereq: [["usa_share_wealth"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_silver_shirts",
    tree: "USA",
    x: 3,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "usa_strongman",
    prereq: [["usa_share_wealth"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_veterans_league",
    tree: "USA",
    x: 5,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "medal",
    group: "usa_strongman",
    prereq: [["usa_share_wealth"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_business_backers",
    tree: "USA",
    x: 7,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "factory",
    group: "usa_strongman",
    prereq: [["usa_share_wealth"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
      { kind: "pp", amount: 15 },
    ],
    ai: { base: 10 },
  },

  // ---- usa_seizure: the first fork, then the two routes (rows 16-19) ----
  {
    id: "usa_legal_path",
    tree: "USA",
    x: 2,
    y: 16,
    days: 35,
    branch: "politics",
    icon: "scales",
    group: "usa_seizure",
    prereq: ANY_STRONGMAN,
    exclusive: ["usa_coup_path"],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "popularity", ideology: "democratic", pp: -3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_coup_path",
    tree: "USA",
    x: 6,
    y: 16,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "usa_seizure",
    prereq: ANY_STRONGMAN,
    exclusive: ["usa_legal_path"],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "usa_emergency_powers",
    tree: "USA",
    x: 2,
    y: 17,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "usa_seizure",
    prereq: [["usa_legal_path"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: -4 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_court_neutered",
    tree: "USA",
    x: 2,
    y: 18,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "usa_seizure",
    prereq: [["usa_emergency_powers"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: -4 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    // The last step of the legal road: it needs a real following first.
    id: "usa_suspend_congress",
    tree: "USA",
    x: 2,
    y: 19,
    days: 70,
    branch: "politics",
    icon: "chain_broken",
    group: "usa_seizure",
    prereq: [["usa_court_neutered"]],
    available: { kind: "pop_ge", ideology: "fascist", pct: 35 },
    effects: [...SEIZURE, { kind: "stability", pct: -2 }],
    ai: { base: 10 },
  },
  {
    // The coup: no following needed.
    id: "usa_seize_washington",
    tree: "USA",
    x: 6,
    y: 17,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "usa_seizure",
    prereq: [["usa_coup_path"]],
    effects: [...SEIZURE, { kind: "stability", pct: -5 }],
    ai: { base: 10 },
  },

  // ---- usa_new_order: the regime (rows 21-22) ----
  {
    id: "usa_federal_guard",
    tree: "USA",
    x: 1,
    y: 21,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "usa_new_order",
    prereq: EITHER_END,
    effects: [
      { kind: "manpower", recruitablePct: 4 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_press_control",
    tree: "USA",
    x: 4,
    y: 21,
    days: 70,
    branch: "politics",
    icon: "radio",
    group: "usa_new_order",
    prereq: EITHER_END,
    effects: [
      { kind: "war_support", pct: 5 },
      { kind: "stability", pct: 3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_industrial_control",
    tree: "USA",
    x: 7,
    y: 21,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "usa_new_order",
    prereq: EITHER_END,
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      { kind: "pp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_total_conscription",
    tree: "USA",
    x: 0,
    y: 22,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "usa_new_order",
    prereq: [["usa_federal_guard"]],
    effects: [
      // A free step ignores the tension gate.
      {
        kind: "set_law",
        law: "conscription",
        value: "service",
        free: true,
      },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_new_officer_corps",
    tree: "USA",
    x: 2,
    y: 22,
    days: 70,
    branch: "army",
    icon: "star_plain",
    group: "usa_new_order",
    prereq: [["usa_federal_guard"]],
    effects: [
      { kind: "army_xp", amount: 15 },
      { kind: "add_general" },
      { kind: "research_bonus", branch: "doctrine", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },
  {
    // Only once the country is whole again: no breakaway war is running.
    id: "usa_national_reunification",
    tree: "USA",
    x: 4,
    y: 22,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "usa_new_order",
    prereq: [["usa_press_control"]],
    available: NO_CIVIL_WAR,
    effects: [
      { kind: "remove_spirit", id: "gen_civil_strife" },
      { kind: "stability", pct: 8 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_war_economy_order",
    tree: "USA",
    x: 7,
    y: 22,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "usa_new_order",
    prereq: [["usa_industrial_control"]],
    effects: [
      { kind: "set_law", law: "economy", value: "war_economy", free: true },
      { kind: "pp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_fleet_programme",
    tree: "USA",
    x: 9,
    y: 22,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "usa_new_order",
    prereq: [["usa_industrial_control"]],
    effects: [
      {
        kind: "build",
        where: { coastal: true, n: 2 },
        building: "dock",
        count: 2,
      },
      { kind: "navy_xp", amount: 10 },
      { kind: "research_bonus", branch: "naval", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },

  // ---- usa_new_order_fate: the last fork (rows 25-27) ----
  {
    id: "usa_axis_pact",
    tree: "USA",
    x: 2,
    y: 25,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "usa_new_order_fate",
    prereq: [["usa_press_control"], ["usa_industrial_control"]],
    exclusive: ["usa_hemisphere_fortress"],
    effects: [
      { kind: "opinion", of: T("DEU"), value: 25, days: 365 },
      { kind: "opinion", of: T("JPN"), value: 25, days: 365 },
      // Their camp, whichever one stands.
      {
        kind: "if",
        cond: { kind: "in_faction", who: T("DEU") },
        then: [{ kind: "join_faction", of: T("DEU") }],
        else: [
          {
            kind: "if",
            cond: { kind: "in_faction", who: T("JPN") },
            then: [{ kind: "join_faction", of: T("JPN") }],
          },
        ],
      },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_pacific_division",
    tree: "USA",
    x: 0,
    y: 26,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "usa_new_order_fate",
    prereq: [["usa_axis_pact"]],
    effects: [
      { kind: "nap", of: T("JPN") },
      { kind: "opinion", of: T("JPN"), value: 25, days: 365 },
      { kind: "pp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_atlantic_exchange",
    tree: "USA",
    x: 2,
    y: 26,
    days: 70,
    branch: "research",
    icon: "flask",
    group: "usa_new_order_fate",
    prereq: [["usa_axis_pact"]],
    effects: [
      { kind: "research_bonus", branch: "armour", pct: 100, uses: 1 },
      { kind: "research_bonus", branch: "air", pct: 100, uses: 1 },
      { kind: "opinion", of: T("DEU"), value: 25, days: 365 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_hemisphere_fortress",
    tree: "USA",
    x: 7,
    y: 25,
    days: 70,
    branch: "diplomacy",
    icon: "shield",
    group: "usa_new_order_fate",
    prereq: [["usa_press_control"], ["usa_industrial_control"]],
    exclusive: ["usa_axis_pact"],
    effects: [
      {
        kind: "if",
        cond: not({ kind: "in_faction" }),
        then: [{ kind: "create_faction", name: "pan_american" }],
      },
      { kind: "opinion", of: T("GBR"), value: -20, days: 365 },
      { kind: "opinion", of: T("CAN"), value: -20, days: 365 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_monroe_reborn",
    tree: "USA",
    x: 7,
    y: 26,
    days: 70,
    branch: "diplomacy",
    icon: "eagle_plain",
    group: "usa_new_order_fate",
    prereq: [["usa_hemisphere_fortress"]],
    effects: [
      { kind: "invite", of: T("MEX") },
      { kind: "invite", of: T("BRA") },
      { kind: "invite", of: T("ARG") },
      { kind: "manpower", recruitablePct: 2 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_northern_claim",
    tree: "USA",
    x: 5,
    y: 27,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "usa_new_order_fate",
    prereq: [["usa_monroe_reborn"]],
    effects: [
      { kind: "war_goal", on: T("CAN"), type: "conquer" },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_southern_claim",
    tree: "USA",
    x: 7,
    y: 27,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "usa_new_order_fate",
    prereq: [["usa_monroe_reborn"]],
    effects: [
      { kind: "war_goal", on: T("MEX"), type: "conquer" },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "usa_caribbean_sea",
    tree: "USA",
    x: 9,
    y: 27,
    days: 70,
    branch: "navy",
    icon: "compass",
    group: "usa_new_order_fate",
    prereq: [["usa_monroe_reborn"]],
    effects: [
      { kind: "war_goal", on: T("CUB"), type: "conquer" },
      { kind: "navy_xp", amount: 10 },
      {
        kind: "build",
        where: { coastal: true, n: 1 },
        building: "dock",
        count: 1,
      },
    ],
    ai: { base: 10 },
  },
];
