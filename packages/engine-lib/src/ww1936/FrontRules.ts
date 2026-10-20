// World War 1936 P2: fronts (P2 spec §8.1) over plain data, so the screens'
// front preview and the engine's daily fronts agree.
import { WW_FRONT_DIVS_PER_REGION } from "@openfront/engine-api/ww1936/LandTypes";
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
  const sc = w.scenario;
  // The border regions touching each enemy region.
  const byEnemy = new Map<number, number[]>();
  for (const b of border) {
    for (const e of sc.edgesOf(b)) {
      if (!facesFront(w, me, enemy, w.controller[e.to])) continue;
      let l = byEnemy.get(e.to);
      if (l === undefined) byEnemy.set(e.to, (l = []));
      l.push(b);
    }
  }
  const out = [anchor];
  const seen = new Set<number>(out);
  for (let i = 0; i < out.length && out.length < count; i++) {
    const next = new Set<number>();
    for (const e of sc.edgesOf(out[i])) {
      if (border.has(e.to)) next.add(e.to);
      for (const b of byEnemy.get(e.to) ?? []) next.add(b);
    }
    for (const v of [...next].sort((a, b) => a - b)) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
      if (out.length >= count) break;
    }
  }
  return out;
}

/** Spec §8.1: ceil(divisions / 3). */
export function frontSize(divisions: number): number {
  return Math.max(1, Math.ceil(divisions / WW_FRONT_DIVS_PER_REGION));
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
