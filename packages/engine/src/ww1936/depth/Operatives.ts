// P6 lane I fills this file (plan Task 5): operatives: recruiting, travel, missions, capture (spec §8.3–§8.4).
// The foundation's stub: final signatures, neutral answers.
import { capturePmMilli } from "@openfront/engine-lib/ww1936/IntelRules";
import type { Operative, WwDepth } from "./WwDepth";

export function dailyOperatives(d: WwDepth, id: number, day: number): void {}

/**
 * Review E6: an operative's capture risk today, ‰ (the screens' number).
 * The foundation's body: on a mission (state 2) or an operation (3) the
 * spec §8.4 base with no counter-intelligence known; lane I refines it
 * (the target's counter-intelligence, exile cores).
 */
export function operativeCapturePm(
  d: WwDepth,
  id: number,
  o: Operative,
): number {
  if (o.state !== 2 && o.state !== 3) return 0;
  return Math.floor(capturePmMilli(o.state === 3, o.skill, 0, false) / 1000);
}
