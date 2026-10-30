// World War 1936 P2: where the army tokens stand on the map and what a tap
// hits (spec §15.2, §15.3, §15.9). Pure: the render passes and the land
// controller (Task 8) share it, so a token is tapped where it is drawn.
//
// Positions are tile coordinates as WwLandView.tokenXY gives them (a
// region's center tile, not the middle of that tile); the passes draw at
// +0.5. `zoom` is screen (CSS) pixels per tile, the TransformHandler's scale.
import type { ArmySummary } from "@openfront/engine-api/ww1936/LandTypes";
import { fogOfLand } from "../hud/ww1936/FogModel";
import type { WwLandView } from "./WwLandView";

export interface TokenPlacement {
  army: number;
  /** World position in tiles (fractional), after the fan-out of tokens sharing a region. */
  x: number;
  y: number;
  /** 0: full token, 1: number chip, 2: dot (spec §15.2 LOD). */
  lod: number;
}

/** Below this zoom tokens are dots and battle markers points (LOD 2)… */
export const LOD_DOT_BELOW = 1.5;
/** …and below this one number chips (LOD 1); full tokens from here (LOD 0). */
export const LOD_CHIP_BELOW = 3;
/** Screen px from one fanned token to the next, by LOD: the token's height. */
export const TOKEN_STEP_PX: readonly number[] = [32, 16, 9];

export function tokenLod(zoom: number): number {
  return zoom < LOD_DOT_BELOW ? 2 : zoom < LOD_CHIP_BELOW ? 1 : 0;
}

/**
 * The k-th token of a region's fan, in token heights: 0, up 1, down 1, up
 * 2, down 2… (spec §15.2: spread vertically, alternating).
 */
export function fanSlot(k: number): number {
  return k === 0 ? 0 : k % 2 === 1 ? -(k + 1) / 2 : k / 2;
}

/** Reusable per-region counters for fanTokens (no allocation per frame). */
export class FanScratch {
  private stamp = new Int32Array(0);
  private seen = new Int32Array(0);
  private gen = 0;

  /** Starts a pass over regions 0..maxRegion. */
  begin(maxRegion: number): void {
    if (this.stamp.length <= maxRegion) {
      this.stamp = new Int32Array(maxRegion + 1);
      this.seen = new Int32Array(maxRegion + 1);
      this.gen = 0;
    }
    this.gen++;
  }

  /** Tokens already placed in `region` during this pass; counts this one. */
  next(region: number): number {
    if (region < 0 || region >= this.stamp.length) return 0;
    if (this.stamp[region] !== this.gen) {
      this.stamp[region] = this.gen;
      this.seen[region] = 0;
    }
    return this.seen[region]++;
  }
}

/**
 * Spreads standing tokens that share a region (spec §15.2): by army id (the
 * order of `armies`), each a token height above or below the last. A region
 * with a battle keeps its center for the battle marker, so its tokens start
 * one slot out. Moving tokens are left where they are.
 */
export function fanTokens(
  view: WwLandView,
  armies: readonly ArmySummary[],
  out: TokenPlacement[],
  n: number,
  zoom: number,
  scratch: FanScratch,
): void {
  if (n === 0) return;
  const step = TOKEN_STEP_PX[out[0].lod] / Math.max(zoom, 1e-6);
  scratch.begin(view.controller.length - 1);
  for (let i = 0; i < n; i++) {
    const a = armies[i];
    if (a.move !== null) continue;
    const k = scratch.next(a.region) + (view.battles.has(a.region) ? 1 : 0);
    out[i].y += fanSlot(k) * step;
  }
}

function byId(a: ArmySummary, b: ArmySummary): number {
  return a.id - b.id;
}

/** The token's point, or null when it stands nowhere yet (no region). */
function tokenAt(
  view: WwLandView,
  a: ArmySummary,
  tick: number,
): readonly [number, number] | null {
  const xy: readonly [number, number] | null = view.tokenXY(a, tick);
  return xy;
}

