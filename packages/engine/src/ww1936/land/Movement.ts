// World War 1936 P2: movement (P2 spec §7.2–§7.7). Task 3 owns this file.
// The foundation wrote the tick loop (stepMovement, its step and its
// arrival: pre-flight U9) and stopDivision / startHopInto; Task 3 the
// hops along a path (startNextHop), the paths and their times.
import {
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  TPL_ARMOR_ANY,
  TPL_CAVALRY_MAJOR,
  TPL_MOTOR_ANY,
  traitBit,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  edgeTicks,
  moveNeed,
  moveStep,
  railStep,
  seaTicks,
  shortestPath,
} from "@openfront/engine-lib/ww1936/MoveRules";
import { joinBattle, retreatDivision } from "./Battles";
import { generalOf } from "./GeneralsRun";
import { capture } from "./Occupation";
import type { Army, WwLand } from "./WwLand";

/** Every moving division by row (= id) order (spec §2.2-4). */
export function stepMovement(land: WwLand, tick: number): void {
  const t = land.divisions;
  const prep = land.ww.inPrep(tick);
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.mode[r] === MOVE_NONE) continue;
    const owner = t.owner[r];
    const mode = t.mode[r];
    const to = t.next[r];
    const c = land.controller[to];
    if (!land.sameSide(owner, c)) {
      if (mode === MOVE_WALK || mode === MOVE_ADVANCE) {
        // Spec §7.7: never across into an enemy region that has enemy divisions.
        if (prep || !land.isEnemy(owner, c)) {
          stopDivision(land, r);
          continue;
        }
        if (enemyDivisionsIn(land, owner, to) > 0) {
          stopDivision(land, r);
          joinBattle(land, t.id[r], to);
          continue;
        }
      } else if (mode === MOVE_RAIL || mode === MOVE_SEA) {
        // Spec §7.4: the enemy took a region on the way: off the train here.
        stopDivision(land, r);
        continue;
      } else if (mode === MOVE_RETREAT) {
        // Its refuge fell: retreat again from where it is (or be destroyed).
        stopDivision(land, r);
        retreatDivision(land, r);
        continue;
      }
    }
    const step = stepOf(land, r, mode);
    t.step[r] = step;
    t.prog[r] = Math.min(t.need[r], t.prog[r] + step);
    if (t.prog[r] >= t.need[r]) arrive(land, r, tick);
  }
}

function stepOf(land: WwLand, r: number, mode: number): number {
  const t = land.divisions;
  if (mode === MOVE_SEA) return 1000; // need is in milli-ticks
  const ce = land.econ.country(t.owner[r])!;
  if (mode === MOVE_RAIL) return railStep(ce.tech.railSpeedPct);
  const to = t.next[r];
  const w = land.weatherOn(to, land.day());
  const s = land.baseStatsOf(r);
  return moveStep(
    s.speedCenti,
    land.econ.infra[to],
    w,
    t.supply[r],
    ce.tech.speedPct * 100 + traitSpeedBp(land, r, s.flags),
  );
}

function arrive(land: WwLand, r: number, tick: number): void {
  const t = land.divisions;
  const owner = t.owner[r];
  const to = t.next[r];
  const mode = t.mode[r];
  if (!land.sameSide(owner, land.controller[to])) {
    // Walking or advancing into an empty enemy region takes it (spec §7.7,
    // §9.7). Rows run in id order: the smaller division arrives first.
    capture(land, to, owner, tick);
  }
  land.setDivisionRegion(r, to);
  t.mode[r] = MOVE_NONE;
  t.prog[r] = 0;
  t.need[r] = 0;
  t.edge[r] = -1;
  t.step[r] = 0;
  t.stillDays[r] = 0;
  t.entrench[r] = 0;
  t.role[r] = 0;
  t.battle[r] = 0;
  if (mode !== MOVE_RETREAT && t.dest[r] !== to) startNextHop(land, r, tick);
}

/** Spec §6.2: the general's movement traits, bp (panzer leader, cavalry officer). */
export function traitSpeedBp(land: WwLand, r: number, flags: number): number {
  const army = land.armies.get(land.divisions.army[r]);
  const g = army === undefined ? null : generalOf(land, army);
  if (g === null) return 0;
  let bp = 0;
  if (
    (g.traits & traitBit("panzer_leader")) !== 0 &&
    (flags & (TPL_ARMOR_ANY | TPL_MOTOR_ANY)) !== 0
  ) {
    bp += 1000;
  }
  if (
    (g.traits & traitBit("cavalry_officer")) !== 0 &&
    (flags & TPL_CAVALRY_MAJOR) !== 0
  ) {
    bp += 1000;
  }
  return bp;
}

/**
 * Divisions in `region` (standing there: not advancing in or retreating
 * through) of countries `owner` may fight now.
 */
