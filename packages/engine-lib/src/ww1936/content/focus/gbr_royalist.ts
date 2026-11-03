// World War 1936: Britain's royalist path (an addition to the tree in gbr.ts).
// The door is the refused abdication (gbr_abdication, option b; flag
// kings_party). The King's friends build strength, the Crown seizes power
// (Parliament is prorogued, no civil war is fired from a focus), and then the
// Dominions are forced into the Crown one by one, in a fixed order, each
// costlier than the last: a stronger governor, the dominion parliament
// suspended, annexation. A dominion played by a human is never forced: those
// steps are closed for it and the UK has to take it by war. Data only
// (ContentPurity).
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, flag } from "../helpers";
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
  {
    id: "gbr_nzl_governor",
    tree: "GBR",
    x: 0,
    y: 23,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "gbr_integration",
    prereq: [["gbr_imperial_unity"]],
    available: { not: { kind: "is_human", who: { tag: "NZL" } } },
    effects: [
      { kind: "autonomy", who: { tag: "NZL" }, pct: -15 },
      { kind: "set_flag", who: { tag: "NZL" }, flag: "gbr_crown_control" },
      {
        kind: "opinion",
        who: { tag: "NZL" },
        of: "self",
        value: -5,
        days: 365,
      },
      { kind: "stability", pct: 0 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_nzl_parliament",
    tree: "GBR",
    x: 0,
    y: 24,
    days: 35,
    branch: "politics",
    icon: "ballot",
    group: "gbr_integration",
    prereq: [["gbr_nzl_governor"]],
    available: { not: { kind: "is_human", who: { tag: "NZL" } } },
    effects: [
      { kind: "autonomy", who: { tag: "NZL" }, pct: -25 },
      { kind: "set_flag", who: { tag: "NZL" }, flag: "gbr_nzl_suspended" },
      { kind: "war_support", who: { tag: "NZL" }, pct: -3 },
      { kind: "stability", pct: 0 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_nzl_annex",
    tree: "GBR",
    x: 0,
    y: 25,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "gbr_integration",
    prereq: [["gbr_nzl_parliament"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "NZL" } } },
        { kind: "subject_of", who: { tag: "NZL" }, of: "self" },
        { not: { kind: "at_war", who: { tag: "NZL" } } },
      ],
    },
    cancelIf: {
      any: [
        { kind: "is_human", who: { tag: "NZL" } },
        { kind: "at_war", who: { tag: "NZL" } },
      ],
    },
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            { not: { kind: "is_human", who: { tag: "NZL" } } },
            { kind: "subject_of", who: { tag: "NZL" }, of: "self" },
            { not: { kind: "at_war", who: { tag: "NZL" } } },
          ],
        },
        then: [
          { kind: "annex", target: { tag: "NZL" }, units: "transfer" },
          { kind: "set_flag", flag: "gbr_nzl_annexed" },
          { kind: "resistance", group: "gbr_nzl_heart", pct: 5 },
          { kind: "add_spirit", id: "gbr_nzl_crown_rule" },
        ],
      },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_aus_governor",
    tree: "GBR",
    x: 2,
    y: 23,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "gbr_integration",
    prereq: [["gbr_imperial_unity"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "AUS" } } },
        {
          any: [
            { kind: "focus_done", id: "gbr_nzl_annex" },
            { kind: "is_human", who: { tag: "NZL" } },
            { not: { kind: "subject_of", who: { tag: "NZL" }, of: "self" } },
          ],
        },
      ],
    },
    effects: [
      { kind: "autonomy", who: { tag: "AUS" }, pct: -15 },
      { kind: "set_flag", who: { tag: "AUS" }, flag: "gbr_crown_control" },
      {
        kind: "opinion",
        who: { tag: "AUS" },
        of: "self",
        value: -5,
        days: 365,
      },
      { kind: "stability", pct: 0 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_aus_parliament",
    tree: "GBR",
    x: 2,
    y: 24,
    days: 35,
    branch: "politics",
    icon: "ballot",
    group: "gbr_integration",
    prereq: [["gbr_aus_governor"]],
    available: { not: { kind: "is_human", who: { tag: "AUS" } } },
    effects: [
      { kind: "autonomy", who: { tag: "AUS" }, pct: -25 },
      { kind: "set_flag", who: { tag: "AUS" }, flag: "gbr_aus_suspended" },
      { kind: "war_support", who: { tag: "AUS" }, pct: -3 },
      { kind: "stability", pct: 0 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_aus_annex",
    tree: "GBR",
    x: 2,
    y: 25,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "gbr_integration",
    prereq: [["gbr_aus_parliament"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "AUS" } } },
        { kind: "subject_of", who: { tag: "AUS" }, of: "self" },
        { not: { kind: "at_war", who: { tag: "AUS" } } },
      ],
    },
    cancelIf: {
      any: [
        { kind: "is_human", who: { tag: "AUS" } },
        { kind: "at_war", who: { tag: "AUS" } },
      ],
    },
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            { not: { kind: "is_human", who: { tag: "AUS" } } },
            { kind: "subject_of", who: { tag: "AUS" }, of: "self" },
            { not: { kind: "at_war", who: { tag: "AUS" } } },
          ],
        },
        then: [
          { kind: "annex", target: { tag: "AUS" }, units: "transfer" },
          { kind: "set_flag", flag: "gbr_aus_annexed" },
          { kind: "resistance", group: "gbr_aus_heart", pct: 10 },
          { kind: "add_spirit", id: "gbr_aus_crown_rule" },
        ],
      },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_zaf_governor",
    tree: "GBR",
    x: 4,
    y: 23,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "gbr_integration",
    prereq: [["gbr_imperial_unity"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "ZAF" } } },
        {
          any: [
            { kind: "focus_done", id: "gbr_aus_annex" },
            { kind: "is_human", who: { tag: "AUS" } },
            { not: { kind: "subject_of", who: { tag: "AUS" }, of: "self" } },
          ],
        },
      ],
    },
    effects: [
      { kind: "autonomy", who: { tag: "ZAF" }, pct: -20 },
      { kind: "set_flag", who: { tag: "ZAF" }, flag: "gbr_crown_control" },
      {
        kind: "opinion",
        who: { tag: "ZAF" },
        of: "self",
        value: -5,
        days: 365,
      },
      { kind: "stability", pct: 0 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_zaf_parliament",
    tree: "GBR",
    x: 4,
    y: 24,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "gbr_integration",
    prereq: [["gbr_zaf_governor"]],
    available: { not: { kind: "is_human", who: { tag: "ZAF" } } },
    effects: [
      { kind: "autonomy", who: { tag: "ZAF" }, pct: -30 },
      { kind: "set_flag", who: { tag: "ZAF" }, flag: "gbr_zaf_suspended" },
      { kind: "war_support", who: { tag: "ZAF" }, pct: -3 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_zaf_annex",
    tree: "GBR",
    x: 4,
    y: 25,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "gbr_integration",
    prereq: [["gbr_zaf_parliament"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "ZAF" } } },
        { kind: "subject_of", who: { tag: "ZAF" }, of: "self" },
        { not: { kind: "at_war", who: { tag: "ZAF" } } },
      ],
    },
    cancelIf: {
      any: [
        { kind: "is_human", who: { tag: "ZAF" } },
        { kind: "at_war", who: { tag: "ZAF" } },
      ],
    },
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            { not: { kind: "is_human", who: { tag: "ZAF" } } },
            { kind: "subject_of", who: { tag: "ZAF" }, of: "self" },
            { not: { kind: "at_war", who: { tag: "ZAF" } } },
          ],
        },
        then: [
          { kind: "annex", target: { tag: "ZAF" }, units: "transfer" },
          { kind: "set_flag", flag: "gbr_zaf_annexed" },
          { kind: "resistance", group: "gbr_zaf_heart", pct: 15 },
          { kind: "add_spirit", id: "gbr_zaf_crown_rule" },
        ],
      },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_can_governor",
    tree: "GBR",
    x: 6,
    y: 23,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "gbr_integration",
    prereq: [["gbr_imperial_unity"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "CAN" } } },
        {
          any: [
            { kind: "focus_done", id: "gbr_zaf_annex" },
            { kind: "is_human", who: { tag: "ZAF" } },
            { not: { kind: "subject_of", who: { tag: "ZAF" }, of: "self" } },
          ],
        },
      ],
    },
    effects: [
      { kind: "autonomy", who: { tag: "CAN" }, pct: -20 },
      { kind: "set_flag", who: { tag: "CAN" }, flag: "gbr_crown_control" },
      {
        kind: "opinion",
        who: { tag: "CAN" },
        of: "self",
        value: -5,
        days: 365,
      },
      { kind: "stability", pct: 0 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_can_parliament",
    tree: "GBR",
    x: 6,
    y: 24,
    days: 70,
    branch: "politics",
    icon: "ballot",
    group: "gbr_integration",
    prereq: [["gbr_can_governor"]],
    available: { not: { kind: "is_human", who: { tag: "CAN" } } },
    effects: [
      { kind: "autonomy", who: { tag: "CAN" }, pct: -30 },
      { kind: "set_flag", who: { tag: "CAN" }, flag: "gbr_can_suspended" },
      { kind: "war_support", who: { tag: "CAN" }, pct: -3 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_can_annex",
    tree: "GBR",
    x: 6,
    y: 25,
    days: 70,
    branch: "politics",
    icon: "crown",
    group: "gbr_integration",
    prereq: [["gbr_can_parliament"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "CAN" } } },
        { kind: "subject_of", who: { tag: "CAN" }, of: "self" },
        { not: { kind: "at_war", who: { tag: "CAN" } } },
      ],
    },
    cancelIf: {
      any: [
        { kind: "is_human", who: { tag: "CAN" } },
        { kind: "at_war", who: { tag: "CAN" } },
      ],
    },
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            { not: { kind: "is_human", who: { tag: "CAN" } } },
            { kind: "subject_of", who: { tag: "CAN" }, of: "self" },
            { not: { kind: "at_war", who: { tag: "CAN" } } },
          ],
        },
        then: [
          { kind: "annex", target: { tag: "CAN" }, units: "transfer" },
          { kind: "set_flag", flag: "gbr_can_annexed" },
          { kind: "resistance", group: "gbr_can_heart", pct: 20 },
          { kind: "add_spirit", id: "gbr_can_crown_rule" },
        ],
      },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_raj_governor",
    tree: "GBR",
    x: 8,
    y: 23,
    days: 70,
    branch: "politics",
    icon: "flag",
    group: "gbr_integration",
    prereq: [["gbr_imperial_unity"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "RAJ" } } },
        {
          any: [
            { kind: "focus_done", id: "gbr_can_annex" },
            { kind: "is_human", who: { tag: "CAN" } },
            { not: { kind: "subject_of", who: { tag: "CAN" }, of: "self" } },
          ],
        },
      ],
    },
    effects: [
      { kind: "autonomy", who: { tag: "RAJ" }, pct: -25 },
      { kind: "set_flag", who: { tag: "RAJ" }, flag: "gbr_crown_control" },
      {
        kind: "opinion",
        who: { tag: "RAJ" },
        of: "self",
        value: -5,
        days: 365,
      },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_raj_parliament",
    tree: "GBR",
    x: 8,
    y: 24,
    days: 105,
    branch: "politics",
    icon: "ballot",
    group: "gbr_integration",
    prereq: [["gbr_raj_governor"]],
    available: { not: { kind: "is_human", who: { tag: "RAJ" } } },
    effects: [
      { kind: "autonomy", who: { tag: "RAJ" }, pct: -35 },
      { kind: "set_flag", who: { tag: "RAJ" }, flag: "gbr_raj_suspended" },
      { kind: "war_support", who: { tag: "RAJ" }, pct: -3 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "gbr_raj_annex",
    tree: "GBR",
    x: 8,
    y: 25,
    days: 105,
    branch: "politics",
    icon: "crown",
    group: "gbr_integration",
    prereq: [["gbr_raj_parliament"]],
    available: {
      all: [
        { not: { kind: "is_human", who: { tag: "RAJ" } } },
        { kind: "subject_of", who: { tag: "RAJ" }, of: "self" },
        { not: { kind: "at_war", who: { tag: "RAJ" } } },
      ],
    },
    cancelIf: {
      any: [
        { kind: "is_human", who: { tag: "RAJ" } },
        { kind: "at_war", who: { tag: "RAJ" } },
      ],
    },
    effects: [
      {
        kind: "if",
        cond: {
          all: [
            { not: { kind: "is_human", who: { tag: "RAJ" } } },
            { kind: "subject_of", who: { tag: "RAJ" }, of: "self" },
            { not: { kind: "at_war", who: { tag: "RAJ" } } },
          ],
        },
        then: [
          { kind: "annex", target: { tag: "RAJ" }, units: "disband" },
          { kind: "set_flag", flag: "gbr_raj_annexed" },
          { kind: "resistance", group: "gbr_raj_heart", pct: 35 },
          { kind: "add_spirit", id: "gbr_raj_crown_rule" },
        ],
      },
      { kind: "stability", pct: -2 },
    ],
    ai: { base: 2 },
  },

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
    available: {
      all: [
        {
          all: [
            {
              all: [
                {
                  all: [
                    {
                      all: [
                        { kind: "always", value: true },
                        {
                          any: [
                            { kind: "focus_done", id: "gbr_nzl_annex" },
                            { kind: "is_human", who: { tag: "NZL" } },
                            {
                              not: {
                                kind: "subject_of",
                                who: { tag: "NZL" },
                                of: "self",
                              },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      any: [
                        { kind: "focus_done", id: "gbr_aus_annex" },
                        { kind: "is_human", who: { tag: "AUS" } },
                        {
                          not: {
                            kind: "subject_of",
                            who: { tag: "AUS" },
                            of: "self",
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  any: [
                    { kind: "focus_done", id: "gbr_zaf_annex" },
                    { kind: "is_human", who: { tag: "ZAF" } },
                    {
                      not: {
                        kind: "subject_of",
                        who: { tag: "ZAF" },
                        of: "self",
                      },
                    },
                  ],
                },
              ],
            },
            {
              any: [
                { kind: "focus_done", id: "gbr_can_annex" },
                { kind: "is_human", who: { tag: "CAN" } },
                {
                  not: { kind: "subject_of", who: { tag: "CAN" }, of: "self" },
                },
              ],
            },
          ],
        },
        {
          any: [
            { kind: "focus_done", id: "gbr_raj_annex" },
            { kind: "is_human", who: { tag: "RAJ" } },
            { not: { kind: "subject_of", who: { tag: "RAJ" }, of: "self" } },
          ],
        },
      ],
    },
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
    available: {
      all: [
        {
          all: [
            {
              all: [
                {
                  all: [
                    {
                      all: [
                        { kind: "always", value: true },
                        {
                          any: [
                            { kind: "focus_done", id: "gbr_nzl_annex" },
                            { kind: "is_human", who: { tag: "NZL" } },
                            {
                              not: {
                                kind: "subject_of",
                                who: { tag: "NZL" },
                                of: "self",
                              },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      any: [
                        { kind: "focus_done", id: "gbr_aus_annex" },
                        { kind: "is_human", who: { tag: "AUS" } },
                        {
                          not: {
                            kind: "subject_of",
                            who: { tag: "AUS" },
                            of: "self",
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  any: [
                    { kind: "focus_done", id: "gbr_zaf_annex" },
                    { kind: "is_human", who: { tag: "ZAF" } },
                    {
                      not: {
                        kind: "subject_of",
                        who: { tag: "ZAF" },
                        of: "self",
                      },
                    },
                  ],
                },
              ],
            },
            {
              any: [
                { kind: "focus_done", id: "gbr_can_annex" },
                { kind: "is_human", who: { tag: "CAN" } },
                {
                  not: { kind: "subject_of", who: { tag: "CAN" }, of: "self" },
                },
              ],
            },
          ],
        },
        {
          any: [
            { kind: "focus_done", id: "gbr_raj_annex" },
            { kind: "is_human", who: { tag: "RAJ" } },
            { not: { kind: "subject_of", who: { tag: "RAJ" }, of: "self" } },
          ],
        },
      ],
    },
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
