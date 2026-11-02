// World War 1936 military thought sliders (docs: /home/eser/dev/ww9-doctrine-design.md
// §5-§9). Nine sliders, three per service, replace the doctrines.
// APPEND ONLY: THOUGHT_SLIDERS and THOUGHT_EDGE_IDS are wire / snapshot enums.
import { zb } from "@openfront/zbin";
import { z } from "zod";
import type { CountryTag } from "./Countries";

/** Land, naval, air: the DOCTRINE_DOMAINS order. */
export const THOUGHT_SLIDERS = [
  "off_def",
  "mob_fire",
  "quant_qual",
  "gun_carrier",
  "raid_escort",
  "battle_patrol",
  "intercept_escort",
  "strat_cas",
  "tempo_preserve",
] as const;
export type ThoughtSlider = (typeof THOUGHT_SLIDERS)[number];
export const THOUGHT_SLIDER_COUNT = THOUGHT_SLIDERS.length;
/** DOCTRINE_DOMAINS index (0 land, 1 naval, 2 air) of each slider. */
export const THOUGHT_SLIDER_DOMAIN: readonly number[] = [
  0, 0, 0, 1, 1, 1, 2, 2, 2,
];
/**
 * The 18 ends: end e of slider s is THOUGHT_EDGE_IDS[2 * s + e], e 0 = the
 * left (negative notches), 1 = the right (positive). The ids name the i18n keys
 * `ww1936.thought.left.<slider>`, `.right.<slider>` and `.edge.<id>`.
 */
export const THOUGHT_EDGE_IDS = [
  "offense",
  "defense",
  "mobility",
  "firepower",
  "mass",
  "quality",
  "battleship",
  "carrier",
  "raid",
  "escort",
  "decisive",
  "patrol",
  "intercept",
  "air_escort",
  "strategic",
  "close",
  "sortie",
  "preserve",
] as const;
export type ThoughtEdgeId = (typeof THOUGHT_EDGE_IDS)[number];

/** Notches run -THOUGHT_MAX_STEP..+THOUGHT_MAX_STEP (21 stops). */
export const THOUGHT_MAX_STEP = 10;
/** An actual value at or past this many notches from the middle lights the end's star bonus. */
export const THOUGHT_EDGE_STEP = 9;
/** The actual value moves this many milli-notches a day, x (100 + rsDoctrinePct)%. */
export const THOUGHT_DRIFT_MILLI = 100;
/** Year multiplier on the scaled values: 100% in 1936, +THOUGHT_YEAR_PCT a year, at most THOUGHT_YEAR_MAX_PCT. */
export const THOUGHT_YEAR_PCT = 10;
export const THOUGHT_YEAR_MAX_PCT = 160;
export const THOUGHT_START_YEAR = 1936;
/** Start position jitter (notches, +-): historical AI on / off. A start is clamped to +-THOUGHT_START_LIMIT. */
export const THOUGHT_START_JITTER = 2;
export const THOUGHT_START_JITTER_FREE = 3;
export const THOUGHT_START_LIMIT = 8;
/** Points per end of a slider, by service (land, naval, air), and the star bonus points. */
export const THOUGHT_BUDGET_PTS = [36, 24, 24] as const;
export const THOUGHT_EDGE_PTS = [6, 4, 4] as const;
/** AI judgement (design §9): days between judgements at war / at peace, the historical AI's share, the smallest change. */
export const THOUGHT_AI_WAR_DAYS = 30;
export const THOUGHT_AI_PEACE_DAYS = 90;
export const THOUGHT_AI_HISTORICAL_PCT = 50;
/** Design §3: the old doctrine_mastery effect's points become experience of the same domain, percent. */
export const MASTERY_TO_XP_PCT = 67;
export const THOUGHT_AI_MIN_CHANGE = 2;

/** The thought orders, at the end of WwOrderSchema after the wing orders (not a depth order: DEPTH_ORDER_KINDS is the 57 after army_garrison). Append only. */
export const THOUGHT_ORDER_KINDS = ["thought_set"] as const;
export type ThoughtOrderKind = (typeof THOUGHT_ORDER_KINDS)[number];

/** thought_set's position schema: a whole notch. */
export const ThoughtPos = zb.int({
  min: -THOUGHT_MAX_STEP,
  max: THOUGHT_MAX_STEP,
});
export const ThoughtSliderEnum = z.enum(THOUGHT_SLIDERS);

/** One country's thought state (T1 stores it as CountryDepth.th; every field optional with these defaults on the wire). */
export interface ThoughtState {
  /** Notch the owner set per slider, THOUGHT_SLIDERS order. */
  target: number[];
  /** Actual position per slider, milli-notches (notch * 1000). */
  curMilli: number[];
  /** Set once the start position was taken. */
  started: boolean;
}

/** A start row: nine notches in THOUGHT_SLIDERS order. */
export interface StartThoughtDef {
  tag: CountryTag | "@aggressor" | "@democracy" | "@minor";
  pos: readonly number[];
}
