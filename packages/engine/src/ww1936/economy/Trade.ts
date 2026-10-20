// World War 1936 P1: resource trade (spec §7.4, §7.5). The partner and room
// judgements are final (the pure parts in engine-lib EconomyChecks and
// EconomyRules.tradeRouteOk, shared with the screens); openTrade,
// closeTrade and validateTrades are STUBS that Task 4 fills, with final
// signatures.
import {
  WW_TRADE_UNITS_PER_CIV,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { exportRoomOf } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { tradeRouteOk } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { CountryEconomy, WwEconomy } from "./WwEconomy";

/**
 * Why `buyer` may not buy from `seller` now; null if it may (spec §7.4):
 * both living and uncapitulated, no embargo from the seller, and a route.
 */
export function tradePartnerBlock(
  econ: WwEconomy,
  buyer: number,
  seller: number,
): WwOrderBlock | null {
  if (buyer === seller) return "no_partner";
  const b = econ.mg.playerBySmallID(buyer);
  const s = econ.mg.playerBySmallID(seller);
  if (!b.isPlayer() || !s.isPlayer() || !b.isAlive() || !s.isAlive()) {
    return "no_partner";
  }
  if (econ.ww.isCapitulated(buyer) || econ.ww.isCapitulated(seller)) {
    return "no_partner";
  }
  if (econ.country(seller) === null || s.hasEmbargoAgainst(b)) {
    return "no_partner";
  }
  const ww = econ.ww;
  const ok = tradeRouteOk(
    {
      atWar: (x, y) => ww.isAtWar(x, y),
      sameFaction: (x, y) => ww.sameFaction(x, y),
      neighbours: (c) => econ.countryNeighbours(c),
      seaZones: (c) => econ.countrySeaZones(c),
    },
    buyer,
    seller,
  );
  return ok ? null : "no_partner";
}

/** The countries `buyer` may buy from now, by smallID. */
export function tradePartners(econ: WwEconomy, buyer: number): number[] {
  return econ
    .countries()
    .map((ce) => ce.smallID)
    .filter((id) => tradePartnerBlock(econ, buyer, id) === null);
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

export function openTrade(
  econ: WwEconomy,
  ce: CountryEconomy,
  seller: number,
  res: number,
  civs: number,
): WwOrderBlock | null {
  return "no_partner";
}

export function closeTrade(
  econ: WwEconomy,
  ce: CountryEconomy,
  tradeId: number,
): WwOrderBlock | null {
  return "bad_index";
}

/** The day's common check (spec §7.5): closes the trades that broke. */
export function validateTrades(econ: WwEconomy, tick: number): void {}
