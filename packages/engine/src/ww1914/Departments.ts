// Great War 1914 (ww193): departments at work. Stub: the format commit.
import type {
  GwOffice,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GreatWar } from "./GreatWar";

export function giveTask(
  _gw: GreatWar,
  _seat: GwSeatState,
  _office: GwOffice,
  _row: string,
  _topic: string | null,
): GwOrderBlock | null {
  return "no_dept";
}

export function briefDept(
  _gw: GreatWar,
  _seat: GwSeatState,
  _office: GwOffice,
): GwOrderBlock | null {
  return "no_dept";
}

export function passOn(
  _gw: GreatWar,
  _seat: GwSeatState,
  _uid: number,
  _office: GwOffice,
): GwOrderBlock | null {
  return "no_card";
}

export function shelvePaper(
  _gw: GreatWar,
  _seat: GwSeatState,
  _uid: number,
): GwOrderBlock | null {
  return "no_card";
}

export function giveGift(
  _gw: GreatWar,
  _seat: GwSeatState,
  _row: string,
  _person: string,
): GwOrderBlock | null {
  return "no_gift";
}

export function turnAway(
  _gw: GreatWar,
  _seat: GwSeatState,
  _person: string,
): GwOrderBlock | null {
  return "no_person";
}
