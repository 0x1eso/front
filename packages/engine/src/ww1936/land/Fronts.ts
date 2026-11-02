// World War 1936 P2: front assignment (P2 spec §8.1), ww7: army objective
// orders. The pure border and zone rules live in engine-lib (FrontRules,
// the screens' preview too); this file draws each army's zone of the day,
// fills the gaps between armies, and moves the divisions: cover first, then
// the spare by threat (Defend) or toward the axis (Attack), then rotation.
import {
  idleOrder,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RAIL,
  MOVE_RETREAT,
  MOVE_SEA,
  MOVE_WALK,
  WW_ROUND_HOUR_MILLI,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { combatWidth } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  type BorderGraph,
  borderGraphOf,
  borderLinks,
  borderRegionsOf,
  facesFront,
  frontOf,
  splitByWeight,
  zoneFrom,
  zoneSize,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { moveNeed } from "@openfront/engine-lib/ww1936/MoveRules";
import { RegionHeap } from "@openfront/engine-lib/ww1936/RegionHeap";
import { startNextHop } from "./Movement";
import { leaveAttack, stopOrFinishEdge } from "./Orders";
import {
  armyRows,
  axisOf,
  FAR,
  finishPlan,
  oddsOf,
  planDay,
  readinessDay,
  targetDistances,
} from "./Plans";
import type { Army, WwLand } from "./WwLand";

/** Spec §8.1: base weight of a front region. */
const FRONT_BASE_WEIGHT = 2;
/** ww7: a holder below this org (% of max) swaps with a fresh spare of its army. */
const ROTATE_TIRED_PCT = 40;
/** ww7: the spare it swaps with has at least this org (% of max)... */
const ROTATE_FRESH_PCT = 70;
/** ww7: ...and gets there within 3 days (ticks: 7.5 a day). */
const ROTATE_TICKS = 22;

/** One front or plan army's day: its zone, the border it faces, what it targets. */
interface ArmyDay {
  a: Army;
  /** The side's country (a volunteer army's host). */
  me: number;
  g: BorderGraph;
  rows: number[];
  attack: boolean;
  /** targetDistances for an Attack with targets, else null. */
  dist: Int32Array | null;
  /** The zone proper; `front` is it plus the gap fills, the order cover reads. */
  zone: number[];
  front: number[];
  fills: Set<number>;
  axis: ReadonlySet<number>;
}

/** What the gap fill reads of an army: its divisions and the regions it holds. */
interface Holder {
  a: Army;
  n: number;
  front: number[];
  /** The gap regions it took (its day's). */
  fills: Set<number>;
}

/**
 * Spec §8.1: the country's day, its armies in id order. Front and plan
 * armies draw their zone (ww7), the gaps between them are filled, then each
 * covers its zone, spreads its spare divisions, rotates the tired, plans
 * (§8.3) and, executing, attacks (§8.2). A move order whose divisions all
 * stand still is done: the army waits.
 */
export function dailyFronts(land: WwLand, smallID: number, day: number): void {
  const tick = land.mg.ticks();
  // Nothing changes control during this step: one border graph per enemy
  // (and per side: P5 lane A, a volunteer army stands on its host's).
  const graphs = new Map<string, BorderGraph>();
  const days: ArmyDay[] = [];
  for (const a of land.armiesOf(smallID)) {
    if (a.order.kind === "move") {
      finishMove(land, a);
      continue;
    }
    if (a.order.kind !== "front" && a.order.kind !== "plan") continue;
    const d = openDay(land, a, graphs);
    if (d !== null) days.push(d);
  }
  // Gaps between armies, per side (a volunteer's army shares its host's).
  if (days.length > 1) {
    const sides = new Set(days.map((d) => d.me));
    for (const me of [...sides].sort((x, y) => x - y)) {
      const mine = days.filter((d) => d.me === me);
      if (mine.length > 1) {
        fillGaps(
          land,
          graphOf(land, graphs, me, 0),
          mine.map((d) => ({
            a: d.a,
            n: d.rows.length,
            front: d.front,
            fills: d.fills,
          })),
          null,
        );
      }
    }
  }
  for (const d of days) {
    commitFront(land, d);
    layout(land, d, tick);
    readinessDay(land, d.a);
    if (d.a.order.kind === "plan" && d.a.order.executing) {
      planDay(land, d.a, day, d.dist ?? undefined, d.axis);
    }
    setOdds(land, d);
  }
}

/**
 * ww7: one front or plan army's zone, gaps, divisions and (executing) attack
 * recomputed now: an order was just applied, the screen must see it within
 * a tick. Its peers' fronts stay as they are (they change on their day);
 * only this army may take the gap regions between them. `day` -1: no
 * attack (the preparation minute). False when the army went idle.
 */
export function applyFront(
  land: WwLand,
  a: Army,
  tick: number,
  day: number,
): boolean {
  const graphs = new Map<string, BorderGraph>();
  const d = openDay(land, a, graphs);
  if (d === null) return false;
  const peers: Holder[] = [];
  for (const b of land.armiesOf(a.owner)) {
    if (b.order.kind !== "front" && b.order.kind !== "plan") continue;
    if (land.ownerForSides(b) !== d.me) continue;
    peers.push(
      b === a
        ? { a, n: d.rows.length, front: d.front, fills: d.fills }
        : { a: b, n: b.divisions.length, front: b.front, fills: new Set() },
    );
  }
  if (peers.length > 1) {
    fillGaps(land, graphOf(land, graphs, d.me, 0), peers, a);
  }
  commitFront(land, d);
  layout(land, d, tick);
  if (day >= 0 && a.order.kind === "plan" && a.order.executing) {
    planDay(land, a, day, d.dist ?? undefined, d.axis);
  }
  setOdds(land, d);
  return true;
}

/** The screen's gap list: border regions facing a country at war with us where none of our side's divisions stands or is headed. */
export function gapsOf(land: WwLand, smallID: number): number[] {
  const border = borderRegionsOf(land, smallID, 0);
  if (border.length === 0) return [];
  const t = land.divisions;
  const held = new Set<number>();
  const side = land.sideMembers(land.sideOf(smallID));
  for (const member of side.length > 0 ? side : [smallID]) {
    for (const r of land.rowsOf(member)) {
      held.add(t.region[r]);
      if (t.mode[r] !== MOVE_NONE) {
        held.add(t.dest[r]);
        held.add(t.next[r]);
      }
    }
  }
  return border.filter((r) => !held.has(r));
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
  a.odds = undefined;
  land.markArmy(a.id);
}

/** The side's border graph against `enemy`, once per (side, enemy) a day. */
function graphOf(
  land: WwLand,
  graphs: Map<string, BorderGraph>,
  me: number,
  enemy: number,
): BorderGraph {
  const key = `${me}:${enemy}`;
  let g = graphs.get(key);
  if (g === undefined) {
    g = borderGraphOf(land, me, enemy);
    graphs.set(key, g);
  }
  return g;
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
  // ww7 (bands): standing in an enemy region is occupying it, not holding a front.
  if (
    m === MOVE_NONE &&
    land.isEnemy(land.fightOwner(r), land.controller[t.region[r]])
  ) {
    return true;
  }
  if (m === MOVE_RAIL || m === MOVE_SEA) return true;
  return (
    m === MOVE_WALK &&
    !land.sameSide(land.fightOwner(r), land.controller[t.next[r]])
  );
}

/**
 * ww7 item 1: the army's zone of the day. A plan whose targets are all ours
 * turns to Defend first. Defend: the explicit zone on the border, else a
 * BFS along the border from the anchor (re-anchored to the nearest border
 * region when it left the border) of ceil(divisions ÷ 2) regions. Attack:
 * the explicit zone on the border, else a BFS of ceil(divisions ÷ 3) from
 * the border region nearest the targets. Null when the army went idle (no
 * border left).
 */
function openDay(
  land: WwLand,
  a: Army,
  graphs: Map<string, BorderGraph>,
): ArmyDay | null {
  // P5 lane A: a volunteer army's front is its host's.
  const me = land.ownerForSides(a);
  finishPlan(land, a);
  const o = a.order;
  const g = graphOf(land, graphs, me, o.enemy);
  const rows = armyRows(land, a);
  const attack = o.kind === "plan";
  const dist = attack && o.targets.length > 0 ? targetDistances(land, a) : null;
  let zone: number[] = [];
  // ww7 lane D: a Defend zone may also name our own interior regions (the
  // AI's shortened front holds a fallback line behind the border).
  const explicit = [...new Set(o.zone)].filter(
    (r) => g.set.has(r) || (!attack && land.sameSide(me, land.controller[r])),
  );
  if (explicit.length > 0) {
    zone = explicit.slice(0, WW_ZONE_MAX);
  } else {
    let anchor = o.anchor;
    if (dist !== null) {
      // The border region nearest the targets (ties: the smaller id).
      let near = FAR;
      for (const r of g.list) {
        if (dist[r] < near) {
          near = dist[r];
          anchor = r;
        }
      }
    }
    if (!g.set.has(anchor)) {
      anchor = nearestBorder(land, g.set, [anchor], (r) =>
        land.sameSide(me, land.controller[r]),
      );
    }
    if (anchor !== 0) {
      o.anchor = anchor;
      zone = zoneFrom(land, g, anchor, zoneSize(rows.length, attack));
    }
  }
  if (zone.length === 0) {
    goIdle(land, a);
    return null;
  }
  return {
    a,
    me,
    g,
    rows,
    attack,
    dist,
    zone,
    front: [...zone],
    fills: new Set(),
    axis: attack ? axisOf(zone, dist) : new Set(),
  };
}

/** The day's front becomes the army's (and the screen's) when it changed. */
function commitFront(land: WwLand, d: ArmyDay): void {
  if (!sameList(d.a.front, d.front)) {
    d.a.front = d.front;
    land.markArmy(d.a.id);
  }
}

/** The army's odds for the screen (a human's plan only), marking it when they changed. */
function setOdds(land: WwLand, d: ArmyDay): void {
  const a = d.a;
  const want =
    a.order.kind === "plan" && land.ww.isHumanControlled(a.owner)
      ? oddsOf(land, a, d.dist ?? undefined)
      : undefined;
  const had = a.odds;
  if (want === undefined || want.length === 0) {
    if (had !== undefined) {
      a.odds = undefined;
      if (had.length > 0) land.markArmy(a.id);
    }
    return;
  }
  if (
    had === undefined ||
    had.length !== want.length ||
    had.some((x, i) => x.some((v, k) => v !== want[i][k]))
  ) {
    a.odds = want;
    land.markArmy(a.id);
  }
}

/**
 * ww7 item 6: after every army has its zone, the border regions (against
 * the countries at war with us) of a border component that holds the zones
 * of two or more of the side's front or plan armies and that no army
 * covers go to the nearest of those armies (border-graph distance, ties:
 * the smaller army id) while it still has a division for every region it
 * holds. `only`: the one army that may take (the others' fronts are as
 * they stand). `holders` is in army id order; the takers' `front` grows.
 */
function fillGaps(
  land: WwLand,
  g: BorderGraph,
  holders: readonly Holder[],
  only: Army | null,
): void {
  if (g.list.length === 0) return;
  // The border's components.
  const comp = new Map<number, number>();
  let nc = 0;
  for (const s of g.list) {
    if (comp.has(s)) continue;
    comp.set(s, nc);
    const queue = [s];
    for (let i = 0; i < queue.length; i++) {
      for (const v of borderLinks(land, g, queue[i])) {
        if (comp.has(v)) continue;
        comp.set(v, nc);
        queue.push(v);
      }
    }
    nc++;
  }
  const covered = new Set<number>();
  const armies: Holder[][] = Array.from({ length: nc }, () => []);
  for (const h of holders) {
    const seen = new Set<number>();
    for (const r of h.front) {
      covered.add(r);
      const c = comp.get(r);
      if (c !== undefined && !seen.has(c)) {
        seen.add(c);
        armies[c].push(h);
      }
    }
  }
  for (let c = 0; c < nc; c++) {
    const arms = armies[c];
    if (arms.length < 2) continue;
    const open = g.list.filter((r) => comp.get(r) === c && !covered.has(r));
    if (open.length === 0) continue;
    // Border-graph distance from each army's part of the component.
    const reach = arms.map((h) => {
      const dist = new Map<number, number>();
      const queue: number[] = [];
      for (const r of h.front) {
        if (comp.get(r) === c && !dist.has(r)) {
          dist.set(r, 0);
          queue.push(r);
        }
      }
      for (let i = 0; i < queue.length; i++) {
        for (const v of borderLinks(land, g, queue[i])) {
          if (dist.has(v)) continue;
          dist.set(v, dist.get(queue[i])! + 1);
          queue.push(v);
        }
      }
      return dist;
    });
    const near = (r: number) =>
      Math.min(...reach.map((m) => m.get(r) ?? Infinity));
    open.sort((x, y) => near(x) - near(y) || x - y);
    const room = arms.map((h) => h.n - h.front.length);
    for (const r of open) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < arms.length; i++) {
        const dd = reach[i].get(r);
        if (dd === undefined || room[i] <= 0) continue;
        if (dd < bestD) {
          best = i;
          bestD = dd;
        }
      }
      if (best < 0) continue;
      room[best]--;
      if (only !== null && arms[best].a !== only) continue;
      arms[best].front.push(r);
      arms[best].fills.add(r);
    }
  }
}

