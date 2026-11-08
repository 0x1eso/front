// World War 1936 P2: where the army tokens stand on the map and what a tap
// hits (spec §15.2, §15.3, §15.9). Pure: the render passes and the land
// controller (Task 8) share it, so a token is tapped where it is drawn.
//
// Positions are tile coordinates as WwLandView.tokenXY gives them (a
// region's center tile, not the middle of that tile); the passes draw at
// +0.5. `zoom` is screen (CSS) pixels per tile, the TransformHandler's scale.
//
// ww162 (army design §3.1): the counters group by zoom, as HOI4's do. Below
// LOD_DOT_BELOW one chip per country per region sums its armies there
// (LEVEL_REGION); up to DIVISION_SPLIT_AT one counter per army
// (LEVEL_ARMY, today's chip and token); from there each of my divisions has
// its own counter (LEVEL_DIVISION), merging again below DIVISION_MERGE_BELOW.
// Other countries stay one counter per army: the fog sends only their totals.
import {
  ARMY_BATTLE,
  ARMY_ENCIRCLED,
  ARMY_EXECUTING,
  type ArmySummary,
  BATTALION_IDS,
  type DivisionData,
  type TemplateData,
} from "@openfront/engine-api/ww1936/LandTypes";
import { fogOfLand } from "../hud/ww1936/FogModel";
import { ZONE_HUE_COUNT as ZONE_HUES } from "./WarBadges";
import type { WwLandView } from "./WwLandView";

export interface TokenPlacement {
  army: number;
  /** World position in tiles (fractional), after the fan-out of tokens sharing a region. */
  x: number;
  y: number;
  /** 0: full token, 1: number chip, 2: region chip (a dot before ww162), 3: division counter. */
  lod: number;
  /** ww162: the division a division counter stands for (its army is `army`). */
  division?: number;
  /** ww162: a region chip's army: its divisions, so a tap picks the biggest first. */
  weight?: number;
  /** ww162: a "+N" chip: N more of my divisions in `region`. */
  more?: number;
  region?: number;
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

/** ww162 §3.1: one chip per country per region (zoom < LOD_DOT_BELOW). */
export const LEVEL_REGION = 0;
/** One counter per army: today's chip and token. */
export const LEVEL_ARMY = 1;
/** One counter per division of mine; other countries per army. */
export const LEVEL_DIVISION = 2;
/** My armies split into divisions from this zoom… */
export const DIVISION_SPLIT_AT = 6;
/** …and merge again below this one (a pinch at the edge never flickers). */
export const DIVISION_MERGE_BELOW = 5;
/** A region shows at most this many division counters; past it, one less and a "+N" chip. */
export const REGION_DIVISIONS_MAX = 4;
/** Screen px between fanned region chips (a chip and its bars). */
export const REGION_STEP_PX = 22;
/** A division counter's size against a full token (24 px tall instead of 32). */
export const DIVISION_SCALE = 0.75;

/** Whether my armies stand split into divisions at `zoom`, given they did (`split`). */
export function nextSplit(zoom: number, split: boolean): boolean {
  if (zoom >= DIVISION_SPLIT_AT) return true;
  if (zoom < DIVISION_MERGE_BELOW) return false;
  return split;
}

/** The counter level at `zoom` with `split` (nextSplit). */
export function counterLevel(zoom: number, split: boolean): number {
  if (zoom < LOD_DOT_BELOW) return LEVEL_REGION;
  return split ? LEVEL_DIVISION : LEVEL_ARMY;
}

/**
 * What the renderer and the taps share about the counters of one view: the
 * split (the hysteresis between DIVISION_MERGE_BELOW and DIVISION_SPLIT_AT)
 * and the regions whose "+N" chip a tap fanned open. Both ask it with the
 * same zoom, so a counter is tapped where it is drawn.
 */
export class CounterState {
  split = false;
  /** Bumped when the split or the opened regions change. */
  version = 0;
  private readonly open = new Set<number>();

  /** The level at `zoom`, moving the split across its edges. */
  level(zoom: number): number {
    const s = nextSplit(zoom, this.split);
    if (s !== this.split) {
      this.split = s;
      if (!s) this.open.clear();
      this.version++;
    }
    return counterLevel(zoom, s);
  }

