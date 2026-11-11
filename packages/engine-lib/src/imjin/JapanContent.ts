// ww177 I4b (Imjin design §7, §8): the scenes, decisions and spirits of
// Japan's politics and the truce. The engine's ImjinJapan fires the scenes
// by state (never by date) and reads the flags their options set; the
// options' texts say what is done, never what comes of it. The texts are
// placeholders for P6's writers (ww1936.event_* keys in resources/lang).
import type {
  DecisionDef,
  EventDef,
  FlagId,
  SpiritDef,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { flag, not } from "../ww1936/content/helpers";

/** Flags the options and decisions set and ImjinJapan reads (and clears). */
export const JP_FLAG = {
  strikeNow: "imjin_jp_strike_now",
  muster: "imjin_jp_do_muster",
  sekibune: "imjin_jp_do_sekibune",
  nagoya: "imjin_jp_do_nagoya",
  demands: "imjin_jp_do_demands",
  grant: "imjin_jp_do_grant",
  example: "imjin_jp_do_example",
  heed: "imjin_jos_do_heed",
  talksYes: "imjin_jp_talks_yes",
  talksNo: "imjin_jp_talks_no",
  truceYes: "imjin_jp_truce_yes",
  truceNo: "imjin_jp_truce_no",
  tearLetter: "imjin_jp_tear_letter",
  takeTitle: "imjin_jp_take_title",
  goHome: "imjin_jp_go_home",
  fightOn: "imjin_jp_fight_on",
  regentsNamed: "imjin_jp_regents_named",
} as const;

/** Flags that stay: what was done once, and the AI's hints. */
export const JP_MARK = {
  mustered: "imjin_jp_mustered",
  sekibuneBuilt: "imjin_jp_sekibune_built",
  nagoyaBuilt: "imjin_jp_nagoya_built",
  demandsSent: "imjin_jp_demands_sent",
  warBegun: "imjin_jp_war_begun",
  frail: "imjin_jp_taiko_frail",
  losing: "imjin_jp_losing",
  regency: "imjin_jp_regency",
} as const;

/**
 * Global flags shared with lane I4a (Joseon and Ming), names fixed there:
 * Japan's demand reached Joseon; the forged truce broke; Ming is weary
 * of the war (I4a sets it; Japan reads it for talks and a second war).
 */
export const IMJIN_GFLAG = {
  japanDemand: "imjin_japan_demand",
  truceBroken: "imjin_truce_broken",
  mingWeary: "imjin_ming_weary",
} as const;

/** A global flag the endings read: the investiture peace was taken. */
export const IMJIN_PEACE_GFLAG = "imjin_peace_investiture";

export const IMJIN_JAPAN_FLAGS: readonly FlagId[] = [
  ...Object.values(JP_FLAG),
  ...Object.values(JP_MARK),
  IMJIN_PEACE_GFLAG,
];

/** Scene ids (P6 writes their texts; variants are separate ids). */
export const JP_SCENE = {
  strikeReady: "imjin_jp_strike_ready",
  strikeFull: "imjin_jp_strike_full",
  strikeAgain: "imjin_jp_strike_again",
  grumble: "imjin_jp_daimyo_grumble",
  ailing: "imjin_jp_taiko_ailing",
  dies: "imjin_jp_taiko_dies",
  regentsPress: "imjin_jp_regents_press",
  talks: "imjin_jp_talks",
  mingReply: "imjin_jp_ming_reply",
  investiture: "imjin_jp_investiture",
  investitureRegents: "imjin_jp_investiture_regents",
  omens: "imjin_jos_omens",
  omensGrave: "imjin_jos_omens_grave",
  demand: "imjin_jos_demand",
  truce: "imjin_jos_truce",
  truceBroken: "imjin_jos_truce_broken",
  tsushima: "imjin_jos_tsushima",
} as const;

/** Spirits ImjinJapan adds (with their days). */
export const JP_SPIRIT = {
  thinWave: "imjin_jp_thin_wave",
  fullWave: "imjin_jp_full_wave",
  unready: "imjin_jos_caught_unready",
  halfReady: "imjin_jos_half_ready",
  regency: "imjin_jp_regency_spirit",
} as const;

const set = (f: string) => ({ kind: "set_flag", flag: f }) as const;

/** Two options: `a` and `b`, each setting its flag. */
function choice(
  id: string,
  picture: EventDef["picture"],
  a: {
    flag?: string;
    ai: number;
    more?: EventDef["options"][number]["effects"];
  },
  b: {
    flag?: string;
    ai: number;
    more?: EventDef["options"][number]["effects"];
  },
  once: EventDef["once"] = "country",
  cooldownDays?: number,
  mods?: { a?: EventDef["options"][number]["ai"]["mods"] },
): EventDef {
  return {
    id,
    kind: "country",
    picture,
    once,
    ...(cooldownDays !== undefined ? { cooldownDays } : {}),
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: { base: a.ai, ...(mods?.a ? { mods: mods.a } : {}) },
        effects: [...(a.flag ? [set(a.flag)] : []), ...(a.more ?? [])],
      },
      {
        id: "b",
        ai: { base: b.ai },
        effects: [...(b.flag ? [set(b.flag)] : []), ...(b.more ?? [])],
      },
    ],
  };
}

