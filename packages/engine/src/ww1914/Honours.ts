// Great War 1914 (ww196 §4): honours at their occasions, out of the audience.
// A seat's honours rows (GwHonourRow) bring a free desk paper, the 서훈 명단,
// on their occasion; the 서훈식 (1 of the time) gives who gets what; unheld,
// the proposers' list is given as 대행. A department may petition between
// lists (서훈 상신). Rows: content/depts/<seat>.ts `honours`, `orders`.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwPetitionAnswer } from "@openfront/engine-api/ww1914/GwDepts";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GreatWar } from "./GreatWar";

/** Opens the chapter's honours: lists on their occasions, petitions. */
export function openHonours(_gw: GreatWar, _seat: GwSeatState): void {}

/** The `honours` order: the 서훈식. */
export function holdHonours(
  _gw: GreatWar,
  _seat: GwSeatState,
  _uid: number,
  _give: readonly { at: number; honour: string }[],
): GwOrderBlock | null {
  return "no_card";
}

/** The `petition_answer` order. */
export function answerPetition(
  _gw: GreatWar,
  _seat: GwSeatState,
  _uid: number,
  _answer: GwPetitionAnswer,
): GwOrderBlock | null {
  return "no_card";
}
