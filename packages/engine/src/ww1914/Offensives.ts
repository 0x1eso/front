// STUB: owner S7b
import type { GwTheatre } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GreatWar } from "./GreatWar";

export interface GwOffensiveView {
  tag: GwTag;
  theatre: GwTheatre;
  from: number;
  launch: number | null;
  method: "long" | "broad" | "surprise";
  feint: boolean;
  quiet: boolean;
  round: number;
}

/** Those in preparation or running, sorted by tag. */
export function offensivesOf(_gw: GreatWar): readonly GwOffensiveView[] {
  return [];
}

/** The design's L: long 50 + 25 a chapter, broad 30, surprise 15, quiet -15; a feint 40. */
export function loudnessOf(_gw: GreatWar, _o: GwOffensiveView): number {
  return 0;
}

/** Adds `by` to `seenBy` and sends the defender's counterplay scene. */
export function markSeen(
  _gw: GreatWar,
  _o: GwOffensiveView,
  _by: GwTag,
): void {}

export function seenBy(_gw: GreatWar, _o: GwOffensiveView): readonly GwTag[] {
  return [];
}
