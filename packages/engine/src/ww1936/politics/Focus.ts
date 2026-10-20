// World War 1936 P3: national focus (spec §11). STUB: lane F (Task 2)
// writes the bodies; the signatures are final.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  FocusId,
  WwFocusCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { WwPolitics } from "./WwPolitics";

export function startFocus(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
  tick: number,
): WwOrderBlock | null {
  return "focus_unavailable";
}

export function queueFocus(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): WwOrderBlock | null {
  return "focus_unavailable";
}

export function cancelFocus(pol: WwPolitics, id: number): WwOrderBlock | null {
  return "focus_none";
}

export function unqueueFocus(pol: WwPolitics, id: number): WwOrderBlock | null {
  return "focus_none";
}

/** Spec §11.2: the day's progress, bypass, cancelIf, completion, the queued one. */
export function stepFocus(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {}

/** Why `focus` cannot start now for `id` (shared by orders, the AI and the cards); null if it can. */
export function focusBlock(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
  asQueued: boolean,
): WwOrderBlock | null {
  return "focus_unavailable";
}

export function focusCards(pol: WwPolitics, id: number): WwFocusCard[] {
  return [];
}

/** Days a focus takes with the country's focusSpeedPct, milli. */
export function focusDaysMilli(
  pol: WwPolitics,
  id: number,
  focus: FocusId,
): number {
  return 0;
}
