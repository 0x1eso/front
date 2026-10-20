// World War 1936 P2: where the army tokens stand on the map and what a tap
// hits (spec §15.2, §15.3, §15.9). Pure: the render passes and the land
// controller (Task 8) share it, so a token is tapped where it is drawn.
//
// Positions are tile coordinates as WwLandView.tokenXY gives them (a
// region's center tile, not the middle of that tile); the passes draw at
// +0.5. `zoom` is screen (CSS) pixels per tile, the TransformHandler's scale.
import type { ArmySummary } from "@openfront/engine-api/ww1936/LandTypes";
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
  for (const a of [...view.armies.values()].sort(byId)) {
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
 */
export function hitToken(
  placements: readonly TokenPlacement[],
  wx: number,
  wy: number,
  radiusTiles: number,
  current: number | null,
): number | null {
  const r2 = radiusTiles * radiusTiles;
  let best: number | null = null;
  let bestD = Infinity;
  let currentHit = false;
  let first: number | null = null;
  let after: number | null = null;
  for (const p of placements) {
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

/**
 * The renderer's token layout, frame after frame, without allocating: when
 * the view or the tick changes it samples each moving token at this tick
 * and the next (WwLandView.tokenXY), then interpolates between the two by
 * the frame's share of the tick (spec §15.2: moving tokens glide). At a
 * whole tick it equals layoutTokens.
 */
export class TokenLayoutCache {
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
  private baseTick = Number.NaN;
  private lastFrac = Number.NaN;
  private lastZoom = Number.NaN;

  /** Lays the tokens out for fractional tick `tick`; true when a placement changed. */
  update(view: WwLandView, tick: number, zoom: number): boolean {
    const base = Math.floor(tick);
    const frac = tick - base;
    let sampled = false;
    if (
      view !== this.viewSeen ||
      view.version !== this.version ||
      base !== this.baseTick
    ) {
      this.sample(view, base);
      sampled = true;
    }
    const glides = this.moving && frac !== this.lastFrac;
    if (!sampled && !glides && zoom === this.lastZoom) return false;
    this.lastFrac = frac;
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
    return true;
  }

  private sample(view: WwLandView, base: number): void {
    this.viewSeen = view;
    this.version = view.version;
    this.baseTick = base;
    const armies = this.armies;
    armies.length = 0;
    for (const a of view.armies.values()) {
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
    }
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