/** The mean width of `rows`' divisions (at least 1). */
export function meanWidthOf(land: WwLand, rows: readonly number[]): number {
  let widths = 0;
  for (const r of rows) widths += land.baseStatsOf(r).width;
  return Math.max(1, Math.floor(widths / Math.max(1, rows.length)));
}

/**
 * ww7 item 3: the divisions a zone region takes at most: 1.5 × its combat
 * width for `dirs` enemy directions, in divisions `mean` wide (the layout,
 * the AI's gate).
 */
export function zoneCap(
  land: WwLand,
  region: number,
  dirs: number,
  mean: number,
): number {
  const width = combatWidth(land.scenario.landOf(region), Math.max(1, dirs));
  return Math.max(1, Math.floor((3 * width) / (2 * mean)));
}

/** Spare divisions into `share` by `weight`, never above `cap`; what fits nowhere is left over. */
function spread(
  spare: number,
  share: number[],
  cap: readonly number[],
  weight: number[],
): number {
  for (let i = 0; i < share.length; i++) if (share[i] >= cap[i]) weight[i] = 0;
  let left = spare;
  while (left > 0 && weight.some((x) => x > 0)) {
    const add = splitByWeight(left, weight);
    left = 0;
    for (let i = 0; i < add.length; i++) {
      if (add[i] === 0) continue;
      const take = Math.min(add[i], cap[i] - share[i]);
      share[i] += take;
      left += add[i] - take;
      if (share[i] >= cap[i]) weight[i] = 0;
    }
  }
  return left;
}

