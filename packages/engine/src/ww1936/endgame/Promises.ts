// World War 1936 diplomacy D4 (ww161 Design B §4; lane L3): promised land.
// The deal items promise and join_war (checked, valued and applied here,
// called from Deals.ts), the conference's pre-assignment (Conference.ts),
// lapsing when the war ends otherwise (Wars.ts / WhitePeace.ts), and the AI
// side leader's offers to neutrals. Until L3 fills them the items are
// refused and nothing runs.
import type { DealItem } from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwEndgame } from "./WwEndgame";

type PromiseItem = Extract<DealItem, { kind: "promise" | "join_war" }>;

/** Why `giver` may not give `item` to `taker` today (null: it may). */
export function promiseItemBlock(
  _eg: WwEndgame,
  _giver: number,
  _taker: number,
  _item: PromiseItem,
  _day: number,
): WwOrderBlock | null {
  return "promise_bad_target";
}

/**
 * The AI's value points of `item` (`giver` gives it, `taker` gets it) for
 * `judge`, the country judging the deal (the giver or the taker; L2 added
 * the parameter): positive is good for the judge, DiploRules.WW_DEAL_VETO
 * never.
 */
export function promiseItemValue(
  _eg: WwEndgame,
  _giver: number,
  _taker: number,
  _item: PromiseItem,
  _judge: number,
): number {
  return 0;
}

/** An accepted deal's promise or join_war item takes effect (`deal`: the deal's id, the promise's id). */
export function applyPromiseItem(
  _eg: WwEndgame,
  _giver: number,
  _taker: number,
  _item: PromiseItem,
  _deal: number,
  _tick: number,
): void {}

/** Daily for an AI country (staggered by smallID): a side leader's promises to neutrals. */
export function aiPromiseDay(
  _eg: WwEndgame,
  _id: number,
  _day: number,
  _tick: number,
): void {}