/** Where every token is drawn at `tick` and `zoom` (screen px per tile). */
export function layoutTokens(
  view: WwLandView,
  tick: number,
  zoom: number,
): TokenPlacement[] {
  const lod = tokenLod(zoom);
  const armies: ArmySummary[] = [];
  const out: TokenPlacement[] = [];
  const fog = fogOfLand(view);
  for (const a of [...view.armies.values()].sort(byId)) {
    // P6 (spec §8.9): an army the fog hides is neither placed nor tappable.
    if (fog !== undefined && !fog.armyView(a.id).visible) continue;
    const xy = tokenAt(view, a, tick);
    if (xy === null) continue;
    armies.push(a);
    out.push({ army: a.id, x: xy[0], y: xy[1], lod });
  }
  fanTokens(view, armies, out, out.length, zoom, new FanScratch());
  return out;
}

/**
 * The army under a tap at world (wx, wy) within `radiusTiles` (24 screen px,
 * spec §15.9); with several there, the one after `current` (spec §15.3-1).
 * Only the first `count` placements count (all by default).
 */
export function hitToken(
  placements: readonly TokenPlacement[],
  wx: number,
  wy: number,
  radiusTiles: number,
  current: number | null,
  count: number = placements.length,
): number | null {
  const r2 = radiusTiles * radiusTiles;
  let best: number | null = null;
  let bestD = Infinity;
  let currentHit = false;
  let first: number | null = null;
  let after: number | null = null;
  const n = Math.min(count, placements.length);
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    const dx = p.x - wx;
    const dy = p.y - wy;
    const d = dx * dx + dy * dy;
    if (d > r2) continue;
    if (d < bestD || (d === bestD && best !== null && p.army < best)) {
      best = p.army;
      bestD = d;
    }
    if (p.army === current) currentHit = true;
    if (first === null || p.army < first) first = p.army;
    if (
      current !== null &&
      p.army > current &&
      (after === null || p.army < after)
    ) {
      after = p.army;
    }
  }
  if (best === null) return null;
  if (!currentHit) return best;
  // Tapping the chosen army's stack again picks the next one by id, round.
  return after ?? first;
}

/** Where battle markers stand (tap targets of the battle card): the defending region's center, by region. */
export function battleMarkers(
  view: WwLandView,
): { region: number; x: number; y: number }[] {
  const w = view.scenario.width;
  return [...view.battles.keys()]
    .sort((a, b) => a - b)
    .map((region) => {
      const t = view.scenario.centerTile(region);
      return { region, x: t % w, y: Math.floor(t / w) };
    });
}

/** A token put somewhere else by a sample glides there over this many ticks… */
export const TOKEN_EASE_TICKS = 2;
/** …when it moved more than this (tiles; less is a frame's own glide)… */
const TOKEN_EASE_MIN_TILES = 0.5;
/** …and less than this (longer than any edge: a transfer, an eviction is put down at once). */
export const TOKEN_EASE_MAX_TILES = 240;

interface TokenEase {
  /** Offset from the sampled place at `at` (tiles), shrinking to 0. */
  ox: number;
  oy: number;
  at: number;
  /** The sample that last saw its army (the others are dropped). */
  gen: number;
}

/**
 * The renderer's token layout, frame after frame, without allocating: when
 * the view or the tick changes it samples each moving token at this tick
 * and the next (WwLandView.tokenXY), then interpolates between the two by
 * the frame's share of the tick (spec §15.2: moving tokens glide). At a
 * whole tick it equals layoutTokens.
 *
 * A token a sample puts elsewhere than its glide was going (its army's
 * token region changed, its fan slot did, a summary corrected it) glides
 * from where it was drawn over TOKEN_EASE_TICKS instead of jumping.
 */