  /** The region's "+N" chip was tapped open: all its division counters show. */
  isOpen(region: number): boolean {
    return this.open.has(region);
  }

  /** Opens the region's division fan, or closes it again. */
  toggleOpen(region: number): void {
    if (!this.open.delete(region)) this.open.add(region);
    this.version++;
  }

  /** Whether some region's fan is open. */
  anyOpen(): boolean {
    return this.open.size > 0;
  }

  /** Closes every open fan (a tap elsewhere); true when one was open. */
  closeAll(): boolean {
    if (this.open.size === 0) return false;
    this.open.clear();
    this.version++;
    return true;
  }
}

const COUNTER_STATES = new WeakMap<WwLandView, CounterState>();

/** The counter state of `view` (made on first use). */
export function counterStateOf(view: WwLandView): CounterState {
  let s = COUNTER_STATES.get(view);
  if (s === undefined) {
    s = new CounterState();
    COUNTER_STATES.set(view, s);
  }
  return s;
}

/** A counter for one army (another country's, or any at LEVEL_ARMY). */
export const C_ARMY = 0;
/** A region chip: one country's armies in one region, summed. */
export const C_REGION = 1;
/** One of my divisions. */
export const C_DIVISION = 2;
/**
 * "+N": my divisions in a region past REGION_DIVISIONS_MAX. A fan a tap
 * opened keeps it in the same slot with N = 0 (drawn "−", the rest of the
 * fan past it): a second tap there closes the fan again.
 */
export const C_MORE = 3;

/** Bars as the fog lets them show: exact, in steps ("close"), or unknown. */
export const BARS_EXACT = 0;
export const BARS_CLOSE = 1;
export const BARS_GRAY = 2;

/** One counter to draw (the renderer's; taps read tapPlacements). */
export interface Counter {
  type: number;
  /** World position in tiles, after the fan and any glide. */
  x: number;
  y: number;
  /** The army a tap chooses: a region chip's biggest, a division's own, a "+N" chip's first hidden. */
  army: number;
  /** Index of the army in the layout's `armies` (C_ARMY, and a moving army's region chip): it stands at that placement. -1: at its fan slot. */
  index: number;
  /** The region center and fan slot it stands at when `index` is -1. */
  cx: number;
  cy: number;
  slot: number;
  region: number;
  /** C_DIVISION: the division id; 0 otherwise. */
  division: number;
  /** C_REGION: its armies, biggest first (ties: the smaller id); otherwise [army]. */
  members: number[];
  owner: number;
  /** Branch symbol (BATTALION_IDS index), -1 none. */
  symbol: number;
  /** Divisions it shows (-1: "?"); a "+N" chip's N. */
  shown: number;
  approx: boolean;
  bars: number;
  strengthPm: number;
  orgPm: number;
  /** ARMY_* bits it shows (a division: ARMY_BATTLE while it fights). */
  state: number;
  /** The zone hue (army id % 4) of my counter's rim; -1 for another country's. */
  hue: number;
  /** A division with a pin (army design §1.4). */
  pinned: boolean;
  /** Before the glide (a division's ease). */
  rx: number;
  ry: number;
}

function newCounter(): Counter {
  return {
    type: C_ARMY,
    x: 0,
    y: 0,
    army: 0,
    index: -1,
    cx: 0,
    cy: 0,
    slot: 0,
    region: 0,
    division: 0,
    members: [],
    owner: 0,
    symbol: -1,
    shown: 0,
    approx: false,
    bars: BARS_EXACT,
    strengthPm: 0,
    orgPm: 0,
    state: 0,
    hue: -1,
    pinned: false,
    rx: 0,
    ry: 0,
  };
}

/** A template's branch symbol, as the engine picks an army's: its most numerous battalion (ties: the first). */
export function templateSymbol(t: Pick<TemplateData, "battalions">): number {
  let best: string | null = null;
  let bestN = 0;
  const counts = new Map<string, number>();
  for (const id of t.battalions) {
    const n = (counts.get(id) ?? 0) + 1;
    counts.set(id, n);
  }
  for (const [id, n] of counts) {
    if (n > bestN) {
      best = id;
      bestN = n;
    }
  }
  return best === null
    ? -1
    : (BATTALION_IDS as readonly string[]).indexOf(best);
}

/** A bar in five steps (spec §8.9, "close" band), as ArmyTokenPass shows a fogged army's. */
export function stepPm(pm: number): number {
  return Math.min(1000, Math.ceil(pm / 200) * 200);
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
  skip: Uint8Array | null = null,
): void {
  if (n === 0) return;
  const step = TOKEN_STEP_PX[out[0].lod] / Math.max(zoom, 1e-6);
  scratch.begin(view.controller.length - 1);
  for (let i = 0; i < n; i++) {
    const a = armies[i];
    // ww162: an army drawn as its divisions takes no slot.
    if (a.move !== null || (skip !== null && skip[i] !== 0)) continue;
    const k = scratch.next(a.region) + (view.battles.has(a.region) ? 1 : 0);
    out[i].y += fanSlot(k) * step;
  }
}

function byId(a: ArmySummary, b: ArmySummary): number {
  return a.id - b.id;
}

/**
 * Where every counter is drawn at `tick` and `zoom` (screen px per tile), as
 * tap targets: a token or chip per army, at LEVEL_REGION one placement per
 * army at its region chip (with its `weight`), at LEVEL_DIVISION one per
 * division of mine (`division`) and the "+N" chips (`more`). `me` defaults
 * to the fog's viewer. The level comes from the view's CounterState, which
 * the renderer moves with the same zoom.
 */
export function layoutTokens(
  view: WwLandView,
  tick: number,
  zoom: number,
  me?: number,
): TokenPlacement[] {
  const cache = new TokenLayoutCache();
  cache.update(view, tick, zoom, me);
  return cache.tapPlacements();
}

/** Whether `p` comes before `q` in a stack's tap order: the bigger region-chip army, then the smaller id. */
function tapsBefore(pw: number, pa: number, qw: number, qa: number): boolean {
  return pw > qw || (pw === qw && pa < qa);
}

/**
 * The army under a tap at world (wx, wy) within `radiusTiles` (24 screen px,
 * spec §15.9); with several there, the one after `current` (spec §15.3-1).
 * Only the first `count` placements count (all by default). ww162: at the
 * region level the armies of a chip all stand on it, and the order is the
 * biggest first (`weight`), then by id.
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
  let bestW = 0;
  let bestD = Infinity;
  let currentHit = false;
  let currentW = 0;
  const n = Math.min(count, placements.length);
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    const dx = p.x - wx;
    const dy = p.y - wy;
    const d = dx * dx + dy * dy;
    if (d > r2) continue;
    const w = p.weight ?? 0;
    if (
      d < bestD ||
      (d === bestD && best !== null && tapsBefore(w, p.army, bestW, best))
    ) {
      best = p.army;
      bestW = w;
      bestD = d;
    }
    if (p.army === current) {
      currentHit = true;
      currentW = w;
    }
  }
  if (best === null || !currentHit) return best;
  // Tapping the chosen army's stack again picks the next one, round.
  let first: number | null = null;
  let firstW = 0;
  let after: number | null = null;
  let afterW = 0;
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    const dx = p.x - wx;
    const dy = p.y - wy;
    if (dx * dx + dy * dy > r2) continue;
    const w = p.weight ?? 0;
    if (first === null || tapsBefore(w, p.army, firstW, first)) {
      first = p.army;
      firstW = w;
    }
    if (
      tapsBefore(currentW, current!, w, p.army) &&
      (after === null || tapsBefore(w, p.army, afterW, after))
    ) {
      after = p.army;
      afterW = w;
    }
  }
  return after ?? first;
}

/** What a tap on the counters hits (hitCounter). */
export type CounterHit =
  | { kind: "army"; army: number }
  | { kind: "division"; army: number; division: number }
  | { kind: "more"; army: number; region: number };

/**
 * ww162 §3.1: the counter under a tap at world (wx, wy) within
 * `radiusTiles`. The nearest one decides: a division counter gives that
 * division, a "+N" chip its region (a tap opens it: CounterState.toggleOpen),
 * anything else an army as hitToken picks it (cycling from `current`). Ties
 * go to the smaller division, then army id.
 */
export function hitCounter(
  placements: readonly TokenPlacement[],
  wx: number,
  wy: number,
  radiusTiles: number,
  current: number | null,
  count: number = placements.length,
): CounterHit | null {
  const r2 = radiusTiles * radiusTiles;
  const n = Math.min(count, placements.length);
  let best: TokenPlacement | null = null;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const p = placements[i];
    const dx = p.x - wx;
    const dy = p.y - wy;
    const d = dx * dx + dy * dy;
    if (d > r2) continue;
    if (
      d < bestD ||
      (d === bestD &&
        best !== null &&
        ((p.division ?? 0) < (best.division ?? 0) ||
          ((p.division ?? 0) === (best.division ?? 0) && p.army < best.army)))
    ) {
      best = p;
      bestD = d;
    }
  }
  if (best === null) return null;
  if (best.division !== undefined) {
    return { kind: "division", army: best.army, division: best.division };
  }
  if (best.more !== undefined) {
    return { kind: "more", army: best.army, region: best.region ?? 0 };
  }
  const army = hitToken(placements, wx, wy, radiusTiles, current, n);
  return army === null ? null : { kind: "army", army };
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
 * A token put somewhere else by a sample glides there over this many ticks
 * (of the ease clock: TokenLayoutCache.update's `easeAt`, which runs on
 * while the game is paused)…
 */
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
  /** A sample's points at this tick and the next (tokenXYInto). */
  private readonly xy: [number, number] = [0, 0];
  private readonly next: [number, number] = [0, 0];

