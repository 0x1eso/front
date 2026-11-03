// World War 1936: the Showa Restoration, an alt-history road in the Japanese
// tree (an addition to jpn.ts). A human road: the Imperial Way plot, the
// seizure (by an imperial edict or by a rising, both setting the fascist
// government and the flag jpn_regime_seized), the restored order and its
// last fork. The focus only takes power: the navy and the Control Faction
// rise through jpn_service_revolt, the Kwantung Army through
// jpn_kwantung_break (events/jpn.ts). Data only (ContentPurity).
import type {
  Condition,
  Effect,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { T, all, any, done, not } from "../helpers";
import { NO_CIVIL_WAR } from "./usa_fascist";

export { NO_CIVIL_WAR };

/** The seizure is done: either final focus has been taken. */
export const JPN_SHOWA_RULE: Condition = any(
  done("jpn_imperial_rule"),
  done("jpn_capital_rising"),
);

/** The old guard's rising (jpn_service_revolt): neutral popularity at or over this share (percent) ... */
export const JPN_REVOLT_POP_PCT = 20;
/** ... mean days to the event once the trigger holds ... */
export const JPN_REVOLT_MTTH_DAYS = 60;
/** ... at least this many days between two of them ... */
export const JPN_REVOLT_COOLDOWN_DAYS = 90;
/** ... and at this stability or more the regime can break it; below, civil war. */
export const JPN_REVOLT_STABILITY = 25;

/** The Kwantung Army (jpn_kwantung_break): mean days to the event ... */
export const JPN_KWANTUNG_MTTH_DAYS = 90;
/** ... days between two of them ... */
export const JPN_KWANTUNG_COOLDOWN_DAYS = 180;
/** ... and at this stability or more the generals are brought to heel; below, they break away. */
export const JPN_KWANTUNG_STABILITY = 35;

/** Neutral popularity the seizure itself wakes (written; x3 in play). */
export const JPN_SEIZURE_BACKLASH_PP = 4;

/**
 * The seizure's effects, in this order. No civil war is started here: the
 * flag jpn_regime_seized is what the two opposition events key on, and what
 * keeps the generic regime crisis (gen_regime_crisis) from handing the
 * country back (Ideology.dailyIdeology).
 */
const SEIZURE: Effect[] = [
  { kind: "set_government", ideology: "fascist" },
  { kind: "set_flag", flag: "jpn_regime_seized" },
  { kind: "add_spirit", id: "jpn_showa_restoration" },
  // The old establishment rallies against the seizure.
  { kind: "popularity", ideology: "neutral", pp: JPN_SEIZURE_BACKLASH_PP },
];

const ANY_PLOT = [
  [
    "jpn_regiment_circles",
    "jpn_agrarian_cause",
    "jpn_patriotic_leagues",
    "jpn_court_friends",
    "jpn_kwantung_backing",
  ],
] as const;
const EITHER_END = [["jpn_imperial_rule", "jpn_capital_rising"]] as const;

export const JPN_SHOWA_FOCUSES: FocusDef[] = [
  // (jpn_young_officers sets the flag jpn_showa_plot: only a Japan that went
  // through the door is guarded from the generic regime crisis.)
  // ---- jpn_showa_plot: the Imperial Way takes the initiative (rows 10-11) ----
  {
    // The door: the Imperial Way's young officers stop waiting.
    id: "jpn_young_officers",
    tree: "JPN",
    x: 4,
    y: 10,
    days: 35,
    branch: "politics",
    icon: "star_plain",
    group: "jpn_showa_plot",
    prereq: [["jpn_kodoha_faction"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
      { kind: "army_xp", amount: 5 },
      // Through the door: while the plot is alive the generic regime crisis
      // does not hand the country over (Ideology.dailyIdeology).
      { kind: "set_flag", flag: "jpn_showa_plot" },
    ],
    ai: { base: 1 },
  },
  {
    id: "jpn_regiment_circles",
    tree: "JPN",
    x: 0,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "infantry",
    group: "jpn_showa_plot",
    prereq: [["jpn_young_officers"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_agrarian_cause",
    tree: "JPN",
    x: 2,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "wheat",
    group: "jpn_showa_plot",
    prereq: [["jpn_young_officers"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
      { kind: "manpower", recruitablePct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_patriotic_leagues",
    tree: "JPN",
    x: 4,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "megaphone",
    group: "jpn_showa_plot",
    prereq: [["jpn_young_officers"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_court_friends",
    tree: "JPN",
    x: 6,
    y: 11,
    days: 35,
    branch: "politics",
    icon: "crown",
    group: "jpn_showa_plot",
    prereq: [["jpn_young_officers"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "popularity", ideology: "neutral", pp: -1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    // The link with the Kwantung Army's road: the generals back the plot, and
    // will expect to be paid for it (jpn_kwantung_break).
    id: "jpn_kwantung_backing",
    tree: "JPN",
    x: 8,
    y: 11,
    days: 35,
    branch: "army",
    icon: "fort",
    group: "jpn_showa_plot",
    prereq: [["jpn_young_officers"], ["jpn_kwantung_autonomy"]],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },

  // ---- jpn_showa_seizure: the first fork, then the two roads (rows 13-16) ----
  {
    id: "jpn_edict_route",
    tree: "JPN",
    x: 2,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "scales",
    group: "jpn_showa_seizure",
    prereq: ANY_PLOT,
    exclusive: ["jpn_rising_route"],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "popularity", ideology: "neutral", pp: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_rising_route",
    tree: "JPN",
    x: 7,
    y: 13,
    days: 35,
    branch: "politics",
    icon: "sword",
    group: "jpn_showa_seizure",
    prereq: ANY_PLOT,
    exclusive: ["jpn_edict_route"],
    effects: [
      { kind: "popularity", ideology: "fascist", pp: 2 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 2 },
  },
  {
    id: "jpn_emergency_decree",
    tree: "JPN",
    x: 2,
    y: 14,
    days: 70,
    branch: "politics",
    icon: "document",
    group: "jpn_showa_seizure",
    prereq: [["jpn_edict_route"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: -2 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_cabinet_purge",
    tree: "JPN",
    x: 2,
    y: 15,
    days: 70,
    branch: "politics",
    icon: "fist",
    group: "jpn_showa_seizure",
    prereq: [["jpn_emergency_decree"]],
    effects: [
      { kind: "popularity", ideology: "neutral", pp: -2 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: -1 },
    ],
    ai: { base: 10 },
  },
  {
    // The last step of the edict road: it needs a real following first.
    id: "jpn_imperial_rule",
    tree: "JPN",
    x: 2,
    y: 16,
    days: 70,
    branch: "politics",
    icon: "chain_broken",
    group: "jpn_showa_seizure",
    prereq: [["jpn_cabinet_purge"]],
    available: { kind: "pop_ge", ideology: "fascist", pct: 35 },
    effects: [...SEIZURE, { kind: "stability", pct: -1 }],
    ai: { base: 10 },
  },
  {
    // The rising: no following needed.
    id: "jpn_capital_rising",
    tree: "JPN",
    x: 7,
    y: 14,
    days: 35,
    branch: "politics",
    icon: "flag",
    group: "jpn_showa_seizure",
    prereq: [["jpn_rising_route"]],
    effects: [...SEIZURE, { kind: "stability", pct: -3 }],
    ai: { base: 10 },
  },

  // ---- jpn_showa_order: the restored state (rows 18-19) ----
  {
    id: "jpn_young_cabinet",
    tree: "JPN",
    x: 1,
    y: 18,
    days: 70,
    branch: "politics",
    icon: "medal",
    group: "jpn_showa_order",
    prereq: EITHER_END,
    effects: [
      { kind: "war_support", pct: 3 },
      { kind: "stability", pct: 2 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    // Pressing the zaibatsu: the great houses pay, and take orders.
    id: "jpn_zaibatsu_levy",
    tree: "JPN",
    x: 3,
    y: 18,
    days: 70,
    branch: "industry",
    icon: "factory",
    group: "jpn_showa_order",
    prereq: EITHER_END,
    effects: [
      { kind: "pp", amount: 20 },
      { kind: "stability", pct: -1 },
      { kind: "add_spirit", id: "jpn_levied_combines" },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_military_police",
    tree: "JPN",
    x: 5,
    y: 18,
    days: 70,
    branch: "politics",
    icon: "shield",
    group: "jpn_showa_order",
    prereq: EITHER_END,
    effects: [
      { kind: "popularity", ideology: "neutral", pp: -1 },
      { kind: "popularity", ideology: "fascist", pp: 1 },
      { kind: "stability", pct: 3 },
    ],
    ai: { base: 10 },
  },
  {
    // The admirals are bought with ships: the navy's opposition cools.
    id: "jpn_fleet_compact",
    tree: "JPN",
    x: 7,
    y: 18,
    days: 70,
    branch: "navy",
    icon: "ship",
    group: "jpn_showa_order",
    prereq: EITHER_END,
    effects: [
      { kind: "popularity", ideology: "neutral", pp: -1 },
      { kind: "navy_xp", amount: 10 },
      { kind: "research_bonus", branch: "naval", pct: 50, uses: 1 },
      { kind: "stability", pct: 1 },
    ],
    ai: { base: 10 },
  },
  {
    // The settlement with the Kwantung Army: its price is paid, and the
    // generals stop threatening to break away (jpn_kwantung_break).
    id: "jpn_kwantung_settlement",
    tree: "JPN",
    x: 9,
    y: 18,
    days: 70,
    branch: "army",
    icon: "fort",
    group: "jpn_showa_order",
    prereq: EITHER_END,
    effects: [
      {
        kind: "fort",
        who: T("MCK"),
        where: { group: "manchukuo_soviet_border" },
        amount: 1,
      },
      { kind: "army_xp", amount: 10 },
      { kind: "stability", pct: 1 },
      { kind: "set_flag", flag: "jpn_kwantung_settled" },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_rural_relief",
    tree: "JPN",
    x: 0,
    y: 19,
    days: 70,
    branch: "politics",
    icon: "wheat",
    group: "jpn_showa_order",
    prereq: [["jpn_young_cabinet"]],
    effects: [
      { kind: "stability", pct: 3 },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_national_service",
    tree: "JPN",
    x: 2,
    y: 19,
    days: 70,
    branch: "army",
    icon: "infantry",
    group: "jpn_showa_order",
    prereq: [["jpn_young_cabinet"]],
    effects: [
      // A free step ignores the tension gate.
      { kind: "set_law", law: "conscription", value: "service", free: true },
      { kind: "war_support", pct: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_state_plan",
    tree: "JPN",
    x: 4,
    y: 19,
    days: 70,
    branch: "industry",
    icon: "factory_mil",
    group: "jpn_showa_order",
    prereq: [["jpn_zaibatsu_levy"]],
    effects: [
      { kind: "set_law", law: "economy", value: "war_economy", free: true },
      { kind: "pp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    // Only once the country is whole again: no breakaway war is running.
    id: "jpn_service_reconciliation",
    tree: "JPN",
    x: 6,
    y: 19,
    days: 70,
    branch: "politics",
    icon: "handshake",
    group: "jpn_showa_order",
    prereq: [["jpn_military_police"]],
    available: NO_CIVIL_WAR,
    effects: [
      { kind: "remove_spirit", id: "gen_civil_strife" },
      { kind: "stability", pct: 6 },
    ],
    ai: { base: 10 },
  },

  // ---- jpn_showa_fate: the last fork (rows 22-24) ----
  {
    // Strike north. Closed to a Japan that has already struck south; once
    // taken, the southern advance (jpn_strike_south and what hangs on it)
    // is closed, as strike_north closes it.
    id: "jpn_northern_crusade",
    tree: "JPN",
    x: 2,
    y: 22,
    days: 70,
    branch: "army",
    icon: "compass",
    group: "jpn_showa_fate",
    prereq: [["jpn_military_police"], ["jpn_state_plan"]],
    available: not(done("jpn_strike_south")),
    exclusive: ["jpn_washington_accord"],
    effects: [
      {
        kind: "war_goal",
        on: T("SUN"),
        type: "claim",
        group: "far_east_soviet",
      },
      { kind: "army_xp", amount: 20 },
      { kind: "add_spirit", id: "jpn_northern_readiness" },
    ],
    ai: { base: 10 },
  },
  {
    // A deal with Washington and the army's attention on China. Closed once
    // Hawaii is planned; once taken it closes the southern advance and the
    // Pacific branch behind it.
    id: "jpn_washington_accord",
    tree: "JPN",
    x: 7,
    y: 22,
    days: 70,
    branch: "diplomacy",
    icon: "handshake",
    group: "jpn_showa_fate",
    prereq: [["jpn_military_police"], ["jpn_state_plan"]],
    available: all(
      not(done("jpn_hawaii_operation")),
      not({ kind: "at_war_with", of: T("USA") }),
    ),
    exclusive: ["jpn_northern_crusade"],
    effects: [
      { kind: "opinion", of: T("USA"), value: 25, days: 730 },
      { kind: "opinion", of: T("GBR"), value: 15, days: 730 },
      { kind: "nap", of: T("USA") },
      { kind: "add_spirit", id: "jpn_washington_credit" },
      { kind: "set_flag", flag: "jpn_washington_accord" },
    ],
    ai: { base: 8 },
  },
  {
    id: "jpn_far_east_offensive",
    tree: "JPN",
    x: 1,
    y: 23,
    days: 70,
    branch: "army",
    icon: "tank",
    group: "jpn_showa_fate",
    prereq: [["jpn_northern_crusade"]],
    effects: [
      { kind: "build", where: { best: 2 }, building: "mil", count: 2 },
      { kind: "manpower", recruitablePct: 3 },
      { kind: "army_xp", amount: 10 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_amur_railways",
    tree: "JPN",
    x: 3,
    y: 23,
    days: 70,
    branch: "industry",
    icon: "rail",
    group: "jpn_showa_fate",
    prereq: [["jpn_northern_crusade"]],
    effects: [
      { kind: "rail", where: { group: "manchuria" }, amount: 2 },
      { kind: "infra", where: { group: "manchuria" }, amount: 1 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_new_york_credit",
    tree: "JPN",
    x: 6,
    y: 23,
    days: 70,
    branch: "industry",
    icon: "industry",
    group: "jpn_showa_fate",
    prereq: [["jpn_washington_accord"]],
    effects: [
      { kind: "pp", amount: 30 },
      { kind: "resource", where: { best: 2 }, res: "oil", amount: 2 },
      { kind: "build", where: { best: 2 }, building: "civ", count: 2 },
    ],
    ai: { base: 10 },
  },
  {
    id: "jpn_china_priority",
    tree: "JPN",
    x: 8,
    y: 23,
    days: 70,
    branch: "army",
    icon: "map",
    group: "jpn_showa_fate",
    prereq: [["jpn_washington_accord"]],
    effects: [
      { kind: "war_goal", on: T("CHN"), type: "conquer" },
      { kind: "army_xp", amount: 15 },
      { kind: "research_bonus", branch: "doctrine", pct: 50, uses: 1 },
    ],
    ai: { base: 10 },
  },
];
