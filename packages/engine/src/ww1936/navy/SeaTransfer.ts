// World War 1936 P4: sea moves and voyages (P4 spec §10.4, §11.3, plan
// decision 34). An army_sea move (and lane I's invasion) sails as a
// voyage: its convoys are bound at launch, its divisions are lifted (P2's
// row keeps the departure region, MOVE_SEA, need 0) and the voyage carries
// them along its route at 12 knots; never in less than a day. On the
// owner's day, a region where our side holds less than 50% supremacy
// against an enemy with power intercepts it.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  type LandOrderSource,
  MOVE_SEA,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  type ArmySeaOrder,
  WW_CONVOY_SPEED_KN,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  divisionConvoys,
  interceptLossPm,
  seaTransferBlock,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { tickMilliKm } from "@openfront/engine-lib/ww1936/NavalRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { loseConvoys } from "../economy/Buildings";
import { armyOrderBlock } from "../land/Orders";
import {
  atSea,
  damageDivisions,
  divisionWeightCenti,
  landDivisions,
  liftDivisions,
} from "../land/SeaLift";
import {
  clampToStock,
  convoyPath,
  freeConvoysOf,
  portRegionsOf,
  putRoute,
  ROUTE_RECHECK_DAYS,
  setRoutePath,
  USE_VOYAGE,
} from "./Convoys";
import { cancelInvasion, landInvasion } from "./Invasions";
import { navalPort } from "./Ports";
import { enemySupPm } from "./SeaSupply";
import type { SeaRoute, Voyage, WwNavy } from "./WwNavy";

/** Spec §11.3: a voyage takes a day at least (WW_DAY_SPLIT ticks). */
export const VOYAGE_MIN_TICKS = WW_DAY_SPLIT;
/** Spec §10.4: a division below this strength ‰ sinks with its convoys. */
export const SINK_STRENGTH_PM = 100;

/** The convoys `divs` (division ids) need, Σ ceil(weight × 2) (spec §10.5). */
export function convoysForDivisions(
  navy: WwNavy,
  divs: readonly number[],
): number {
  let n = 0;
  for (const id of divs) {
    n += divisionConvoys(divisionWeightCenti(navy.land, id));
  }
  return n;
}

/** A working naval base on open water of `owner`'s side. */
function sidePort(navy: WwNavy, owner: number, region: number): boolean {
  const sc = navy.scenario;
  const z = sc.harborOf(region);
  return (
    z !== 0 &&
    sc.zoneSr(z) !== 0 &&
    navy.land.sameSide(owner, navy.land.controller[region] ?? 0) &&
    navalPort(navy.ww, region)
  );
}

/**
 * army_sea (decision 34; WwLand.issue sends the AI's here too): P2's
 * conditions (ports of our side, no division fighting: no_port,
 * army_busy), a convoy route between the harbors (no_sea_path) and idle
 * convoys for every division (no_convoys). Then the army sails at once.
 */
export function issueSeaTransfer(
  navy: WwNavy,
  smallID: number,
  order: ArmySeaOrder,
  tick: number,
  by: LandOrderSource = "player",
): WwOrderBlock | null {
  const land = navy.land;
  const cl = land.country(smallID);
  if (cl === null) return "dead";
  const p2 = armyOrderBlock(land, cl, order);
  if (p2 !== null) return p2;
  const a = land.armies.get(order.army)!;
  const from = land.armyRegion(a);
  const to = order.region;
  const sc = navy.scenario;
  const path = convoyPath(
    navy,
    smallID,
    [sc.harborOf(from)].filter((z) => z !== 0),
    [sc.harborOf(to)].filter((z) => z !== 0),
  );
  const divs = [...a.divisions];
  const block = seaTransferBlock({
    fromPort: sidePort(navy, smallID, from),
    toPort: sidePort(navy, smallID, to),
    anyInBattle: false,
    routeKm: path === null ? null : path.km,
    convoysFree: freeConvoysOf(navy, smallID),
    convoysNeed: convoysForDivisions(navy, divs),
  });
  if (block !== null) return block;
  // P2 issueArmyOrder: a player's order turns auto off; another standing
  // order drops the army's invasion (lane I).
  if (by === "player") a.auto = false;
  cancelInvasion(navy, a.id);
  if (startVoyage(navy, smallID, a.id, divs, from, to, false, tick) === 0) {
    return "no_convoys";
  }
  // The army's standing order is the move, never pending: P2 would sail
  // it itself (applyOrder); Fronts.finishMove idles it after the landing.
  a.order = { ...idleOrder(), kind: "move", to, mode: MOVE_SEA };
  a.front = [];
  a.path = [from, to];
  a.planBp = 0;
  a.pending = false;
  land.markArmy(a.id);
  return null;
}

