// World War 1936: Britain's royalist path (an addition to the tree in gbr.ts).
// The door is the refused abdication (gbr_abdication, option b; flag
// kings_party). The King's friends build strength, the Crown seizes power
// (Parliament is prorogued, no civil war is fired from a focus), and then the
// Dominions are forced into the Crown one by one, in a fixed order, each
// costlier than the last: a stronger governor, the dominion parliament
// suspended, annexation. A dominion played by a human is never forced: those
// steps are closed for it and the UK has to take it by war. Data only
// (ContentPurity).
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, any, done, flag, not } from "../helpers";
import type { RegionGroupDef } from "../types";

/** The seizure is done: either final focus has been taken. */
const EITHER_END = [["gbr_prorogue_parliament", "gbr_palace_dismissal"]];
const ANY_FRIENDS = [
  ["gbr_union_rallies", "gbr_press_barons", "gbr_county_lords"],
];

/** The home uprising: democratic popularity at or over this share (percent) ... */
export const GBR_UPRISING_POP_PCT = 20;
/** ... mean days to the event once the trigger holds ... */
export const GBR_UPRISING_MTTH_DAYS = 60;
/** ... at least this many days between two of them ... */
export const GBR_UPRISING_COOLDOWN_DAYS = 90;
/** ... and at this stability or more the regime can suppress it; below, civil war. */
export const GBR_UPRISING_STABILITY = 25;

/**
 * Effects of the seizure, in this order. No civil war is started here: the
 * flag gbr_regime_seized is what the uprising event keys on, and what stops
 * the generic regime crisis (Ideology.dailyIdeology).
 */
const SEIZURE: Effect[] = [
  { kind: "set_government", ideology: "fascist" },
  { kind: "elections", suspend: true },
  { kind: "set_flag", flag: "elections_suspended" },
  { kind: "set_flag", flag: "gbr_regime_seized" },
];

export type DominionTag = "NZL" | "AUS" | "ZAF" | "CAN" | "RAJ";

interface DominionRow {
  tag: DominionTag;
  /** Lower-case id part and the tree column. */
  key: string;
  x: number;
  /** Autonomy points taken by the governor and by the suspension. */
  governor: number;
  suspend: number;
  /** Home stability (raw focus points, x3 in play) for the three steps. */
  stab: [number, number, number];
  days: [35 | 70 | 105, 35 | 70 | 105, 35 | 70 | 105];
  /** Resistance (percent) the annexed land starts with. */
  res: number;
  /** The crown-rule spirit's stats, raw (a focus spirit is x3 in play). */
  spirit: string;
  /** Unrest events: mean days, cooldown, how long (days since the annexation) they last. */
  unrestMtth: number;
  unrestCooldown: number;
  unrestWindow: number;
  /** The units on annexation. */
  units: "transfer" | "disband";
}

/** The forced order: easiest first; RAJ last and costliest. */
export const DOMINIONS: readonly DominionRow[] = [
  {
    tag: "NZL",
    key: "nzl",
    x: 0,
    governor: 15,
    suspend: 25,
    stab: [0, 0, -1],
    days: [35, 35, 70],
    res: 5,
    spirit: "gbr_nzl_crown_rule",
    unrestMtth: 120,
    unrestCooldown: 90,
    unrestWindow: 300,
    units: "transfer",
  },
  {
    tag: "AUS",
    key: "aus",
    x: 2,
    governor: 15,
    suspend: 25,
    stab: [0, 0, -1],
    days: [35, 35, 70],
    res: 10,
    spirit: "gbr_aus_crown_rule",
    unrestMtth: 100,
    unrestCooldown: 90,
    unrestWindow: 400,
    units: "transfer",
  },
  {
    tag: "ZAF",
    key: "zaf",
    x: 4,
    governor: 20,
    suspend: 30,
    stab: [0, -1, -1],
    days: [35, 70, 70],
    res: 15,
    spirit: "gbr_zaf_crown_rule",
    unrestMtth: 90,
    unrestCooldown: 90,
    unrestWindow: 500,
    units: "transfer",
  },
  {
    tag: "CAN",
    key: "can",
    x: 6,
    governor: 20,
    suspend: 30,
    stab: [0, -1, -1],
    days: [70, 70, 70],
    res: 20,
    spirit: "gbr_can_crown_rule",
    unrestMtth: 80,
    unrestCooldown: 90,
    unrestWindow: 600,
    units: "transfer",
  },
  {
    tag: "RAJ",
    key: "raj",
    x: 8,
    governor: 25,
    suspend: 35,
    stab: [-1, -1, -2],
    days: [70, 105, 105],
    res: 35,
    spirit: "gbr_raj_crown_rule",
    unrestMtth: 45,
    unrestCooldown: 60,
    unrestWindow: 1000,
    // The Indian army is disbanded, not taken over: its men are not trusted.
    units: "disband",
  },
];

