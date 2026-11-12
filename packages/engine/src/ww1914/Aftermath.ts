// STUB: owner S1
// ww190 §10-11: the chapters after the conference, and a seat that plays on
// after its own peace. The stub holds nothing and does nothing; S1's file
// replaces it at the merge.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";

export type GwAfterCond = Extract<
  GwWorldCond,
  { is: "ratified" | "after_months" | "demob" | "left_war" }
>;
export type GwAfterEffect = Extract<
  GwWorldEffect,
  { do: "ratify" | "demob" | "play_on" }
>;

/** Chapters of the aftermath, after the table's sessions. */
export const GW_AFTER_CHAPTERS = 3;

/** Whole months since the table signed; null before. */
export function afterMonths(_gw: GreatWar): number | null {
  return null;
}

export function ratify(_gw: GreatWar, _tag: GwTag, _yes: boolean): void {}

/** 0 hold, 1 by classes, 2 all at once. */
export function demobOf(_gw: GreatWar, _tag: GwTag): number {
  return 0;
}

export function playOn(_gw: GreatWar, _seat: GwSeatState, _on: boolean): void {}

/** The seat's country left by its own peace and the seat plays on. */
export function playingOn(_seat: GwSeatState): boolean {
  return false;
}

export function afterHolds(
  _gw: GreatWar,
  _seat: GwSeatState,
  _c: GwAfterCond,
): boolean {
  return false;
}

export function afterDo(
  _gw: GreatWar,
  _seat: GwSeatState,
  _e: GwAfterEffect,
): void {}

export function aftermathStep(_gw: GreatWar): void {}