/**
 * A convoy voyage of `divs` (division ids) of `army` from port `from` to
 * `to` (an invasion when `invasion`: lane I's landInvasion on arrival):
 * binds Σ divisionConvoys of the idle convoys, lifts the divisions
 * (SeaLift.liftDivisions). Returns the voyage id; 0 when there is no
 * convoy route between the harbors or too few idle convoys (nothing
 * changes). The caller judges the ports and the army.
 */
export function startVoyage(
  navy: WwNavy,
  owner: number,
  army: number,
  divs: readonly number[],
  from: number,
  to: number,
  invasion: boolean,
  tick: number,
): number {
  const sc = navy.scenario;
  const a = sc.harborOf(from);
  const b = sc.harborOf(to);
  if (a === 0 || b === 0) return 0;
  const path = convoyPath(navy, owner, [a], [b]);
  if (path === null) return 0;
  const need = convoysForDivisions(navy, divs);
  if (freeConvoysOf(navy, owner) < need) return 0;
  const id = navy.nextVoyageId++;
  const r = putRoute(
    navy,
    USE_VOYAGE,
    owner,
    id,
    path,
    Math.max(0, navy.ww.day(tick)),
  );
  // A voyage's convoys are its bound (freeConvoysOf counts them once).
  r.need = need;
  r.got = 0;
  const v: Voyage = {
    id,
    owner,
    army,
    invasion,
    divisions: [...divs].sort((x, y) => x - y),
    from,
    to,
    route: r.id,
    zoneIdx: 0,
    prog: 0,
    need: 0,
    bound: need,
    aborting: false,
    departTick: tick,
  };
  // Voyage ids only rise: the Map stays in id order.
  navy.voyages.set(id, v);
  liftDivisions(navy.land, v.divisions);
  navy.markCountry(owner);
  return id;
}

/** The sea edge from zone `a` to zone `b` (the shortest of several); −1 when none. */
function edgeBetween(sc: ScenarioIndex, a: number, b: number): number {
  let best = -1;
  for (const e of sc.seaEdgesOf(a)) {
    if (e.to !== b) continue;
    if (best < 0 || sc.seaEdge(e.edge).km < sc.seaEdge(best).km) best = e.edge;
  }
  return best;
}

/** The voyage's route (its own: use voyage, ref = the voyage id). */
function routeOf(navy: WwNavy, v: Voyage): SeaRoute | null {
  return navy.routes.get(v.route) ?? null;
}

/** The zone the voyage is in (the start of its edge in progress). */
export function voyageZone(navy: WwNavy, v: Voyage): number {
  const r = routeOf(navy, v);
  if (r === null || r.zones.length === 0) return navy.scenario.harborOf(v.from);
  return r.zones[Math.min(v.zoneIdx, r.zones.length - 1)];
}

/** Ends a voyage: its convoys are free again, its own route goes. */
function endVoyage(navy: WwNavy, v: Voyage): void {
  navy.voyages.delete(v.id);
  const r = routeOf(navy, v);
  if (r !== null && r.use === USE_VOYAGE && r.ref === v.id) {
    navy.routes.delete(r.id);
  }
  navy.markCountry(v.owner);
}

/** Drops the divisions no longer aboard (killed, or stopped by P2 code). */
function keepAboard(navy: WwNavy, v: Voyage): void {
  const t = navy.land.divisions;
  const aboard = v.divisions.filter((id) => {
    const r = t.rowOf(id);
    return r >= 0 && t.owner[r] === v.owner && atSea(navy.land, r);
  });
  if (aboard.length !== v.divisions.length) v.divisions = aboard;
}

/**
 * Sails the voyage from `zone` to `v.to`'s harbor on a new route (lane I
 * turns an invasion back by setting v.to and v.aborting). False when no
 * convoy route leads there now (it waits where it is).
 */
function reroute(navy: WwNavy, v: Voyage, zone: number, day: number): boolean {
  const b = navy.scenario.harborOf(v.to);
  if (b === 0 || zone === 0) return false;
  const path = convoyPath(navy, v.owner, [zone], [b]);
  if (path === null) return false;
  const r = routeOf(navy, v);
  if (r !== null && r.use === USE_VOYAGE && r.ref === v.id) {
    setRoutePath(navy, r, path);
  } else {
    const nr = putRoute(navy, USE_VOYAGE, v.owner, v.id, path, day);
    nr.need = v.bound;
    v.route = nr.id;
  }
  v.zoneIdx = 0;
  v.prog = 0;
  v.need = 0;
  return true;
}

