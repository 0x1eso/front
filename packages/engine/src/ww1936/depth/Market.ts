// P6 lane M (plan Task 4): the arms market (spec §7.2) and the trade
// orders' routing. A listing takes its units out of the seller's stock
// (market_unlist gives them back). A purchase is a deal: for MARKET_DAYS
// the buyer hands the seller `civs` civilian factories (the foundation's
// civFlow counts the deal while paidMilli < priceMilli) and each day a
// 30th of the units leaves; it arrives MARKET_TRANSIT_DAYS later.
// deliveredMilli is the value arrived, so the units given so far are
// floor(count × deliveredMilli / priceMilli). P5 has no transport helper
// on this base (its lend-lease is a stub), so every delivery is that flat
// queue — no sea losses (reported).
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  MARKET_DAYS,
  WW_MAX_LISTINGS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { NON_TRANSFERABLE } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  marketBuyBlock,
  marketCivs,
  marketPriceMilli,
  marketYearsOld,
} from "@openfront/engine-lib/ww1936/MarketRules";
import { tradePartnerBlock } from "../economy/Trade";
import { receiveKey } from "./DesignCopy";
import { equipCostMilli } from "./Designs";
import { issueEmbargo } from "./Embargo";
import {
  dayLicences,
  designKindOf,
  endLicence,
  freeCivsOf,
  issueLicence,
  keyYear,
  lineNewestYear,
} from "./Licences";
import type { WwDepth } from "./WwDepth";

/** Spec §7.2 (P5 §13.3 by land): days from a day's shipment to its arrival. */
export const MARKET_TRANSIT_DAYS = 10;

type Listing = WwDepth["market"]["listings"][number];
type Deal = WwDepth["market"]["deals"][number];

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

/**
 * Spec §7.2: `count` units of a listing — the seller's unit cost × the
 * generation discount (years behind the newest of its line the seller
 * makes). Merge glue: WwDepth's market view should price listings with
 * this (it passes 0 years today).
 */
export function listingPriceMilli(
  d: WwDepth,
  l: Pick<Listing, "seller" | "key">,
  count: number,
): number {
  const old = marketYearsOld(
    keyYear(d, l.seller, l.key),
    lineNewestYear(d, l.seller, l.key),
  );
  return marketPriceMilli(equipCostMilli(d, l.seller, l.key), old, count);
}

/** Why `id` may not put `count` of `key` on the market; null when it may. */
export function marketListBlock(
  d: WwDepth,
  id: number,
  key: number,
  count: number,
): WwOrderBlock | null {
  const k = EQUIP_KEYS[key];
  if (k === undefined || !(count >= 1)) return "listing_bad";
  const [type, gen] = k;
  // Spec §7.2 / plan decision 20: no ships (not equipment keys), convoys,
  // bombs, rockets or harbours; spec §5.6: no captured design.
  if (NON_TRANSFERABLE.includes(type)) return "listing_bad";
  const kind = designKindOf(type);
  if (kind !== null) {
    const s = d.designSlot(id, kind, gen);
    if (s === null || s.origin === "captured") return "listing_bad";
  }
  const ce = d.ww.economy.country(id);
  if (ce === null || (ce.stock[key] ?? 0) < count) return "listing_bad";
  const mine = d.market.listings.filter((l) => l.seller === id);
  if (!mine.some((l) => l.key === key) && mine.length >= WW_MAX_LISTINGS) {
    return "listing_bad";
  }
  return null;
}

/** market_list: the units leave the stock into the listing (one listing a key). */
export function marketList(
  d: WwDepth,
  id: number,
  key: number,
  count: number,
): WwOrderBlock | null {
  const block = marketListBlock(d, id, key, count);
  if (block !== null) return block;
  const ce = d.ww.economy.country(id)!;
  ce.stock[key] -= count;
  const [type, gen] = EQUIP_KEYS[key];
  const kind = designKindOf(type);
  const def = kind === null ? null : (d.designSlot(id, kind, gen)?.def ?? null);
  // A copy: the seller may change its slot while the listing stands.
  const design =
    def === null ? null : (JSON.parse(JSON.stringify(def)) as typeof def);
  const same = d.market.listings.find((l) => l.seller === id && l.key === key);
  if (same !== undefined) {
    same.count += count;
    same.design = design;
  } else {
    d.market.listings.push({
      id: d.uid(),
      seller: id,
      key,
      design,
      count,
      reserved: 0,
    });
  }
  d.ww.economy.markCountryDirty(id);
  d.markGlobal();
  return null;
}

