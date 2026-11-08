// ww162 (battle planner, design ww162 §1-§3): the map's three lines as the
// screen builds them — a stroke's regions snapped to the line they mean,
// the preview the engine will agree with, the orders a finished stroke or a
// tap sends, the handles drawn on the lines, and the undo list. Pure code
// over a FrontWorld (the screens' sides), shared by the land controller and
// the render passes.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import {
  type ArmyOrder,
  type ArmySummary,
  type Stance,
  WW_GOAL_MAX,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  borderChain,
  borderGraphOf,
  borderLinks,
  facesFront,
  type FrontWorld,
  zoneFrom,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { shortestPath } from "@openfront/engine-lib/ww1936/MoveRules";

/** The army card's line modes (design §2): what a drag or a tap on the map draws. */
export type DrawMode = "none" | "front" | "goal" | "fallback" | "divisions";
/** The three lines (the draw modes that draw). */
export type LineKind = "front" | "goal" | "fallback";

/** An offensive line starts at most this many regions from the army's front (design §2). */
export const GOAL_START_REACH = 2;
/** Undo keeps this many line orders per army and line (design §2). */
export const UNDO_DEPTH = 5;
/** A sent line shows until the army's order carries it, or this long (ms). */
export const LINE_DRAFT_MS = 4000;
/** Handle radii, screen px (design §3): a front end, an offensive waypoint. */
export const END_HANDLE_PX = 12;
export const WAYPOINT_HANDLE_PX = 10;

// ---------------------------------------------------------------------------
// The front chain (lane L1's FrontRules.frontChainBetween, same signature)
// ---------------------------------------------------------------------------

/**
 * Where an end of a front against `enemy` sits: `r` itself when it is a
 * border region, else the nearest one by a BFS over our side's land from
 * `r` (ties: the smaller id); 0 when none is reachable.
 */
export function snapToBorder(
  w: FrontWorld,
  border: ReadonlySet<number>,
  me: number,
  r: number,
): number {
  if (border.has(r)) return r;
  if (w.scenario.region(r) === undefined) return 0;
  let level = [r];
  const seen = new Set(level);
  while (level.length > 0) {
    const next: number[] = [];
    for (const u of level) {
      for (const e of w.scenario.edgesOf(u)) {
        const v = e.to;
        if (seen.has(v) || !w.sameSide(me, w.controller[v])) continue;
        seen.add(v);
        next.push(v);
      }
    }
    let best = 0;
    for (const v of next)
      if (border.has(v) && (best === 0 || v < best)) best = v;
    if (best !== 0) return best;
    level = next;
  }
  return 0;
}

/**
 * Design §1.1: the front between ends `a` and `b` against `enemy` (0: every
 * enemy). Each end snaps to the nearest border region (snapToBorder); the
 * chain is the shortest way between them over the border graph (BFS,
 * neighbours by id), at most WW_ZONE_MAX; ends in different pieces of the
 * border give `a`'s piece (zoneFrom). [] with no border.
 *
 * STUB: lane L1 owns `FrontRules.frontChainBetween`; this is the screen's
 * stand-in with the same signature and rule until it lands, and is to be
 * replaced by the lib import so preview and engine share one function.
 */
export function frontChainBetween(
  w: FrontWorld,
  me: number,
  enemy: number,
  a: number,
  b: number,
): number[] {
  const g = borderGraphOf(w, me, enemy);
  const sa = snapToBorder(w, g.set, me, a);
  const sb = snapToBorder(w, g.set, me, b);
  if (sa === 0 || sb === 0) return sa !== 0 ? [sa] : sb !== 0 ? [sb] : [];
  if (sa === sb) return [sa];
  const prev = new Map<number, number>([[sa, 0]]);
  const queue = [sa];
  for (let i = 0; i < queue.length && !prev.has(sb); i++) {
    for (const v of borderLinks(w, g, queue[i])) {
      if (prev.has(v)) continue;
      prev.set(v, queue[i]);
      queue.push(v);
    }
  }
  if (!prev.has(sb)) return zoneFrom(w, g, sa, WW_ZONE_MAX);
  const path = [sb];
  while (path[path.length - 1] !== sa)
    path.push(prev.get(path[path.length - 1])!);
  path.reverse();
  return path.slice(0, WW_ZONE_MAX);
}