  /**
   * ww162 §3.1: what is drawn, `counterCount` of them (the pool is longer):
   * at LEVEL_ARMY a C_ARMY per placement; at LEVEL_REGION the region chips;
   * at LEVEL_DIVISION my divisions, "+N" chips and the other armies.
   */
  readonly counters: Counter[] = [];
  counterCount = 0;
  /** The level the counters were grouped at (LEVEL_*). */
  level = LEVEL_ARMY;
  /** The viewer the counters were grouped for. */
  private me = -1;
  private stateVersion = -1;
  private stateSeen: CounterState | null = null;
  /** Armies drawn as their divisions (skip[i] = 1): no fan slot. */
  private skip = new Uint8Array(64);
  private readonly regionGroups = new Map<number, Counter>();
  private readonly standing = new Map<number, number>();
  /** Division glides: the last group's places by division id, and the eases. */
  private readonly divPrev = new Map<number, number>();
  private divPrevX = new Float64Array(64);
  private divPrevY = new Float64Array(64);
  private readonly divEases = new Map<number, TokenEase>();

  /**
   * ww162: the regions where a standing counter is drawn (not one on the
   * move), and a version bumped when they change: the wing tokens at an air
   * base there take a column of their own beside the land counters.
   */
  readonly landRegions = new Set<number>();
  landRegionsVersion = 0;
  private readonly landRegionsNext = new Set<number>();
  /** The ease clock the last frame was laid out at. */
  private lastEaseAt = Number.NaN;