/** The region groups the annexed land's uprisings and resistance act on (VP and factory regions). */
export const REGION_GROUPS_GBR: RegionGroupDef[] = [
  // regions: Auckland, Wellington
  { id: "gbr_nzl_heart", regions: [1306, 1317], owner1936: "NZL" },
  // regions: New South Wales, Victoria, Western Australia (W)
  { id: "gbr_aus_heart", regions: [1283, 1305, 1238], owner1936: "AUS" },
  // regions: Gauteng, Western Cape, KwaZulu-Natal
  { id: "gbr_zaf_heart", regions: [1264, 1291, 1275], owner1936: "ZAF" },
  // regions: British Columbia (S), Alberta (SE), Québec (S), Ontario (SE)
  { id: "gbr_can_heart", regions: [196, 211, 290, 345], owner1936: "CAN" },
  // regions: Punjab, Delhi, Uttar Pradesh, Rajasthan, Sind, Bihar, West Bengal, Dhaka,
  // Gujarat, Chittagong, Maharashtra, Telangana, Karnataka, Tamil Nadu
  {
    id: "gbr_raj_heart",
    regions: [
      799, 839, 840, 844, 863, 877, 894, 898, 905, 910, 934, 957, 974, 1026,
    ],
    owner1936: "RAJ",
  },
];

/** The dominion's own politics cannot undo the governor: the dominion tree reads this flag. */
export const CROWN_CONTROL_FLAG = "gbr_crown_control";

const annexedFlag = (d: DominionRow) => `gbr_${d.key}_annexed`;
const human = (d: DominionRow): Condition => ({
  kind: "is_human",
  who: T(d.tag),
});
const atWar = (d: DominionRow): Condition => ({
  kind: "at_war",
  who: T(d.tag),
});
const subject = (d: DominionRow): Condition => ({
  kind: "subject_of",
  who: T(d.tag),
  of: "self",
});
/** The dominion is dealt with: annexed, or not ours to force (a human plays it, or it is no longer our subject). */
const settled = (d: DominionRow): Condition =>
  any(done(`gbr_${d.key}_annex`), human(d), not(subject(d)));
/** A dominion's steps are closed while a human plays it. */
const FORCEABLE = (d: DominionRow): Condition => not(human(d));

/** The three steps of one dominion. Steps 1 and 2 are columns of the same x. */
function dominionSteps(d: DominionRow, i: number): FocusDef[] {
  const prev = i === 0 ? undefined : DOMINIONS[i - 1];
  const k = d.key;
  const first: Condition =
    prev === undefined ? FORCEABLE(d) : { all: [FORCEABLE(d), settled(prev)] };
  return [
    {
      id: `gbr_${k}_governor`,
      tree: "GBR",
      x: d.x,
      y: 23,
      days: d.days[0],
      branch: "politics",
      icon: "flag",
      group: "gbr_integration",
      prereq: [["gbr_imperial_unity"]],
      available: first,
      effects: [
        { kind: "autonomy", who: T(d.tag), pct: -d.governor },
        { kind: "set_flag", who: T(d.tag), flag: CROWN_CONTROL_FLAG },
        { kind: "opinion", who: T(d.tag), of: "self", value: -5, days: 365 },
        { kind: "stability", pct: d.stab[0] },
      ],
      ai: { base: 2 },
    },
    {
      id: `gbr_${k}_parliament`,
      tree: "GBR",
      x: d.x,
      y: 24,
      days: d.days[1],
      branch: "politics",
      icon: "ballot",
      group: "gbr_integration",
      prereq: [[`gbr_${k}_governor`]],
      available: FORCEABLE(d),
      effects: [
        { kind: "autonomy", who: T(d.tag), pct: -d.suspend },
        { kind: "set_flag", who: T(d.tag), flag: `gbr_${k}_suspended` },
        { kind: "war_support", who: T(d.tag), pct: -3 },
        { kind: "stability", pct: d.stab[1] },
      ],
      ai: { base: 2 },
    },
    {
      id: `gbr_${k}_annex`,
      tree: "GBR",
      x: d.x,
      y: 25,
      days: d.days[2],
      branch: "politics",
      icon: "crown",
      group: "gbr_integration",
      prereq: [[`gbr_${k}_parliament`]],
      available: { all: [FORCEABLE(d), subject(d), not(atWar(d))] },
      // The annexation needs a dominion at peace and nobody's player.
      cancelIf: any(human(d), atWar(d)),
      effects: [
        {
          kind: "if",
          cond: { all: [FORCEABLE(d), subject(d), not(atWar(d))] },
          then: [
            { kind: "annex", target: T(d.tag), units: d.units },
            { kind: "set_flag", flag: annexedFlag(d) },
            { kind: "resistance", group: `gbr_${k}_heart`, pct: d.res },
            { kind: "add_spirit", id: d.spirit },
          ],
        },
        { kind: "stability", pct: d.stab[2] },
      ],
      ai: { base: 2 },
    },
  ];
}

