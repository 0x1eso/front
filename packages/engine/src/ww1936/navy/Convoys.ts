// World War 1936 P4: convoy routes and their allocation (P4 spec §10.1,
// plan decisions 20–21). A route belongs to who pays its convoys: the buyer
// of a trade, the controller of an overseas supply hub, the owner of a
// voyage. Its path is the convoys' seaPath (warship = false) between the
// harbor zones of its ports. The stock `convoy` is the whole number:
// free = stock − Σ voyages' bound − Σ routes' got (derived, never stored).
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  CONVOY_USE_PRIORITY,
  CONVOY_USES,
  type ConvoyUse,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { seaPath } from "@openfront/engine-lib/ww1936/SeaGraph";
import { dailyConvoyNotices } from "./ConvoyWar";
import { navalPort } from "./Ports";
import { supplyNeed, syncSupplyRoutes } from "./SeaSupply";
import { syncTradeRoutes, tradeNeed } from "./SeaTrade";
import type { SeaRoute, WwNavy } from "./WwNavy";

export const USE_VOYAGE = CONVOY_USES.indexOf("voyage");
export const USE_SUPPLY = CONVOY_USES.indexOf("supply");
export const USE_TRADE = CONVOY_USES.indexOf("trade");
/** Spec §10.2: a route is found again every 7 days (and whenever its world changes). */
export const ROUTE_RECHECK_DAYS = 7;

/** A convoy path: the zones in order and the km. */
export interface ConvoyPath {
  zones: number[];
  km: number;
}

// ---- Derived memos (never state: a restored game builds the same) ----

interface ConvoyMemo {
  /** warVer, the preparation minute, the controllers of every strait shore. */
  pathStamp: string;
  paths: Map<string, ConvoyPath | null>;
  /** controlChanges and portVer. */
  portStamp: string;
  /** The ports by owner as text: a change of them starts the path memo over too. */
  portSig: string;
  portZones: Map<number, number[]>;
  portRegions: Map<number, number[]>;
  shores: number[];
}

const memos = new WeakMap<WwNavy, ConvoyMemo>();

function memoOf(navy: WwNavy): ConvoyMemo {
  let m = memos.get(navy);
  if (m === undefined) {
    m = {
      pathStamp: "",
      paths: new Map(),
      portStamp: "",
      portSig: "",
      portZones: new Map(),
      portRegions: new Map(),
      shores: shoreRegions(navy.scenario),
    };
    memos.set(navy, m);
  }
  return m;
}

/** Every strait and canal shore region, ascending (what a convoy's passability reads). */
function shoreRegions(sc: ScenarioIndex): number[] {
  const out = new Set<number>();
  for (let i = 0; i < sc.seaEdgeCount(); i++) {
    for (const r of sc.straitOf(i)?.shore ?? []) out.add(r);
  }
  return [...out].sort((a, b) => a - b);
}

/** Paths kept at most (a cache: dropping it changes no result). */
const PATH_MEMO_MAX = 4096;

/**
 * The convoys' seaPath from any of `from` to the nearest of `to` (zones
 * ascending), memoised. A convoy's edgePassable reads only the strait
 * shores' controllers and who is at war (the Montreux rule is the
 * warships'), so the memo starts over when one of those changes
 * (pre-flight T5: the day a war closes a canal, the route changes). The
 * keys are port harbors: it also starts over when the ports change hands
 * or stop working (portMemo), and past PATH_MEMO_MAX entries.
 */
export function convoyPath(
  navy: WwNavy,
  owner: number,
  from: readonly number[],
  to: readonly number[],
): ConvoyPath | null {
  if (from.length === 0 || to.length === 0) return null;
  const m = memoOf(navy);
  const ww = navy.ww;
  const ctl = navy.land.controller;
  let stamp = `${ww.warVer}|${ww.inPrep(navy.mg.ticks()) ? 1 : 0}`;
  for (const r of m.shores) stamp += `,${ctl[r] ?? 0}`;
  if (stamp !== m.pathStamp) {
    m.pathStamp = stamp;
    m.paths.clear();
  }
  const key = `${owner}|${from.join(",")}|${to.join(",")}`;
  const hit = m.paths.get(key);
  if (hit !== undefined) return hit;
  const p = seaPath(navy.scenario, from, to, navy.passable(owner, false));
  const v = p === null ? null : { zones: p.zones, km: p.km };
  if (m.paths.size >= PATH_MEMO_MAX) m.paths.clear();
  m.paths.set(key, v);
  return v;
}

/** The sea regions of a path's zones, each once, in path order (spec §10.2). */
export function srsOf(sc: ScenarioIndex, zones: readonly number[]): number[] {
  const out: number[] = [];
  for (const z of zones) {
    const s = sc.zoneSr(z);
    if (s !== 0 && !out.includes(s)) out.push(s);
  }
  return out;
}

