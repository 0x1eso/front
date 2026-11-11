// STUB: owner S7c
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GreatWar } from "./GreatWar";

/** The latest strain report the viewer holds, or null if none. */
export function believedStrain(
  _gw: GreatWar,
  _viewer: GwTag,
  _theatre: GwTheatre,
  _of: GwTag,
): number | null {
  return null;
}

/** After a won raid: a prisoner's report, and the raid term for spotting. */
export function wonRaid(
  _gw: GreatWar,
  _winner: GwTag,
  _theatre: GwTheatre,
): void {}

/** Papers taken in a won raid or a breakthrough. */
export function capturedOrders(
  _gw: GreatWar,
  _winner: GwTag,
  _theatre: GwTheatre,
): void {}