// ---------------------------------------------------------------------------
// Strokes: sampled regions to a line
// ---------------------------------------------------------------------------

/** A front being drawn or held: its ends, the enemy it faces, its chain. */
export interface FrontDraft {
  ends: [number, number];
  enemy: number;
  chain: number[];
}

/** A foreign country `me` may face from `r` (at war first; ties: the smaller region id); 0: none. */
function facedFrom(w: FrontWorld, me: number, r: number): number {
  let atWar = 0;
  let other = 0;
  let atWarR = Infinity;
  let otherR = Infinity;
  for (const e of w.scenario.edgesOf(r)) {
    const c = w.controller[e.to];
    if (c === 0 || w.sameSide(me, c)) continue;
    if (w.isEnemy(me, c) && e.to < atWarR) {
      atWar = c;
      atWarR = e.to;
    }
    if (e.to < otherR) {
      other = c;
      otherR = e.to;
    }
  }
  return atWar !== 0 ? atWar : other;
}

/**
 * The enemy a front drawn from region `r` faces (design §2): the owner of
 * `r` when it is foreign, else the country the nearest region of ours
 * with a foreign neighbour faces (at war first). 0: none.
 */
export function enemyFacing(w: FrontWorld, me: number, r: number): number {
  const c = w.controller[r];
  if (w.scenario.region(r) === undefined) return 0;
  if (c !== 0 && !w.sameSide(me, c)) return c;
  if (!w.sameSide(me, c)) return 0;
  let level = [r];
  const seen = new Set(level);
  while (level.length > 0) {
    let best = 0;
    let bestR = Infinity;
    for (const u of level) {
      const f = facedFrom(w, me, u);
      if (f !== 0 && u < bestR) {
        best = f;
        bestR = u;
      }
    }
    if (best !== 0) return best;
    const next: number[] = [];
    for (const u of level) {
      for (const e of w.scenario.edgesOf(u)) {
        if (seen.has(e.to) || !w.sameSide(me, w.controller[e.to])) continue;
        seen.add(e.to);
        next.push(e.to);
      }
    }
    level = next;
  }
  return 0;
}

/** Our border set against `enemy`. */
function borderSet(w: FrontWorld, me: number, enemy: number): Set<number> {
  return new Set(borderGraphOf(w, me, enemy).list);
}

/**
 * Design §2: a front from a stroke's regions — each snaps to our nearest
 * border region against the enemy the first one faces; the first and last
 * are the ends. null when nothing snaps.
 */
export function frontFromSamples(
  w: FrontWorld,
  me: number,
  samples: readonly number[],
): FrontDraft | null {
  if (samples.length === 0) return null;
  const enemy = enemyFacing(w, me, samples[0]);
  if (enemy === 0) return null;
  const border = borderSet(w, me, enemy);
  const a = snapToBorder(w, border, me, samples[0]);
  const b = snapToBorder(w, border, me, samples[samples.length - 1]);
  if (a === 0 || b === 0) return null;
  return { ends: [a, b], enemy, chain: frontChainBetween(w, me, enemy, a, b) };
}

/** The front with end `i` moved to (the border region nearest) `r`; null when it does not snap. */
export function moveFrontEnd(
  w: FrontWorld,
  me: number,
  front: FrontDraft,
  i: 0 | 1,
  r: number,
): FrontDraft | null {
  const s = snapToBorder(w, borderSet(w, me, front.enemy), me, r);
  if (s === 0) return null;
  const ends: [number, number] =
    i === 0 ? [s, front.ends[1]] : [front.ends[0], s];
  return {
    ends,
    enemy: front.enemy,
    chain: frontChainBetween(w, me, front.enemy, ends[0], ends[1]),
  };
}

/**
 * Design §2 (taps): a tap on `r` stretches the nearest end of `front` to
 * it (by distance; ties: the first end); with no front, a one-region front
 * there. null when `r` does not snap.
 */
export function extendFront(
  w: FrontWorld,
  me: number,
  front: FrontDraft | null,
  r: number,
): FrontDraft | null {
  if (front === null) return frontFromSamples(w, me, [r]);
  const s = snapToBorder(w, borderSet(w, me, front.enemy), me, r);
  if (s === 0) return null;
  const sc = w.scenario;
  const i =
    sc.regionKm(front.ends[1], s) < sc.regionKm(front.ends[0], s) ? 1 : 0;
  return moveFrontEnd(w, me, front, i, s);
}

