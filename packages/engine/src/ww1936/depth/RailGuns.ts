// P6 lane W1 fills this file (plan Task 7): railway guns (spec §16.5).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** Centi-hits of railway guns for `side` in the battle at `region` this round. */
export function railGunHits(d: WwDepth, region: number, side: number): number {
  return 0;
}

/** The fort levels the army's railway guns cut at `region` (attacker). */
export function railGunFortCut(
  d: WwDepth,
  armyId: number,
  region: number,
): number {
  return 0;
}
