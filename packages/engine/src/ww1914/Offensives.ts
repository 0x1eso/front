// STUB: owner S7b
// Great War 1914 (ww173 phase B): the great offensive. S7b owns this file;
// this stub keeps the signatures of /home/eser/dev/ww173-interfaces.md. At
// the merge, S7b's file wins.
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

/** Offensives in preparation or running, sorted by tag. */
export function offensivesOf(_gw: GreatWar): readonly GwOffensiveView[] {
  return [];
}

/** How loud a preparation is (the design's L). */
export function loudnessOf(_gw: GreatWar, _o: GwOffensiveView): number {
  return 0;
}

/** `by` has seen it: the defender's counterplay scene comes. */
export function markSeen(
  _gw: GreatWar,
  _o: GwOffensiveView,
  _by: GwTag,
): void {}

export function seenBy(_gw: GreatWar, _o: GwOffensiveView): readonly GwTag[] {
  return [];
}
