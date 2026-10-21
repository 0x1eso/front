// World War 1936 P1: resource trade (spec §7.4, §7.5). The pure parts of
// the room judgements live in engine-lib (EconomyChecks) and are shared
// with the screens. P4 (spec §10.2): partner rule 3 is a sea route between
// working naval bases (navy/SeaTrade), and a deal the land does not carry
// goes by the buyer's convoys.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import {
  RESOURCE_COUNT,
  RESOURCE_IDS,
  WW_TRADE_UNITS_PER_CIV,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  exportRoomOf,
  openTradeBlockOf,
  payableCivs,
} from "@openfront/engine-lib/ww1936/EconomyChecks";
import { exportCapacity } from "@openfront/engine-lib/ww1936/EconomyRules";
import {
  openSeaTrade,
  seaNeighbourJudge,
  seaTradeUnits,
} from "../navy/SeaTrade";
import type { CountryEconomy, Trade, WwEconomy } from "./WwEconomy";

/**
 * Why `buyer` may not buy from `seller` now; null if it may (spec §7.4):
 * both living and uncapitulated, no embargo from the seller, and a route
 * (partnerJudge's answer).
 */
export function tradePartnerBlock(
  econ: WwEconomy,
  buyer: number,
  seller: number,
): WwOrderBlock | null {
  return partnerJudge(econ, buyer)(seller);
}

/**
 * Partner rule 2's land search from `buyer`: the neighbours of the buyer
 * and of every country reached through a country at peace with the buyer.
 * A seller in it trades by land (P4 spec §10.2: no convoys).
 */
export function landReachOf(econ: WwEconomy, buyer: number): Set<number> {
  const seen = new Set<number>([buyer]);
  const queue = [buyer];
  for (let i = 0; i < queue.length; i++) {
    for (const n of econ.countryNeighbours(queue[i])) {
      if (seen.has(n)) continue;
      seen.add(n);
      if (!econ.ww.isAtWar(buyer, n)) queue.push(n);
    }
  }
  seen.delete(buyer);
  return seen;
}

/**
 * The partner rules for one buyer and many sellers (spec §7.4): a way for
 * the goods — land through countries at peace (2) or, P4 spec §10.2, a sea
 * route between working naval bases (3). A faction (1) carries nothing by
 * itself any more: "같은 진영이라도 육로가 없으면 해로다", and a deal with
 * neither way closes (P1 §7.5) rather than bill its factories for nothing
 * (P4 lane C review). The buyer's land reach and its convoys' reach are
 * each searched once, on the first seller that needs it (pre-flight D13).
 */
export function partnerJudge(
  econ: WwEconomy,
  buyer: number,
): (seller: number) => WwOrderBlock | null {
  const ww = econ.ww;
  const b = econ.mg.playerBySmallID(buyer);
  if (!b.isPlayer() || !ww.isActor(buyer)) {
    return () => "no_partner";
  }
  const buyerPlayer = b;
  let reach: Set<number> | null = null;
  let sea: ((seller: number) => boolean) | null = null;
  return (seller) => {
    if (seller === buyer) return "no_partner";
    const s = econ.mg.playerBySmallID(seller);
    if (!s.isPlayer() || !ww.isActor(seller)) {
      return "no_partner";
    }
    if (econ.country(seller) === null || s.hasEmbargoAgainst(buyerPlayer)) {
      return "no_partner";
    }
    if (ww.isAtWar(buyer, seller)) return "no_partner";
    reach ??= landReachOf(econ, buyer);
    if (reach.has(seller)) return null;
    sea ??= seaNeighbourJudge(ww.navy, buyer);
    return sea(seller) ? null : "no_partner";
  };
}

/**
 * What `buyer`'s deals deliver today (refreshTotals): a deal the land
 * carries all its units; any other its sea route's share (P4 spec §10.2:
 * floor(units × got / need); 0 while the sea is cut).
 */
export function tradeDelivery(
  econ: WwEconomy,
  buyer: number,
): (tr: Trade, units: number) => number {
  let reach: Set<number> | null = null;
  return (tr, units) => {
    reach ??= landReachOf(econ, buyer);
    if (reach.has(tr.seller)) return units;
    return seaTradeUnits(econ.ww.navy, buyer, tr.id, units);
  };
}

/** The countries `buyer` may buy from now, by smallID. */
export function tradePartners(econ: WwEconomy, buyer: number): number[] {
  const judge = partnerJudge(econ, buyer);
  return econ
    .countries()
    .map((ce) => ce.smallID)
    .filter((id) => judge(id) === null);
}

/**
 * Units a day of resource `res` (RESOURCE_IDS index) `seller` still sells:
 * its export share of the last day's output less its open deals (negative
 * when it sells more than it may, spec §7.5).
 */
export function exportRoom(
  econ: WwEconomy,
  seller: number,
  res: number,
): number {
  const ce = econ.country(seller);
  if (ce === null) return 0;
  let sold = 0;
  for (const t of econ.trades()) {
    if (t.seller === seller && t.res === res) {
      sold += t.civs * WW_TRADE_UNITS_PER_CIV;
    }
  }
  return exportRoomOf(ce.totals.produced[res], ce.law().exportPct, sold);
}

/**
 * The civilian factories a deal costs its buyer a day: its `civs`, times
 * P5's percent (spec §9.1: a dominion pays half; rounded up).
 */