/**
 * The nearest working port of the owner's side by sea from `zone` (ties:
 * the smaller region); 0 when none is reached.
 */
function nearestSidePort(navy: WwNavy, owner: number, zone: number): number {
  const sc = navy.scenario;
  const byZone = new Map<number, number>();
  for (const m of navy.land.sideMembers(navy.land.sideOf(owner))) {
    for (const p of portRegionsOf(navy, m)) {
      const z = sc.harborOf(p);
      const had = byZone.get(z);
      if (had === undefined || p < had) byZone.set(z, p);
    }
  }
  if (byZone.size === 0) return 0;
  const zones = [...byZone.keys()].sort((a, b) => a - b);
  const path = convoyPath(navy, owner, [zone], zones);
  return path === null ? 0 : byZone.get(path.zones[path.zones.length - 1])!;
}

/** Spec §10.4: the voyage's convoy speed a tick, milli-km (12 kn × navalSpeedPct). */
function stepMilliKm(navy: WwNavy, owner: number): number {
  const pct = 100 + (navy.econ.country(owner)?.stats.navalSpeedPct ?? 0);
  return tickMilliKm(Math.floor((WW_CONVOY_SPEED_KN * 100 * pct) / 100));
}

/**
 * Every voyage one tick on its route, by id (spec §2.2 ⑥): along its
 * edges at convoy speed, waiting at a zone whose next edge is closed; at
 * the last zone (the destination's harbor), never before departTick + 7,
 * it arrives: an invasion (a turned-back one too) through lane I's
 * landInvasion, a sea move lands in our port — the nearest one of our
 * side when the destination was lost on the way. Lane I turns a voyage
 * back by rewriting its route in place from where it is (zoneIdx 0, prog
 * and need the first edge's milli-km) and setting v.to.
 */
export function stepSeaVoyages(navy: WwNavy, tick: number): void {
  for (const v of [...navy.voyages.values()]) {
    if (navy.voyages.get(v.id) === v) stepVoyage(navy, v, tick);
  }
}

function stepVoyage(navy: WwNavy, v: Voyage, tick: number): void {
  const sc = navy.scenario;
  keepAboard(navy, v);
  if (v.divisions.length === 0) {
    endVoyage(navy, v);
    return;
  }
  let r = routeOf(navy, v);
  const goal = sc.harborOf(v.to);
  if (
    r === null ||
    r.zones.length === 0 ||
    r.zones[r.zones.length - 1] !== goal
  ) {
    // Turned back or lost its route: from where it is to v.to.
    if (!reroute(navy, v, voyageZone(navy, v), navy.ww.day(tick))) return;
    r = routeOf(navy, v)!;
  }
  const last = r.zones.length - 1;
  if (v.zoneIdx < last) {
    const pass = navy.passable(v.owner, false);
    let budget = stepMilliKm(navy, v.owner);
    while (v.zoneIdx < last) {
      const e = edgeBetween(sc, r.zones[v.zoneIdx], r.zones[v.zoneIdx + 1]);
      // A closed strait or canal: it waits here (dailyVoyages finds another way).
      if (e < 0 || !pass(e)) break;
      v.need = sc.seaEdge(e).km * 1000;
      if (v.prog + budget < v.need) {
        v.prog += budget;
        break;
      }
      budget -= v.need - v.prog;
      v.zoneIdx++;
      v.prog = 0;
      v.need = 0;
    }
  }
  if (v.zoneIdx >= last && tick >= v.departTick + VOYAGE_MIN_TICKS) {
    arrive(navy, v, tick);
  }
}

function arrive(navy: WwNavy, v: Voyage, tick: number): void {
  if (v.invasion) {
    // Lane I lands every invasion voyage, a turned-back one in its port
    // too, and ends it: the convoys are free this tick (spec §11.4).
    landInvasion(navy, v.id, tick); // I
    if (navy.voyages.get(v.id) === v) endVoyage(navy, v);
    return;
  }
  if (!sidePort(navy, v.owner, v.to)) {
    const zone = voyageZone(navy, v);
    const p = nearestSidePort(navy, v.owner, zone);
    // No port of our side reached: it waits at sea (and tries every tick).
    if (p === 0) return;
    v.to = p;
    reroute(navy, v, zone, navy.ww.day(tick));
    // Another port in the same harbor: it lands now; else it sails on.
    if (routeOf(navy, v)?.zones.length !== 1) return;
  }
  landDivisions(navy.land, v.divisions, v.to, false, tick);
  endVoyage(navy, v);
}

