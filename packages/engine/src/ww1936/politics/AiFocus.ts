// World War 1936 P3: the AI's focus choice (spec §18.4, §18.5). STUB: lane F
// (Task 2) writes the bodies; the signatures are final.
import type { FocusId } from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function aiPickFocus(
  pol: WwPolitics,
  id: number,
  day: number,
): FocusId | null {
  return null;
}

/** Spec §18.2 beat "focus": put it first in line for an AI that has not done it. */
export function forceFocusNext(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): void {}
