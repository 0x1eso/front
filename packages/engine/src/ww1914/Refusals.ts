// STUB: owner S2
// ww190 §4: refusals in an army, the command's answer, the President's
// review. The stub holds nothing and does nothing; S2's file replaces it.
import type {
  GwRefusal,
  GwRefusalAnswer,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";

export type GwRefusalsCond = Extract<GwWorldCond, { is: "refusals" }>;
export type GwRefusalsEffect = Extract<
  GwWorldEffect,
  { do: "refusals" | "pardon" }
>;

export function refusalsOf(_gw: GreatWar, _tag: GwTag): GwRefusal | null {
  return null;
}

export function answerRefusals(
  _gw: GreatWar,
  _tag: GwTag,
  _a: GwRefusalAnswer,
): void {}

export function pardon(_gw: GreatWar, _tag: GwTag, _many: boolean): void {}

/** The rest the command granted blocks new great offensives (Offensives.ts). */
export function restBlocks(_gw: GreatWar, _tag: GwTag): boolean {
  return false;
}

export function refusalsHolds(
  _gw: GreatWar,
  _seat: GwSeatState,
  _c: GwRefusalsCond,
): boolean {
  return false;
}

export function refusalsDo(
  _gw: GreatWar,
  _seat: GwSeatState,
  _e: GwRefusalsEffect,
): void {}

export function refusalsStep(_gw: GreatWar): void {}
