// P6 lane W1 fills this file (plan Task 7): dams and floods (spec §16.4).
// The foundation's stub: final signatures, neutral answers.
import type { WwDepth } from "./WwDepth";

/** A dam is destroyed: level 0 (W1 adds the flood and the world flag `<damId>_destroyed`). */
export function destroyDam(
  d: WwDepth,
  dam: number,
  by: number,
  tick: number,
): void {
  if (d.world.damLevel[dam] === undefined || d.world.damLevel[dam] === 0)
    return;
  d.world.damLevel[dam] = 0;
  d.markGlobal();
}
