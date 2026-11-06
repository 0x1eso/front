// World War 1936 P1: resource trade (spec §7.4, §7.5). The pure parts of
// the room judgements live in engine-lib (EconomyChecks) and are shared
// with the screens. P4 (spec §10.2): partner rule 3 is a sea route between
// working naval bases (navy/SeaTrade), and a deal the land does not carry
// goes by the buyer's convoys.
import { MessageType } from "@openfront/engine-api/game/GameTypes";
import {
  RESOURCE_COUNT,
  RESOURCE_IDS,
  WW_TRADE_PAUSE_DAYS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  dealCivsOf,
  dealUnitsOf,
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
export function landReachOf(
  econ: WwEconomy,
  buyer: number,
): ReadonlySet<number> {
  // Task 15's perf pass: kept until the country graph or a war changes
  // (every country's deals, its convoys and its partners ask each day).
  const stamp = `${econ.graphVer}|${econ.ww.warVer}`;
  let memo = reachMemos.get(econ);
  if (memo === undefined || memo.stamp !== stamp) {
    memo = { stamp, reach: new Map() };
    reachMemos.set(econ, memo);
  }
  let out = memo.reach.get(buyer);
  if (out === undefined) {
    out = landReachNow(econ, buyer);
    memo.reach.set(buyer, out);
  }
  return out;
}

/** Derived: landReachOf by buyer, while (graph version, war version) holds. */
const reachMemos = new WeakMap<
  WwEconomy,
  { stamp: string; reach: Map<number, ReadonlySet<number>> }
>();

function landReachNow(econ: WwEconomy, buyer: number): Set<number> {
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
 * neither way stops (ww115 T13) rather than bill its factories for nothing
 * (P4 lane C review). The buyer's land reach and its convoys' reach are
 * each searched once, on the first seller that needs it (pre-flight D13).
 */
export function partnerJudge(
  econ: WwEconomy,
  buyer: number,
): (seller: number) => WwOrderBlock | null {
  const breakOf = partnerBreakJudge(econ, buyer);
  return (seller) => (breakOf(seller) === null ? null : "no_partner");
}

/**
 * ww115 T13: partnerJudge's reasons. "partner": the two may not deal at all
 * (one gone, an embargo, a war between them); "route": they may, but no land
 * or sea way joins them today.
 */
function partnerBreakJudge(
  econ: WwEconomy,
  buyer: number,
): (seller: number) => "partner" | "route" | null {
  const ww = econ.ww;
  const b = econ.mg.playerBySmallID(buyer);
  if (!b.isPlayer() || !ww.isActor(buyer)) {
    return () => "partner";
  }
  const buyerPlayer = b;
  let reach: ReadonlySet<number> | null = null;
  let sea: ((seller: number) => boolean) | null = null;
  return (seller) => {
    if (seller === buyer) return "partner";
    const s = econ.mg.playerBySmallID(seller);
    if (!s.isPlayer() || !ww.isActor(seller)) {
      return "partner";
    }
    if (econ.country(seller) === null || s.hasEmbargoAgainst(buyerPlayer)) {
      return "partner";
    }
    // P6 hook (M, pre-flight §A9): the mode's embargo list.
    if (ww.depth.embargoed(buyer, seller)) return "partner";
    if (ww.isAtWar(buyer, seller)) return "partner";
    reach ??= landReachOf(econ, buyer);
    if (reach.has(seller)) return null;
    sea ??= seaNeighbourJudge(ww.navy, buyer);
    return sea(seller) ? null : "route";
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
  let reach: ReadonlySet<number> | null = null;
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
    if (t.seller === seller && t.res === res) sold += t.units;
  }
  return exportRoomOf(ce.totals.produced[res], ce.law().exportPct, sold);
}

/**
 * The civilian factories a deal costs its buyer a day: its `civs`, times
 * P5's percent (spec §9.1: a dominion pays half; rounded up); nothing while
 * it is paused (ww115 T13).
 */
export function tradePaidCivs(econ: WwEconomy, tr: Trade): number {
  if (tr.pausedDay !== undefined) return 0;
  // P5 hook (S).
  const pct = econ.ww.endgame.tradeCivFactorPct(tr.buyer, tr.seller);
  return pct === 100 ? tr.civs : Math.ceil((tr.civs * pct) / 100);
}

/**
 * Spec §7.4: `ce` buys `civs × 8` units a day of `res` from `seller` and
 * pays `civs` civilian factories. A deal with the same seller and resource
 * grows instead of opening a second one (the same checks apply). P4 Task
 * 15 (HOI4): the last factory buys what is left of the seller's room, so
 * the deal moves dealUnitsOf(civs, room) and costs dealCivsOf(units).
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
  const room = exportRoom(econ, seller, res);
  const block = openTradeBlockOf({
    partnerOk: tradePartnerBlock(econ, buyer, seller) === null,
    buyerTrades,
    grows: same !== null,
    civs,
    room,
    payable: payableCivs(ce.totals.civ, ce.totals.cgMilli),
    paidCivs,
  });
  if (block !== null) return block;
  const units = dealUnitsOf(civs, room);
  let tr: Trade;
  if (same === null) {
    tr = econ.addTrade(buyer, seller, res, dealCivsOf(units), units);
  } else {
    tr = same;
    same.units += units;
    same.civs = dealCivsOf(same.units);
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

/**
 * ww115 T13: a deal whose route is cut stops, moving nothing and paying
 * nothing; a human buyer is told once, the day it stops. ww120 T4: the same
 * for a deal whose seller has nothing left to sell.
 */
function pauseDeal(
  econ: WwEconomy,
  tr: Trade,
  day: number,
  notice:
    | "events_display.ww1936_trade_paused"
    | "events_display.ww1936_trade_paused_output",
): void {
  tr.pausedDay = day;
  delete tr.gotPm;
  econ.markCountryDirty(tr.buyer);
  econ.markCountryDirty(tr.seller);
  const b = econ.mg.playerBySmallID(tr.buyer);
  if (!b.isPlayer() || !econ.ww.isHumanControlled(tr.buyer)) return;
  econ.mg.displayMessage(
    notice,
    MessageType.WORLD_WAR,
    b.id(),
    undefined,
    {
      sellerTag: econ.ww.tagOf(tr.seller),
      resource: RESOURCE_IDS[tr.res],
      days: WW_TRADE_PAUSE_DAYS,
    },
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
 * partners broke (war, embargo, capitulation, death) close; ww115 T13: a
 * deal whose route is cut pauses and closes after WW_TRADE_PAUSE_DAYS
 * without one. Then, newest first, deals past the seller's export room for
 * that resource give up the excess (P4 Task 15: a deal shrinks to what is
 * left and pays dealCivsOf of it; ww120 T4: one with nothing left pauses).
 * Oldest first, a paused deal with its route back runs again once the room
 * holds all of it, and closes when the wait runs out. A buyer short of
 * factories closes nothing: its deals move what it pays for (payPm).
 * The trade list is kept in id order (addTrade appends rising ids).
 */
export function validateTrades(econ: WwEconomy, tick: number): void {
  const day = econ.ww.day(tick);
  const judges = new Map<
    number,
    (seller: number) => "partner" | "route" | null
  >();
  const cut = new Set<number>();
  for (const tr of [...econ.trades()]) {
    let judge = judges.get(tr.buyer);
    if (judge === undefined) {
      judge = partnerBreakJudge(econ, tr.buyer);
      judges.set(tr.buyer, judge);
    }
    const broken = judge(tr.seller);
    if (broken === "partner") {
      closeBroken(econ, tr);
    } else if (broken === "route") {
      cut.add(tr.id);
      if (tr.pausedDay === undefined) {
        pauseDeal(econ, tr, day, "events_display.ww1936_trade_paused");
      } else if (day - tr.pausedDay >= WW_TRADE_PAUSE_DAYS) {
        closeBroken(econ, tr);
      }
    }
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
    // Paused with its route back: it holds no room until it runs again.
    const waiting = deals.filter(
      (t) => t.pausedDay !== undefined && !cut.has(t.id),
    );
    let sold = 0;
    for (const tr of deals) if (!waiting.includes(tr)) sold += tr.units;
    for (let i = deals.length - 1; i >= 0 && sold > cap; i--) {
      const tr = deals[i];
      if (waiting.includes(tr)) continue;
      const excess = sold - cap;
      if (tr.units <= excess) {
        sold -= tr.units;
        if (tr.pausedDay === undefined) {
          pauseDeal(econ, tr, day, "events_display.ww1936_trade_paused_output");
        }
        continue;
      }
      tr.units -= excess;
      tr.civs = dealCivsOf(tr.units);
      sold = cap;
      econ.markCountryDirty(tr.buyer);
      econ.markCountryDirty(seller);
    }
    for (const tr of waiting) {
      if (sold + tr.units <= cap) {
        sold += tr.units;
        delete tr.pausedDay;
        econ.markCountryDirty(tr.buyer);
        econ.markCountryDirty(seller);
      } else if (day - tr.pausedDay! >= WW_TRADE_PAUSE_DAYS) {
        closeBroken(econ, tr);
      }
    }
  }
}