/** A region the line kind takes: enemy land for a goal, our side's for a fallback. */
function takes(
  w: FrontWorld,
  me: number,
  kind: "goal" | "fallback",
  r: number,
): boolean {
  if (w.scenario.region(r) === undefined) return false;
  const c = w.controller[r];
  return kind === "goal" ? facesFront(w, me, 0, c) : w.sameSide(me, c);
}

/** The result of adding regions to a goal or fallback line. */
export interface ChainResult {
  regions: number[];
  /** Some region did not fit under the cap. */
  full: boolean;
}

/**
 * Design §2: `regions` with `r` added at the end — only regions the kind
 * takes, no repeats, and a gap from the last one filled with the shortest
 * way over such regions (a fast swipe never skips); at most `max`.
 */
export function appendRegion(
  w: FrontWorld,
  me: number,
  kind: "goal" | "fallback",
  regions: readonly number[],
  r: number,
  max: number = kind === "goal" ? WW_GOAL_MAX : WW_ZONE_MAX,
): ChainResult {
  const out = [...regions];
  if (!takes(w, me, kind, r) || out.includes(r))
    return { regions: out, full: false };
  let add = [r];
  const last = out.length > 0 ? out[out.length - 1] : 0;
  if (last !== 0 && !w.scenario.edgesOf(last).some((e) => e.to === r)) {
    const path = shortestPath(
      w.scenario,
      last,
      r,
      (v) => takes(w, me, kind, v),
      () => 1,
    );
    if (path.length > 1) add = path.slice(1);
  }
  for (const v of add) {
    if (out.includes(v)) continue;
    if (out.length >= max) return { regions: out, full: true };
    out.push(v);
  }
  return { regions: out, full: false };
}

/** A goal or fallback line from a stroke's regions, in order (appendRegion each). */
export function chainFromSamples(
  w: FrontWorld,
  me: number,
  kind: "goal" | "fallback",
  samples: readonly number[],
): ChainResult {
  let regions: number[] = [];
  let full = false;
  for (const r of samples) {
    const res = appendRegion(w, me, kind, regions, r);
    regions = res.regions;
    full ||= res.full;
  }
  return { regions, full };
}

/**
 * Design §2: an offensive line must start near the army's front: within
 * GOAL_START_REACH edges of a region of `zone` (no zone: of the army's own
 * region `home`).
 */
export function goalStartOk(
  w: FrontWorld,
  zone: readonly number[],
  home: number,
  first: number,
): boolean {
  const target = new Set(zone.length > 0 ? zone : [home]);
  let level = [first];
  const seen = new Set(level);
  for (let d = 0; d <= GOAL_START_REACH; d++) {
    if (level.some((r) => target.has(r))) return true;
    const next: number[] = [];
    for (const u of level) {
      for (const e of w.scenario.edgesOf(u)) {
        if (seen.has(e.to) || w.scenario.region(e.to) === undefined) continue;
        seen.add(e.to);
        next.push(e.to);
      }
    }
    level = next;
  }
  return false;
}

/**
 * Design §2 (fallback taps): a tap on one of the line's regions drops it;
 * on another region of ours it joins at the nearer end, the way there
 * filled over our land.
 */
export function tapFallback(
  w: FrontWorld,
  me: number,
  regions: readonly number[],
  r: number,
): ChainResult {
  if (regions.includes(r))
    return { regions: regions.filter((x) => x !== r), full: false };
  if (regions.length < 2) return appendRegion(w, me, "fallback", regions, r);
  const sc = w.scenario;
  const head = regions[0];
  const tail = regions[regions.length - 1];
  if (sc.regionKm(head, r) < sc.regionKm(tail, r)) {
    const rev = appendRegion(w, me, "fallback", [...regions].reverse(), r);
    return { regions: rev.regions.reverse(), full: rev.full };
  }
  return appendRegion(w, me, "fallback", regions, r);
}