export class TokenLayoutCache {
  /** Exactly `count` long: never an army that left the view. */
  readonly placements: TokenPlacement[] = [];
  /** Armies by id, matching placements[0..count). */
  readonly armies: ArmySummary[] = [];
  count = 0;
  /** Some token moves: positions change every frame. */
  moving = false;
  private x0 = new Float64Array(64);
  private y0 = new Float64Array(64);
  private dx = new Float64Array(64);
  private dy = new Float64Array(64);
  private readonly scratch = new FanScratch();
  private viewSeen: WwLandView | null = null;
  private version = -1;
  private fogStamp = -1;
  private baseTick = Number.NaN;
  private lastTick = Number.NaN;
  private lastZoom = Number.NaN;
  /** Each placement before its ease (the sampled place). */
  private rawX = new Float64Array(64);
  private rawY = new Float64Array(64);
  /** The last frame's armies and sampled places, for the next sample. */
  private prevIds = new Int32Array(64);
  private prevX = new Float64Array(64);
  private prevY = new Float64Array(64);
  private prevCount = 0;
  private readonly eases = new Map<number, TokenEase>();
  private gen = 0;

  /** Lays the tokens out for fractional tick `tick`; true when a placement changed. */
  update(view: WwLandView, tick: number, zoom: number): boolean {
    const base = Math.floor(tick);
    const frac = tick - base;
    let sampled = false;
    const fogStamp = fogOfLand(view)?.stamp() ?? -1;
    if (
      fogStamp !== this.fogStamp ||
      view !== this.viewSeen ||
      view.version !== this.version ||
      base !== this.baseTick
    ) {
      // A new view starts over; a new zoom moves the fan by design.
      if (view !== this.viewSeen) this.eases.clear();
      this.keepSampled(view === this.viewSeen && zoom === this.lastZoom);
      this.sample(view, base);
      sampled = true;
    }
    const glides =
      (this.moving || this.eases.size > 0) && tick !== this.lastTick;
    if (!sampled && !glides && zoom === this.lastZoom) return false;
    this.lastTick = tick;
    this.lastZoom = zoom;
    const lod = tokenLod(zoom);
    for (let i = 0; i < this.count; i++) {
      const p = this.placements[i];
      p.army = this.armies[i].id;
      p.x = this.x0[i] + this.dx[i] * frac;
      p.y = this.y0[i] + this.dy[i] * frac;
      p.lod = lod;
    }
    fanTokens(
      view,
      this.armies,
      this.placements,
      this.count,
      zoom,
      this.scratch,
    );
    for (let i = 0; i < this.count; i++) {
      this.rawX[i] = this.placements[i].x;
      this.rawY[i] = this.placements[i].y;
    }
    if (sampled) this.noteJumps(tick);
    if (this.eases.size > 0) this.ease(tick);
    return true;
  }

  /** Keeps the last frame's sampled places (none: the next sample eases nothing). */
  private keepSampled(keep: boolean): void {
    this.prevCount = 0;
    if (!keep) return;
    const n = this.count;
    if (this.prevIds.length < n) {
      this.prevIds = new Int32Array(this.rawX.length);
      this.prevX = new Float64Array(this.rawX.length);
      this.prevY = new Float64Array(this.rawX.length);
    }
    for (let i = 0; i < n; i++) {
      this.prevIds[i] = this.placements[i].army;
      this.prevX[i] = this.rawX[i];
      this.prevY[i] = this.rawY[i];
    }
    this.prevCount = n;
  }

