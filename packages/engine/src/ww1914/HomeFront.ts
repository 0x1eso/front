// STUB: owner S2
// ww190 §5: the home front (prisoners, hunger, women at work, refugees, the
// flu). The stub holds nothing and does nothing; S2's file replaces it.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";

export type GwHomeFrontCond = Extract<
  GwWorldCond,
  {
    is: "prisoners" | "hunger" | "women_work" | "refugees" | "flu";
  }
>;
export type GwHomeFrontEffect = Extract<
  GwWorldEffect,
  { do: "exchange" | "reprisal" }
>;

/** Men of `of` (anyone's, if absent) held by `by`, in thousands. */
export function prisonersHeld(_gw: GreatWar, _by: GwTag, _of?: GwTag): number {
  return 0;
}

export function addPrisoners(
  _gw: GreatWar,
  _by: GwTag,
  _of: GwTag,
  _n: number,
): void {}

export function exchange(_gw: GreatWar, _a: GwTag, _b: GwTag): void {}

export function reprisal(_gw: GreatWar, _a: GwTag, _b: GwTag): void {}

/** The aftermath sends them home (Aftermath.ts calls it). */
export function returnPrisoners(_gw: GreatWar): void {}

export function hungerOf(_gw: GreatWar, _tag: GwTag): number {
  return 0;
}

export function womenAtWork(_gw: GreatWar, _tag: GwTag): number {
  return 0;
}

export function refugeesOf(_gw: GreatWar, _tag: GwTag): number {
  return 0;
}

/** The flu's wave now, 0 none .. 3. */
export function fluWave(_gw: GreatWar): number {
  return 0;
}

export function homeFrontHolds(
  _gw: GreatWar,
  _seat: GwSeatState,
  _c: GwHomeFrontCond,
): boolean {
  return false;
}

export function homeFrontDo(
  _gw: GreatWar,
  _seat: GwSeatState,
  _e: GwHomeFrontEffect,
): void {}

export function homeFrontStep(_gw: GreatWar): void {}
