// World War 1936 P4: fleet movement over the sea graph (P4 spec §7.3).
// Lane N1 (Task 3). A fleet keeps its way as the zones ahead (seaPath
// once); each tick it adds its speed's milli-km on the edge it is on and
// reaches the next zone at the edge's km (the rest is dropped, as P2's
// walking). A strait or canal is looked at the tick the fleet enters its
// edge: closed, the fleet finds its way again from where it is.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FLEET_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { tickMilliKm } from "@openfront/engine-lib/ww1936/NavalRules";
import { joinNavalBattle } from "./NavalBattles";
import type { Fleet, WwNavy } from "./WwNavy";

const DOCKED = FLEET_STATES.indexOf("docked");
const MOVING = FLEET_STATES.indexOf("moving");
const ON_STATION = FLEET_STATES.indexOf("on_station");
const SORTIE = FLEET_STATES.indexOf("sortie");
const RETURNING = FLEET_STATES.indexOf("returning");
const REPAIRING = FLEET_STATES.indexOf("repairing");
const HOLD = FLEET_MISSIONS.indexOf("hold");
const STRIKE = FLEET_MISSIONS.indexOf("strike");
const AVOID = ENGAGE_RULES.indexOf("avoid");

/** The fleets in a naval battle now. */
export function battleFleetIds(navy: WwNavy): Set<number> {
  const out = new Set<number>();
  for (const b of navy.battles.values()) {
    for (const id of b.fleets[0]) out.add(id);
    for (const id of b.fleets[1]) out.add(id);
  }
  return out;
}

/** A naval base the fleet's owner may use as home now (spec §7.1: its side controls a working base). */
export function homeUsable(
  navy: WwNavy,
  owner: number,
  region: number,
): boolean {
  return (
    navy.land.sameSide(owner, navy.land.controller[region] ?? 0) &&
    navy.isPort(region) &&
    navy.scenario.harborOf(region) !== 0
  );
}

/**
 * The sea regions holding a harbor zone of a region `owner`'s side
 * controls ("own coastal regions": the training mission, the preparation
 * minute's waters).
 */
export function homeWaterSrs(navy: WwNavy, owner: number): Set<number> {
  const sc = navy.scenario;
  const ctl = navy.land.controller;
  const out = new Set<number>();
  for (const r of sc.landRegions) {
    if (!navy.land.sameSide(owner, ctl[r.id] ?? 0)) continue;
    const z = sc.harborOf(r.id);
    if (z !== 0) out.add(sc.zoneSr(z));
  }
  out.delete(0);
  return out;
}

/**
 * Stops the fleet where it is and gives it `hold` (spec §8.1: in port or
 * where it is; a repairing fleet goes on repairing).
 */
export function holdFleet(navy: WwNavy, f: Fleet): void {
  f.mission = HOLD;
  f.missionSr = 0;
  f.path = [];
  f.edge = -1;
  f.prog = 0;
  f.need = 0;
  f.dest = 0;
  f.sortieTarget = 0;
  if (f.docked === 0) f.state = ON_STATION;
  else if (f.state !== REPAIRING) f.state = DOCKED;
  navy.markFleet(f.id);
}

/**
 * Sends `f` toward the nearest of `toZones` (seaPath over the edges open
 * to its owner now); "no_sea_path" changes nothing. A fleet already there
 * arrives at once. Sailing home or on a sortie it keeps that state, else
 * it is "moving".
 */
export function startFleetMove(
  navy: WwNavy,
  f: Fleet,
  toZones: readonly number[],
  tick: number,
): WwOrderBlock | null {
  const p = navy.pathFor(f, toZones);
  if (p === null) return "no_sea_path";
  f.path = p.zones.slice(1);
  f.edge = -1;
  f.prog = 0;
  f.need = 0;
  f.dest = p.zones[p.zones.length - 1];
  if (f.state !== RETURNING && f.state !== SORTIE) f.state = MOVING;
  navy.markFleet(f.id);
  if (f.path.length === 0) arriveFleet(navy, f, tick);
  return null;
}

/**
 * Spec §7.3, §8.3: home to its port (state returning, the mission kept);
 * a fleet that has no way home holds where it is.
 */
export function sendHome(
  navy: WwNavy,
  f: Fleet,
  tick: number,
): WwOrderBlock | null {
  const z = navy.scenario.harborOf(f.home);
  f.state = RETURNING;
  f.sortieTarget = 0;
  const block = z === 0 ? "no_sea_path" : startFleetMove(navy, f, [z], tick);
  if (block !== null) holdFleet(navy, f);
  return block;
}

/**
 * The end of a way. Home (returning, its harbor zone, the base usable):
 * docked — repairing when it came back from a mission, else docked. A
 * sortie stays a sortie; anything else is on station (holding there for
 * a move order) and at sea. A battle in the zone: the fleet joins it
 * (N2 decides who may), unless it avoids battle.
 */
