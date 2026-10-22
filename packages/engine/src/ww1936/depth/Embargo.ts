// P6 lane M (plan Task 4): embargoes (spec §7.3). The mode's one embargo
// list (pre-flight §A9): P1's partner judge, P5 lend-lease and the P5
// `embargo` effect read it; an embargo closes the two countries' P1 trade
// deals that day and ends their licences, requests and market deals.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { EMBARGO_PP } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { closeTrade } from "../economy/Trade";
import { payPp } from "../politics/PayPp";
import { endLicencesBetween } from "./Licences";
import { endDealsBetween } from "./Market";
import type { WwDepth } from "./WwDepth";

/** Spec §7.3: a democracy embargoes only a country that made at least 5% of the tension (bp). */
export const EMBARGO_DEMOCRACY_THREAT_BP = 500;

/** Spec §7.3: a democratic government needs the target's share of the tension. */
export function embargoTensionOk(d: WwDepth, by: number, on: number): boolean {
  const pol = d.ww.politics;
  if (pol.country(by)?.ruling !== IDEO_DEM) return true;
  return (pol.threatBp[on] ?? 0) >= EMBARGO_DEMOCRACY_THREAT_BP;
}

/** `by` has an embargo on `on` (one way). */
export function hasEmbargo(d: WwDepth, by: number, on: number): boolean {
  return d.market.embargoes.some(([a, b]) => a === by && b === on);
}

/** Why `id` may not embargo `target` now; null when it may (the cost aside). */
export function embargoBlock(
  d: WwDepth,
  id: number,
  target: number,
): WwOrderBlock | null {
  if (target === id || !(target > 0 && target < d.cap)) return "bad_target";
  if (d.country(target) === null || !d.ww.isActor(target)) return "bad_target";
  if (hasEmbargo(d, id, target)) return "embargoed";
  if (!embargoTensionOk(d, id, target)) return "tension_gate";
  return null;
}

/** embargo (EMBARGO_PP), embargo_lift (free). */
export function issueEmbargo(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  void tick;
  switch (o.kind) {
    case "embargo": {
      const block = embargoBlock(d, id, o.target);
      if (block !== null) return block;
      if (!payPp(d.ww.politics, id, EMBARGO_PP)) return "no_pp";
      d.ww.politics.markCountry(id);
      setEmbargo(d, id, o.target, true);
      return null;
    }
    case "embargo_lift":
      if (!hasEmbargo(d, id, o.target)) return "bad_target";
      setEmbargo(d, id, o.target, false);
      return null;
    default:
      return "bad_index";
  }
}

/** Spec §7.3: the two countries' P1 trade deals close (either way round). */
function closeTradesBetween(d: WwDepth, a: number, b: number): void {
  const econ = d.ww.economy;
  for (const tr of [...econ.trades()]) {
    if (
      !(
        (tr.buyer === a && tr.seller === b) ||
        (tr.buyer === b && tr.seller === a)
      )
    ) {
      continue;
    }
    const ce = econ.country(tr.buyer);
    if (ce !== null) closeTrade(econ, ce, tr.id);
  }
}

/**
 * The mode's one embargo list (pre-flight §A9): `by` embargoes `on`, or
 * lifts it. P5's embargo effects call it too. A new embargo closes the
 * pair's trade deals, licences, requests and market deals at once.
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
    closeTradesBetween(d, by, on);
    endLicencesBetween(d, by, on);
    endDealsBetween(d, by, on);
  } else {
    list.splice(i, 1);
  }
  d.markGlobal();
  d.markCountry(by);
  d.markCountry(on);
}