export const IMJIN_JAPAN_EVENTS: EventDef[] = [
  // The run-up (design §8): a human Japan is told the muster can sail.
  choice(
    JP_SCENE.strikeReady,
    "map",
    { flag: JP_FLAG.strikeNow, ai: 0 },
    { ai: 100 },
  ),
  choice(
    JP_SCENE.strikeFull,
    "column",
    { flag: JP_FLAG.strikeNow, ai: 0 },
    { ai: 100 },
  ),
  // A second invasion, by state alone (after the truce broke).
  choice(
    JP_SCENE.strikeAgain,
    "column",
    { flag: JP_FLAG.strikeNow, ai: 0 },
    { ai: 100 },
  ),
  // The daimyo grumble (mean loyalty low).
  {
    id: JP_SCENE.grumble,
    kind: "country",
    picture: "table",
    once: "never",
    cooldownDays: 120,
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: { base: 50 },
        effects: [set(JP_FLAG.grant), { kind: "pp", amount: -40 }],
      },
      {
        id: "b",
        ai: { base: 30 },
        effects: [set(JP_FLAG.example), { kind: "stability", pct: -5 }],
      },
      { id: "c", ai: { base: 20 }, effects: [] },
    ],
  },
  // Hideyoshi's health fails.
  choice(
    JP_SCENE.ailing,
    "document",
    { flag: JP_FLAG.regentsNamed, ai: 60, more: [{ kind: "pp", amount: -30 }] },
    { ai: 40, more: [{ kind: "stability", pct: 3 }] },
  ),
  // His death: the regents (every option takes the fall in stability).
  choice(
    JP_SCENE.dies,
    "crowd",
    {
      flag: JP_FLAG.goHome,
      ai: 50,
      more: [
        { kind: "stability", pct: -10 },
        { kind: "add_spirit", id: JP_SPIRIT.regency },
      ],
    },
    {
      flag: JP_FLAG.fightOn,
      ai: 50,
      more: [
        { kind: "stability", pct: -15 },
        { kind: "add_spirit", id: JP_SPIRIT.regency },
      ],
    },
    "country",
    undefined,
    { a: [{ if: flag(JP_MARK.losing), factor: 300 }] },
  ),
  // The regents press to bring the armies home.
  choice(
    JP_SCENE.regentsPress,
    "table",
    { flag: JP_FLAG.goHome, ai: 70 },
    { flag: JP_FLAG.fightOn, ai: 30, more: [{ kind: "stability", pct: -5 }] },
    "never",
    90,
  ),
  // The truce: talks through the go-betweens.
  choice(
    JP_SCENE.talks,
    "table",
    { flag: JP_FLAG.talksYes, ai: 60 },
    { flag: JP_FLAG.talksNo, ai: 40 },
    "never",
    60,
    { a: [{ if: flag(JP_MARK.frail), factor: 200 }] },
  ),
  choice(
    JP_SCENE.mingReply,
    "document",
    { flag: JP_FLAG.truceYes, ai: 80 },
    { flag: JP_FLAG.truceNo, ai: 20 },
    "never",
    60,
  ),
  // The investiture envoys before Hideyoshi: the truth comes out.
  choice(
    JP_SCENE.investiture,
    "document",
    {
      flag: JP_FLAG.tearLetter,
      ai: 70,
      more: [{ kind: "war_support", pct: 10 }],
    },
    { flag: JP_FLAG.takeTitle, ai: 30, more: [{ kind: "stability", pct: -5 }] },
    "country",
    undefined,
  ),
  // Or before the regents, when he is dead.
  choice(
    JP_SCENE.investitureRegents,
    "document",
    { flag: JP_FLAG.takeTitle, ai: 80 },
    { flag: JP_FLAG.tearLetter, ai: 20 },
  ),
  // Joseon: what the court hears of Japan's preparations.
  choice(
    JP_SCENE.omens,
    "border",
    { flag: JP_FLAG.heed, ai: 50, more: [{ kind: "pp", amount: -25 }] },
    { ai: 50, more: [{ kind: "stability", pct: 2 }] },
  ),
  choice(
    JP_SCENE.omensGrave,
    "border",
    { flag: JP_FLAG.heed, ai: 60, more: [{ kind: "pp", amount: -35 }] },
    { ai: 40, more: [{ kind: "stability", pct: 2 }] },
  ),
  // An early strike is seen from Tsushima a month before (Japan.ts).
  choice(
    JP_SCENE.tsushima,
    "border",
    { flag: JP_FLAG.heed, ai: 70, more: [{ kind: "pp", amount: -25 }] },
    { ai: 30, more: [{ kind: "stability", pct: 2 }] },
  ),
  choice(
    JP_SCENE.demand,
    "document",
    { flag: JP_FLAG.heed, ai: 70, more: [{ kind: "war_support", pct: 5 }] },
    { ai: 30 },
  ),
  // Joseon hears of a truce Ming and Japan made over its head.
  choice(
    JP_SCENE.truce,
    "table",
    { ai: 60, more: [{ kind: "stability", pct: -5 }] },
    {
      ai: 40,
      more: [
        { kind: "war_support", pct: 5 },
        { kind: "stability", pct: -2 },
      ],
    },
  ),
  {
    id: JP_SCENE.truceBroken,
    kind: "country",
    picture: "newspaper",
    once: "country",
    timeoutSec: 30,
    options: [
      {
        id: "a",
        ai: { base: 100 },
        effects: [{ kind: "war_support", pct: 10 }],
      },
    ],
  },
];

