// World War 1936 P2: fronts (P2 spec §8.1) over plain data, so the screens'
// front preview and the engine's daily fronts agree. ww7: the front is an
// army's zone of border regions (a BFS along the border graph, or the
// player's explicit regions); the border graph, the zone BFS and the
// border-chain order live here for the screen to reuse.
import {
  WW_FRONT_DIVS_PER_REGION,
  WW_ZONE_DIVS_ATTACK,
  WW_ZONE_DIVS_DEFEND,
  WW_ZONE_MAX,
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

/**
 * The region of `border` nearest to `sources` (BFS through regions `pass`
 * accepts, a source counting as distance 0; ties: the smaller id); 0 when
 * none is reached.
 */
export function nearestOf(
  w: Pick<FrontWorld, "scenario">,
  border: ReadonlySet<number>,
  sources: readonly number[],
  pass: (region: number) => boolean,
): number {
  const sc = w.scenario;
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

/**
 * ww162 §1.1: where a front line's end stands today: itself while it is a
 * border region, else the border region nearest it over our side's land
 * (ties: the smaller id); 0 when none is reached.
 */
export function snapFrontEnd(
  w: FrontWorld,
  g: BorderGraph,
  me: number,
  end: number,
): number {
  if (g.set.has(end)) return end;
  return nearestOf(w, g.set, [end], (r) => w.sameSide(me, w.controller[r]));
}

/** A front line of the day: its two ends snapped to the border, and the chain between them. */
export interface FrontLine {
  ends: [number, number];
  chain: number[];
}

/**
 * ww162 §1.1: the front line between `a` and `b` against `enemy` (0: every
 * enemy). Each end snaps to the border (snapFrontEnd; an end with none
 * reached takes the other's); the chain is the shortest path between the
 * snapped ends over the border graph (BFS, neighbours by id, so ties go to
 * the smaller id), from `a`'s end to `b`'s, at most WW_ZONE_MAX regions
 * (cut at `b`'s side). Ends in different border pieces: `a`'s piece by
 * zoneFrom. Null when neither end reaches the border. The engine, the AI
 * and the screen's preview all call this, so they agree.
 */
export function frontLineBetween(
  w: FrontWorld,
  me: number,
  enemy: number,
  a: number,
  b: number,
  g: BorderGraph = borderGraphOf(w, me, enemy),
): FrontLine | null {
  let sa = snapFrontEnd(w, g, me, a);
  let sb = a === b ? sa : snapFrontEnd(w, g, me, b);
  if (sa === 0 && sb === 0) return null;
  if (sa === 0) sa = sb;
  if (sb === 0) sb = sa;
  if (sa === sb) return { ends: [sa, sb], chain: [sa] };
  const parent = new Map<number, number>([[sa, 0]]);
  const queue = [sa];
  for (let i = 0; i < queue.length && !parent.has(sb); i++) {
    for (const v of borderLinks(w, g, queue[i])) {
      if (parent.has(v)) continue;
      parent.set(v, queue[i]);
      queue.push(v);
    }
  }
  if (!parent.has(sb)) {
    return { ends: [sa, sb], chain: zoneFrom(w, g, sa, WW_ZONE_MAX) };
  }
  const chain: number[] = [];
  for (let u = sb; u !== 0; u = parent.get(u)!) chain.push(u);
  chain.reverse();
  return { ends: [sa, sb], chain: chain.slice(0, WW_ZONE_MAX) };
}

/** ww162 §1.1: frontLineBetween's chain ([] when no end reaches the border). */
export function frontChainBetween(
  w: FrontWorld,
  me: number,
  enemy: number,
  a: number,
  b: number,
  g?: BorderGraph,
): number[] {
  return frontLineBetween(w, me, enemy, a, b, g)?.chain ?? [];
}

// ---- Fallback rings (ww7 lane D item 2; ww162 §1.3 moved here from AiLand) ----

/** A ring must be this much shorter than the border, %: no retreat for a region or two (AI_SHORTEN_MIN_SAVE_PCT). */
export const RING_MIN_SAVE_PCT = 25;
/** The suggested fallback lies at most this many layers behind the line (AI_SHORTEN_LAYERS). */
export const RING_LAYERS = 3;
/** Edges no region is from the line (the BFS's unreached). */
const RING_FAR = 1 << 30;

/** A candidate line: its regions, its terrain (half regions) and the victory points it gives up. */
export interface Ring {
  regions: number;
  terrain: number;
  vpLost: number;
}

/**
 * ww7 lane D item 2 (design §7): the best ring to fall back to (the index in
 * `rings`, nearest first), -1 to stay on the border. The score, smallest wins,
 * is regions − terrain + victory points given up, in half regions: a river, a
 * fort level step, a mountain or a city is worth half a region (so a long
 * ring of rivers does not beat a short one on open ground); a victory point
 * a whole one. A ring must be RING_MIN_SAVE_PCT shorter than the border
 * and score better than holding it. Ties: the nearer ring.
 */
export function bestRing(
  border: { regions: number; terrain: number },
  rings: readonly Ring[],
  /** ww91 rule 3: what the points given up count, % of normal. */
  vpPct = 100,
): number {
  const score = (r: Ring) =>
    2 * r.regions - r.terrain + Math.floor((2 * r.vpLost * vpPct) / 100);
  let best = -1;
  let bestScore = score({ ...border, vpLost: 0 });
  rings.forEach((r, i) => {
    if (r.regions === 0) return;
    if (r.regions * 100 > border.regions * (100 - RING_MIN_SAVE_PCT)) {
      return;
    }
    const s = score(r);
    if (s < bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/**
 * A line region's terrain, half regions: fort (more from level 3), every way
 * in over a river (land type is capped in the rules: ww65). `ahead`: the
 * regions in front of the line; `fort`: a region's working fort level.
 */
export function ringTerrain(
  w: Pick<FrontWorld, "scenario">,
  r: number,
  ahead: (x: number) => boolean,
  fort: (x: number) => number,
): number {
  const sc = w.scenario;
  let s = 0;
  const f = fort(r);
  if (f >= 1) s++;
  if (f >= 3) s++;
  let any = false;
  let river = true;
  for (const e of sc.edgesOf(r)) {
    if (!ahead(e.to)) continue;
    any = true;
    if (sc.edge(e.edge).river === 0) river = false;
  }
  return any && river ? s + 1 : s;
}

/** The rings behind a line, the line's own score input and each ring's candidate (fallbackRings). */
export interface RingSet {
  /** rings[k]: the regions k layers behind the line (rings[0] the line), in `regions` order. */
  rings: number[][];
  /** The line itself as bestRing's `border`. */
  border: { regions: number; terrain: number };
  /** rings[1..layers] as bestRing's candidates (candidates[i] is rings[i + 1]). */
  candidates: Ring[];
}

/**
 * ww7 lane D item 2: the rings behind `line` (BFS layers through regions
 * `pass` accepts, at most `layers` deep), listed in `regions`' order (our
 * side's regions, ascending), with their terrain and the victory points
 * each gives up. `ahead0`: what stands in front of the line itself (the
 * enemy's regions).
 */
export function fallbackRings(
  w: Pick<FrontWorld, "scenario">,
  line: readonly number[],
  pass: (region: number) => boolean,
  regions: readonly number[],
  layers: number,
  ahead0: (region: number) => boolean,
  fort: (region: number) => number,
): RingSet {
  const sc = w.scenario;
  const dist = new Int32Array(sc.maxRegionId() + 1).fill(RING_FAR);
  const queue: number[] = [];
  for (const s of line) {
    if (dist[s] === 0) continue;
    dist[s] = 0;
    queue.push(s);
  }
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i];
    if (dist[u] >= layers) continue;
    for (const e of sc.edgesOf(u)) {
      if (dist[e.to] !== RING_FAR || !pass(e.to)) continue;
      dist[e.to] = dist[u] + 1;
      queue.push(e.to);
    }
  }
  const rings: number[][] = Array.from({ length: layers + 1 }, () => []);
  const vpAt = new Array<number>(layers + 1).fill(0);
  for (const r of regions) {
    const d = dist[r];
    if (d === RING_FAR || (d !== 0 && !pass(r))) continue;
    rings[d].push(r);
    vpAt[d] += sc.region(r)?.vp ?? 0;
  }
  const terrainOf = (k: number) => {
    const ahead = (x: number) => (k === 0 ? ahead0(x) : dist[x] === k - 1);
    let s = 0;
    for (const r of rings[k]) s += ringTerrain(w, r, ahead, fort);
    return s;
  };
  const candidates: Ring[] = [];
  let vpLost = 0;
  for (let k = 1; k <= layers; k++) {
    vpLost += vpAt[k - 1];
    candidates.push({
      regions: rings[k].length,
      terrain: rings[k].length === 0 ? 0 : terrainOf(k),
      vpLost,
    });
  }
  return {
    rings,
    border: { regions: line.length, terrain: terrainOf(0) },
    candidates,
  };
}

/**
 * ww162 §1.3 [추천]: the fallback line the AI would pick behind an army's
 * front `zone` against `enemy` (0: every enemy): the rings behind it over
 * our side's land (not through the rest of the border), scored by bestRing;
 * when no ring beats holding, the nearest ring that has regions. At most
 * WW_ZONE_MAX regions, ascending; [] when nothing lies behind.
 */
export function suggestFallback(
  w: FrontWorld,
  me: number,
  enemy: number,
  zone: readonly number[],
  fort: (region: number) => number = () => 0,
): number[] {
  const line = [...new Set(zone)].filter((r) =>
    w.sameSide(me, w.controller[r]),
  );
  if (line.length === 0) return [];
  const border = new Set(borderRegionsOf(w, me, 0));
  const inLine = new Set(line);
  const ours: number[] = [];
  for (const r of w.scenario.landRegions) {
    if (w.sameSide(me, w.controller[r.id])) ours.push(r.id);
  }
  const set = fallbackRings(
    w,
    line,
    (r) => w.sameSide(me, w.controller[r]) && !border.has(r) && !inLine.has(r),
    ours,
    RING_LAYERS,
    (x) => facesFront(w, me, enemy, w.controller[x]),
    fort,
  );
  let k = bestRing(set.border, set.candidates) + 1;
  if (k === 0) {
    k = set.rings.findIndex((ring, i) => i > 0 && ring.length > 0);
    if (k < 0) return [];
  }
  return set.rings[k].slice(0, WW_ZONE_MAX);
}