/** Design §2 (goal taps): a tap on a waypoint removes it; on another enemy region it is added at the end. */
export function tapGoal(
  w: FrontWorld,
  me: number,
  regions: readonly number[],
  r: number,
): ChainResult {
  if (regions.includes(r))
    return { regions: regions.filter((x) => x !== r), full: false };
  return appendRegion(w, me, "goal", regions, r);
}

/** The goal with waypoint `i` moved to enemy region `r` (unchanged when `r` is not one, or already on the line). */
export function moveWaypoint(
  w: FrontWorld,
  me: number,
  regions: readonly number[],
  i: number,
  r: number,
): number[] {
  if (!takes(w, me, "goal", r) || regions.includes(r)) return [...regions];
  const out = [...regions];
  if (i >= 0 && i < out.length) out[i] = r;
  return out;
}

/**
 * The fallback [추천] ring: our side's regions next to `zone` that are in
 * neither the zone nor the border, ascending, at most WW_ZONE_MAX.
 *
 * STUB: lane L1 moves AiLand's ring builder (`bestRing`) into lib
 * FrontRules; this stand-in is to be replaced by it.
 */
export function suggestRing(
  w: FrontWorld,
  me: number,
  zone: readonly number[],
): number[] {
  const inZone = new Set(zone);
  const border = borderSet(w, me, 0);
  const out = new Set<number>();
  for (const z of zone) {
    for (const e of w.scenario.edgesOf(z)) {
      const v = e.to;
      if (inZone.has(v) || border.has(v)) continue;
      if (!takes(w, me, "fallback", v)) continue;
      out.add(v);
    }
  }
  return [...out].sort((a, b) => a - b).slice(0, WW_ZONE_MAX);
}

// ---------------------------------------------------------------------------
// The army's lines as they stand (engine order, or the screen's draft)
// ---------------------------------------------------------------------------

/** The line being drawn or just sent, shown until the engine's order carries it. */
export interface LineDraft {
  kind: LineKind;
  army: number;
  /** front: the ends and enemy; goal and fallback: unused. */
  front: FrontDraft | null;
  /** front: the chain; goal and fallback: the regions in order. */
  regions: number[];
  /** A stroke or a handle drag is under way (nothing sent yet). */
  live: boolean;
  /** When it was sent (ms); 0 while live. */
  sentAt: number;
}

/** The front an army holds as a line: its order's ends, else its zone's chain ends (`withZone`). */
export function frontOfArmy(
  w: FrontWorld,
  me: number,
  a: ArmySummary,
  withZone: boolean,
): FrontDraft | null {
  const m = a.mine;
  if (m === null || m === undefined) return null;
  const o = m.order;
  if (o.ends !== undefined) {
    return {
      ends: [o.ends[0], o.ends[1]],
      enemy: o.enemy,
      chain: [...m.front],
    };
  }
  if (!withZone || m.front.length === 0) return null;
  const chain = borderChain(w, me, o.enemy, m.front);
  const enemy = o.enemy !== 0 ? o.enemy : enemyFacing(w, me, chain[0]);
  return { ends: [chain[0], chain[chain.length - 1]], enemy, chain };
}

/** What of the screen's choice the lines on show depend on (WwLandSelection). */
export interface PlannerChoice {
  draw: DrawMode;
  line: LineDraft | null;
}

/** The front on show for `a`: the draft's, else its line (its zone's ends too in [전선] mode). */
export function shownFront(
  w: FrontWorld,
  me: number,
  a: ArmySummary,
  sel: PlannerChoice,
): FrontDraft | null {
  const d = sel.line;
  if (d !== null && d.kind === "front" && d.army === a.id) return d.front;
  return frontOfArmy(w, me, a, sel.draw === "front");
}

/** The goal or fallback line on show for `a`: the draft's, else its order's. */
export function shownChain(
  a: ArmySummary,
  sel: PlannerChoice,
  kind: "goal" | "fallback",
): number[] {
  const d = sel.line;
  if (d !== null && d.kind === kind && d.army === a.id) return d.regions;
  const o = a.mine?.order;
  return [...((kind === "goal" ? o?.goal : o?.fallback) ?? [])];
}

/**
 * The chosen army's handles (design §3), drawn and pressed: with no line
 * mode both kinds, in [전선] the front's ends, in [공세선] the waypoints,
 * in the other modes none.
 */
