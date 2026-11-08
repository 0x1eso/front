// World War 1936 diplomacy D3 (ww161 Design B §3; lane L2): the deal table —
// an offer's life (send, AI answer, card deadline, accept, lapse), its items
// (DealItemSchema; promise and join_war are Promises.ts's), the AI's value
// points and its few offers, the ally-to-ally transfer, and the `diplomacy`
// auto switch for deals. L0 wired these into WwEndgame; until L2 fills them
// an offer is refused and nothing runs.
import type { DiploOrder } from "@openfront/engine-api/Schemas";
import type { WwDealJudgeRow } from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwEndgame } from "./WwEndgame";

/** deal_offer from `from`. */
export function offerDeal(
  _eg: WwEndgame,
  _from: number,
  _order: Extract<DiploOrder, { kind: "deal_offer" }>,
  _tick: number,
): WwOrderBlock | null {
  return "deal_bad_item";
}

/** deal_reply by `by` to pending deal `offer` (WwEndgame.issue routes an ultimatum's id to Ultimatum.ts). */
export function replyDeal(
  _eg: WwEndgame,
  _by: number,
  _offer: number,
  _accept: boolean,
  _tick: number,
): WwOrderBlock | null {
  return "deal_no_offer";
}

/** Every tick (WwEndgame.tick): AI answers, human card deadlines (refused), the auto switch. */
export function stepDeals(_eg: WwEndgame, _tick: number): void {}

/** Daily for an AI country (staggered by smallID): its own offers. */
export function aiDealDay(
  _eg: WwEndgame,
  _id: number,
  _day: number,
  _tick: number,
): void {}

/** The composer's hint rows for the human countries (takeData; null: unchanged). */
export function dealJudgeData(
  _eg: WwEndgame,
  _first: boolean,
): WwDealJudgeRow[] | null {
  return null;
}
