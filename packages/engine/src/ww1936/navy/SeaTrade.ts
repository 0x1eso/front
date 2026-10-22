// World War 1936 P4: sea trade (P4 spec §10.2, P1 §7.4 partner rule 3). Two
// countries are sea neighbours when both control a working naval base and
// a convoy's sea path joins their harbors (straits and canals included). A
// deal the land cannot carry (P1 rule 2) goes by sea, a faction's too: the
// buyer's convoys carry it and it arrives by their share of the need.
import { convoysForTrade } from "@openfront/engine-lib/ww1936/ConvoyRules";
import { tradeUnitsBought } from "@openfront/engine-lib/ww1936/EconomyRules";
import { landReachOf } from "../economy/Trade";
import {
  convoyPath,
  dropRoute,
  findRoute,
  freeConvoysOf,
  portZonesOf,
  putRoute,
  routesOf,
  srsOf,
  USE_TRADE,
} from "./Convoys";
import type { SeaRoute, WwNavy } from "./WwNavy";

/**
 * The convoy route a trade of `buyer` with `seller` would take now: from
 * the buyer's harbors to the nearest of the seller's (spec §10.2,
 * many-source Dijkstra). Not stored (id 0); null when either has no
 * working port or no convoy path joins them.
 */
export function tradeRoute(
  navy: WwNavy,
  buyer: number,
  seller: number,
): SeaRoute | null {
  const p = convoyPath(
    navy,
    buyer,
    portZonesOf(navy, buyer),
    portZonesOf(navy, seller),
  );
  if (p === null) return null;
  return {
    id: 0,
    use: USE_TRADE,
    owner: buyer,
    ref: 0,
    zones: [...p.zones],
    km: p.km,
    srs: srsOf(navy.scenario, p.zones),
    need: 0,
    got: 0,
    nextDay: 0,
  };
}

/**
 * Partner rule 3 for one buyer and many sellers: whether a convoy path
 * joins the buyer's harbors to a seller's (the same answer as
 * `tradeRoute(…) !== null`; one search of what the buyer's convoys reach).
 */
export function seaNeighbourJudge(
  navy: WwNavy,
  buyer: number,
): (seller: number) => boolean {
  const from = portZonesOf(navy, buyer);
  if (from.length === 0) return () => false;
  let reach: Set<number> | null = null;
  return (seller) => {
    const to = portZonesOf(navy, seller);
    if (to.length === 0) return false;
    reach ??= convoyReach(navy, buyer, from);
    return to.some((z) => reach!.has(z));
  };
}

/** The open-water zones `owner`'s convoys reach from `from` (BFS over passable edges). */
function convoyReach(
  navy: WwNavy,
  owner: number,
  from: readonly number[],
): Set<number> {
  const sc = navy.scenario;
  const naval = new Set(sc.navalZones());
  const pass = navy.passable(owner, false);
  const seen = new Set<number>();
  const q: number[] = [];
  for (const z of from) {
    if (naval.has(z) && !seen.has(z)) {
      seen.add(z);
      q.push(z);
    }
  }
  for (let i = 0; i < q.length; i++) {
    for (const { to, edge } of sc.seaEdgesOf(q[i])) {
      if (seen.has(to) || !naval.has(to) || !pass(edge)) continue;
      seen.add(to);
      q.push(to);
    }
  }
  return seen;
}

/** Units a day a trade carries (the buyer's, P3 tradeCostPct). */
function tradeUnits(navy: WwNavy, buyer: number, units: number): number {
  const ce = navy.econ.country(buyer);
  return ce === null ? 0 : tradeUnitsBought(units, ce.stats);
}

/** Spec §10.2: the convoys a trade route needs, ceil(units × km / 5000). */
export function tradeNeed(navy: WwNavy, r: SeaRoute): number {
  const tr = navy.econ.trades().find((t) => t.id === r.ref);
  if (tr === undefined) return 0;
  return convoysForTrade(tradeUnits(navy, tr.buyer, tr.units), r.km);
}

/**
 * The buyer's day (allocateConvoys): each of its deals the land does not
 * carry gets its sea route (found again; a cut one goes, and P1's day
 * check closes the deal when the sea was its only way); the land carries
 * the rest without convoys; closed deals' routes go.
 */
export function syncTradeRoutes(
  navy: WwNavy,
  buyer: number,
  day: number,
): void {
  const econ = navy.econ;
  let reach: ReadonlySet<number> | null = null;
  const live = new Set<number>();
  for (const tr of econ.trades()) {
    if (tr.buyer !== buyer) continue;
    live.add(tr.id);
    reach ??= landReachOf(econ, buyer);
    const route = findRoute(navy, USE_TRADE, buyer, tr.id);
    const p = reach.has(tr.seller)
      ? null
      : convoyPath(
          navy,
          buyer,
          portZonesOf(navy, buyer),
          portZonesOf(navy, tr.seller),
        );
    if (p === null) {
      if (route !== null) dropRoute(navy, route.id);
      continue;
    }
    putRoute(navy, USE_TRADE, buyer, tr.id, p, day);
  }
  for (const r of routesOf(navy, buyer)) {
    if (r.use === USE_TRADE && !live.has(r.ref)) dropRoute(navy, r.id);
  }
}

/**
 * A deal opened or grown now (P1 openTrade): a sea deal gets its route at
 * once and what free convoys it needs, so it delivers from the next
 * economy turn (the day's allocation re-sorts them by priority).
 */
export function openSeaTrade(navy: WwNavy, tradeId: number): void {
  const tr = navy.econ.trades().find((t) => t.id === tradeId);
  if (tr === undefined) return;
  if (landReachOf(navy.econ, tr.buyer).has(tr.seller)) return;
  const p = convoyPath(
    navy,
    tr.buyer,
    portZonesOf(navy, tr.buyer),
    portZonesOf(navy, tr.seller),
  );
  if (p === null) return;
  const day = navy.ww.day(navy.mg.ticks());
  const r = putRoute(navy, USE_TRADE, tr.buyer, tr.id, p, day);
  r.need = tradeNeed(navy, r);
  r.got = Math.min(r.need, r.got + freeConvoysOf(navy, tr.buyer));
}

/**
 * Spec §10.2: the units a sea deal delivers today — floor(units × got /
 * need) of its route (all of them when it needs none); 0 without a route
 * (the sea is cut). The land's deals do not come here (P1 Trade).
 */
export function seaTradeUnits(
  navy: WwNavy,
  buyer: number,
  tradeId: number,
  units: number,
): number {
  const r = findRoute(navy, USE_TRADE, buyer, tradeId);
  if (r === null) return 0;
  const need = convoysForTrade(units, r.km);
  if (need <= 0) return units;
  return Math.floor((units * Math.min(r.got, need)) / need);
}
