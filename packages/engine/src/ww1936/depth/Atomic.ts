// P6 lane S fills this file (plan Task 6): the atomic bomb: drops, interception, effects (spec §9.4–§9.6).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** The day's drops over the zone (after W2's air day). */
export function processNukeQueue(
  d: WwDepth,
  zone: number,
  day: number,
  tick: number,
): void {}

export function applyNuke(
  d: WwDepth,
  owner: number,
  region: number,
  tick: number,
): void {}

/** Bombs that hit the country: its surrender line's cut, percentage points. */
export function nukeCutPp(d: WwDepth, id: number): number {
  return 0;
}