/** A listing's units go back to its seller's stock (lost when the seller has none). */
function dropListing(d: WwDepth, l: Listing): void {
  const i = d.market.listings.indexOf(l);
  if (i < 0) return;
  d.market.listings.splice(i, 1);
  const ce = d.ww.economy.country(l.seller);
  if (ce !== null) {
    ce.stock[l.key] += l.count;
    d.ww.economy.markCountryDirty(l.seller);
  }
  d.markGlobal();
}

/** Spec §7.2 market_buy: the deal starts (the payments and deliveries run on the common day). */
export function marketBuy(
  d: WwDepth,
  id: number,
  listingId: number,
  count: number,
  day: number,
): WwOrderBlock | null {
  const l = d.market.listings.find((x) => x.id === listingId);
  const seller = l?.seller ?? 0;
  const price = l === undefined ? 0 : listingPriceMilli(d, l, count);
  const civs = marketCivs(price);
  const block = marketBuyBlock({
    listingExists: l !== undefined,
    own: seller === id,
    count,
    available: l?.count ?? 0,
    atWar: d.ww.isAtWar(id, seller),
    embargoed: d.embargoed(id, seller),
    route:
      l !== undefined &&
      seller !== id &&
      tradePartnerBlock(d.ww.economy, id, seller) === null,
    freeCivs: l === undefined ? 0 : freeCivsOf(d, id),
    civs,
  });
  if (block !== null || l === undefined) return block ?? "listing_bad";
  l.count -= count;
  if (l.count === 0) {
    d.market.listings.splice(d.market.listings.indexOf(l), 1);
  }
  d.market.deals.push({
    id: d.uid(),
    buyer: id,
    seller,
    key: l.key,
    design: l.design,
    count,
    // At least a milli a unit: the units arrived are counted by value.
    priceMilli: Math.max(count, price),
    paidMilli: 0,
    deliveredMilli: 0,
    civs,
    startDay: day,
    endDay: day + MARKET_DAYS + MARKET_TRANSIT_DAYS,
  });
  saleNotice(d, d.market.deals[d.market.deals.length - 1]);
  d.markGlobal();
  d.markCountry(id);
  d.markCountry(seller);
  return null;
}

/** Spec §20.11: both sides hear of the sale and of its last delivery. */
function saleNotice(d: WwDepth, x: Deal): void {
  const p = {
    buyerTag: d.ww.tagOf(x.buyer),
    sellerTag: d.ww.tagOf(x.seller),
    count: x.count,
    item: EQUIP_KEYS[x.key]?.[0] ?? "",
  };
  d.message(x.buyer, "ww1936_market_sale", p);
  d.message(x.seller, "ww1936_market_sale", p);
}

/** market_list, market_unlist, market_buy. */
export function issueMarket(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  switch (o.kind) {
    case "market_list":
      return marketList(d, id, o.key, o.count);
    case "market_unlist": {
      const l = d.market.listings.find((x) => x.id === o.listing);
      if (l === undefined || l.seller !== id) return "listing_bad";
      dropListing(d, l);
      return null;
    }
    case "market_buy":
      return marketBuy(d, id, o.listing, o.count, d.ww.day(tick));
    default:
      return "listing_bad";
  }
}

/** The units of a deal given to the buyer so far. */
function unitsGiven(x: Deal): number {
  return x.priceMilli <= 0
    ? x.count
    : Math.floor((x.count * x.deliveredMilli) / x.priceMilli);
}

/**
 * A deal ends early (war, an embargo, a side gone): the payments stop,
 * the units not yet arrived go back to the seller.
 */
export function endDeal(d: WwDepth, x: Deal): void {
  const i = d.market.deals.indexOf(x);
  if (i < 0) return;
  d.market.deals.splice(i, 1);
  const left = x.count - unitsGiven(x);
  const ce = d.ww.economy.country(x.seller);
  if (left > 0 && ce !== null) {
    ce.stock[x.key] += left;
    d.ww.economy.markCountryDirty(x.seller);
  }
  d.markGlobal();
  d.markCountry(x.buyer);
  d.markCountry(x.seller);
}

