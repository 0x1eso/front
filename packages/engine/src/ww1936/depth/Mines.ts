// P6 lane W2 fills this file (plan Task 8): naval mines (spec §14.1).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** The sea region's day: laying, sweeping, decay, damage (after P4's convoy war). */
export function seaRegionDay(d: WwDepth, sr: number, day: number): void {}

/** Extra convoy losses from `side`'s enemies' mines in the region, ‰. */
export function minesConvoyLossPm(
  d: WwDepth,
  sr: number,
  side: number,
): number {
  return 0;
}

/** The landing strength cut from enemy mines, percent. */
export function minesInvasionCutPct(
  d: WwDepth,
  sr: number,
  side: number,
): number {
  return 0;
}
