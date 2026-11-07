// Great War 1914 (ww154): the ruler's earlier life, played before the first
// telegram. A nation's scenes with `prologue: <n>` run in that order; what they
// leave is ordinary state, set before chapter 0 opens. The rule is in
// engine/ww1914/Prologue, the format in /home/eser/dev/ww154-format.md.
import { z } from "zod";

const Id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(48);

/**
 * What the years made of the ruler. The people's temperaments and one more:
 * a life can also leave someone gentle. Append only.
 */
export const GW_RULER_TEMPERS = [
  "anxious",
  "cold",
  "arrogant",
  "cunning",
  "weary",
  "stubborn",
  "gentle",
] as const;
export type GwRulerTemper = (typeof GW_RULER_TEMPERS)[number];

/** Only on a seat that had a prologue, so a game without one hashes as before. */
export const GwPrologueStateSchema = z.object({
  /** Index in the nation's row of the next scene; -1 once it is over. */
  next: z.number().int(),
  /** Each `temper` effect taken, in order. */
  marks: z.array(z.enum(GW_RULER_TEMPERS)),
  /** The mark taken most, the later one on a tie; null with none. */
  temper: z.enum(GW_RULER_TEMPERS).nullable(),
  /** Person id -> how far the years pushed them toward being the rival. */
  lean: z.record(Id, z.number().int()),
});
export type GwPrologueState = z.infer<typeof GwPrologueStateSchema>;

export function gwPrologueStart(): GwPrologueState {
  return { next: 0, marks: [], temper: null, lean: {} };
}

/** The most taken of `marks`, the later one on a tie. */
export function temperOf(
  marks: readonly GwRulerTemper[],
): GwRulerTemper | null {
  let best: GwRulerTemper | null = null;
  let most = 0;
  for (const t of marks) {
    const n = marks.filter((x) => x === t).length;
    if (n >= most) {
      most = n;
      best = t;
    }
  }
  return best;
}

/** What the screens read. */
export interface GwPrologueView {
  /** Scenes dealt so far: the one on screen is number `step`. */
  step: number;
  total: number;
  done: boolean;
  /** "<scene>.<reply>" as taken: the lobby field of the next skipped game. */
  picks: readonly string[];
}