export const GBR_ROYALIST_FOCUSES: FocusDef[] = [
  // ---- gbr_royalist: the King's friends (rows 12-13) ----
  {
    id: "gbr_kings_friends",
    tree: "GBR",
    x: 4,
    y: 12,
    days: 35,
    branch: "politics",
    icon: "crown",
    group: "gbr_royalist",
    available: flag("kings_party"),
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 1 },
  },
  {
    id: "gbr_union_rallies",
    tree: "GBR",
    x: 2,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    group: "gbr_royalist",
    prereq: [["gbr_kings_friends"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_press_barons",
    tree: "GBR",
    x: 4,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "radio",
    group: "gbr_royalist",
    prereq: [["gbr_kings_friends"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "pp", amount: 15 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_county_lords",
    tree: "GBR",
    x: 6,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "tower",
    group: "gbr_royalist",
    prereq: [["gbr_kings_friends"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_old_soldiers",
    tree: "GBR",
    x: 7,
    y: 14,
    days: 35,
    branch: "army",
    icon: "medal",
    group: "gbr_royalist",
    prereq: [["gbr_county_lords"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "popularity", ideology: "democratic", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 5 },
  },

  // ---- gbr_prerogative: cabinet and prorogation (rows 14-17) ----
  {
    id: "gbr_royal_cabinet",
    tree: "GBR",
    x: 3,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "gbr_prerogative",
    prereq: ANY_FRIENDS,
    effects: [
      { kind: "set_leader", person: "gbr_mosley" },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "popularity", ideology: "democratic", pp: -3 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_emergency_decree",
    tree: "GBR",
    x: 3,
    y: 15,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "gbr_prerogative",
    prereq: [["gbr_royal_cabinet"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: -4 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_loyalty_oath",
    tree: "GBR",
    x: 3,
    y: 16,
    days: 70,
    branch: "politics",
    icon: "scales",
    group: "gbr_prerogative",
    prereq: [["gbr_emergency_decree"]],
    effects: [
      { kind: "popularity", ideology: "democratic", pp: -4 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 5 },
  },
  {
    // The legal-looking road: the Crown prorogues Parliament under emergency powers.
    id: "gbr_prorogue_parliament",
    tree: "GBR",
    x: 2,
    y: 17,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "gbr_prerogative",
    prereq: [["gbr_loyalty_oath"]],
    available: { kind: "pop_ge", ideology: "fascist", pct: 35 },
    effects: [...SEIZURE, { kind: "stability", pct: -2 }],
    ai: { base: 3 },
  },
  {
    // The short road: ministers are dismissed at once; no following is needed.
    id: "gbr_palace_dismissal",
    tree: "GBR",
    x: 5,
    y: 17,
    days: 35,
    branch: "politics",
    icon: "fist",
    group: "gbr_prerogative",
    prereq: [["gbr_royal_cabinet"]],
    effects: [...SEIZURE, { kind: "stability", pct: -5 }],
    ai: { base: 1 },
  },

  // ---- gbr_crown_order: the order after the seizure (rows 18-21) ----
  {
    id: "gbr_crown_order",
    tree: "GBR",
    x: 3,
    y: 18,
    days: 35,
    branch: "politics",
    icon: "tower",
    group: "gbr_crown_order",
    prereq: EITHER_END,
    effects: [{ kind: "stability", pct: 2 }],
    ai: { base: 10 },
  },
  {
    id: "gbr_security_service",
    tree: "GBR",
    x: 1,
    y: 19,
    days: 35,
    branch: "politics",
    icon: "shield",
    group: "gbr_crown_order",
    prereq: [["gbr_crown_order"]],
    effects: [{ kind: "stability", pct: 3 }],
    ai: { base: 10 },
  },
  {
    id: "gbr_state_industry",
    tree: "GBR",
    x: 3,
    y: 19,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "gbr_crown_order",
    prereq: [["gbr_crown_order"]],
    effects: [
      { kind: "set_law", law: "economy", value: "war_economy", free: true },
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gbr_national_service",
    tree: "GBR",
    x: 5,
    y: 19,
    days: 35,
    branch: "army",
    icon: "infantry",
    group: "gbr_crown_order",
    prereq: [["gbr_crown_order"]],
    effects: [
      { kind: "set_law", law: "conscription", value: "service", free: true },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gbr_royal_staff",
    tree: "GBR",
    x: 1,
    y: 20,
    days: 35,
    branch: "army",
    icon: "star_plain",
    group: "gbr_crown_order",
    prereq: [["gbr_security_service"]],
    effects: [{ kind: "army_xp", amount: 20 }],
    ai: { base: 10 },
  },
  {
    id: "gbr_realm_reconciliation",
    tree: "GBR",
    x: 3,
    y: 20,
    days: 70,
    branch: "politics",
    icon: "dove",
    group: "gbr_crown_order",
    prereq: [["gbr_state_industry"]],
    available: {
      not: {
        any: [
          { kind: "at_war_with", of: T("CW1") },
          { kind: "at_war_with", of: T("CW2") },
          { kind: "at_war_with", of: T("CW3") },
          { kind: "at_war_with", of: T("CW4") },
          { kind: "at_war_with", of: T("CW5") },
          { kind: "at_war_with", of: T("CW6") },
        ],
      },
    },
    effects: [
      { kind: "remove_spirit", id: "gen_civil_strife" },
      { kind: "stability", pct: 6 },
    ],
    ai: { base: 10 },
  },
  {
    id: "gbr_royal_dockyards",
    tree: "GBR",
    x: 5,
    y: 20,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "gbr_crown_order",
    prereq: [["gbr_national_service"]],
    effects: [
      {
        kind: "build",
        where: { coastal: true, n: 2 },
        building: "dock",
        count: 2,
      },
      { kind: "navy_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    // The hub of forced integration. It closes the liberal federation road.
    id: "gbr_imperial_unity",
    tree: "GBR",
    x: 4,
    y: 22,
    days: 35,
    branch: "diplomacy",
    icon: "globe",
    group: "gbr_integration",
    prereq: [["gbr_realm_reconciliation", "gbr_royal_staff"]],
    effects: [
      { kind: "set_flag", flag: "gbr_forced_integration" },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 3 },
  },
  // ---- gbr_integration: the five dominions, three steps each (rows 23-25) ----
  ...DOMINIONS.flatMap((d, i) => dominionSteps(d, i)),

  // ---- gbr_empire_fate: the last fork (rows 27-29) ----
  {
    id: "gbr_berlin_accord",
    tree: "GBR",
    x: 2,
    y: 27,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "gbr_empire_fate",
    prereq: [["gbr_raj_annex", "gbr_imperial_unity"]],
    available: DOMINIONS.map(settled).reduce<Condition>(
      (a, c) => ({ all: [a, c] }),
      { kind: "always", value: true },
    ),
    exclusive: ["gbr_empire_stand"],
    effects: [
      { kind: "nap", of: T("DEU") },
      { kind: "opinion", of: T("DEU"), value: 25, days: 365 },
      { kind: "stability", pct: 2 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_world_partition",
    tree: "GBR",
    x: 1,
    y: 28,
    days: 70,
    branch: "diplomacy",
    icon: "map",
    group: "gbr_empire_fate",
    prereq: [["gbr_berlin_accord"]],
    effects: [
      { kind: "nap", of: T("ITA") },
      { kind: "nap", of: T("JPN") },
      { kind: "opinion", of: T("JPN"), value: 25, days: 365 },
      { kind: "pp", amount: 10 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_reich_exchange",
    tree: "GBR",
    x: 3,
    y: 28,
    days: 70,
    branch: "research",
    icon: "flask",
    group: "gbr_empire_fate",
    prereq: [["gbr_berlin_accord"]],
    effects: [
      { kind: "research_bonus", branch: "armour", pct: 100, uses: 1 },
      { kind: "research_bonus", branch: "air", pct: 100, uses: 1 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_empire_stand",
    tree: "GBR",
    x: 6,
    y: 27,
    days: 70,
    branch: "army",
    icon: "shield",
    group: "gbr_empire_fate",
    prereq: [["gbr_raj_annex", "gbr_imperial_unity"]],
    available: DOMINIONS.map(settled).reduce<Condition>(
      (a, c) => ({ all: [a, c] }),
      { kind: "always", value: true },
    ),
    exclusive: ["gbr_berlin_accord"],
    effects: [
      { kind: "war_support", pct: 8 },
      { kind: "war_goal", on: T("DEU"), type: "conquer" },
      { kind: "army_xp", amount: 20 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_empire_arsenal",
    tree: "GBR",
    x: 5,
    y: 28,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "gbr_empire_fate",
    prereq: [["gbr_empire_stand"]],
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      { kind: "build", where: { best: 2 }, building: "civ", count: 2 },
    ],
    ai: { base: 5 },
  },
  {
    id: "gbr_imperial_levy",
    tree: "GBR",
    x: 7,
    y: 28,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "gbr_empire_fate",
    prereq: [["gbr_empire_stand"]],
    effects: [
      { kind: "manpower", recruitablePct: 3 },
      { kind: "war_support", pct: 3 },
    ],
    ai: { base: 5 },
  },
];
