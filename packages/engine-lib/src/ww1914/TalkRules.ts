// Great War 1914 (design §5.6): how a person takes a reply. Data and two pure
// functions; the talk engine (engine/ww1914/Talk.ts) runs them. A person's
// temperament comes from the seed inside their recorded range, so the same
// reply lands on Moltke in one game and not in the next.
import type {
  GwPersonState,
  GwTemperament,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type {
  GwReplyKind,
  GwStance,
} from "@openfront/engine-api/ww1914/SceneDsl";

/** +1 goes down well, -1 goes down badly. */
export const GW_STANCE_FIT: Readonly<
  Record<GwTemperament, Readonly<Record<GwStance, number>>>
> = {
  anxious: { warm: 1, cold: -1, threat: 0, flatter: 0, frank: 0 },
  cold: { warm: 0, cold: 1, threat: -1, flatter: -1, frank: 1 },
  arrogant: { warm: 0, cold: -1, threat: -1, flatter: 1, frank: -1 },
  cunning: { warm: 0, cold: 1, threat: 0, flatter: -1, frank: 0 },
  weary: { warm: 1, cold: 0, threat: -1, flatter: 0, frank: 1 },
  stubborn: { warm: 0, cold: 0, threat: -1, flatter: 0, frank: 1 },
};

/** Pride from which a push is pushed back. */
export const GW_PUSHBACK_PRIDE = 4;
/** Trust from which the relation itself carries a reply, either way. */
export const GW_TRUST_CARRIES = 2;
/** A talk's mood from which trust moves when it ends. */
export const GW_MOOD_MOVES_TRUST = 2;

/** How a reply goes down; 0 or more lands. */
export function stanceFit(
  p: Pick<GwPersonState, "temperament" | "trust" | "pride">,
  stance: GwStance,
  kind: GwReplyKind,
): number {
  let fit = GW_STANCE_FIT[p.temperament][stance];
  if (p.trust >= GW_TRUST_CARRIES) fit++;
  if (p.trust <= -GW_TRUST_CARRIES) fit--;
  if (kind === "push" && p.pride >= GW_PUSHBACK_PRIDE) fit--;
  return fit;
}

/** Bias of each temperament towards a straight answer. */
const CANDOUR: Readonly<Record<GwTemperament, number>> = {
  anxious: 1,
  cold: 0,
  arrogant: 0,
  cunning: -1,
  weary: 1,
  stubborn: 1,
};

/**
 * Whether the person answers an asked question straight, this far into a
 * talk. Strangers to the seat evade unless their temperament gives them away.
 */
export function isCandid(
  p: Pick<GwPersonState, "temperament" | "trust">,
  mood: number,
): boolean {
  return p.trust + mood + CANDOUR[p.temperament] >= 1;
}

/** Chapters for a remembered slight or favour to fade by one. */
export const GW_MEMORY_FADE = 4;

/** A memory's weight after `age` chapters: towards zero, never past it. */
export function fadedWeight(weight: number, age: number): number {
  const left = Math.abs(weight) - Math.floor(age / GW_MEMORY_FADE);
  if (left <= 0) return 0;
  return weight < 0 ? -left : left;
}
