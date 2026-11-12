// STUB: owner S1
// ww190 §1: the peace years. Arms (derived from the budget), bonds between
// allies, accords between rivals. The stub holds nothing and does nothing; S1's
// file replaces it at the merge.
import type {
  GwAccord,
  GwAccordKind,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";

export type GwYearsCond = Extract<
  GwWorldCond,
  {
    is:
      | "arming"
      | "arms_race"
      | "bond"
      | "accord"
      | "accord_offered"
      | "courted"
      | "mediating";
  }
>;
export type GwYearsEffect = Extract<
  GwWorldEffect,
  {
    do:
      | "arms"
      | "bond"
      | "accord"
      | "accord_answer"
      | "break_accord"
      | "mediate";
  }
>;

/** Rivals in arms, and the line they race on. */
export const GW_ARMS_RIVALS: readonly (readonly [
  GwTag,
  GwTag,
  "army" | "navy",
])[] = [
  ["DEU", "GBR", "navy"],
  ["DEU", "FRA", "army"],
  ["DEU", "RUS", "army"],
  ["AUH", "RUS", "army"],
  ["AUH", "ITA", "navy"],
];

/** How far `tag` arms past its June 1914 budget, 0..3. */
export function armsLevel(_gw: GreatWar, _tag: GwTag): number {
  return 0;
}

/** The bond between two countries, -3..3; null if the pair has none. */
export function bondOf(_gw: GreatWar, _a: GwTag, _b: GwTag): number | null {
  return null;
}

export function moveBond(
  _gw: GreatWar,
  _a: GwTag,
  _b: GwTag,
  _d: number,
): void {}

export function accordsOf(_gw: GreatWar, _tag: GwTag): readonly GwAccord[] {
  return [];
}

export function offerAccord(
  _gw: GreatWar,
  _from: GwTag,
  _kind: GwAccordKind,
  _to: GwTag,
): void {}

export function answerAccord(
  _gw: GreatWar,
  _seat: GwSeatState,
  _yes: boolean,
): void {}

export function breakAccord(
  _gw: GreatWar,
  _tag: GwTag,
  _kind: GwAccordKind,
  _other?: GwTag,
): void {}

export function mediate(_gw: GreatWar, _seat: GwSeatState): void {}

export function yearsHolds(
  _gw: GreatWar,
  _seat: GwSeatState,
  _c: GwYearsCond,
): boolean {
  return false;
}

export function yearsDo(
  _gw: GreatWar,
  _seat: GwSeatState,
  _e: GwYearsEffect,
): void {}

export function peaceYearsStep(_gw: GreatWar): void {}