function portMemo(navy: WwNavy): ConvoyMemo {
  const m = memoOf(navy);
  const stamp = `${navy.land.controlChanges}|${navy.econ.portVer}`;
  if (stamp !== m.portStamp) {
    m.portStamp = stamp;
    m.portZones = new Map();
    m.portRegions = new Map();
    const ctl = navy.land.controller;
    const sc = navy.scenario;
    for (const r of sc.landRegions) {
      const c = ctl[r.id] ?? 0;
      if (c === 0 || !navalPort(navy.ww, r.id)) continue;
      const z = sc.harborOf(r.id);
      if (z === 0 || sc.zoneSr(z) === 0) continue;
      let regs = m.portRegions.get(c);
      if (regs === undefined) m.portRegions.set(c, (regs = []));
      regs.push(r.id);
      let zones = m.portZones.get(c);
      if (zones === undefined) m.portZones.set(c, (zones = []));
      if (!zones.includes(z)) zones.push(z);
    }
    for (const l of m.portRegions.values()) l.sort((a, b) => a - b);
    for (const l of m.portZones.values()) l.sort((a, b) => a - b);
    // Bounded growth (lane C review): new ports, new path keys.
    let sig = "";
    for (const [c, l] of [...m.portRegions].sort((a, b) => a[0] - b[0])) {
      sig += `${c}:${l.join(",")};`;
    }
    if (sig !== m.portSig) {
      m.portSig = sig;
      m.paths.clear();
    }
  }
  return m;
}

/** The harbor zones of the working naval bases `owner` controls now, ascending (lakes left out). */
export function portZonesOf(navy: WwNavy, owner: number): readonly number[] {
  return portMemo(navy).portZones.get(owner) ?? NONE;
}

/** The working naval bases on open water `owner` controls now, ascending. */
export function portRegionsOf(navy: WwNavy, owner: number): readonly number[] {
  return portMemo(navy).portRegions.get(owner) ?? NONE;
}

const NONE: readonly number[] = [];

// ---- Routes ----

/** The live route of (use, owner, ref), or null (routes are few: a scan). */
export function findRoute(
  navy: WwNavy,
  use: number,
  owner: number,
  ref: number,
): SeaRoute | null {
  for (const r of navy.routes.values()) {
    if (r.use === use && r.ref === ref && r.owner === owner) return r;
  }
  return null;
}

/**
 * The sea route of (use, owner, ref) — ref is the trade id, the hub region
 * or the voyage id (lane I's invasions read their voyage's) — or null.
 */
export function routeFor(
  navy: WwNavy,
  use: ConvoyUse,
  owner: number,
  ref: number,
): SeaRoute | null {
  return findRoute(navy, CONVOY_USES.indexOf(use), owner, ref);
}

/**
 * Creates the route of (use, owner, ref) on `path`, or moves the live one
 * onto it (its convoys stay). Its weekly search date moves on when due.
 */
export function putRoute(
  navy: WwNavy,
  use: number,
  owner: number,
  ref: number,
  path: ConvoyPath,
  day: number,
): SeaRoute {
  const live = findRoute(navy, use, owner, ref);
  if (live !== null) {
    setRoutePath(navy, live, path);
    if (day >= live.nextDay) live.nextDay = day + ROUTE_RECHECK_DAYS;
    return live;
  }
  const r: SeaRoute = {
    id: navy.nextRouteId++,
    use,
    owner,
    ref,
    zones: [...path.zones],
    km: path.km,
    srs: srsOf(navy.scenario, path.zones),
    need: 0,
    got: 0,
    nextDay: day + ROUTE_RECHECK_DAYS,
  };
  // Route ids only rise: the Map stays in id order.
  navy.routes.set(r.id, r);
  navy.markCountry(owner);
  return r;
}

/** A route onto a new path (nothing changes when it is the same). */
export function setRoutePath(
  navy: WwNavy,
  r: SeaRoute,
  path: ConvoyPath,
): void {
  if (
    r.km === path.km &&
    r.zones.length === path.zones.length &&
    r.zones.every((z, i) => z === path.zones[i])
  ) {
    return;
  }
  r.zones = [...path.zones];
  r.km = path.km;
  r.srs = srsOf(navy.scenario, path.zones);
  navy.markCountry(r.owner);
}

/** Ends a route: its convoys are free again. */
export function dropRoute(navy: WwNavy, id: number): void {
  const r = navy.routes.get(id);
  if (r === undefined) return;
  navy.routes.delete(id);
  navy.markCountry(r.owner);
}

/** The routes of `owner`, by id. */
export function routesOf(navy: WwNavy, owner: number): SeaRoute[] {
  const out: SeaRoute[] = [];
  for (const r of navy.routes.values()) if (r.owner === owner) out.push(r);
  return out;
}

// ---- Allocation (spec §10.1) ----