export function enemyDivisionsIn(
  land: WwLand,
  owner: number,
  region: number,
): number {
  const t = land.divisions;
  let n = 0;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    if (land.isEnemy(owner, t.owner[r])) n++;
  }
  return n;
}

/**
 * Starts division `row`, standing in its region (mode none), on the next
 * edge toward its dest; with no way there it waits where it is (spec §7.3:
 * dest = its region). The mode is its army's move order's when that order
 * leads to this dest (walk, rail, sea), else walking (fronts). A move
 * follows the path stored on the army; off it, or when the next region is
 * no longer ours, it looks for a new one.
 */
export function startNextHop(land: WwLand, row: number, tick: number): void {
  const t = land.divisions;
  const here = t.region[row];
  const dest = t.dest[row];
  if (dest === here) {
    if (t.mode[row] !== MOVE_NONE) stopDivision(land, row);
    return;
  }
  const owner = t.owner[row];
  const sc = land.scenario;
  const army = land.armies.get(t.army[row]);
  const moving =
    army !== undefined && army.order.kind === "move" && army.order.to === dest;
  const mode = moving ? army.order.mode : MOVE_WALK;
  const ours = (r: number) => land.sameSide(owner, land.controller[r]);
  let next = -1;
  let edge = -1;
  let need = 0;
  if (mode === MOVE_SEA) {
    // Spec §7.5: one hop, from port to port, in milli-ticks.
    if (ours(dest) && sc.isPort(dest)) {
      next = dest;
      need = seaTicks(sc.regionKm(here, dest)) * 1000;
    }
  } else {
    const rail = mode === MOVE_RAIL;
    const pass = rail ? (r: number) => ours(r) && railed(land, r) : ours;
    if (moving) {
      trimPath(land, army);
      const i = army.path.indexOf(here);
      const cand = i >= 0 && i + 1 < army.path.length ? army.path[i + 1] : -1;
      if (cand >= 0 && pass(cand) && sc.edgeBetween(here, cand) >= 0) {
        next = cand;
      }
    }
    if (next < 0) {
      const path = rail
        ? railPath(land, owner, here, dest)
        : army === undefined
          ? []
          : sidePath(land, army, owner, here, dest);
      if (path.length >= 2 && pass(path[1])) next = path[1];
    }
    if (next >= 0) {
      edge = sc.edgeBetween(here, next);
      const e = sc.edge(edge);
      need = rail ? e.km * 1000 : moveNeed(e, sc.landOf(next));
    }
  }
  if (next < 0) {
    stopDivision(land, row);
    return;
  }
  t.next[row] = next;
  t.edge[row] = edge;
  t.need[row] = need;
  t.prog[row] = 0;
  t.step[row] = 0;
  t.mode[row] = mode;
  land.markArmy(t.army[row]);
}

/** Drops the regions of a move's path every division of the army has left behind. */
function trimPath(land: WwLand, army: Army): void {
  const t = land.divisions;
  let min = Infinity;
  for (const id of army.divisions) {
    const r = t.rowOf(id);
    if (r < 0) continue;
    const i = army.path.indexOf(t.region[r]);
    if (i >= 0 && i < min) min = i;
  }
  if (min !== Infinity && min > 0) army.path.splice(0, min);
}

function railed(land: WwLand, region: number): boolean {
  return land.econ.rail[region] >= 1;
}

/**
 * Spec §7.4: the quickest railway from `from` to `to` over our side's
 * regions with a railway (time = km at the rail speed); [] when none.
 */
export function railPath(
  land: WwLand,
  owner: number,
  from: number,
  to: number,
): number[] {
  const ce = land.econ.country(owner);
  const step = railStep(ce === null ? 0 : ce.tech.railSpeedPct);
  const ok = (r: number) =>
    land.sameSide(owner, land.controller[r]) && railed(land, r);
  if (!ok(from) || !ok(to)) return [];
  const sc = land.scenario;
  return shortestPath(sc, from, to, ok, (e) =>
    edgeTicks(sc.edge(e).km * 1000, step),
  );
}

/** Infantry's 4 km/h: an army with no divisions left still finds a way. */
const DEFAULT_SPEED_CENTI = 400;

/**
 * Spec §7.3: the army's pace for path costs, the slowest division's step
 * on clear plains with full supply and no bonus.
 */
export function slowestPathStep(land: WwLand, army: Army): number {
  const t = land.divisions;
  let speed = Infinity;
  for (const id of army.divisions) {
    const r = t.rowOf(id);
    if (r >= 0) speed = Math.min(speed, land.baseStatsOf(r).speedCenti);
  }
  if (speed === Infinity) speed = DEFAULT_SPEED_CENTI;
  return moveStep(speed, 1, "clear", 1000, 0);
}

