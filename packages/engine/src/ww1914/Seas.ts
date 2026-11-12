// STUB: owner S2
// ww190 §9: who holds a sea, derived from state. The stub holds nothing;
// S2's file replaces it at the merge.
import type {
  GwSeaZone,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GreatWar } from "./GreatWar";

export type GwSeaCond = Extract<GwWorldCond, { is: "sea_hold" }>;

/** The side that holds a sea; null if neither. */
export function seaHold(_gw: GreatWar, _sea: GwSeaZone): GwSide | null {
  return null;
}

export function seaHolds(
  _gw: GreatWar,
  _seat: GwSeatState,
  _c: GwSeaCond,
): boolean {
  return false;
}