  /**
   * Lays the tokens out for fractional tick `tick`; true when a placement
   * or a counter changed. `me` (the viewer whose divisions split) defaults
   * to the fog's. The glides run on `easeAt` (ticks; by default the game's
   * own): the renderer gives a wall clock in ticks, so a counter a tap moved
   * while the game is paused (a "+N" fan, a regroup) still glides home.
   */
  update(
    view: WwLandView,
    tick: number,
    zoom: number,
    me?: number,
    easeAt: number = tick,
  ): boolean {
    const base = Math.floor(tick);
    const frac = tick - base;
    let sampled = false;
    const fog = fogOfLand(view);
    const fogStamp = fog?.stamp() ?? -1;
    const viewer = me ?? fog?.me() ?? 0;
    const state = counterStateOf(view);
    const level = state.level(zoom);
    const sameView = view === this.viewSeen;
    if (
      fogStamp !== this.fogStamp ||
      view !== this.viewSeen ||
      view.version !== this.version ||
      base !== this.baseTick
    ) {
      // A new view starts over; a new zoom moves the fan by design.
      if (view !== this.viewSeen) {
        this.eases.clear();
        this.divEases.clear();
      }
      this.keepSampled(view === this.viewSeen && zoom === this.lastZoom);
      this.sample(view, base);
      sampled = true;
    }
    const regroup =
      sampled ||
      level !== this.level ||
      viewer !== this.me ||
      state !== this.stateSeen ||
      state.version !== this.stateVersion;
    const glides =
      (this.moving && tick !== this.lastTick) ||
      ((this.eases.size > 0 || this.divEases.size > 0) &&
        easeAt !== this.lastEaseAt);
    if (!regroup && !glides && zoom === this.lastZoom) return false;
    const keepDivs =
      regroup &&
      sameView &&
      level === LEVEL_DIVISION &&
      this.level === LEVEL_DIVISION &&
      zoom === this.lastZoom;
    if (regroup) {
      this.group(view, viewer, level, state, keepDivs);
      this.noteLandRegions();
    }
    this.lastTick = tick;
    this.lastEaseAt = easeAt;
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
      this.level === LEVEL_DIVISION ? this.skip : null,
    );
    for (let i = 0; i < this.count; i++) {
      this.rawX[i] = this.placements[i].x;
      this.rawY[i] = this.placements[i].y;
    }
    if (sampled) this.noteJumps(easeAt);
    if (this.eases.size > 0) this.ease(easeAt);
    this.placeCounters(zoom);
    if (keepDivs) this.noteDivJumps(easeAt);
    if (this.divEases.size > 0) this.easeDivs(easeAt);
    return true;
  }

  /** The counters as tap targets (layoutTokens). */
  tapPlacements(): TokenPlacement[] {
    const out: TokenPlacement[] = [];
    for (let i = 0; i < this.counterCount; i++) {
      const c = this.counters[i];
      if (c.type === C_ARMY) {
        const p = this.placements[c.index];
        out.push({ army: p.army, x: p.x, y: p.y, lod: p.lod });
      } else if (c.type === C_REGION) {
        for (const id of c.members) {
          const a = this.armyOf(id);
          out.push({
            army: id,
            x: c.x,
            y: c.y,
            lod: 2,
            weight: a !== undefined && a.owner === this.me ? a.divisions : 0,
          });
        }
      } else if (c.type === C_DIVISION) {
        out.push({
          army: c.army,
          x: c.x,
          y: c.y,
          lod: 3,
          division: c.division,
          region: c.region,
        });
      } else {
        out.push({
          army: c.army,
          x: c.x,
          y: c.y,
          lod: 3,
          more: c.shown,
          region: c.region,
        });
      }
    }
    return out;
  }

  /** The army `id` as the last sample saw it. */
  private armyOf(id: number): ArmySummary | undefined {
    return this.viewSeen?.armies.get(id);
  }

  private take(k: number): Counter {
    while (this.counters.length <= k) this.counters.push(newCounter());
    const c = this.counters[k];
    c.members.length = 0;
    c.index = -1;
    c.slot = 0;
    c.division = 0;
    c.symbol = -1;
    c.shown = 0;
    c.approx = false;
    c.bars = BARS_EXACT;
    c.strengthPm = 0;
    c.orgPm = 0;
    c.state = 0;
    c.hue = -1;
    c.pinned = false;
    return c;
  }

  private center(c: Counter, region: number): void {
    const sc = this.viewSeen!.scenario;
    const t = sc.centerTile(region);
    c.region = region;
    c.cx = t % sc.width;
    c.cy = Math.floor(t / sc.width);
  }

  /** Builds the counters for `level` from the sampled armies (and my division records). */
  private group(
    view: WwLandView,
    me: number,
    level: number,
    state: CounterState,
    keepDivs: boolean,
  ): void {
    if (keepDivs) this.keepDivs();
    this.level = level;
    this.me = me;
    this.stateSeen = state;
    this.stateVersion = state.version;
    const n = this.count;
    if (this.skip.length < n) this.skip = new Uint8Array(this.x0.length);
    this.skip.fill(0, 0, n);
    let k = 0;
    if (level === LEVEL_ARMY) {
      for (let i = 0; i < n; i++) k = this.armyCounter(k, i, me);
    } else if (level === LEVEL_REGION) {
      k = this.groupRegions(view, me);
    } else {
      k = this.groupDivisions(view, me, state);
    }
    this.counterCount = k;
  }

  private armyCounter(k: number, i: number, me: number): number {
    const a = this.armies[i];
    const c = this.take(k);
    c.type = C_ARMY;
    c.army = a.id;
    c.index = i;
    c.region = a.region;
    c.owner = a.owner;
    c.members.push(a.id);
    c.hue = a.owner === me ? a.id % ZONE_HUES : -1;
    return k + 1;
  }

  /** LEVEL_REGION: one chip per country per region; a moving army is a chip of its own. */
  private groupRegions(view: WwLandView, me: number): number {
    const groups = this.regionGroups;
    groups.clear();
    let k = 0;
    for (let i = 0; i < this.count; i++) {
      const a = this.armies[i];
      if (a.move !== null) {
        const c = this.take(k++);
        c.type = C_REGION;
        c.index = i;
        c.region = a.region;
        c.owner = a.owner;
        c.members.push(a.id);
        continue;
      }
      const key = a.owner * 65536 + a.region;
      let c = groups.get(key);
      if (c === undefined) {
        c = this.take(k++);
        c.type = C_REGION;
        c.owner = a.owner;
        this.center(c, a.region);
        groups.set(key, c);
      }
      c.members.push(a.id);
    }
    const fog = fogOfLand(view);
    this.scratch.begin(view.controller.length - 1);
    for (let j = 0; j < k; j++) {
      const c = this.counters[j];
      const mine = c.owner === me;
      // Biggest first (a tap's order), ties to the smaller id.
      if (c.members.length > 1) {
        c.members.sort((x, y) => {
          const wx = mine ? (view.armies.get(x)?.divisions ?? 0) : 0;
          const wy = mine ? (view.armies.get(y)?.divisions ?? 0) : 0;
          return wy - wx || x - y;
        });
      }
      this.sumUp(c, view, fog, mine);
      if (c.index < 0) {
        c.slot =
          this.scratch.next(c.region) + (view.battles.has(c.region) ? 1 : 0);
      }
    }
    return k;
  }

  /** A region chip's count, bars and badges from its armies, as the fog lets them show. */
  private sumUp(
    c: Counter,
    view: WwLandView,
    fog: ReturnType<typeof fogOfLand>,
    mine: boolean,
  ): void {
    let shown = 0;
    let weight = 0;
    let str = 0;
    let org = 0;
    for (const id of c.members) {
      const a = view.armies.get(id)!;
      const fv = fog?.armyView(id);
      const v = fv !== undefined && fv.visible ? fv : null;
      const s = v === null ? a.divisions : v.shown;
      shown = shown < 0 || s < 0 ? -1 : shown + s;
      if (v !== null) {
        if (v.approx) c.approx = true;
        const bars =
          v.bars === "exact"
            ? BARS_EXACT
            : v.bars === "gray"
              ? BARS_GRAY
              : BARS_CLOSE;
        c.bars = Math.max(c.bars, bars);
      }
      const w = Math.max(1, a.divisions);
      weight += w;
      str += a.strengthPm * w;
      org += a.orgPm * w;
      c.state |=
        (mine ? a.state : a.state & ~ARMY_EXECUTING) &
        (ARMY_ENCIRCLED | ARMY_EXECUTING | ARMY_BATTLE);
    }
    const lead = view.armies.get(c.members[0])!;
    c.army = lead.id;
    c.symbol = lead.symbol;
    c.hue = mine ? lead.id % ZONE_HUES : -1;
    c.shown = shown;
    c.strengthPm = weight > 0 ? Math.round(str / weight) : 0;
    c.orgPm = weight > 0 ? Math.round(org / weight) : 0;
    if (c.bars === BARS_CLOSE) {
      c.strengthPm = stepPm(c.strengthPm);
      c.orgPm = stepPm(c.orgPm);
    } else if (c.bars === BARS_GRAY) {
      c.strengthPm = 0;
      c.orgPm = 0;
    }
  }

  /**
   * LEVEL_DIVISION: each of my armies with division records becomes its
   * divisions, at their own regions, fanned after the other tokens there;
   * past REGION_DIVISIONS_MAX a region shows one less and a "+N" chip,
   * unless a tap opened it.
   */
  private groupDivisions(
    view: WwLandView,
    me: number,
    state: CounterState,
  ): number {
    const detail = me > 0 ? view.details.get(me) : undefined;
    const split = new Map<number, ArmySummary>();
    if (detail !== undefined) {
      const has = new Set<number>();
      for (const d of detail.divisions) if (d.region > 0) has.add(d.army);
      for (let i = 0; i < this.count; i++) {
        const a = this.armies[i];
        if (a.owner === me && has.has(a.id)) {
          split.set(a.id, a);
          this.skip[i] = 1;
        }
      }
    }
    let k = 0;
    const standing = this.standing;
    standing.clear();
    for (let i = 0; i < this.count; i++) {
      if (this.skip[i] !== 0) continue;
      k = this.armyCounter(k, i, me);
      const a = this.armies[i];
      if (a.move === null)
        standing.set(a.region, (standing.get(a.region) ?? 0) + 1);
    }
    if (split.size === 0) return k;
    const divs: DivisionData[] = [];
    for (const d of detail!.divisions) {
      if (d.region > 0 && split.has(d.army)) divs.push(d);
    }
    divs.sort((x, y) => x.region - y.region || x.army - y.army || x.id - y.id);
    const symbols = new Map<number, number>();
    for (const t of detail!.templates) symbols.set(t.id, templateSymbol(t));
    const pinned = new Set<number>();
    for (const a of split.values()) {
      for (const [div] of a.mine?.pins ?? []) pinned.add(div);
    }
    for (let s = 0; s < divs.length; ) {
      const region = divs[s].region;
      let e = s;
      while (e < divs.length && divs[e].region === region) e++;
      const m = e - s;
      const many = m > REGION_DIVISIONS_MAX;
      const shownN =
        many && !state.isOpen(region) ? REGION_DIVISIONS_MAX - 1 : m;
      const slot0 =
        (standing.get(region) ?? 0) + (view.battles.has(region) ? 1 : 0);
      // The chip keeps its slot, open or not: under the finger that opened it.
      const chipSlot = REGION_DIVISIONS_MAX - 1;
      for (let j = 0; j < shownN; j++) {
        const d = divs[s + j];
        const c = this.take(k++);
        c.type = C_DIVISION;
        c.army = d.army;
        c.division = d.id;
        c.owner = me;
        this.center(c, region);
        c.slot = slot0 + (many && j >= chipSlot ? j + 1 : j);
        c.members.push(d.army);
        c.symbol = symbols.get(d.template) ?? split.get(d.army)!.symbol;
        c.shown = 1;
        c.strengthPm = d.strengthPm;
        c.orgPm = d.orgPm;
        c.state = d.battle !== 0 ? ARMY_BATTLE : 0;
        c.hue = d.army % ZONE_HUES;
        c.pinned = pinned.has(d.id);
      }
      // An open fan keeps its chip ("−", N = 0): a tap on it closes the fan.
      if (many) {
        const c = this.take(k++);
        c.type = C_MORE;
        c.army = divs[s + chipSlot].army;
        c.owner = me;
        this.center(c, region);
        c.slot = slot0 + chipSlot;
        c.members.push(c.army);
        c.shown = m - shownN;
        c.hue = c.army % ZONE_HUES;
      }
      s = e;
    }
    return k;
  }

  /** Refreshes landRegions from the counters; bumps the version on a change. */
  private noteLandRegions(): void {
    const next = this.landRegionsNext;
    next.clear();
    for (let i = 0; i < this.counterCount; i++) {
      const c = this.counters[i];
      if (c.index >= 0 && this.armies[c.index].move !== null) continue;
      next.add(c.region);
    }
    const cur = this.landRegions;
    let same = next.size === cur.size;
    if (same) {
      for (const r of next) {
        if (!cur.has(r)) {
          same = false;
          break;
        }
      }
    }
    if (same) return;
    cur.clear();
    for (const r of next) cur.add(r);
    this.landRegionsVersion++;
  }

  /** Each counter's place for this frame: its army's placement, or its region's fan slot. */
  private placeCounters(zoom: number): void {
    const z = Math.max(zoom, 1e-6);
    const step =
      (this.level === LEVEL_REGION ? REGION_STEP_PX : TOKEN_STEP_PX[0]) / z;
    for (let i = 0; i < this.counterCount; i++) {
      const c = this.counters[i];
      if (c.index >= 0) {
        c.rx = this.placements[c.index].x;
        c.ry = this.placements[c.index].y;
      } else {
        c.rx = c.cx;
        c.ry = c.cy + fanSlot(c.slot) * step;
      }
      c.x = c.rx;
      c.y = c.ry;
    }
  }

  /** Keeps the division counters' places before a regroup (their glide's start). */
  private keepDivs(): void {
    this.divPrev.clear();
    if (this.divPrevX.length < this.counterCount) {
      this.divPrevX = new Float64Array(this.counters.length);
      this.divPrevY = new Float64Array(this.counters.length);
    }
    for (let i = 0; i < this.counterCount; i++) {
      const c = this.counters[i];
      if (c.type !== C_DIVISION) continue;
      this.divPrev.set(c.division, i);
      this.divPrevX[i] = c.rx;
      this.divPrevY[i] = c.ry;
    }
  }

  /** As noteJumps, for the division counters (by division id). */
  private noteDivJumps(tick: number): void {
    const gen = ++this.gen;
    const min2 = TOKEN_EASE_MIN_TILES * TOKEN_EASE_MIN_TILES;
    const max2 = TOKEN_EASE_MAX_TILES * TOKEN_EASE_MAX_TILES;
    for (let i = 0; i < this.counterCount; i++) {
      const c = this.counters[i];
      if (c.type !== C_DIVISION) continue;
      const e = this.divEases.get(c.division);
      if (e !== undefined) e.gen = gen;
      const j = this.divPrev.get(c.division);
      if (j === undefined) continue;
      const jx = this.divPrevX[j] - c.rx;
      const jy = this.divPrevY[j] - c.ry;
      const d2 = jx * jx + jy * jy;
      if (d2 <= min2) continue;
      if (d2 >= max2) {
        this.divEases.delete(c.division);
        continue;
      }
      const left = e === undefined ? 0 : easeLeft(e, tick);
      const ox = jx + (e === undefined ? 0 : e.ox * left);
      const oy = jy + (e === undefined ? 0 : e.oy * left);
      if (e === undefined) {
        this.divEases.set(c.division, { ox, oy, at: tick, gen });
      } else {
        e.ox = ox;
        e.oy = oy;
        e.at = tick;
      }
    }
    for (const [id, e] of this.divEases) {
      if (e.gen !== gen) this.divEases.delete(id);
    }
  }

  private easeDivs(tick: number): void {
    for (let i = 0; i < this.counterCount; i++) {
      const c = this.counters[i];
      if (c.type !== C_DIVISION) continue;
      const e = this.divEases.get(c.division);
      if (e === undefined) continue;
      const left = easeLeft(e, tick);
      if (left <= 0) {
        this.divEases.delete(c.division);
        continue;
      }
      c.x += e.ox * left;
      c.y += e.oy * left;
    }
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
    // Final review M6: tokenXYInto, not tokenAt — no array per army a tick.
    const xy = this.xy;
    for (const a of view.armies.values()) {
      if (fog !== undefined && !fog.armyView(a.id).visible) continue;
      if (view.tokenXYInto(a, base, xy)) armies.push(a);
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
    const next = this.next;
    for (let i = 0; i < n; i++) {
      const a = armies[i];
      view.tokenXYInto(a, base, xy);
      this.x0[i] = xy[0];
      this.y0[i] = xy[1];
      this.dx[i] = 0;
      this.dy[i] = 0;
      if (a.move === null) continue;
      if (!view.tokenXYInto(a, base + 1, next)) continue;
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
