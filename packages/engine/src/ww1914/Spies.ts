// STUB: owner S7c
// Great War 1914 (ww173 phase C1): the secret war. S7c owns this file; this
// stub keeps the signatures of /home/eser/dev/ww173-interfaces.md so S7a's
// raids can call it. At the merge, S7c's file wins.
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GreatWar } from "./GreatWar";

/** The latest strain report `viewer` holds on `of` there, or null. */
export function believedStrain(
  _gw: GreatWar,
  _viewer: GwTag,
  _theatre: GwTheatre,
  _of: GwTag,
): number | null {
  return null;
}

/** A won raid: a prisoner's report, and the raid term for spotting. */
export function wonRaid(
  _gw: GreatWar,
  _winner: GwTag,
  _theatre: GwTheatre,
): void {}

/** Orders found on a prisoner or in a taken trench. */
export function capturedOrders(
  _gw: GreatWar,
  _winner: GwTag,
  _theatre: GwTheatre,
): void {}
