// World War 1936 P2: front assignment (P2 spec §8.1). The pure border and
// front rules live in engine-lib (FrontRules, the screens' preview too);
// this file moves the divisions.
import {
  idleOrder,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  borderRegionsOf,
  facesFront,
  frontOf,
  frontOfBorder,
  frontSize,
  splitByWeight,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { startNextHop } from "./Movement";
import { leaveAttack, stopOrFinishEdge } from "./Orders";
import { armyRows, planDay, readinessDay, targetDistances } from "./Plans";
import type { Army, WwLand } from "./WwLand";

/** targetDistances as assignFront computed them for its army (null: it did not). */
export interface TargetDist {
  value: Int32Array | null;
}

/** Spec §8.1: base weight of a front region, and the plan's bonus toward its targets. */
const FRONT_BASE_WEIGHT = 2;
const FRONT_TARGET_WEIGHT = 2;

/**
 * Spec §8.1: the country's day, its armies in id order. Front and plan
 * armies re-anchor, redraw their front, spread their divisions by threat,
 * plan (§8.3) and, executing, attack (§8.2). A move order whose divisions
 * all stand still is done: the army waits.
 */
export function dailyFronts(land: WwLand, smallID: number, day: number): void {
  const tick = land.mg.ticks();
  // Nothing changes control during this step: one border set per enemy
  // (and per side: P5 lane A, a volunteer army stands on its host's).
  const borders = new Map<string, ReadonlySet<number>>();
  for (const a of land.armiesOf(smallID)) {
    if (a.order.kind === "move") {
      finishMove(land, a);
      continue;
    }
    if (a.order.kind !== "front" && a.order.kind !== "plan") continue;
    const enemy = a.order.enemy;
    const me = land.ownerForSides(a);
    const key = `${me}:${enemy}`;
    let border = borders.get(key);
    if (border === undefined) {
      border = new Set(borderRegionsOf(land, me, enemy));
      borders.set(key, border);
    }
    // The plan's target distances, once (nothing between moves control).
    const dist: TargetDist = { value: null };
    if (!assignFront(land, a, tick, border, dist)) continue;
    readinessDay(land, a);
    if (a.order.kind === "plan" && a.order.executing) {
      planDay(land, a, day, dist.value ?? undefined);
    }
  }
}

/** Spec §8.1: our regions touching `enemy`'s (0: any enemy), ascending. */
export function borderRegions(
  land: WwLand,
  smallID: number,
  enemy: number,
): number[] {
  return borderRegionsOf(land, smallID, enemy);
}

/** Spec §8.1: the front of `count` border regions from `anchor`, BFS order. */
export function frontFrom(
  land: WwLand,
  smallID: number,
  enemy: number,
  anchor: number,
  count: number,
): number[] {
  return frontOf(land, smallID, enemy, anchor, count);
}

function finishMove(land: WwLand, a: Army): void {
  // A new order not applied yet (applyArmyOrders runs after the days).
  if (a.pending) return;
  const t = land.divisions;
  for (const r of armyRows(land, a)) if (t.mode[r] !== MOVE_NONE) return;
  a.order = idleOrder();
  a.path = [];
  land.markArmy(a.id);
}

/**
 * The region of `border` nearest to `sources` (BFS through regions `pass`
 * accepts, a source counting as distance 0; ties: the smaller id); 0 when
 * none is reached.
 */
export function nearestBorder(
  land: WwLand,
  border: ReadonlySet<number>,
  sources: readonly number[],
  pass: (region: number) => boolean,
): number {
  const sc = land.scenario;
  const seen = new Set<number>(sources);
  let layer = [...seen];
  while (layer.length > 0) {
    let best = 0;
    for (const r of layer)
      if (border.has(r) && (best === 0 || r < best)) best = r;
    if (best !== 0) return best;
    const next: number[] = [];
    for (const u of layer) {
      for (const e of sc.edgesOf(u)) {
        if (seen.has(e.to) || !pass(e.to)) continue;
        seen.add(e.to);
        next.push(e.to);
      }
    }
    layer = next;
  }
  return 0;
}

function sameList(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Spec §8.1: the army waits where it is (its border is gone). */
function goIdle(land: WwLand, a: Army): void {
  for (const r of armyRows(land, a)) {
    leaveAttack(land, r);
    stopOrFinishEdge(land, r);
  }
  a.order = idleOrder();
  a.front = [];
  a.planBp = 0;
  land.markArmy(a.id);
}

/** Enemy divisions facing the front in `region` (standing, not advancing or retreating). */
function threatIn(
  land: WwLand,
  me: number,
  enemy: number,
  region: number,
): number {
  const t = land.divisions;
  let n = 0;
  for (const r of land.rowsIn(region)) {
    const m = t.mode[r];
    if (m === MOVE_ADVANCE || m === MOVE_RETREAT) continue;
    // P5 lane A: a volunteer division counts for the side it serves.
    const o = land.fightOwner(r);
    if (land.sameSide(me, o)) continue;
    if (enemy !== 0 ? land.sameSide(o, enemy) : land.isEnemy(me, o)) n++;
  }
  return n;
}

/** A division the front leaves where it is: fighting, retreating, advancing, on a train or ship, or walking into an enemy region. */
function busy(land: WwLand, r: number): boolean {
  const t = land.divisions;
  const m = t.mode[r];
  if (t.battle[r] !== 0) return true;
  if (m === MOVE_RETREAT || m === MOVE_ADVANCE) return true;
  if (m === MOVE_RAIL || m === MOVE_SEA) return true;
  return (
    m === MOVE_WALK &&
    !land.sameSide(land.fightOwner(r), land.controller[t.next[r]])
  );
}

/**
 * Spec §8.1 steps 1–5 for one front or plan army: re-anchor when the
 * anchor left the border (nearest border region over our side from the old
 * one), draw the front, weigh its regions (2 + enemy divisions facing it +
 * 2 toward the plan's targets), split the divisions (largest remainder,
 * ties: the smaller region), keep yesterday's assignment where it is
 * within one, move the surplus (highest ids first) to the regions short of
 * theirs. False when the army went idle (no border left).
 */
export function assignFront(
  land: WwLand,
  a: Army,
  tick: number,
  border: ReadonlySet<number> = new Set(
    borderRegionsOf(land, land.ownerForSides(a), a.order.enemy),
  ),
  dist: TargetDist = { value: null },
): boolean {
  const o = a.order;
  // P5 lane A: a volunteer army's front is its host's.
  const me = land.ownerForSides(a);
  if (!border.has(o.anchor)) {
    const anchor = nearestBorder(land, border, [o.anchor], (r) =>
      land.sameSide(me, land.controller[r]),
    );
    if (anchor === 0) {
      goIdle(land, a);
      return false;
    }
    o.anchor = anchor;
  }
  const t = land.divisions;
  const rows = armyRows(land, a);
  const front = frontOfBorder(
    land,
    me,
    o.enemy,
    border,
    o.anchor,
    frontSize(rows.length),
  );
  if (front.length === 0) {
    goIdle(land, a);
    return false;
  }
  if (!sameList(a.front, front)) {
    a.front = front;
    land.markArmy(a.id);
  }
  if (rows.length === 0) return true;
  const sc = land.scenario;
  const regions = [...front].sort((x, y) => x - y);
  // Toward the targets: the front regions nearest them.
  const toward = new Set<number>();
  if (o.kind === "plan" && o.targets.length > 0) {
    const d = (dist.value = targetDistances(land, a));
    let min = Infinity;
    for (const f of regions) min = Math.min(min, d[f]);
    for (const f of regions) if (d[f] === min) toward.add(f);
  }
  const weights = regions.map((f) => {
    let w = FRONT_BASE_WEIGHT + (toward.has(f) ? FRONT_TARGET_WEIGHT : 0);
    for (const e of sc.edgesOf(f)) {
      if (facesFront(land, me, o.enemy, land.controller[e.to])) {
        w += threatIn(land, me, o.enemy, e.to);
      }
    }
    return w;
  });
  const share = splitByWeight(rows.length, weights);
  // Yesterday's assignment: the divisions whose dest is a front region.
  const index = new Map(regions.map((f, i) => [f, i]));
  const held: number[][] = regions.map(() => []);
  const free: number[] = [];
  for (const r of rows) {
    const i = index.get(t.dest[r]);
    if (i !== undefined) held[i].push(r);
    else if (!busy(land, r)) free.push(r);
  }
  const want = share.map((s, i) =>
    Math.abs(held[i].length - s) <= 1 ? held[i].length : s,
  );
  const count = held.map((h) => h.length);
  const pool = [...free];
  for (let i = 0; i < regions.length; i++) {
    const movable = held[i].filter((r) => !busy(land, r));
    while (count[i] > want[i] && movable.length > 0) {
      pool.push(movable.pop()!);
      count[i]--;
    }
  }
  const send = (r: number, i: number) => {
    count[i]++;
    if (t.dest[r] === regions[i]) return;
    t.dest[r] = regions[i];
    if (t.mode[r] === MOVE_NONE) startNextHop(land, r, tick);
    land.markArmy(a.id);
  };
  let p = 0;
  for (let i = 0; i < regions.length; i++) {
    while (count[i] < want[i] && p < pool.length) send(pool[p++], i);
  }
  // Left over (yesterday's regions kept one over): where short the most.
  while (p < pool.length) {
    let best = 0;
    for (let i = 1; i < regions.length; i++) {
      if (share[i] - count[i] > share[best] - count[best]) best = i;
    }
    send(pool[p++], best);
  }
  return true;
}