/** The run-up's decisions (design §8), and the grant of fiefs. */
export const IMJIN_JAPAN_DECISIONS: DecisionDef[] = [
  {
    id: "imjin_jp_muster_daimyo",
    category: "military",
    for: ["JPN"],
    available: not(flag(JP_MARK.warBegun)),
    visible: not(flag(JP_MARK.mustered)),
    cost: { pp: 50 },
    days: 60,
    effects: [set(JP_MARK.mustered)],
    completeEffects: [set(JP_FLAG.muster)],
    ai: { base: 30 },
  },
  {
    id: "imjin_jp_build_sekibune",
    category: "military",
    for: ["JPN"],
    available: not(flag(JP_MARK.warBegun)),
    visible: not(flag(JP_MARK.sekibuneBuilt)),
    cost: { pp: 40 },
    days: 90,
    effects: [set(JP_MARK.sekibuneBuilt)],
    completeEffects: [set(JP_FLAG.sekibune)],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_nagoya_castle",
    category: "economy",
    for: ["JPN"],
    available: not(flag(JP_MARK.warBegun)),
    visible: not(flag(JP_MARK.nagoyaBuilt)),
    cost: { pp: 60 },
    days: 120,
    effects: [set(JP_MARK.nagoyaBuilt)],
    completeEffects: [set(JP_FLAG.nagoya)],
    ai: { base: 25 },
  },
  {
    id: "imjin_jp_demands_so",
    category: "diplomacy",
    for: ["JPN"],
    available: not(flag(JP_MARK.warBegun)),
    visible: not(flag(JP_MARK.demandsSent)),
    cost: { pp: 25 },
    effects: [set(JP_MARK.demandsSent), set(JP_FLAG.demands)],
    ai: { base: 20 },
  },
  {
    id: "imjin_jp_grant_fiefs",
    category: "political",
    for: ["JPN"],
    cost: { pp: 50 },
    cooldownDays: 180,
    effects: [set(JP_FLAG.grant)],
    ai: { base: 10 },
  },
];

export const IMJIN_JAPAN_SPIRITS: SpiritDef[] = [
  {
    id: JP_SPIRIT.thinWave,
    icon: "infantry",
    stats: { attackPct: -10, orgPct: -10 },
  },
  {
    id: JP_SPIRIT.fullWave,
    icon: "infantry",
    stats: { attackPct: 5, orgPct: 5 },
  },
  {
    id: JP_SPIRIT.unready,
    icon: "chain_broken",
    stats: { orgPct: -20, planSpeedPct: -30, recruitablePct: -10 },
  },
  {
    id: JP_SPIRIT.halfReady,
    icon: "shield",
    stats: { orgPct: -10, planSpeedPct: -15 },
  },
  {
    id: JP_SPIRIT.regency,
    icon: "crown",
    stats: { ppGainPct: -15, stabilityBp: -500 },
  },
];

/** How many days each wave and readiness spirit lasts. */
export const JP_SPIRIT_DAYS = {
  thinWave: 120,
  fullWave: 90,
  unready: 90,
  halfReady: 60,
} as const;
