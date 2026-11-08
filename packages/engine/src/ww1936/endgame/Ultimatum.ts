// World War 1936 diplomacy D5 (ww161 Design B §5; lane L4): the peacetime
// ultimatum — sending it, the target's card (give or refuse; a timeout is a
// refusal), its AI answer and the `diplomacy` auto switch, the guarantors'
// notice, and the AI's own ultimatums. Until L4 fills them an ultimatum is
// refused and nothing runs.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwEndgame } from "./WwEndgame";

/** ultimatum from `from` to `target` for `regions`. */
export function sendUltimatum(
  _eg: WwEndgame,
  _from: number,
  _target: number,
  _regions: readonly number[],
  _tick: number,
): WwOrderBlock | null {
  return "ultimatum_bad_regions";
}

/** deal_reply by `by` to pending ultimatum `offer` (accept: give the regions). */
export function replyUltimatum(
  _eg: WwEndgame,
  _by: number,
  _offer: number,
  _accept: boolean,
  _tick: number,
): WwOrderBlock | null {
  return "deal_no_offer";
}

/** Every tick (WwEndgame.tick): AI answers, human card deadlines (refused), the auto switch. */
export function stepUltimatums(_eg: WwEndgame, _tick: number): void {}

/** Daily for an AI country (staggered by smallID): its own ultimatums. */
export function aiUltimatumDay(
  _eg: WwEndgame,
  _id: number,
  _day: number,
  _tick: number,
): void {}