  /**
   * After a sample: a token whose sampled place moved by more than a
   * frame's glide (and less than TOKEN_EASE_MAX_TILES) starts gliding from
   * where it was drawn; eases of armies gone are dropped.
   */
  private noteJumps(tick: number): void {
    const gen = ++this.gen;
    const min2 = TOKEN_EASE_MIN_TILES * TOKEN_EASE_MIN_TILES;
    const max2 = TOKEN_EASE_MAX_TILES * TOKEN_EASE_MAX_TILES;
    let j = 0;
    for (let i = 0; i < this.count; i++) {
      const id = this.armies[i].id;
      const e = this.eases.get(id);
      if (e !== undefined) e.gen = gen;
      // Both lists are by id.
      while (j < this.prevCount && this.prevIds[j] < id) j++;
      if (j >= this.prevCount || this.prevIds[j] !== id) continue;
      const jx = this.prevX[j] - this.rawX[i];
      const jy = this.prevY[j] - this.rawY[i];
      const d2 = jx * jx + jy * jy;
      if (d2 <= min2) continue;
      if (d2 >= max2) {
        this.eases.delete(id);
        continue;
      }
      // From where it is drawn: the jump plus what is left of a glide.
      const k = e === undefined ? 0 : easeLeft(e, tick);
      const ox = jx + (e === undefined ? 0 : e.ox * k);
      const oy = jy + (e === undefined ? 0 : e.oy * k);
      if (e === undefined) {
        this.eases.set(id, { ox, oy, at: tick, gen });
      } else {
        e.ox = ox;
        e.oy = oy;
        e.at = tick;
      }
    }
    if (this.eases.size === 0) return;
    for (const [id, e] of this.eases) {
      if (e.gen !== gen) this.eases.delete(id);
    }
  }

  /** Adds what is left of each glide; drops the finished ones. */
  private ease(tick: number): void {
    for (let i = 0; i < this.count; i++) {
      const p = this.placements[i];
      const e = this.eases.get(p.army);
      if (e === undefined) continue;
      const k = easeLeft(e, tick);
      if (k <= 0) {
        this.eases.delete(p.army);
        continue;
      }
      p.x += e.ox * k;
      p.y += e.oy * k;
    }
  }

  private sample(view: WwLandView, base: number): void {
    this.viewSeen = view;
    this.version = view.version;
    this.baseTick = base;
    const fog = fogOfLand(view);
    this.fogStamp = fog?.stamp() ?? -1;
    const armies = this.armies;
    armies.length = 0;
    for (const a of view.armies.values()) {
      if (fog !== undefined && !fog.armyView(a.id).visible) continue;
      if (tokenAt(view, a, base) !== null) armies.push(a);
    }
    armies.sort(byId);
    const n = armies.length;
    if (this.x0.length < n) {
      const cap = Math.max(n, this.x0.length * 2);
      this.x0 = new Float64Array(cap);
      this.y0 = new Float64Array(cap);
      this.dx = new Float64Array(cap);
      this.dy = new Float64Array(cap);
      this.rawX = new Float64Array(cap);
      this.rawY = new Float64Array(cap);
    }
    // Truncate when armies left (the pool shrinks with them), grow when
    // they came; an unchanged count keeps every object.
    if (this.placements.length > n) this.placements.length = n;
    while (this.placements.length < n) {
      this.placements.push({ army: 0, x: 0, y: 0, lod: 0 });
    }
    this.moving = false;
    for (let i = 0; i < n; i++) {
      const a = armies[i];
      const xy = tokenAt(view, a, base)!;
      this.x0[i] = xy[0];
      this.y0[i] = xy[1];
      this.dx[i] = 0;
      this.dy[i] = 0;
      if (a.move === null) continue;
      const next = tokenAt(view, a, base + 1);
      if (next === null) continue;
      this.dx[i] = next[0] - xy[0];
      this.dy[i] = next[1] - xy[1];
      if (this.dx[i] !== 0 || this.dy[i] !== 0) this.moving = true;
    }
    this.count = n;
  }

  /** Index of `army` in placements, or -1. */
  indexOf(army: number): number {
    for (let i = 0; i < this.count; i++) {
      if (this.armies[i].id === army) return i;
    }
    return -1;
  }
}

/** The share of an ease's offset left at `tick` (1 at its start, 0 when done). */
function easeLeft(e: TokenEase, tick: number): number {
  return Math.min(1, Math.max(0, 1 - (tick - e.at) / TOKEN_EASE_TICKS));
}
