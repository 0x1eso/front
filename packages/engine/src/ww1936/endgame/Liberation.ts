// World War 1936 P5 lane X (plan Task 5 Step 5; spec §5.3): the day's
// common step gives land an ally (anyone at peace with its legal owner)
// holds back to that owner — when it still plays (active, or a government
// in exile) and the region is no occupation zone. HOI4's liberated land.
import { transferRegionPeaceful } from "../land/PoliticsBridge";
import { landRegained } from "./Activate";
import type { WwEndgame } from "./WwEndgame";

/**
 * Spec §5.3, in region order: controller X ≠ legal owner L, X and L not at
 * war, L an actor, not a zone → control (its victory-point tile this tick)
 * back to L, which holds land again (landRegained). A gone L that is no
 * exile gets nothing back (its conference decides).
 */
export function returnLiberated(
  eg: WwEndgame,
  day: number,
  tick: number,
): void {
  void day;
  const ww = eg.ww;
  const ctl = ww.land.controller;
  const legal = ww.politics.legalOwner;
  const back = new Set<number>();
  for (const r of ww.scenario.landRegions) {
    const c = ctl[r.id] ?? 0;
    const owner = legal[r.id] ?? 0;
    if (c === 0 || owner === 0 || c === owner) continue;
    if (ww.isAtWar(c, owner) || !eg.isActor(owner) || eg.isZone(r.id)) {
      continue;
    }
    transferRegionPeaceful(ww.land, r.id, owner, tick);
    back.add(owner);
  }
  for (const id of [...back].sort((a, b) => a - b)) {
    landRegained(eg, id, tick);
  }
}
