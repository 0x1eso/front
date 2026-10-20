// World War 1936 P2: occupation and the tile spread (P2 spec §7.7, §9.7,
// §12). STUB: Task 4 writes the bodies; the signatures are final.
import type { WwLand } from "./WwLand";

/** Spec §7.7, §9.7, §12: `by` takes `region` now. Stub: the whole region at once. */
export function capture(
  land: WwLand,
  region: number,
  by: number,
  tick: number,
): void {
  land.setController(region, by, tick);
  const p = land.mg.playerBySmallID(by);
  if (!p.isPlayer()) return;
  for (const t of land.scenario.regionTiles(region)) {
    if (land.mg.ownerID(t) !== by) p.conquer(t);
  }
}

/** Spec §12.4: this tick's share of the spreads. */
export function stepSpread(land: WwLand): void {}

/**
 * Spec §12.5. Stub: control now, without a message each (P0 announces the
 * capitulation once), the tiles by P0's transfer queue (decision 8).
 */
export function transferOnCapitulation(
  land: WwLand,
  loser: number,
  victor: number,
): void {
  const tick = land.mg.ticks();
  for (const r of land.scenario.landRegions) {
    if (land.controller[r.id] === loser) {
      land.setController(r.id, victor, tick, false);
    }
  }
  const lp = land.mg.playerBySmallID(loser);
  if (lp.isPlayer() && victor !== 0) {
    land.ww.queueTransfer(loser, victor, Uint32Array.from(lp.tiles()));
  }
}
