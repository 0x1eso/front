// Great War 1914: the person at the desk. Five things about them, in words on
// the screen (hud/ww1914/GwRuler) and integers here. The rows are in
// engine-lib/ww1914/RulerRows, the rule in engine/ww1914/Ruler.
import { z } from "zod";

export const GW_RULER_SIDES = [
  "health",
  "family",
  "conscience",
  "reputation",
  // ww196 (§0.4): what he has left for the things against his grain
  // (engine/ww1914/Persona). Spent by them, back with rest and sleep.
  "nerve",
] as const;
export type GwRulerSide = (typeof GW_RULER_SIDES)[number];

/** Each side runs 0..GW_RULER_MAX; 0 is the bottom. */
export const GW_RULER_MAX = 5;

/** How a card can end a game. Text: pack `endings`, gw.ending.<tag>_r_<how>. */
export const GW_RULER_ENDS = ["death", "removed"] as const;
export type GwRulerEnd = (typeof GW_RULER_ENDS)[number];

const int = z.number().int();

/** A move of the card and why: the text is a reason line. */
export const GwRulerLineSchema = z.object({
  side: z.enum(GW_RULER_SIDES),
  key: z.string(),
  delta: int,
  chapter: int,
});
export type GwRulerLine = z.infer<typeof GwRulerLineSchema>;

export const GwRulerStateSchema = z.object({
  /** The row of the person at the desk; null when no row fits the regime. */
  id: z.string().nullable(),
  health: int,
  family: int,
  conscience: int,
  reputation: int,
  /** ww196: absent on an older save, which starts it full. */
  nerve: int.default(GW_RULER_MAX),
  /** Chapter conscience gave out; it doesn't come back. */
  broken: int.nullable(),
  /** Chapter health hit the bottom; null when it has recovered. */
  failing: int.nullable(),
  /** Chapter reputation hit the bottom; null when it has recovered. */
  shaken: int.nullable(),
  /** Chapter they were last seen to effect: reputation rose. */
  seen: int,
  /** The casualties conscience has already answered for, in thousands. */
  counted: int,
  lines: z.array(GwRulerLineSchema),
});
export type GwRulerState = z.infer<typeof GwRulerStateSchema>;

/** The card before a row is laid on it. */
export function blankRuler(): GwRulerState {
  return {
    id: null,
    health: GW_RULER_MAX,
    family: GW_RULER_MAX,
    conscience: GW_RULER_MAX,
    reputation: GW_RULER_MAX,
    nerve: GW_RULER_MAX,
    broken: null,
    failing: null,
    shaken: null,
    seen: 0,
    counted: 0,
    lines: [],
  };
}

/** The card as the seat reads it: their own life, so nothing here is hidden. */
export interface GwRulerView {
  id: string;
  /** Whole years on the chapter's date. */
  age: number;
  /** In GW_RULER_SIDES order: 0 low, 1 middling, 2 sound. */
  levels: readonly number[];
  broken: boolean;
  /** A bottom that ends the game in a few chapters unless it is lifted. */
  atRisk?: "health" | "reputation" | null;
  /** The last moves, newest first: reason keys. */
  lines: readonly { side: GwRulerSide; key: string; delta: number }[];
}
