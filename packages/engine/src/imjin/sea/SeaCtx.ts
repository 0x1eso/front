// Imjin sea layer: what the tick needs from the game, as plain functions, so
// the rules run the same on a test map and on the real one (WwImjin.ctx builds
// it from a Game).
import { MT } from "@openfront/engine-lib/imjin/SeaRules";
import type { SeaFlags } from "@openfront/engine-lib/imjin/Terrain";

export interface SeaCtx {
  seed: number;
  tick: number;
  /** Game calendar month 1-12 and day index (wind holds 10 days). */
  month: number;
  day: number;
  night: boolean;
  /** Map size in tiles. */
  width: number;
  height: number;
  ref(x: number, y: number): number;
  tileX(tile: number): number;
  tileY(tile: number): number;
  isWater(tile: number): boolean;
  flags(tile: number): SeaFlags;
  /** Sea zone of a water tile (wind is per zone); 0 when unknown. */
  zoneOf(tile: number): number;
  hostile(a: number, b: number): boolean;
  /** Water path (tiles, from excluded or included) or null; the existing water A*. */
  path(from: number, to: number): number[] | null;
  /** The nearest friendly port tile for a fleeing fleet, or -1. */
  nearestPort(owner: number, x: number, y: number): number;
  /** Naval base level at a tile for an owner (0 when none). */
  portLevelAt(owner: number, tile: number): number;
  /** Binary angle a channel current flows along at its + sign. */
  currentAxis(current: number): number;
  /** Japan and Ming keep a taken ship; Joseon burns it. */
  keepsPrizes(owner: number): boolean;
  /** ww177 P7b: Japan's owner id (its prize guns), absent off the real map. */
  japan?: number;
  /** ww177 P7b: fortified anchorages (the wajō) that fire on hostile ships. */
  batteries?(): readonly SeaBattery[];
  /**
   * ww177 final (design §6.2): whether `owner`'s side holds both shores of
   * the channel at milli-tile (x, y) whose current is `current`, and so
   * sees its turn coming. Absent: no one does.
   */
  holdsShores?(owner: number, x: number, y: number, current: number): boolean;
}

export interface SeaBattery {
  /** The port tile. */
  tile: number;
  owner: number;
  /** Fort level: the battery fires 2 × level light guns. */
  level: number;
}

/** The tile under a milli-tile position, or -1 off the map. */
export function tileAt(ctx: SeaCtx, x: number, y: number): number {
  const tx = Math.floor(x / MT);
  const ty = Math.floor(y / MT);
  if (tx < 0 || ty < 0 || tx >= ctx.width || ty >= ctx.height) return -1;
  return ctx.ref(tx, ty);
}

/** The centre of a tile in milli-tiles. */
export function tileCentre(
  ctx: SeaCtx,
  tile: number,
): { x: number; y: number } {
  return {
    x: ctx.tileX(tile) * MT + (MT >> 1),
    y: ctx.tileY(tile) * MT + (MT >> 1),
  };
}

const NO_FLAGS: SeaFlags = {
  coastal: false,
  lee: false,
  channel: false,
  shoal: false,
  current: 0,
  currentDir: 0,
};

export function flagsAt(ctx: SeaCtx, x: number, y: number): SeaFlags {
  const t = tileAt(ctx, x, y);
  return t < 0 ? NO_FLAGS : ctx.flags(t);
}
