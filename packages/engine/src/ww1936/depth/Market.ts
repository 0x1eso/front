// P6 lane M fills this file (plan Task 4): the arms market (spec §7.2) and the trade orders' routing.
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { issueEmbargo } from "./Embargo";
import { issueLicence } from "./Licences";
import type { WwDepth } from "./WwDepth";

/** The eight licence, market and embargo orders (the foundation routes them). */
export function issueTrade(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "licence_request":
    case "licence_answer":
    case "licence_cancel":
      return issueLicence(d, id, o, tick);
    case "embargo":
    case "embargo_lift":
      return issueEmbargo(d, id, o, tick);
    default:
      return issueMarket(d, id, o, tick);
  }
}

/** market_list, market_unlist, market_buy. */
export function issueMarket(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "listing_bad";
}

/** The day's deals: payments, deliveries, licence cards timing out. */
export function dayCommonMarket(d: WwDepth, day: number, tick: number): void {}
