// World War 1936 P2: fronts (P2 spec §8.1) over plain data, so the screens'
// front preview and the engine's daily fronts agree. ww7: the front is an
// army's zone of border regions (a BFS along the border graph, or the
// player's explicit regions); the border graph, the zone BFS and the
// border-chain order live here for the screen to reuse.
import {
  WW_FRONT_DIVS_PER_REGION,
  WW_ZONE_DIVS_ATTACK,
  WW_ZONE_DIVS_DEFEND,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { ScenarioIndex } from "./ScenarioIndex";

export interface FrontWorld {
  scenario: ScenarioIndex;
  controller: ArrayLike<number>;
  /** a and b on the same side (spec §7.1). */
  sameSide(a: number, b: number): boolean;
  /** a may fight b now. */
  isEnemy(a: number, b: number): boolean;
}

/**
 * Whether a region controlled by `c` stands across `me`'s front against
 * `enemy`: `enemy`'s own (at war or not: a front can stand before the war,
 * spec §14.1), or with `enemy` 0 any country `me` may fight now. Never a
 * region of our side.
 */
export function facesFront(
  w: FrontWorld,
  me: number,
  enemy: number,
  c: number,
): boolean {
  if (c === 0 || w.sameSide(me, c)) return false;
  return enemy !== 0 ? c === enemy : w.isEnemy(me, c);
}

/**
 * Spec §8.1: our side's regions (spec §7.1: ours and our faction
 * partners') touching `enemy`'s (0: any enemy of `me`), ascending.
 */
export function borderRegionsOf(
  w: FrontWorld,
  me: number,
  enemy: number,
): number[] {
  const sc = w.scenario;
  const out: number[] = [];
  for (const r of sc.landRegions) {
    if (!w.sameSide(me, w.controller[r.id])) continue;
    for (const e of sc.edgesOf(r.id)) {
      if (facesFront(w, me, enemy, w.controller[e.to])) {
        out.push(r.id);
        break;
      }
    }
  }
  return out;
}

/**
 * ww7: a side's border against `enemy`, indexed once (the engine's day and
 * the screens build one per (side, enemy) and reuse it): the ascending
 * list, the set, and for every enemy region the border regions touching it.
 * Two border regions are linked when they share an edge or touch the same
 * enemy region (spec §8.1).
 */
export interface BorderGraph {
  list: readonly number[];
  set: ReadonlySet<number>;
  byEnemy: ReadonlyMap<number, readonly number[]>;
  /** borderLinks' memo. */
  links: Map<number, readonly number[]>;
}

/** The enemy regions each of `border`'s regions touches (iteration order: `border`'s, then the edges'). */
function enemyIndex(
  w: FrontWorld,
  me: number,
  enemy: number,
  border: Iterable<number>,
): Map<number, number[]> {
  const sc = w.scenario;
  const byEnemy = new Map<number, number[]>();
  for (const b of border) {
    for (const e of sc.edgesOf(b)) {
      if (!facesFront(w, me, enemy, w.controller[e.to])) continue;
      let l = byEnemy.get(e.to);
      if (l === undefined) byEnemy.set(e.to, (l = []));
      l.push(b);
    }
  }
  return byEnemy;
}

/** The border graph of `me`'s side against `enemy` (0: every enemy), from a border list already at hand when given. */
export function borderGraphOf(
  w: FrontWorld,
  me: number,
  enemy: number,
  border: readonly number[] = borderRegionsOf(w, me, enemy),
): BorderGraph {
  return {
    list: border,
    set: new Set(border),
    byEnemy: enemyIndex(w, me, enemy, border),
    links: new Map(),
  };
}

/** The border regions linked to `u` (ascending, never `u`). */
export function borderLinks(
  w: FrontWorld,
  g: BorderGraph,
  u: number,
): readonly number[] {
  const known = g.links.get(u);
  if (known !== undefined) return known;
  const next = new Set<number>();
  for (const e of w.scenario.edgesOf(u)) {
    if (g.set.has(e.to)) next.add(e.to);
    for (const b of g.byEnemy.get(e.to) ?? []) next.add(b);
  }
  next.delete(u);
  const out = [...next].sort((a, b) => a - b);
  g.links.set(u, out);
  return out;
}

/**
 * Spec §8.1: BFS over the border graph from `anchor`, neighbours by id, up
 * to `count`. [] when `anchor` is not a border region.
 */
export function zoneFrom(
  w: FrontWorld,
  g: BorderGraph,
  anchor: number,
  count: number,
): number[] {
  if (count <= 0 || !g.set.has(anchor)) return [];
  const out = [anchor];
  const seen = new Set<number>(out);
  for (let i = 0; i < out.length && out.length < count; i++) {
    for (const v of borderLinks(w, g, out[i])) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
      if (out.length >= count) break;
    }
  }
  return out;
}

