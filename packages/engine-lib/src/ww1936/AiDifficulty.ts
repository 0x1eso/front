// World War 1936: the lobby's difficulty, HOI4-style (owner decision,
// 2026-10-30: "the AI plays too well; humans have too much to do"). The
// handicaps go to the AI-controlled countries only, never a human's.
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

export type WwAiLevel = "easy" | "normal" | "hard";

/** The lobby's three choices, in order (Impossible plays as Hard). */
export const WW_DIFFICULTIES: readonly Difficulty[] = [
  Difficulty.Easy,
  Difficulty.Medium,
  Difficulty.Hard,
];

/**
 * The difficulty a World War 1936 game plays: Easy when none was chosen,
 * Impossible as Hard.
 */
export function wwDifficulty(d: Difficulty | undefined): Difficulty {
  if (d === undefined) return Difficulty.Easy;
  return d === Difficulty.Impossible ? Difficulty.Hard : d;
}

/** Easy→easy, Medium→normal, Hard (and Impossible)→hard. */
export function wwAiLevel(d: Difficulty | undefined): WwAiLevel {
  switch (wwDifficulty(d)) {
    case Difficulty.Easy:
      return "easy";
    case Difficulty.Hard:
      return "hard";
    default:
      return "normal";
  }
}

/**
 * The stats an AI-controlled country gets on top of its own (integer
 * percent points, summed like any other source). Normal: none.
 */
export const WW_AI_HANDICAP: Readonly<
  Record<WwAiLevel, Readonly<Partial<WwStats>>>
> = {
  easy: {
    // Factory output (military lines and dockyards).
    outputPct: -20,
    constructionPct: -20,
    researchPct: -15,
    // Land, sea and air combat.
    attackPct: -10,
    defensePct: -10,
    navyAttackPct: -10,
    navyDefensePct: -10,
    airAttackPct: -10,
    airDefensePct: -10,
  },
  normal: {},
  hard: {
    outputPct: 10,
    constructionPct: 10,
    researchPct: 10,
  },
};

/**
 * Easy: an AI country plans its land fronts at war (else daily) and its
 * fleets at war (else every 2 days) only every this many days, staggered by
 * its id. Slower cadences (peace, the air force's 5 days) stay as they are.
 */
export const WW_EASY_AI_PLAN_DAYS = 3;

/** Whether an AI country of this level plans its war today (Easy's cadence). */
export function wwAiWarPlanDue(
  level: WwAiLevel,
  smallID: number,
  day: number,
): boolean {
  if (level !== "easy") return true;
  return (day + smallID) % WW_EASY_AI_PLAN_DAYS === 0;
}
