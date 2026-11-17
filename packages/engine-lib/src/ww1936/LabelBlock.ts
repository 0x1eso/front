// ww240: where a country's name sits on the map. The box of every region it
// controls spans its colonies too (a civil-war side holding a few scattered
// colonies had its name over the sea), so the name goes on its home block
// instead: the piece of contiguous land it controls with the most homeland
// victory points (a region's scenario `core`: not a colony or mandate; the
// capital and the big cities weigh most), then the most homeland tiles,
// then the most tiles. Display only: nothing in the game reads it.

/** What the home block reads from the scenario (ScenarioIndex). */
export interface LabelBlockScenario {
  readonly landRegions: readonly { readonly id: number }[];
  region(
    id: number,
  ):
    | { readonly tiles: number; readonly core: boolean; readonly vp: number }
    | undefined;
  regionNeighbours(id: number): readonly number[];
  /** [minX, minY, maxX, maxY]; all -1 for a region without tiles. */
  bbox(id: number): readonly [number, number, number, number];
}

/**
 * The regions of `smallID`'s home block, ascending; empty when it controls
 * none. Ties go to the block holding the lowest region id.
 */
export function homeBlock(
  sc: LabelBlockScenario,
  controller: ArrayLike<number>,
  smallID: number,
): number[] {
  const seen = new Set<number>();
  let best: number[] = [];
  let bestScore = [-1, -1, -1];
  for (const r of sc.landRegions) {
    if (controller[r.id] !== smallID || seen.has(r.id)) continue;
    const block: number[] = [];
    let coreVp = 0;
    let core = 0;
    let tiles = 0;
    const stack = [r.id];
    seen.add(r.id);
    while (stack.length > 0) {
      const id = stack.pop()!;
      block.push(id);
      const info = sc.region(id);
      tiles += info?.tiles ?? 0;
      if (info?.core === true) {
        coreVp += info.vp;
        core += info.tiles;
      }
      for (const n of sc.regionNeighbours(id)) {
        if (controller[n] !== smallID || seen.has(n)) continue;
        seen.add(n);
        stack.push(n);
      }
    }
    const score = [coreVp, core, tiles];
    const i = score.findIndex((v, n) => v !== bestScore[n]);
    if (i >= 0 && score[i] > bestScore[i]) {
      best = block;
      bestScore = score;
    }
  }
  return best.sort((a, b) => a - b);
}

/** The tile box of `smallID`'s home block; null when it controls no land. */
export function homeBlockBox(
  sc: LabelBlockScenario,
  controller: ArrayLike<number>,
  smallID: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (const id of homeBlock(sc, controller, smallID)) {
    const b = sc.bbox(id);
    if (b[0] < 0) continue;
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  }
  return x1 < 0 ? null : { minX: x0, minY: y0, maxX: x1, maxY: y1 };
}