/**
 * The owner's day of its voyages (after allocateConvoys, spec §10.4):
 * interception where our side's supremacy is below 50% and an enemy has
 * power — each division loses (500 − ours) / 500 × 10% of its men and
 * equipment, one below 10% strength sinks, the bound convoys lose the same
 * share (its remainder with the region's convoy losses); then a voyage at
 * a closed edge, or due its weekly search, finds its way again.
 */
export function dailyVoyages(navy: WwNavy, smallID: number, day: number): void {
  for (const v of [...navy.voyages.values()]) {
    if (v.owner !== smallID || navy.voyages.get(v.id) !== v) continue;
    keepAboard(navy, v);
    if (v.divisions.length === 0) {
      endVoyage(navy, v);
      continue;
    }
    intercept(navy, v, day);
    if (v.divisions.length === 0) {
      endVoyage(navy, v);
      continue;
    }
    const r = routeOf(navy, v);
    if (r === null || r.zones.length === 0) continue;
    const blocked = nextEdgeClosed(navy, v, r);
    if (!blocked && day < r.nextDay) continue;
    if (day >= r.nextDay) r.nextDay = day + ROUTE_RECHECK_DAYS;
    const here = r.zones[Math.min(v.zoneIdx, r.zones.length - 1)];
    const p = convoyPath(navy, v.owner, [here], [navy.scenario.harborOf(v.to)]);
    if (p === null) continue;
    const ahead = r.zones.slice(v.zoneIdx);
    const same =
      ahead.length === p.zones.length &&
      ahead.every((z, i) => z === p.zones[i]);
    if (!same) reroute(navy, v, here, day);
  }
}

function nextEdgeClosed(navy: WwNavy, v: Voyage, r: SeaRoute): boolean {
  if (v.zoneIdx >= r.zones.length - 1) return false;
  const e = edgeBetween(
    navy.scenario,
    r.zones[v.zoneIdx],
    r.zones[v.zoneIdx + 1],
  );
  return e < 0 || !navy.passable(v.owner, false)(e);
}

function intercept(navy: WwNavy, v: Voyage, day: number): void {
  const sc = navy.scenario;
  const land = navy.land;
  const sr = sc.zoneSr(voyageZone(navy, v));
  const idx = sc.srIdxOf(sr);
  if (idx < 0) return;
  const side = land.sideOf(v.owner);
  const pm = interceptLossPm(
    navy.supremacy(side, sr),
    enemySupPm(navy, side, sr),
  );
  if (pm <= 0) return;
  damageDivisions(land, v.divisions, pm);
  const t = land.divisions;
  for (const id of v.divisions) {
    const row = t.rowOf(id);
    if (row >= 0 && land.strengthOf(row) < SINK_STRENGTH_PM) {
      land.killDivision(row, true);
    }
  }
  keepAboard(navy, v);
  // The convoys: the same share of the bound, its remainder kept with the
  // region's convoy losses of this country.
  const st = navy.srState[idx];
  const milli = v.bound * pm;
  const rest = (st.raidRest.get(v.owner) ?? 0) + milli;
  const n = Math.min(v.bound, Math.floor(rest / 1000));
  setRest(st.raidRest, v.owner, rest - n * 1000);
  const ce = navy.econ.country(v.owner);
  const lost = ce === null || n <= 0 ? 0 : loseConvoys(ce, n);
  v.bound -= lost;
  if (lost > 0) clampToStock(navy, v.owner);
  const cn = navy.country(v.owner);
  if (cn !== null && milli > 0) cn.convoyLoss[day % 30] += milli;
  navy.convoysSunkTotal += lost;
  navy.markCountry(v.owner);
  navy.markSr(idx);
}

/** Sets a non-zero value keeping the Map in key order; 0 deletes. */
export function setRest(
  m: Map<number, number>,
  key: number,
  value: number,
): void {
  if (value === 0) {
    m.delete(key);
    return;
  }
  if (m.has(key)) {
    m.set(key, value);
    return;
  }
  m.set(key, value);
  let last = -Infinity;
  let sorted = true;
  for (const k of m.keys()) {
    if (k < last) sorted = false;
    last = k;
  }
  if (!sorted) {
    const e = [...m].sort((a, b) => a[0] - b[0]);
    m.clear();
    for (const [k, val] of e) m.set(k, val);
  }
}