export function tradePaidCivs(econ: WwEconomy, tr: Trade): number {
  // P5 hook (S).
  const pct = econ.ww.endgame.tradeCivFactorPct(tr.buyer, tr.seller);
  return pct === 100 ? tr.civs : Math.ceil((tr.civs * pct) / 100);
}

/**
 * Spec §7.4: `ce` buys `civs × 8` units a day of `res` from `seller` and
 * pays `civs` civilian factories. A deal with the same seller and resource
 * grows instead of opening a second one (the same checks apply).
 */
export function openTrade(
  econ: WwEconomy,
  ce: CountryEconomy,
  seller: number,
  res: number,
  civs: number,
): WwOrderBlock | null {
  if (!(res >= 0 && res < RESOURCE_COUNT)) return "bad_index";
  if (!Number.isInteger(civs) || civs < 1) return "no_civs";
  const buyer = ce.smallID;
  let buyerTrades = 0;
  let paidCivs = 0;
  let same: Trade | null = null;
  for (const tr of econ.trades()) {
    if (tr.buyer !== buyer) continue;
    buyerTrades++;
    paidCivs += tradePaidCivs(econ, tr);
    if (tr.seller === seller && tr.res === res) same = tr;
  }
  const block = openTradeBlockOf({
    partnerOk: tradePartnerBlock(econ, buyer, seller) === null,
    buyerTrades,
    grows: same !== null,
    civs,
    room: exportRoom(econ, seller, res),
    payable: payableCivs(ce.totals.civ, ce.totals.cgMilli),
    paidCivs,
  });
  if (block !== null) return block;
  let tr: Trade;
  if (same === null) {
    tr = econ.addTrade(buyer, seller, res, civs);
  } else {
    tr = same;
    same.civs += civs;
    econ.markCountryDirty(buyer);
    econ.markCountryDirty(seller);
  }
  // P4 spec §10.2: a sea deal's route and convoys at once.
  openSeaTrade(econ.ww.navy, tr.id);
  return null;
}

/** The buyer ends one of its deals. */
export function closeTrade(
  econ: WwEconomy,
  ce: CountryEconomy,
  tradeId: number,
): WwOrderBlock | null {
  const tr = econ.trades().find((t) => t.id === tradeId);
  if (tr === undefined || tr.buyer !== ce.smallID) return "bad_index";
  econ.removeTrade(tradeId);
  return null;
}

/** Closes a deal the day's check broke; a human buyer is told. */
function closeBroken(econ: WwEconomy, tr: Trade): void {
  econ.removeTrade(tr.id);
  const b = econ.mg.playerBySmallID(tr.buyer);
  if (!b.isPlayer() || !econ.ww.isHumanControlled(tr.buyer)) return;
  econ.mg.displayMessage(
    "events_display.ww1936_trade_closed",
    MessageType.WORLD_WAR,
    b.id(),
    undefined,
    { sellerTag: econ.ww.tagOf(tr.seller), resource: RESOURCE_IDS[tr.res] },
  );
}

/** Groups trades in id order by `key`, each group in id order. */
function groupBy(
  trades: readonly Trade[],
  key: (t: Trade) => number,
): Trade[][] {
  const groups = new Map<number, Trade[]>();
  for (const tr of trades) {
    const k = key(tr);
    const g = groups.get(k);
    if (g === undefined) groups.set(k, [tr]);
    else g.push(tr);
  }
  return [...groups.values()];
}

/**
 * The day's common check (spec §7.5), in deal-number order: deals whose
 * partners broke (war, embargo, a cut route, capitulation, death) close;
 * then, newest first, deals past the seller's export room for that
 * resource, and deals past the civilian factories the buyer can pay.
 * The trade list is kept in id order (addTrade appends rising ids).
 */
export function validateTrades(econ: WwEconomy, tick: number): void {
  const judges = new Map<number, (seller: number) => WwOrderBlock | null>();
  for (const tr of [...econ.trades()]) {
    let judge = judges.get(tr.buyer);
    if (judge === undefined) {
      judge = partnerJudge(econ, tr.buyer);
      judges.set(tr.buyer, judge);
    }
    if (judge(tr.seller) !== null) closeBroken(econ, tr);
  }

  const bySeller = groupBy(
    econ.trades(),
    (t) => t.seller * RESOURCE_COUNT + t.res,
  );
  for (const deals of bySeller) {
    const { seller, res } = deals[0];
    const s = econ.country(seller);
    const cap =
      s === null
        ? 0
        : exportCapacity(s.totals.produced[res], s.law().exportPct);
    let sold = 0;
    for (const tr of deals) sold += tr.civs * WW_TRADE_UNITS_PER_CIV;
    for (let i = deals.length - 1; i >= 0 && sold > cap; i--) {
      sold -= deals[i].civs * WW_TRADE_UNITS_PER_CIV;
      closeBroken(econ, deals[i]);
    }
  }

  const byBuyer = groupBy(econ.trades(), (t) => t.buyer);
  for (const deals of byBuyer) {
    const b = econ.country(deals[0].buyer);
    const payable =
      b === null ? 0 : payableCivs(b.totals.civ, b.totals.cgMilli);
    let paid = 0;
    for (const tr of deals) paid += tradePaidCivs(econ, tr);
    for (let i = deals.length - 1; i >= 0 && paid > payable; i--) {
      paid -= tradePaidCivs(econ, deals[i]);
      closeBroken(econ, deals[i]);
    }
  }
}
