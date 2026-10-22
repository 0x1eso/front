// World War 1936 P4: overseas supply (P4 spec §10.3, §11.5). A sea hub is a
// working naval base of a side that no railway joins to the side's
// capitals (P2's rail net: a joined port gets land supply); its controller
// ships the supply from its rail-joined ports with convoys. Capacity =
// min(4 + 2 × level, convoys × 500 / km) × the route's efficiency (the
// worst of 1000 − enemy supremacy / 2 over its sea regions). A beachhead
// (lane I's table) is the same with 6 for the base for 30 days.
import {
  WW_BEACHHEAD_CAPACITY_MILLI,
  WW_SUPPLY_CONVOY_KM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  convoysForSupply,
  routeEffPm,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { effectiveLevel } from "../economy/Buildings";
import { capitalRegion } from "../land/LandStartRun";
import {
  convoyPath,
  dropRoute,
  portRegionsOf,
  putRoute,
  routesOf,
  USE_SUPPLY,
} from "./Convoys";
import { navalPort } from "./Ports";
import type { SeaRoute, WwNavy } from "./WwNavy";

// ---- Derived (a restored game builds the same) ----

/**
 * What the map decides of a side's supply: kept while its stamp holds (the
 * controllers, the sides, the buildings and the beachheads), so it is
 * built a few times a day at most, not on every country's turn (Task 15's
 * perf pass). Only the boot demand reads the day's supply and is summed
 * again each tick.
 */
interface SideNet {
  stamp: string;
  /** Regions a railway joins to a member's capital (P2 Supply.hubsOf's net). */
  railNet: Set<number>;
  /** Hub region → base capacity milli: the side's sea hubs and beachheads, region order. */
  hubs: Map<number, number>;
  /** The side's regions the hubs reach over land, BFS order, and each one's nearest hub. */
  reached: number[];
  nearest: number[];
}

interface SideSupply {
  /** The net's stamp it was summed on (a change within the tick sums again). */
  stamp: string;
  railNet: Set<number>;
  hubs: Map<number, number>;
  /**
   * Hub → use, milli, of the side's regions short of supply whose nearest
   * hub (by land edges over the side's regions) it is: the demand of a hub
   * that carries nothing yet (yesterday's use of a hub with no capacity is
   * 0; HOI4 ships to where the divisions stand).
   */
  boot: Map<number, number>;
}

interface SupplyMemo {
  nets: Map<number, SideNet>;
  tick: number;
  sides: Map<number, SideSupply>;
  routeStamp: string;
  /** Hub region → its supply routes (by id). */
  routes: Map<number, SeaRoute[]>;
}

const memos = new WeakMap<WwNavy, SupplyMemo>();

function memoOf(navy: WwNavy): SupplyMemo {
  let m = memos.get(navy);
  if (m === undefined) {
    m = {
      nets: new Map(),
      tick: -1,
      sides: new Map(),
      routeStamp: "",
      routes: new Map(),
    };
    memos.set(navy, m);
  }
  return m;
}

/**
 * Everything buildSideNet reads: the controllers (and the capitals they
 * move), the factions (sides), the railway and naval-base levels and their
 * damage, and the side's beachheads that count today.
 */
function netStamp(navy: WwNavy, side: number): string {
  const land = navy.land;
  const econ = navy.econ;
  let s = `${land.controlChanges}|${land.derivedEpoch}|${econ.portVer}|${econ.railPortVer}`;
  if (navy.beachhead.size > 0) {
    const day = navy.ww.day(navy.mg.ticks());
    for (const [r, b] of navy.beachhead) {
      if (b.side === side) s += `|${r}:${b.until >= day ? 1 : 0}`;
    }
  }
  return s;
}

/** The side's rail net, hubs and their bootstrap demand (the demand summed once a tick). */
function sideSupply(navy: WwNavy, side: number): SideSupply {
  const land = navy.land;
  const m = memoOf(navy);
  const tick = navy.mg.ticks();
  if (m.tick !== tick) {
    m.tick = tick;
    m.sides = new Map();
  }
  const stamp = netStamp(navy, side);
  let s = m.sides.get(side);
  if (s !== undefined && s.stamp === stamp) return s;
  let net = m.nets.get(side);
  if (net === undefined || net.stamp !== stamp) {
    net = buildSideNet(navy, side, stamp);
    m.nets.set(side, net);
  }
  const boot = new Map<number, number>();
  for (let i = 0; i < net.reached.length; i++) {
    const r = net.reached[i];
    const use = land.useMilli[r] ?? 0;
    if (use <= 0 || (land.supplyMilli[r] ?? 0) >= use) continue;
    const h = net.nearest[i];
    boot.set(h, (boot.get(h) ?? 0) + use);
  }
  s = { stamp, railNet: net.railNet, hubs: net.hubs, boot };
  m.sides.set(side, s);
  return s;
}

/** The base capacity milli of a working port (4 + 2 × level) or of a beachhead (6); 0 for neither. */
function baseMilli(navy: WwNavy, region: number, side: number): number {
  if (navalPort(navy.ww, region)) {
    return (4 + 2 * effectiveLevel(navy.econ, region, "naval_base")) * 1000;
  }
  const b = navy.beachhead.get(region);
  return b !== undefined &&
    b.side === side &&
    b.until >= navy.ww.day(navy.mg.ticks())
    ? WW_BEACHHEAD_CAPACITY_MILLI
    : 0;
}

function buildSideNet(navy: WwNavy, side: number, stamp: string): SideNet {
  const land = navy.land;
  const sc = navy.scenario;
  const ctl = land.controller;
  const members = land.sideMembers(side);
  // A member's region (sideOf: members are the countries of the side).
  const ours = (r: number): boolean => {
    const c = ctl[r] ?? 0;
    return c !== 0 && land.sideOf(c) === side;
  };
  // P2 Supply.hubsOf: the rail net from the members' capitals.
  const rail = navy.econ.rail;
  const railNet = new Set<number>();
  const q: number[] = [];
  for (const m of members) {
    const c = capitalRegion(land, m);
    if (c === 0 || railNet.has(c)) continue;
    railNet.add(c);
    q.push(c);
  }
  for (let i = 0; i < q.length; i++) {
    const u = q[i];
    if ((rail[u] ?? 0) < 1) continue;
    for (const e of sc.edgesOf(u)) {
      if (!railNet.has(e.to) && ours(e.to) && (rail[e.to] ?? 0) >= 1) {
        railNet.add(e.to);
        q.push(e.to);
      }
    }
  }
  // The members' working ports off the rail net, and the side's beachheads.
  const found: number[] = [];
  for (const m of members) {
    for (const p of portRegionsOf(navy, m)) if (!railNet.has(p)) found.push(p);
  }
  for (const [r, b] of navy.beachhead) {
    if (b.side !== side || !ours(r) || navalPort(navy.ww, r)) continue;
    const z = sc.harborOf(r);
    if (z !== 0 && sc.zoneSr(z) !== 0) found.push(r);
  }
  found.sort((a, b) => a - b);
  const hubs = new Map<number, number>();
  for (const r of found) {
    const base = baseMilli(navy, r, side);
    if (base > 0) hubs.set(r, base);
  }
  // Each of the side's regions to its nearest hub (BFS from every hub at
  // once, hubs in region order: ties go to the smaller hub); sideSupply
  // sums the ones short of supply.
  const reached: number[] = [];
  const nearest: number[] = [];
  if (hubs.size > 0) {
    const owner = new Map<number, number>();
    for (const h of hubs.keys()) {
      owner.set(h, h);
      reached.push(h);
      nearest.push(h);
    }
    for (let i = 0; i < reached.length; i++) {
      const h = nearest[i];
      for (const e of sc.edgesOf(reached[i])) {
        if (owner.has(e.to) || !ours(e.to)) continue;
        owner.set(e.to, h);
        reached.push(e.to);
        nearest.push(h);
      }
    }
  }
  return { stamp, railNet, hubs, reached, nearest };
}

/** The supply route of `owner` to hub `region` (an index of the supply routes, rebuilt when routes come or go). */
function supplyRouteOf(
  navy: WwNavy,
  owner: number,
  region: number,
): SeaRoute | null {
  const m = memoOf(navy);
  const stamp = `${navy.mg.ticks()}|${navy.nextRouteId}|${navy.routes.size}`;
  const find = (): SeaRoute | null =>
    m.routes.get(region)?.find((r) => r.owner === owner) ?? null;
  let r = m.routeStamp === stamp ? find() : null;
  if (r !== null && navy.routes.get(r.id) === r && r.use === USE_SUPPLY) {
    return r;
  }
  if (m.routeStamp !== stamp || r !== null) {
    m.routeStamp = stamp;
    m.routes = new Map();
    for (const x of navy.routes.values()) {
      if (x.use !== USE_SUPPLY) continue;
      const l = m.routes.get(x.ref);
      if (l === undefined) m.routes.set(x.ref, [x]);
      else l.push(x);
    }
    r = find();
  }
  return r;
}

// ---- Capacity and need ----

/** Whether some member of side `a` is at war (and fighting) with some member of side `b`. */
export function hostileSides(navy: WwNavy, a: number, b: number): boolean {
  if (a === b) return false;
  const land = navy.land;
  for (const x of land.sideMembers(a)) {
    for (const y of land.sideMembers(b)) if (land.isEnemy(x, y)) return true;
  }
  return false;
}

/**
 * The enemy supremacy ‰ against `side` in sea region `sr` (its last day):
 * the sides at war with it, summed (> 0 exactly when an enemy has power
 * there, spec §8.5).
 */
export function enemySupPm(navy: WwNavy, side: number, sr: number): number {
  const i = navy.scenario.srIdxOf(sr);
  if (i < 0) return 0;
  let e = 0;
  for (const [k, v] of navy.srState[i].sup) {
    if (k !== side && hostileSides(navy, side, k)) e += v;
  }
  return Math.min(1000, e);
}

/** Spec §10.3: the enemy supremacy ‰ in each of `srs` against `side`. */
export function enemySupremacies(
  navy: WwNavy,
  side: number,
  srs: readonly number[],
): number[] {
  return srs.map((sr) => enemySupPm(navy, side, sr));
}

/** Today's supply demand of a hub, milli: yesterday's use it fed, or the use short of supply nearest it. */
export function supplyDemandMilli(
  navy: WwNavy,
  side: number,
  hub: number,
): number {
  return Math.max(
    navy.land.seaHubUse[hub] ?? 0,
    sideSupply(navy, side).boot.get(hub) ?? 0,
  );
}

/**
 * The sea-hub capacity of a region for `side`, milli a day (P2's daily
 * supply asks it for every working port of the side; a change re-runs
 * that hub): a sea hub's min(4 + 2 × level, convoys × 500 / km) × route
 * efficiency; a beachhead's (no working port, lane I's table) the same
 * with 6 for the base — lane I's beachheadCapacityMilli computes the same.
 * 0 without a supply route: a port the rail joins to a capital has land
 * supply (not P2's old HUB_SEA value) and gets none (its controller's day
 * judges that: syncSupplyRoutes).
 */
export function seaHubCapacityMilli(
  navy: WwNavy,
  region: number,
  side: number,
): number {
  const land = navy.land;
  const c = land.controller[region] ?? 0;
  if (c === 0 || land.sideOf(c) !== side) return 0;
  const r = supplyRouteOf(navy, c, region);
  if (r === null) return 0;
  const base = baseMilli(navy, region, side);
  if (base === 0) return 0;
  const eff = routeEffPm(enemySupremacies(navy, side, r.srs));
  // ConvoyRules.seaHubCapacity's (and lane I's beachhead's) arithmetic.
  const byConvoys = Math.floor(
    (r.got * WW_SUPPLY_CONVOY_KM * 1000) / Math.max(1, r.km),
  );
  return Math.floor((Math.min(base, byConvoys) * eff) / 1000);
}

/**
 * Spec §10.3: a supply route's need, ceil(min(demand, base) × km / 500),
 * at least one convoy while there is a demand (a hub sharing its harbor
 * with the port it is shipped from: 0 km).
 */
export function supplyNeed(navy: WwNavy, r: SeaRoute): number {
  const side = navy.land.sideOf(r.owner);
  const base = sideSupply(navy, side).hubs.get(r.ref) ?? 0;
  if (base === 0) return 0;
  const demand = supplyDemandMilli(navy, side, r.ref);
  if (demand <= 0) return 0;
  return Math.max(1, convoysForSupply(Math.min(demand, base), r.km));
}

/**
 * The controller's day (allocateConvoys): a supply route for each of its
 * sea hubs and beachheads with a demand, from the nearest of its
 * rail-joined ports (spec §10.3: the shortest route); a hub with none, a
 * cut route or no hub any more loses its route (capacity 0).
 */
export function syncSupplyRoutes(
  navy: WwNavy,
  owner: number,
  day: number,
): void {
  const land = navy.land;
  const sc = navy.scenario;
  // A hub of ours is a port or a beachhead we control: with neither there
  // is nothing to ship to (Task 15's perf pass: the side's net unbuilt).
  if (
    portRegionsOf(navy, owner).length === 0 &&
    ![...navy.beachhead.keys()].some((r) => land.controller[r] === owner)
  ) {
    for (const r of routesOf(navy, owner)) {
      if (r.use === USE_SUPPLY) dropRoute(navy, r.id);
    }
    return;
  }
  const side = land.sideOf(owner);
  const ss = sideSupply(navy, side);
  const sources: number[] = [];
  for (const p of portRegionsOf(navy, owner)) {
    if (!ss.railNet.has(p)) continue;
    const z = sc.harborOf(p);
    if (!sources.includes(z)) sources.push(z);
  }
  sources.sort((a, b) => a - b);
  const live = new Set<number>();
  for (const hub of ss.hubs.keys()) {
    if (land.controller[hub] !== owner) continue;
    if (supplyDemandMilli(navy, side, hub) <= 0) continue;
    const p = convoyPath(navy, owner, sources, [sc.harborOf(hub)]);
    if (p === null) continue;
    putRoute(navy, USE_SUPPLY, owner, hub, p, day);
    live.add(hub);
  }
  for (const r of routesOf(navy, owner)) {
    if (r.use === USE_SUPPLY && !live.has(r.ref)) dropRoute(navy, r.id);
  }
}
