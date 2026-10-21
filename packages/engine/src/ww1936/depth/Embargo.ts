// P6 lane M fills this file (plan Task 4): embargoes (spec §7.3).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwDepth } from "./WwDepth";

/** embargo, embargo_lift. */
export function issueEmbargo(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "no_pp";
}

/**
 * The mode's one embargo list (pre-flight §A9): `by` embargoes `on`, or
 * lifts it. The foundation's body (P5's embargo effects call it).
 */
export function setEmbargo(
  d: WwDepth,
  by: number,
  on: number,
  active: boolean,
): void {
  const list = d.market.embargoes;
  const i = list.findIndex(([a, b]) => a === by && b === on);
  if (active === i >= 0) return;
  if (active) {
    list.push([by, on]);
    list.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  } else {
    list.splice(i, 1);
  }
  d.markGlobal();
}