/** Every deal between `a` and `b` ends (an embargo). */
export function endDealsBetween(d: WwDepth, a: number, b: number): void {
  for (const x of d.market.deals.filter(
    (y) =>
      (y.buyer === a && y.seller === b) || (y.buyer === b && y.seller === a),
  )) {
    endDeal(d, x);
  }
}

/** Spec §7.2: a day of a deal — its payment, and what arrives (the receiving key: lane E's receiveKey). */
function dealDay(d: WwDepth, x: Deal, day: number): void {
  const paidDays = Math.max(0, Math.min(MARKET_DAYS, day - x.startDay));
  const paid = Math.floor((x.priceMilli * paidDays) / MARKET_DAYS);
  const arrivedDays = Math.max(
    0,
    Math.min(MARKET_DAYS, day - x.startDay - MARKET_TRANSIT_DAYS),
  );
  const delivered = Math.floor((x.priceMilli * arrivedDays) / MARKET_DAYS);
  const before = unitsGiven(x);
  let changed = paid !== x.paidMilli;
  x.paidMilli = paid;
  if (delivered !== x.deliveredMilli) {
    x.deliveredMilli = delivered;
    changed = true;
    const n = unitsGiven(x) - before;
    if (n > 0) {
      const ce = d.ww.economy.country(x.buyer);
      const key = receiveKey(d, x.seller, x.key, x.buyer, "received");
      if (ce !== null && key >= 0) {
        ce.stock[key] += n;
        d.ww.economy.markCountryDirty(x.buyer);
      }
    }
  }
  if (x.deliveredMilli >= x.priceMilli) {
    d.market.deals.splice(d.market.deals.indexOf(x), 1);
    saleNotice(d, x);
    changed = true;
  }
  if (changed) {
    d.markGlobal();
    d.markCountry(x.buyer);
    d.markCountry(x.seller);
  }
}

/** The day's deals: payments, deliveries, licence cards timing out, the ends (spec §7.1–§7.2). */
export function dayCommonMarket(d: WwDepth, day: number, tick: number): void {
  dayLicences(d, day, tick);
  const m = d.market;
  if (m.listings.length > 0) {
    for (const l of [...m.listings]) {
      if (!d.ww.isActor(l.seller)) dropListing(d, l);
    }
  }
  if (m.deals.length > 0) {
    for (const x of [...m.deals]) {
      if (
        !d.ww.isActor(x.buyer) ||
        !d.ww.isActor(x.seller) ||
        d.ww.isAtWar(x.buyer, x.seller) ||
        d.embargoed(x.buyer, x.seller)
      ) {
        endDeal(d, x);
      } else {
        dealDay(d, x, day);
      }
    }
  }
  settleCivs(d);
}

/**
 * P1 spec §7.5's rule for trade deals, for the market and licences: a
 * country that can no longer hand over the factories it owes (lost
 * factories, a new law) ends its newest market deal, then its newest
 * licence with a fee, until it can.
 */
function settleCivs(d: WwDepth): void {
  const m = d.market;
  if (m.deals.length === 0 && m.licences.length === 0) return;
  const payers = new Set<number>();
  for (const x of m.deals) if (x.paidMilli < x.priceMilli) payers.add(x.buyer);
  for (const l of m.licences) {
    if (!d.ww.sameFaction(l.from, l.to)) payers.add(l.to);
  }
  for (const id of [...payers].sort((a, b) => a - b)) {
    for (let guard = 0; guard < 64 && freeCivsOf(d, id) < 0; guard++) {
      const deal = [...m.deals]
        .reverse()
        .find((x) => x.buyer === id && x.paidMilli < x.priceMilli);
      if (deal !== undefined) {
        endDeal(d, deal);
        continue;
      }
      const lic = [...m.licences]
        .reverse()
        .find((l) => l.to === id && !d.ww.sameFaction(l.from, l.to));
      if (lic === undefined) break;
      endLicence(d, lic);
    }
  }
}