const CONVOY = equipKey("convoy", 1);

/** A use's priority (CONVOY_USE_PRIORITY: smaller first; P5 puts lend-lease between supply and trade). */
function priorityOf(use: number): number {
  const u = CONVOY_USES[use];
  return u === undefined ? 1_000 : (CONVOY_USE_PRIORITY[u] ?? 1_000);
}

/**
 * The country's day (spec §10.1, §2.2 ⑥-②): yesterday's convoy notices,
 * its trade and supply routes found again, then the convoys handed out in
 * CONVOY_USE_PRIORITY order — the voyages keep what they bound at launch;
 * supply hubs, the largest need first (ties: the smaller hub region);
 * trades, the oldest first — each min(need, what is left). A use this
 * lane does not know (P5's lend-lease) keeps the need its owner set.
 */
export function allocateConvoys(
  navy: WwNavy,
  smallID: number,
  day: number,
): void {
  const ce = navy.econ.country(smallID);
  if (ce === null) return;
  dailyConvoyNotices(navy, smallID, day);
  // A loss outside the routes (P3's convoys effect below 0) may leave the
  // voyages bound beyond the stock: they give way first.
  clampToStock(navy, smallID);
  syncTradeRoutes(navy, smallID, day);
  syncSupplyRoutes(navy, smallID, day);
  let free = ce.stock[CONVOY];
  for (const v of navy.voyages.values()) {
    if (v.owner === smallID) free -= v.bound;
  }
  free = Math.max(0, free);
  const mine = routesOf(navy, smallID).filter((r) => r.use !== USE_VOYAGE);
  for (const r of mine) {
    if (r.use === USE_SUPPLY) r.need = supplyNeed(navy, r);
    else if (r.use === USE_TRADE) r.need = tradeNeed(navy, r);
  }
  mine.sort(
    (a, b) =>
      priorityOf(a.use) - priorityOf(b.use) ||
      (a.use === USE_SUPPLY && b.use === USE_SUPPLY ? b.need - a.need : 0) ||
      a.ref - b.ref ||
      a.id - b.id,
  );
  for (const r of mine) {
    const got = Math.max(0, Math.min(r.need, free));
    r.got = got;
    free -= got;
  }
  navy.markCountry(smallID);
}

/** Plan decision 20: the stock less the convoys bound to voyages and allotted to routes. */
export function freeConvoysOf(navy: WwNavy, smallID: number): number {
  const ce = navy.econ.country(smallID);
  if (ce === null) return 0;
  let used = 0;
  for (const v of navy.voyages.values()) {
    if (v.owner === smallID) used += v.bound;
  }
  for (const r of navy.routes.values()) if (r.owner === smallID) used += r.got;
  return Math.max(0, ce.stock[CONVOY] - used);
}

/**
 * Convoys `owner` lost on its routes through sea region `sr` (raiders):
 * the routes' allotments shrink by as many, in route order (a voyage's
 * convoys are its bound), so the stock never falls below what is bound and
 * allotted (Review Focus 3).
 */
export function takeFromRoutes(
  navy: WwNavy,
  owner: number,
  sr: number,
  n: number,
): void {
  let left = n;
  for (const r of navy.routes.values()) {
    if (left <= 0) break;
    if (r.owner !== owner || !r.srs.includes(sr)) continue;
    if (r.use === USE_VOYAGE) {
      const v = navy.voyages.get(r.ref);
      if (v === undefined) continue;
      const k = Math.min(v.bound, left);
      v.bound -= k;
      left -= k;
    } else {
      const k = Math.min(r.got, left);
      r.got -= k;
      left -= k;
    }
  }
  if (left > 0) clampToStock(navy, owner);
  navy.markCountry(owner);
}

/** Keeps Σ bound + Σ got within the stock (after a loss the routes did not carry). */
export function clampToStock(navy: WwNavy, owner: number): void {
  const ce = navy.econ.country(owner);
  if (ce === null) return;
  let over = -ce.stock[CONVOY];
  for (const v of navy.voyages.values()) if (v.owner === owner) over += v.bound;
  for (const r of navy.routes.values()) if (r.owner === owner) over += r.got;
  if (over <= 0) return;
  // The last in priority give way first (trades, newest first), then voyages.
  const routes = routesOf(navy, owner)
    .filter((r) => r.use !== USE_VOYAGE)
    .sort((a, b) => priorityOf(b.use) - priorityOf(a.use) || b.id - a.id);
  for (const r of routes) {
    if (over <= 0) break;
    const k = Math.min(r.got, over);
    r.got -= k;
    over -= k;
  }
  for (const v of [...navy.voyages.values()].reverse()) {
    if (over <= 0) break;
    if (v.owner !== owner) continue;
    const k = Math.min(v.bound, over);
    v.bound -= k;
    over -= k;
  }
}
