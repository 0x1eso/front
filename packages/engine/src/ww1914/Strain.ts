// STUB: owner S7a
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GreatWar } from "./GreatWar";

/** 0..100 at the end where `tag` fights; 0 if it doesn't fight there. */
export function strainOf(
  _gw: GreatWar,
  _theatre: GwTheatre,
  _tag: GwTag,
): number {
  return 0;
}

/** Clamped 0..100; does nothing if `tag` doesn't fight there. */
export function addStrain(
  _gw: GreatWar,
  _theatre: GwTheatre,
  _tag: GwTag,
  _delta: number,
): void {}

export function collapsedThisChapter(
  _gw: GreatWar,
  _theatre: GwTheatre,
): GwTag | null {
  return null;
}