export function shownHandles(
  w: FrontWorld,
  me: number,
  a: ArmySummary,
  sel: PlannerChoice,
): LineHandle[] {
  const draw = sel.draw;
  const front =
    draw === "none" || draw === "front" ? shownFront(w, me, a, sel) : null;
  const goal =
    draw === "none" || draw === "goal" ? shownChain(a, sel, "goal") : [];
  return lineHandles(w, me, front, goal);
}

/** Whether the army's order now carries the draft (it can give way). */
export function orderCarries(
  order: ArmyOrder | undefined,
  d: LineDraft,
): boolean {
  if (order === undefined) return false;
  const same = (x: readonly number[] | undefined, y: readonly number[]) =>
    (x ?? []).length === y.length && (x ?? []).every((v, i) => v === y[i]);
  switch (d.kind) {
    case "front":
      // A cleared front (no ends) is carried once the order has none.
      if (d.front === null) return order.ends === undefined;
      return (
        order.ends !== undefined &&
        order.ends[0] === d.front.ends[0] &&
        order.ends[1] === d.front.ends[1]
      );
    case "goal":
      return same(order.goal, d.regions);
    case "fallback":
      return same(order.fallback, d.regions);
  }
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export function frontLineOrder(army: number, f: FrontDraft): LandOrder {
  return {
    kind: "army_front_line",
    army,
    ends: [f.ends[0], f.ends[1]],
    enemy: f.enemy,
  };
}

export function goalOrder(
  army: number,
  regions: readonly number[],
  spear: boolean,
  stance: Stance,
): LandOrder {
  return { kind: "army_goal", army, regions: [...regions], spear, stance };
}

export function fallbackOrder(
  army: number,
  regions: readonly number[],
  manual: boolean,
): LandOrder {
  return { kind: "army_fallback", army, regions: [...regions], manual };
}

/**
 * The order that puts `kind`'s line back as the army holds it now (undo's
 * first entry): its ends, goal or fallback; a front with no ends goes back
 * to its zone (army_zone). null when there is nothing to put back.
 */
export function restoreOrder(a: ArmySummary, kind: LineKind): LandOrder | null {
  const o = a.mine?.order;
  if (o === undefined) return null;
  switch (kind) {
    case "front":
      return o.ends !== undefined
        ? {
            kind: "army_front_line",
            army: a.id,
            ends: [o.ends[0], o.ends[1]],
            enemy: o.enemy,
          }
        : { kind: "army_zone", army: a.id, regions: [...o.zone] };
    case "goal":
      return goalOrder(a.id, o.goal ?? [], o.spear === true, o.stance);
    case "fallback":
      return fallbackOrder(a.id, o.fallback ?? [], o.fbManual === true);
  }
}

/**
 * Design §2: the last UNDO_DEPTH line orders sent, per army and line, with
 * the state before the first of them; undo drops the newest and gives the
 * one before it to re-send.
 */
export class LineUndo {
  private readonly lists = new Map<string, LandOrder[]>();

  private key(army: number, kind: LineKind): string {
    return `${army}:${kind}`;
  }

  /** Records `order` as sent; `before` is the state to go back to when this is the first. */
  push(
    army: number,
    kind: LineKind,
    order: LandOrder,
    before: LandOrder | null,
  ): void {
    const k = this.key(army, kind);
    let l = this.lists.get(k);
    if (l === undefined) {
      l = before === null ? [] : [before];
      this.lists.set(k, l);
    }
    l.push(order);
    // The newest UNDO_DEPTH orders plus the one each undo goes back to.
    while (l.length > UNDO_DEPTH + 1) l.shift();
  }

  /** Whether undo has something to go back to. */
  canUndo(army: number, kind: LineKind): boolean {
    return (this.lists.get(this.key(army, kind))?.length ?? 0) >= 2;
  }

  /** Drops the newest order and returns the one to re-send; null when none. */
  undo(army: number, kind: LineKind): LandOrder | null {
    const l = this.lists.get(this.key(army, kind));
    if (l === undefined || l.length < 2) return null;
    l.pop();
    return l[l.length - 1];
  }

  /** Forgets an army (it is gone). */
  forget(army: number): void {
    for (const k of [...this.lists.keys()]) {
      if (k.startsWith(`${army}:`)) this.lists.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Handles (design §3): what the passes draw and the controller hits
// ---------------------------------------------------------------------------

export interface LineHandle {
  /** "end": a front end (index 0 or 1); "wp": an offensive waypoint (its index). */
  kind: "end" | "wp";
  index: number;
  region: number;
  /** Tile coords of its centre. */
  x: number;
  y: number;
  /** Radius, screen px. */
  px: number;
}

/** A region's centre, tile coords (cell centres). */
export function regionCenter(w: FrontWorld, r: number): [number, number] {
  const t = w.scenario.centerTile(r);
  const width = w.scenario.width;
  return [(t % width) + 0.5, Math.floor(t / width) + 0.5];
}

/**
 * A front end's handle: on the line where the end region meets the enemy,
 * halfway from its centre to the nearest region it faces (no such region:
 * its centre).
 */
export function endHandleAt(
  w: FrontWorld,
  me: number,
  enemy: number,
  r: number,
): [number, number] {
  const [x, y] = regionCenter(w, r);
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (const e of w.scenario.edgesOf(r)) {
    if (!facesFront(w, me, enemy, w.controller[e.to])) continue;
    const [ex, ey] = regionCenter(w, e.to);
    const d = (ex - x) * (ex - x) + (ey - y) * (ey - y);
    if (d < bestD) {
      bestD = d;
      best = [ex, ey];
    }
  }
  return best === null ? [x, y] : [(x + best[0]) / 2, (y + best[1]) / 2];
}

/** The handles of a front and an offensive line (either may be absent). */
export function lineHandles(
  w: FrontWorld,
  me: number,
  front: FrontDraft | null,
  goal: readonly number[],
): LineHandle[] {
  const out: LineHandle[] = [];
  if (front !== null) {
    const one = front.ends[0] === front.ends[1];
    for (const i of one ? [0] : [0, 1]) {
      const r = front.ends[i];
      const [x, y] = endHandleAt(w, me, front.enemy, r);
      out.push({ kind: "end", index: i, region: r, x, y, px: END_HANDLE_PX });
    }
  }
  goal.forEach((r, i) => {
    const [x, y] = regionCenter(w, r);
    out.push({ kind: "wp", index: i, region: r, x, y, px: WAYPOINT_HANDLE_PX });
  });
  return out;
}

/** The handle within `radius` tiles of (wx, wy), nearest first (ties: the earlier); null: none. */
export function hitHandle(
  handles: readonly LineHandle[],
  wx: number,
  wy: number,
  radius: number,
): LineHandle | null {
  let best: LineHandle | null = null;
  let bestD = radius * radius;
  for (const h of handles) {
    const d = (h.x - wx) * (h.x - wx) + (h.y - wy) * (h.y - wy);
    if (d <= bestD && (best === null || d < bestD)) {
      best = h;
      bestD = d;
    }
  }
  return best;
}

/**
 * The broad line's arrows (design §3): one from every third region of the
 * zone (in border-chain order, evenly spread, at most 6) to the goal region
 * nearest it: [from, to] pairs.
 */
export function broadArrows(
  w: FrontWorld,
  me: number,
  enemy: number,
  zone: readonly number[],
  goal: readonly number[],
): [number, number][] {
  if (zone.length === 0 || goal.length === 0) return [];
  const chain = borderChain(w, me, enemy, zone);
  const n = Math.min(6, Math.ceil(chain.length / 3));
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const from = chain[Math.floor(((k + 0.5) * chain.length) / n)];
    let best = goal[0];
    let bestKm = Infinity;
    for (const g of goal) {
      const km = w.scenario.regionKm(from, g);
      if (km < bestKm) {
        best = g;
        bestKm = km;
      }
    }
    out.push([from, best]);
  }
  return out;
}

/** The zone region nearest `r` (by distance; ties: the earlier); `home` when the zone is empty. */
export function nearestOf(
  w: FrontWorld,
  zone: readonly number[],
  home: number,
  r: number,
): number {
  let best = home;
  let bestKm = Infinity;
  for (const z of zone) {
    const km = w.scenario.regionKm(z, r);
    if (km < bestKm) {
      best = z;
      bestKm = km;
    }
  }
  return best;
}