function arriveFleet(navy: WwNavy, f: Fleet, tick: number): void {
  void tick;
  f.path = [];
  f.edge = -1;
  f.prog = 0;
  f.need = 0;
  if (f.state === RETURNING) {
    if (
      f.zone === navy.scenario.harborOf(f.home) &&
      homeUsable(navy, f.owner, f.home)
    ) {
      f.docked = f.home;
      f.dest = 0;
      f.sortieTarget = 0;
      f.state = f.mission === HOLD || f.mission === STRIKE ? DOCKED : REPAIRING;
    }
    // Otherwise its home changed on the way: applyFleetOrders sends it on.
    navy.markFleet(f.id);
    return;
  }
  f.docked = 0;
  if (f.state !== SORTIE) f.state = ON_STATION;
  navy.markFleet(f.id);
  if (navy.battles.has(f.zone) && (f.state === SORTIE || f.engage !== AVOID)) {
    joinNavalBattle(navy, f.zone, f.id); // N2
  }
}

/** Docks a fleet that sails home and is already in its harbor zone (applyFleetOrders). */
export function dockIfHome(navy: WwNavy, f: Fleet, tick: number): boolean {
  if (f.state !== RETURNING || f.path.length > 0) return false;
  if (f.zone !== navy.scenario.harborOf(f.home)) return false;
  if (!homeUsable(navy, f.owner, f.home)) return false;
  arriveFleet(navy, f, tick);
  return true;
}

/** Spec §8.4: a fleet that left sea region `sr` loses every side's spotting on it there. */
function clearSpotting(navy: WwNavy, fleet: number, sr: number): void {
  const i = navy.scenario.srIdxOf(sr);
  if (i < 0) return;
  for (const [side, m] of [...navy.srState[i].spot]) {
    if (m.has(fleet)) navy.setSpotPm(sr, side, fleet, 0);
  }
}

/** The open edge from the fleet's zone to `next` (the shortest when several), −1 when none. */
function edgeTo(navy: WwNavy, f: Fleet, next: number): number {
  const sc = navy.scenario;
  const open = navy.passable(f.owner, true);
  let best = -1;
  for (const { to, edge } of sc.seaEdgesOf(f.zone)) {
    if (to !== next || !open(edge)) continue;
    if (best < 0 || sc.seaEdge(edge).km < sc.seaEdge(best).km) best = edge;
  }
  return best;
}

/**
 * Every moving fleet, by fleet id (spec §2.2-6 ④). Fleets in a battle do
 * not move. A docked fleet puts to sea from its port's harbor zone. In
 * the preparation minute (spec §2.2: no war yet) a fleet does not leave
 * the sea regions of its side's coast: it waits at the last zone inside
 * and goes on when the minute ends. A tick at sea is a day at sea
 * (`seaDay`, fuel).
 */
export function stepFleets(navy: WwNavy, tick: number): void {
  if (navy.fleets.size === 0) return;
  const prep = navy.ww.inPrep(tick);
  const day = navy.day(tick);
  const busy = battleFleetIds(navy);
  // side → its coast's sea regions (the preparation minute only).
  const waters = new Map<number, Set<number>>();
  for (const f of [...navy.fleets.values()]) {
    if (!navy.fleets.has(f.id)) continue;
    const atSea = f.docked === 0;
    if (f.path.length > 0 && !busy.has(f.id)) {
      stepFleet(navy, f, tick, prep ? waters : null);
    }
    if (!prep && (atSea || f.docked === 0)) f.seaDay = day;
  }
}

function stepFleet(
  navy: WwNavy,
  f: Fleet,
  tick: number,
  waters: Map<number, Set<number>> | null,
): void {
  const sc = navy.scenario;
  if (f.edge < 0) {
    if (!mayEnter(navy, f, f.path[0], waters)) return;
    let e = edgeTo(navy, f, f.path[0]);
    if (e < 0) {
      // Closed on the way (spec §3.3): find the way again from here.
      const p = navy.pathFor(f, [f.path[f.path.length - 1]]);
      if (p === null) {
        holdFleet(navy, f);
        return;
      }
      f.path = p.zones.slice(1);
      if (f.path.length === 0) {
        arriveFleet(navy, f, tick);
        return;
      }
      if (!mayEnter(navy, f, f.path[0], waters)) return;
      e = edgeTo(navy, f, f.path[0]);
      if (e < 0) {
        holdFleet(navy, f);
        return;
      }
    }
    f.edge = e;
    f.need = sc.seaEdge(e).km * 1000;
    f.prog = 0;
    // Puts to sea from its port's harbor zone (spec §7.3).
    f.docked = 0;
  }
  f.prog += tickMilliKm(navy.fleetSpeedCentiKn(f));
  if (f.prog >= f.need) {
    const z = f.path.shift()!;
    f.prog = 0;
    f.need = 0;
    f.edge = -1;
    const from = f.lastSr;
    navy.setFleetZone(f, z);
    const sr = sc.zoneSr(z);
    if (sr !== from) {
      clearSpotting(navy, f.id, from);
      f.lastSr = sr;
    }
    if (f.path.length === 0) arriveFleet(navy, f, tick);
  }
  navy.markFleet(f.id);
}

/** The preparation minute: only the sea regions of the side's coast. */
function mayEnter(
  navy: WwNavy,
  f: Fleet,
  next: number,
  waters: Map<number, Set<number>> | null,
): boolean {
  if (waters === null) return true;
  const side = navy.sideOf(f.owner);
  let w = waters.get(side);
  if (w === undefined) waters.set(side, (w = homeWaterSrs(navy, f.owner)));
  return w.has(navy.scenario.zoneSr(next));
}
