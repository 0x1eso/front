// World War 1936 diplomacy D1 (ww161 Design B §1; lane L1): separate peace
// with any enemy member. The target rule itself lives in WhitePeace.ts
// (peaceOfferBlock, offerStands); this file holds what is new: "come home
// as my subject" to an exile, and the AI side leader's offers to minors.
// L0 wired both into WwEndgame; until L1 fills them they refuse / do nothing.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwEndgame } from "./WwEndgame";

/** peace_offer with home: `from` offers exile `target` to come home as its neutral collaborator. */
export function offerHome(
  _eg: WwEndgame,
  _from: number,
  _war: number,
  _target: number,
  _tick: number,
): WwOrderBlock | null {
  return "home_not_exile";
}

/** Daily for an AI country (staggered by smallID): a winning side leader's separate peace offers. */
export function aiSeparatePeaceDay(
  _eg: WwEndgame,
  _id: number,
  _day: number,
  _tick: number,
): void {}