/**
 * Spec §8.1: BFS over the border graph from `anchor`, neighbours by id, up
 * to `count`. Two border regions are linked when they share an edge or
 * touch the same enemy region. [] when `anchor` is not a border region.
 */
export function frontOf(
  w: FrontWorld,
  me: number,
  enemy: number,
  anchor: number,
  count: number,
): number[] {
  return frontOfBorder(
    w,
    me,
    enemy,
    new Set(borderRegionsOf(w, me, enemy)),
    anchor,
    count,
  );
}

/** frontOf over a border set already at hand (borderRegionsOf's, as a set). */
export function frontOfBorder(
  w: FrontWorld,
  me: number,
  enemy: number,
  border: ReadonlySet<number>,
  anchor: number,
  count: number,
): number[] {
  if (count <= 0 || !border.has(anchor)) return [];
  const g: BorderGraph = {
    list: [...border],
    set: border,
    byEnemy: enemyIndex(w, me, enemy, border),
    links: new Map(),
  };
  return zoneFrom(w, g, anchor, count);
}

/** Spec §8.1: ceil(divisions / 3). */
export function frontSize(divisions: number): number {
  return Math.max(1, Math.ceil(divisions / WW_FRONT_DIVS_PER_REGION));
}

/**
 * ww7: the regions of an army's automatic zone: ceil(divisions ÷ 2) to
 * defend, ceil(divisions ÷ 3) to attack, at least one.
 */
export function zoneSize(divisions: number, attack: boolean): number {
  const per = attack ? WW_ZONE_DIVS_ATTACK : WW_ZONE_DIVS_DEFEND;
  return Math.max(1, Math.ceil(divisions / per));
}

/**
 * ww7: `regions` in geographic order along the border: a chain walk. It
 * starts at the end of the chain (the region with the fewest links among
 * `regions`, ties: the smaller id), then steps to the linked region with
 * the fewest links left (ties: the smaller id); with none linked it jumps
 * to the nearest region by distance (ties: the smaller id). Duplicates go.
 * The same input gives the same chain on every client.
 */
export function borderChain(
  w: FrontWorld,
  me: number,
  enemy: number,
  regions: readonly number[],
): number[] {
  const list = [...new Set(regions)].sort((a, b) => a - b);
  if (list.length <= 2) return list;
  const sc = w.scenario;
  const set = new Set(list);
  const byEnemy = enemyIndex(w, me, enemy, list);
  const links = new Map<number, number[]>();
  for (const u of list) {
    const next = new Set<number>();
    for (const e of sc.edgesOf(u)) {
      if (set.has(e.to)) next.add(e.to);
      for (const b of byEnemy.get(e.to) ?? []) next.add(b);
    }
    next.delete(u);
    links.set(
      u,
      [...next].sort((a, b) => a - b),
    );
  }
  const left = new Set(list);
  const degree = (u: number) => {
    let n = 0;
    for (const v of links.get(u)!) if (left.has(v)) n++;
    return n;
  };
  // The start: the fewest links, but at least one when any region has one.
  let cur = list[0];
  let curDeg = Infinity;
  for (const u of list) {
    const d = links.get(u)!.length;
    if (d > 0 && d < curDeg) {
      cur = u;
      curDeg = d;
    }
  }
  const out: number[] = [];
  for (;;) {
    out.push(cur);
    left.delete(cur);
    if (left.size === 0) return out;
    let best = 0;
    let bestDeg = Infinity;
    for (const v of links.get(cur)!) {
      if (!left.has(v)) continue;
      const d = degree(v);
      if (d < bestDeg) {
        best = v;
        bestDeg = d;
      }
    }
    if (best === 0) {
      let bestKm = Infinity;
      for (const v of list) {
        if (!left.has(v)) continue;
        const km = sc.regionKm(cur, v);
        if (km < bestKm) {
          best = v;
          bestKm = km;
        }
      }
    }
    cur = best;
  }
}

/**
 * Spec §8.1: largest-remainder split of `n` divisions over `weights`
 * (quotas rounded down, the rest by the largest remainder, ties: smaller
 * index). Weights below 0 count as 0; all-zero weights split evenly.
 */
export function splitByWeight(n: number, weights: readonly number[]): number[] {
  const k = weights.length;
  if (k === 0 || n <= 0) return weights.map(() => 0);
  let w = weights.map((x) => Math.max(0, x));
  let total = w.reduce((s, x) => s + x, 0);
  if (total === 0) {
    w = w.map(() => 1);
    total = k;
  }
  const out = w.map((x) => Math.floor((n * x) / total));
  const rem = w.map((x) => (n * x) % total);
  let left = n - out.reduce((s, x) => s + x, 0);
  const order = [...out.keys()].sort((a, b) => rem[b] - rem[a] || a - b);
  for (let j = 0; left > 0; j++, left--) out[order[j]]++;
  return out;
}