/**
 * ww7 items 2 and 3, for one front or plan army: every region of its front
 * gets one division first (the nearest free one, ties: the smaller id; too
 * few divisions: by threat × (1 + victory points) descending), then the
 * spare: Defend by weight 2 + enemy divisions facing the region (moving
 * only when off by more than one), Attack to the axis (the regions nearest
 * the targets, overflow to the next nearest), never above 1.5 × the
 * region's combat width. What fits nowhere stays in reserve where it is.
 * Then the tired holders rotate out.
 */
function layout(land: WwLand, d: ArmyDay, tick: number): void {
  const a = d.a;
  const o = a.order;
  const t = land.divisions;
  const sc = land.scenario;
  const regions = a.front;
  const rows = d.rows;
  const n = rows.length;
  const k = regions.length;
  if (n === 0 || k === 0) return;
  const me = d.me;
  // The enemy divisions facing each region, and the directions they stand in.
  const threat = new Array<number>(k).fill(0);
  const dirs = new Array<number>(k).fill(0);
  for (let i = 0; i < k; i++) {
    const enemy = d.fills.has(regions[i]) ? 0 : o.enemy;
    for (const e of sc.edgesOf(regions[i])) {
      if (!facesFront(land, me, enemy, land.controller[e.to])) continue;
      dirs[i]++;
      threat[i] += threatIn(land, me, enemy, e.to);
    }
  }
  // Cover order: threat × (1 + victory points), then the points, then the smaller id.
  const vp = regions.map((f) => sc.region(f)?.vp ?? 0);
  const prio = [...regions.keys()].sort(
    (x, y) =>
      threat[y] * (1 + vp[y]) - threat[x] * (1 + vp[x]) ||
      vp[y] - vp[x] ||
      regions[x] - regions[y],
  );
  const coverN = Math.min(n, k);
  const covered = new Array<boolean>(k).fill(false);
  for (let j = 0; j < coverN; j++) covered[prio[j]] = true;
  // 1.5 × the combat width, in divisions of this army's mean width.
  const mean = meanWidthOf(land, rows);
  const cap = regions.map((f, i) => zoneCap(land, f, dirs[i], mean));
  // The shares: one for the covered, then the spare.
  const share = covered.map((c) => (c ? 1 : 0));
  const spare = n - coverN;
  if (spare > 0) {
    if (!d.attack) {
      spread(
        spare,
        share,
        cap,
        regions.map((_, i) => (covered[i] ? FRONT_BASE_WEIGHT + threat[i] : 0)),
      );
    } else {
      // The axis first, the overflow to the next nearest regions.
      const dist = (f: number) => (d.dist === null ? 0 : d.dist[f]);
      const steps = [
        ...new Set(regions.filter((_, i) => covered[i]).map(dist)),
      ].sort((x, y) => x - y);
      let left = spare;
      for (const step of steps) {
        if (left <= 0) break;
        left = spread(
          left,
          share,
          cap,
          regions.map((f, i) => (covered[i] && dist(f) === step ? 1 : 0)),
        );
      }
    }
  }
  // Yesterday's assignment: the divisions whose dest is a front region.
  const index = new Map(regions.map((f, i) => [f, i]));
  const held: number[][] = regions.map(() => []);
  const pool: number[] = [];
  for (const r of rows) {
    const i = index.get(t.dest[r]);
    if (i !== undefined) held[i].push(r);
    else if (!busy(land, r)) pool.push(r);
  }
  // Defend keeps yesterday's count where it is within one of the share.
  const want = share.map((s, i) => {
    if (!covered[i]) return 0;
    const h = held[i].length;
    return !d.attack && h >= 1 && Math.abs(h - s) <= 1
      ? Math.min(h, cap[i])
      : s;
  });
  const count = held.map((h) => h.length);
  const movable = held.map((h) => h.filter((r) => !busy(land, r)));
  for (let i = 0; i < k; i++) {
    while (count[i] > want[i] && movable[i].length > 0) {
      pool.push(movable[i].pop()!);
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
  // The free division nearest `region` (ties: the smaller id; rows are in id order).
  const take = (i: number) => {
    let best = 0;
    let bestKm = Infinity;
    for (let p = 0; p < pool.length; p++) {
      const km = sc.regionKm(t.region[pool[p]], regions[i]);
      if (km < bestKm || (km === bestKm && pool[p] < pool[best])) {
        best = p;
        bestKm = km;
      }
    }
    const r = pool[best];
    pool.splice(best, 1);
    send(r, i);
  };
  // A covered region with nobody may draw on a region holding two or more.
  const donate = (): boolean => {
    let from = -1;
    for (let i = 0; i < k; i++) {
      if (count[i] < 2 || movable[i].length === 0) continue;
      if (from < 0 || count[i] - share[i] > count[from] - share[from]) from = i;
    }
    if (from < 0) return false;
    pool.push(movable[from].pop()!);
    count[from]--;
    return true;
  };
  for (const i of prio) {
    if (!covered[i] || count[i] > 0) continue;
    if (pool.length === 0 && !donate()) break;
    take(i);
  }
  for (const i of prio) {
    while (count[i] < want[i] && pool.length > 0) take(i);
  }
  // Left over (yesterday's regions kept one over): where short the most.
  while (pool.length > 0) {
    let best = -1;
    for (let i = 0; i < k; i++) {
      if (!covered[i] || count[i] >= cap[i]) continue;
      if (best < 0 || share[i] - count[i] > share[best] - count[best]) best = i;
    }
    if (best < 0) break;
    take(best);
  }
  rotate(land, d, tick);
}

/** Milli-km `r` walks in a tick on a clear day over level ground with full supply. */
function stepOf(land: WwLand, r: number): number {
  return Math.floor(
    (land.baseStatsOf(r).speedCenti * WW_ROUND_HOUR_MILLI) / 100,
  );
}

/**
 * Milli-km it takes to walk over our side's land from each region to
 * `to` (Dijkstra backwards from `to`, edge costs as MoveRules.moveNeed),
 * for the regions within `bound`.
 */
function walkNeeds(
  land: WwLand,
  me: number,
  to: number,
  bound: number,
): Map<number, number> {
  const sc = land.scenario;
  const need = new Map<number, number>([[to, 0]]);
  const done = new Set<number>();
  const open = new RegionHeap();
  open.push(0, to);
  while (open.size > 0) {
    const u = open.pop();
    const du = open.lastDist;
    if (done.has(u) || du !== need.get(u)) continue;
    done.add(u);
    for (const e of sc.edgesOf(u)) {
      if (done.has(e.to) || !land.sameSide(me, land.controller[e.to])) {
        continue;
      }
      // The cost of walking from e.to into u.
      const nd = du + moveNeed(sc.edge(e.edge), sc.landOf(u));
      if (nd > bound) continue;
      const old = need.get(e.to);
      if (old === undefined || nd < old) {
        need.set(e.to, nd);
        open.push(nd, e.to);
      }
    }
  }
  return need;
}

/**
 * ww7 item 4: a zone holder (standing at its post, not in battle) below 40 %
 * org swaps with the freshest spare of its army (at least 70 %, not alone at
 * a post, within 3 days of the tired one's region). The tired ones go in
 * order of their org, each division swaps at most once a day.
 */
function rotate(land: WwLand, d: ArmyDay, tick: number): void {
  const t = land.divisions;
  const regions = d.a.front;
  const at = new Map(regions.map((f, i) => [f, i]));
  const posts = new Map<number, number>();
  const count = regions.map(() => 0);
  for (const r of d.rows) {
    const i = at.get(t.dest[r]);
    if (i === undefined) continue;
    posts.set(r, i);
    count[i]++;
  }
  const tired: number[] = [];
  for (const [r, i] of posts) {
    if (t.mode[r] !== MOVE_NONE || t.region[r] !== regions[i]) continue;
    if (t.battle[r] !== 0) continue;
    if (t.org[r] * 100 < land.orgMaxOf(r) * ROTATE_TIRED_PCT) tired.push(r);
  }
  if (tired.length === 0) return;
  // Least rested first (org ÷ max, cross-multiplied), then the smaller id.
  tired.sort(
    (x, y) =>
      t.org[x] * land.orgMaxOf(y) - t.org[y] * land.orgMaxOf(x) || x - y,
  );
  const used = new Set<number>();
  // How far to look: what the army's fastest division walks in 3 days.
  let reach = 0;
  for (const r of d.rows) reach = Math.max(reach, stepOf(land, r));
  reach *= ROTATE_TICKS;
  for (const x of tired) {
    const post = t.dest[x];
    const needs = walkNeeds(land, d.me, post, reach);
    let best = -1;
    for (const r of d.rows) {
      if (used.has(r) || r === x || t.region[r] === post) continue;
      if (busy(land, r)) continue;
      if (t.org[r] * 100 < land.orgMaxOf(r) * ROTATE_FRESH_PCT) continue;
      const i = posts.get(r);
      // A spare: in reserve, or one of two or more at its post.
      if (i !== undefined && (count[i] < 2 || regions[i] === post)) continue;
      const need = needs.get(t.region[r]);
      if (need === undefined || need > stepOf(land, r) * ROTATE_TICKS) continue;
      if (
        best < 0 ||
        t.org[r] * land.orgMaxOf(best) > t.org[best] * land.orgMaxOf(r)
      ) {
        best = r;
      }
    }
    if (best < 0) continue;
    const i = posts.get(best);
    const home = i === undefined ? t.region[best] : regions[i];
    used.add(x);
    used.add(best);
    t.dest[best] = post;
    t.dest[x] = home;
    if (t.mode[best] === MOVE_NONE) startNextHop(land, best, tick);
    if (t.mode[x] === MOVE_NONE) startNextHop(land, x, tick);
    land.markArmy(d.a.id);
  }
}
