// World War 1936 P4: the sea-zone graph (P4 spec §3.3, plan decision 10).
// Fleets, convoy routes and invasion voyages all find their way with
// seaPath; straits and canals close by edgePassable.
import type { ScenarioIndex } from "./ScenarioIndex";

/** What edgePassable asks about the world now. */
export interface PassQuery {
  controller(region: number): number;
  isEnemy(a: number, b: number): boolean;
  /** Spec §3.3 Montreux: Turkey controls the shore and is in no faction and at no war. */
  neutralTurkey(region: number): boolean;
  /** `a` is at war with anyone. */
  isAtWarAny(a: number): boolean;
}

/** Can `who` take edge `i` now? Warships and convoys differ only at the Bosporus. */
export function edgePassable(
  sc: ScenarioIndex,
  i: number,
  who: number,
  warship: boolean,
  q: PassQuery,
): boolean {
  const e = sc.seaEdge(i);
  if (e.strait < 0) return true;
  const st = sc.straitOf(i)!;
  for (const r of st.shore) {
    const c = q.controller(r);
    if (c !== 0 && q.isEnemy(who, c)) return false;
  }
  if (
    st.id === "bosporus" &&
    warship &&
    st.shore.every((r) => q.neutralTurkey(r))
  ) {
    // A belligerent's warships may not pass (who is at war with anyone).
    return !q.isAtWarAny(who);
  }
  return true;
}

/**
 * Spec §3.3: Dijkstra over the naval zones (≈160, O(n²)), edge cost = km.
 * Many sources at 0, stops at the first settled target. Ties: smaller zone
 * id. Lakes never appear.
 */
export function seaPath(
  sc: ScenarioIndex,
  from: readonly number[],
  to: readonly number[],
  passable: (edge: number) => boolean,
): { zones: number[]; km: number } | null {
  const zones = sc.navalZones();
  const n = zones.length;
  const at = new Map<number, number>();
  zones.forEach((z, i) => at.set(z, i));
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const goal = new Uint8Array(n);
  for (const z of to) {
    const i = at.get(z);
    if (i !== undefined) goal[i] = 1;
  }
  for (const z of from) {
    const i = at.get(z);
    if (i !== undefined) dist[i] = 0;
  }
  for (;;) {
    let best = -1;
    for (let i = 0; i < n; i++) {
      // zones ascending: ties → smaller id
      if (
        done[i] === 0 &&
        dist[i] !== Infinity &&
        (best < 0 || dist[i] < dist[best])
      ) {
        best = i;
      }
    }
    if (best < 0) return null;
    if (goal[best] === 1) {
      const path: number[] = [];
      for (let i = best; i >= 0; i = prev[i]) path.push(zones[i]);
      path.reverse();
      return { zones: path, km: dist[best] };
    }
    done[best] = 1;
    for (const { to: nz, edge } of sc.seaEdgesOf(zones[best])) {
      const j = at.get(nz);
      if (j === undefined || done[j] === 1 || !passable(edge)) continue;
      const d = dist[best] + sc.seaEdge(edge).km;
      if (
        d < dist[j] ||
        (d === dist[j] && prev[j] >= 0 && zones[best] < zones[prev[j]])
      ) {
        dist[j] = d;
        prev[j] = best;
      }
    }
  }
}

/**
 * seaPath's distances from `from` to every naval zone at once (final perf
 * lane): the same Dijkstra, run until every reachable zone is settled. A
 * zone settles in the same step, with the same km, as a seaPath to it
 * alone would stop on (the choice of the next zone never reads the
 * targets), so `dist[i]` is that seaPath's `km` (Infinity: its null).
 * Indices follow `sc.navalZones()`.
 */
export function seaDistances(
  sc: ScenarioIndex,
  from: readonly number[],
  passable: (edge: number) => boolean,
): Float64Array {
  const zones = sc.navalZones();
  const n = zones.length;
  const at = new Map<number, number>();
  zones.forEach((z, i) => at.set(z, i));
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  for (const z of from) {
    const i = at.get(z);
    if (i !== undefined) dist[i] = 0;
  }
  for (;;) {
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (
        done[i] === 0 &&
        dist[i] !== Infinity &&
        (best < 0 || dist[i] < dist[best])
      ) {
        best = i;
      }
    }
    if (best < 0) return dist;
    done[best] = 1;
    for (const { to: nz, edge } of sc.seaEdgesOf(zones[best])) {
      const j = at.get(nz);
      if (j === undefined || done[j] === 1 || !passable(edge)) continue;
      const d = dist[best] + sc.seaEdge(edge).km;
      if (
        d < dist[j] ||
        (d === dist[j] && prev[j] >= 0 && zones[best] < zones[prev[j]])
      ) {
        dist[j] = d;
        prev[j] = best;
      }
    }
  }
}

/**
 * Spec §8.1: the station zone of a sea region from where a fleet is (the
 * region's zone with the shortest sea path, ties smaller id); 0 when none.
 */
export function stationZone(
  sc: ScenarioIndex,
  sr: number,
  from: number,
  passable: (edge: number) => boolean,
): number {
  const s = sc.sr(sr);
  if (s === undefined || s.kind !== "sea") return 0;
  const p = seaPath(sc, [from], s.members, passable);
  return p === null ? 0 : p.zones[p.zones.length - 1];
}

/** Every edge open (tests, the screens' distance hints). */
export const ALL_EDGES = (): boolean => true;
