// P6 lane I fills this file (plan Task 5): the intelligence levels of every country pair and domain (spec §8.8).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** Writes the observer's row of intelLevels. Stub: all 100 (no fog: P5's screens). */
export function computeIntelRow(
  d: WwDepth,
  observer: number,
  day: number,
): void {
  const row = d.intelRow(observer);
  let changed = false;
  for (let i = 0; i < row.length; i++) {
    if (row[i] !== 100) {
      row[i] = 100;
      changed = true;
    }
  }
  if (changed) d.markIntel(observer);
}
