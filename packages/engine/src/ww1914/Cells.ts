// Great War 1914 (ww179): each place's cell. A place is one region of the
// map; the regions of its country that are no place belong to the nearest
// place of the same country, by land first, then (an island or a coast cut
// off from every place) by distance on the map. When a place changes hands
// its whole cell goes with it, so every land region of a country with
// places can be taken. Derived from the map files, never stored.
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { GW_PLACE_KEYS } from "@openfront/engine-api/ww1914/GwPlaces";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { GreatWar } from "./GreatWar";

interface Cells {
  readonly byPlace: ReadonlyMap<GwPlace, number[]>;
  /** Regions joined by distance, not by land: they border nothing. */
  readonly detached: ReadonlySet<number>;
}

const CELLS = new WeakMap<ScenarioIndex, Cells>();

/** Place -> the regions of its cell, its own first, then ascending. */
export const placeCells = (gw: GreatWar): ReadonlyMap<GwPlace, number[]> =>
  cellsOf(gw).byPlace;

/** Regions of a cell cut off from its place by water. */
export const detachedRegions = (gw: GreatWar): ReadonlySet<number> =>
  cellsOf(gw).detached;

function cellsOf(gw: GreatWar): Cells {
  const idx = gw.scenario;
  const known = CELLS.get(idx);
  if (known !== undefined) return known;
  const owners = gw.world.owners;
  const placeOf = new Map<number, GwPlace>();
  for (const p of GW_PLACE_KEYS) {
    const id = gw.world.places.get(p);
    if (id !== undefined) placeOf.set(id, p);
  }
  const cell = new Map<number, number>();
  let edge = [...placeOf.keys()].sort((a, b) => a - b);
  for (const id of edge) cell.set(id, id);
  while (edge.length > 0) {
    const next: number[] = [];
    for (const id of edge) {
      const home = cell.get(id)!;
      for (const n of idx.regionNeighbours(id)) {
        if (cell.has(n) || owners[n] !== owners[home]) continue;
        cell.set(n, home);
        next.push(n);
      }
    }
    edge = next.sort((a, b) => a - b);
  }
  // What no land route reaches goes to its country's nearest region that
  // has a place, by the regions' centres.
  const withPlace = new Set<number>();
  for (const id of placeOf.keys()) withPlace.add(owners[id]);
  const regions = [...idx.data.regions].sort((a, b) => a.id - b.id);
  const detached = new Set<number>();
  const placed = regions.filter(
    (r) => cell.has(r.id) && r.center !== undefined,
  );
  for (const r of regions) {
    if (
      cell.has(r.id) ||
      !withPlace.has(owners[r.id]) ||
      r.center === undefined
    )
      continue;
    const [rx, ry] = r.center;
    let best = -1;
    let bestD = Infinity;
    for (const q of placed) {
      if (owners[q.id] !== owners[r.id]) continue;
      const dx = q.center![0] - rx;
      const dy = q.center![1] - ry;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = q.id;
      }
    }
    if (best < 0) continue;
    cell.set(r.id, cell.get(best)!);
    detached.add(r.id);
  }
  const out = new Map<GwPlace, number[]>();
  for (const [id, p] of placeOf) out.set(p, [id]);
  for (const [id, home] of [...cell].sort((a, b) => a[0] - b[0])) {
    if (id !== home) out.get(placeOf.get(home)!)!.push(id);
  }
  const cells = { byPlace: out, detached };
  CELLS.set(idx, cells);
  return cells;
}