/**
 * Ticks for an army to walk `path` at its slowest division's pace (UI ETA,
 * AI): each edge at the speed the division would have walking into its far
 * end today (infrastructure, weather, supply, tech and the general).
 */
export function pathTicks(
  land: WwLand,
  army: Army,
  path: readonly number[],
): number {
  const t = land.divisions;
  const sc = land.scenario;
  const rows: number[] = [];
  for (const id of army.divisions) {
    const r = t.rowOf(id);
    if (r >= 0) rows.push(r);
  }
  const fallback = slowestPathStep(land, army);
  let total = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const to = path[i + 1];
    const e = sc.edgeBetween(path[i], to);
    if (e < 0) continue;
    let step = rows.length === 0 ? fallback : Infinity;
    for (const r of rows) step = Math.min(step, walkStepInto(land, r, to));
    total += edgeTicks(moveNeed(sc.edge(e), sc.landOf(to)), step);
  }
  return total;
}

/** What division `r` would walk in a tick into region `to` today (stepOf for a walk there). */
function walkStepInto(land: WwLand, r: number, to: number): number {
  const t = land.divisions;
  const ce = land.econ.country(t.owner[r]);
  const w = land.weatherOn(to, land.day());
  const s = land.baseStatsOf(r);
  return moveStep(
    s.speedCenti,
    land.econ.infra[to],
    w,
    t.supply[r],
    (ce === null ? 0 : ce.tech.speedPct * 100) + traitSpeedBp(land, r, s.flags),
  );
}

/**
 * Shortest region path (Dijkstra, spec §7.3) for `army` over regions
 * `pass` accepts, an edge costing whole ticks at its slowest division's
 * pace; [] when none, [from] when from = to.
 */
export function findPath(
  land: WwLand,
  army: Army,
  from: number,
  to: number,
  pass: (region: number) => boolean,
): number[] {
  const sc = land.scenario;
  const step = slowestPathStep(land, army);
  return shortestPath(sc, from, to, pass, (e, next) =>
    edgeTicks(moveNeed(sc.edge(e), sc.landOf(next)), step),
  );
}

/**
 * findPath over the regions of `owner`'s side (startNextHop's walk), kept
 * by side, pace and both ends while no region changed hands
 * (controlChanges), the sides are the same and nothing was rebuilt
 * (derivedEpoch): the search reads nothing else (the graph and the terrain
 * are static), so a kept path is the one a new search finds. The
 * divisions of an army walking together share each hop's search. A copy
 * goes out (callers may keep it).
 */
function sidePath(
  land: WwLand,
  army: Army,
  owner: number,
  from: number,
  to: number,
): number[] {
  const step = slowestPathStep(land, army);
  let memo = pathMemos.get(land);
  const sides = land.sideList();
  if (
    memo === undefined ||
    memo.changes !== land.controlChanges ||
    memo.epoch !== land.derivedEpoch ||
    memo.sides !== sides
  ) {
    memo = {
      changes: land.controlChanges,
      epoch: land.derivedEpoch,
      sides,
      paths: new Map(),
    };
    pathMemos.set(land, memo);
  }
  const key = `${land.sideOf(owner)}:${step}:${from}:${to}`;
  let path = memo.paths.get(key);
  if (path === undefined) {
    const sc = land.scenario;
    path = shortestPath(
      sc,
      from,
      to,
      (r) => land.sameSide(owner, land.controller[r]),
      (e, next) => edgeTicks(moveNeed(sc.edge(e), sc.landOf(next)), step),
    );
    if (memo.paths.size > 4096) memo.paths.clear();
    memo.paths.set(key, path);
  }
  return [...path];
}

const pathMemos = new WeakMap<
  WwLand,
  {
    changes: number;
    epoch: number;
    sides: readonly unknown[];
    paths: Map<string, number[]>;
  }
>();

/** Stops a division where it stands (finished here by the foundation; C and A call it). */
export function stopDivision(land: WwLand, row: number): void {
  const t = land.divisions;
  t.mode[row] = MOVE_NONE;
  t.prog[row] = 0;
  t.need[row] = 0;
  t.step[row] = 0;
  t.edge[row] = -1;
  t.dest[row] = t.region[row];
  land.markArmy(t.army[row]);
}

/** Starts a division straight into a neighbouring region (advance, retreat, walking into an empty enemy region). */
export function startHopInto(
  land: WwLand,
  row: number,
  region: number,
  mode: number,
): void {
  const t = land.divisions;
  const e = land.scenario.edgeBetween(t.region[row], region);
  if (e < 0) return;
  t.next[row] = region;
  t.edge[row] = e;
  t.prog[row] = 0;
  t.step[row] = 0;
  t.mode[row] = mode;
  t.dest[row] = region;
  t.need[row] = moveNeed(land.scenario.edge(e), land.scenario.landOf(region));
  land.markArmy(t.army[row]);
}
