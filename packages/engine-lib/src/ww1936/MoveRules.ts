// World War 1936 P2: movement (P2 spec §7.2–§7.5) and paths over the
// region graph (§7.3). The engine's movement lane and the screens' move
// previews call the same functions.
import {
  LandTerrain,
  Weather,
  WW_ROUND_HOUR_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { TERRAIN } from "./CombatRules";
import { RegionHeap } from "./RegionHeap";
import type { Edge, ScenarioIndex } from "./ScenarioIndex";
import { WEATHER } from "./Weather";

/**
 * Spec §7.2 extra distance over an edge's river, % (0 none, 1 small, 2
 * big). Task 11 (controller ruling 7): a small river +15% (was +25%; HOI4
 * −25% speed per province crossed, here a part of a region's border), a
 * big one +50%.
 */
export const RIVER_MOVE_PCT: readonly [number, number, number] = [0, 15, 50];

/** Spec §7.2: the river's extra distance, +100% over a strait. */
export function riverPct(e: Edge): number {
  return (
    RIVER_MOVE_PCT[e.river === 1 || e.river === 2 ? e.river : 0] +
    (e.strait === 1 ? 100 : 0)
  );
}

/** Milli-km to cross `edge` into a region of `toLand` on foot. */
export function moveNeed(edge: Edge, toLand: LandTerrain): number {
  return Math.floor(
    (edge.km * 1000 * (100 + TERRAIN[toLand].movePct + riverPct(edge))) / 100,
  );
}

/**
 * Milli-km a division walks in a tick (spec §7.2): speed × 1.829 h,
 * +5% per infrastructure level above 1 plus `bonusBp` (mobile_1, traits),
 * × weather, × (50 + supply/20)% — half speed without supply.
 */
export function moveStep(
  speedCenti: number,
  infra: number,
  weather: Weather,
  supplyPm: number,
  bonusBp: number,
): number {
  const base = Math.floor((speedCenti * WW_ROUND_HOUR_MILLI) / 100);
  const infraBp = 500 * Math.max(0, infra - 1);
  const a = Math.floor((base * (10_000 + infraBp + bonusBp)) / 10_000);
  const b = Math.floor((a * WEATHER[weather].movePct) / 100);
  const s = Math.max(0, Math.min(1000, supplyPm));
  return Math.max(1, Math.floor((b * (50 + Math.floor(s / 20))) / 100));
}

export const RAIL_KMH_CENTI = 5000;

/** Spec §7.4: 50 km/h (+ rail_1's 20%), no terrain or river. Milli-km a tick. */
export function railStep(railSpeedPct: number): number {
  return Math.floor(
    (RAIL_KMH_CENTI * WW_ROUND_HOUR_MILLI * (100 + railSpeedPct)) / 10_000,
  );
}

/** Spec §7.5: 5 days + km × 1.3 / 400 km a day × 1.75, in ticks (7.5 a day). */
export function seaTicks(km: number): number {
  const milliDays = 5000 + Math.floor((km * 56_875) / 10_000);
  return Math.ceil((milliDays * 15) / 2000);
}

/** Path cost of an edge for an army (spec §7.3): whole ticks at its pace. */
export function edgeTicks(need: number, step: number): number {
  return Math.ceil(need / Math.max(1, step));
}

/**
 * Dijkstra over the region graph (spec §7.3): regions `pass` accepts,
 * edge cost `cost(edgeIndex, toRegion)` in whole ticks (at least 1). Ties:
 * the smaller region id settles first, and of two equal ways in, the one
 * from the smaller region wins. [] when `to` is unreachable; [from] when
 * equal. `to` itself is taken as the last step even when `pass` refuses it
 * (the caller decides about "walk up to it and attack").
 */
export function shortestPath(
  scenario: ScenarioIndex,
  from: number,
  to: number,
  pass: (region: number) => boolean,
  cost: (edge: number, to: number) => number,
): number[] {
  if (from === to) return [from];
  const dist = new Map<number, number>([[from, 0]]);
  const prev = new Map<number, number>();
  const done = new Set<number>();
  const open = new RegionHeap();
  open.push(0, from);
  while (open.size > 0) {
    const u = open.pop();
    const du = open.lastDist;
    if (done.has(u) || du !== dist.get(u)) continue;
    if (u === to) break;
    done.add(u);
    for (const e of scenario.edgesOf(u)) {
      if (done.has(e.to) || (e.to !== to && !pass(e.to))) continue;
      const nd = du + Math.max(1, cost(e.edge, e.to));
      const old = dist.get(e.to);
      if (old === undefined || nd < old) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
        open.push(nd, e.to);
      } else if (nd === old && u < prev.get(e.to)!) {
        prev.set(e.to, u);
      }
    }
  }
  if (!prev.has(to)) return [];
  const path = [to];
  while (path[path.length - 1] !== from) {
    path.push(prev.get(path[path.length - 1])!);
  }
  return path.reverse();
}
