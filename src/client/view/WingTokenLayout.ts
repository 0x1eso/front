// ww8: where the air wings stand on the map and what a tap hits (air
// overhaul design §8.2, §8.3). Pure: the render passes and the wing
// controller share it, so a token is tapped where it is drawn.
//
// Every wing goes through the fog first (FogModel.wingView /
// wingFlightVisible): a wing the fog hides gets no slot and no pose, so
// its place never reaches the GPU.
//
// Positions are tile coordinates (a region's center tile); the passes draw
// at +0.5. `zoom` is screen (CSS) pixels per tile.
import {
  AIR_TYPES,
  type WingBrief,
  type WingFlightRow,
  WP_BACK,
  WP_FERRY,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WP_STATION,
} from "@openfront/engine-api/ww1936/AirTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { wingMaxPlanes } from "@openfront/engine-lib/ww1936/WingRules";
import type { FogModel } from "../hud/ww1936/FogModel";
import { fanSlot, TOKEN_STEP_PX, tokenLod } from "./LandTokenLayout";
import type { WwAirView } from "./WwAirView";
import type { WwNavyView } from "./WwNavyView";

/** Screen px a tap may miss a token by (as the army tokens). */
export const TAP_RADIUS_PX = 24;
/** A base with this many wings shows one group chip while the air layer is on. */
export const GROUP_MIN_WINGS = 3;
/** Planes a wing shows in the air at most, and planes per drawn plane. */
export const FLIGHT_PLANES_MAX = 3;
export const PLANES_PER_DRAWN = 50;
/** Tiles the loitering planes circle the target at. */
export const LOITER_TILES = 4;

export const SLOT_TOKEN = 0;
export const SLOT_GROUP = 1;
export const SLOT_BASE = 2;

export interface WingSlot {
  /** SLOT_TOKEN: one wing; SLOT_GROUP: several in a chip; SLOT_BASE: a base chip (air layer off). */
  kind: number;
  /** The wing of a token; the first wing of a chip. */
  wing: number;
  base: number;
  owner: number;
  /** Tile position, after the fan-out of the tokens sharing a base. */
  x: number;
  y: number;
  /** 0 token, 1 chip, 2 dot (tokenLod). */
  lod: number;
  /** Planes shown (exact, or a band's top through the fog). */
  planes: number;
  /** Wings the slot stands for. */
  wings: number;
  /** AIR_TYPES index of a token. */
  type: number;
}

/**
 * What the wing controller tells the renderer: the wings picked, the bases
 * opened into a fan, and the range ellipse to show around a base (a tap on
 * [base] previews the circle before the second tap confirms).
 */
export interface WingFocus {
  chosen: ReadonlySet<number>;
  expanded: ReadonlySet<number>;
  range: { base: number; rangeKm: number; warning?: boolean } | null;
}

export const NO_WING_FOCUS: WingFocus = {
  chosen: new Set<number>(),
  expanded: new Set<number>(),
  range: null,
};

/** What a layout reads that is not in the views. */
export interface WingLayoutInput {
  zoom: number;
  airLayer: boolean;
  /** Wings picked: always shown as tokens, layer or not. */
  chosen: ReadonlySet<number>;
  /** Bases whose group chip a tap opened into a fan. */
  expanded: ReadonlySet<number>;
}

/** A wing's base tile (x, y), or false when it stands nowhere (no base, or a ship not found). */
export function wingBaseXY(
  air: WwAirView,
  navy: WwNavyView | null,
  base: number,
  out: [number, number],
): boolean {
  const sc = air.scenario;
  const W = sc.width;
  if (base > 0) {
    if (sc.region(base) === undefined) return false;
    const t = sc.centerTile(base);
    out[0] = t % W;
    out[1] = Math.floor(t / W);
    return true;
  }
  if (base === 0 || navy === null) return false;
  for (const f of navy.fleets.values()) {
    for (const s of f.ships) {
      if (s.id !== -base) continue;
      const [x, y] = navy.fleetXY(f.id, 0, 0);
      out[0] = ((x % W) + W) % W;
      out[1] = y;
      return true;
    }
  }
  return false;
}

/** The wing's brief with its latest schedule row's phase worked out for `tick`. */
export function wingPhase(
  b: WingBrief,
  row: WingFlightRow | undefined,
  tick: number,
): number {
  if (row === undefined) return b.phase;
  const [, phase, until, leg, station, rearm] = row;
  if (phase === WP_OUT) {
    if (tick < until) return WP_OUT;
    if (tick < until + station) return WP_STATION;
    if (tick < until + station + leg) return WP_BACK;
    if (tick < until + station + leg + rearm) return WP_REARM;
    return WP_GROUND;
  }
  if (phase === WP_STATION) {
    if (tick < until) return WP_STATION;
    if (tick < until + leg) return WP_BACK;
    if (tick < until + leg + rearm) return WP_REARM;
    return WP_GROUND;
  }
  if (phase === WP_BACK) {
    if (tick < until) return WP_BACK;
    return tick < until + rearm ? WP_REARM : WP_GROUND;
  }
  if (phase === WP_FERRY) return tick < until ? WP_FERRY : WP_GROUND;
  if (phase === WP_REARM) return tick < until ? WP_REARM : WP_GROUND;
  return WP_GROUND;
}

/** A target's tile index (a region, a sea zone, or the zone's center with 0), -1 when unknown. */
export function targetTile(
  sc: ScenarioIndex,
  target: number,
  flySr: number,
): number {
  if (target > SEA_ZONE_BASE) return sc.zoneCenter(target);
  if (target > 0)
    return sc.region(target) === undefined ? -1 : sc.centerTile(target);
  return sc.sr(flySr)?.center ?? -1;
}

export interface WingPose {
  x: number;
  y: number;
  /** Radians, 0 = east. */
  heading: number;
  /** 0..1: how far from the base (the take-off and landing scale). */
  progress: number;
  /** Tiles flown on this leg (the contrail's length). */
  flown: number;
  /** The wing is circling its target. */
  loiter: boolean;
}

/**
 * Where a wing's planes are at fractional tick `tickF`, from its schedule
 * row alone (design §10.3). `minLegTicks` stretches a short leg on screen
 * only (the plane lands late, the rules do not move). False: on the ground.
 */
export function flightPose(
  W: number,
  base: readonly [number, number],
  target: readonly [number, number],
  row: WingFlightRow,
  tickF: number,
  minLegTicks: number,
  out: WingPose,
): boolean {
  const [, phase, until, leg, station, rearm] = row;
  const eff = Math.max(1, leg, minLegTicks);
  let from = base;
  let to = target;
  let t0: number;
  if (phase === WP_OUT) {
    t0 = until - leg;
    const back0 = until + station;
    if (tickF < t0) return false;
    if (tickF >= back0) {
      from = target;
      to = base;
      t0 = back0;
    }
  } else if (phase === WP_BACK) {
    from = target;
    to = base;
    t0 = until - leg;
    if (tickF < t0) return false;
  } else if (phase === WP_STATION) {
    from = target;
    to = base;
    t0 = until;
    if (tickF < t0) {
      out.x = target[0] + LOITER_TILES * Math.cos(tickF * 0.4);
      out.y = target[1] + LOITER_TILES * Math.sin(tickF * 0.4);
      out.heading = tickF * 0.4 + Math.PI / 2;
      out.progress = 1;
      out.flown = 0;
      out.loiter = true;
      return true;
    }
  } else if (phase === WP_FERRY) {
    // The row's `target` is the base it left; `base` is where it goes. Its
    // `until` holds the rest after landing (the row's R), on the ground.
    from = target;
    to = base;
    t0 = until - rearm - leg;
    if (tickF < t0) return false;
  } else {
    return false;
  }
  const p = (tickF - t0) / eff;
  if (p >= 1) {
    // Arrived: circling the target after an outward leg, else landed.
    if (phase === WP_OUT && to === target) {
      out.x = target[0] + LOITER_TILES * Math.cos(tickF * 0.4);
      out.y = target[1] + LOITER_TILES * Math.sin(tickF * 0.4);
      out.heading = tickF * 0.4 + Math.PI / 2;
      out.progress = 1;
      out.flown = 0;
      out.loiter = true;
      return true;
    }
    return false;
  }
  let dx = to[0] - from[0];
  if (dx > W / 2) dx -= W;
  else if (dx < -W / 2) dx += W;
  const dy = to[1] - from[1];
  const x = from[0] + dx * p;
  out.x = ((x % W) + W) % W;
  out.y = from[1] + dy * p;
  out.heading = Math.atan2(dy, dx);
  const toBase = to === base;
  out.progress =
    phase === WP_FERRY
      ? Math.min(1, 4 * Math.min(p, 1 - p))
      : toBase
        ? 1 - p
        : p;
  out.flown = Math.hypot(dx, dy) * p;
  out.loiter = false;
  return true;
}

/** Planes drawn in the air for a wing of `planes`: min(3, ceil(planes / 50)). */
export function drawnPlanes(planes: number): number {
  if (!(planes > 0)) return 0;
  return Math.min(FLIGHT_PLANES_MAX, Math.ceil(planes / PLANES_PER_DRAWN));
}

/** ‰ of a full wing, for the token's strength bar. */
export function wingStrengthPm(b: WingBrief, planes: number): number {
  const full = wingMaxPlanes(AIR_TYPES[b.type]);
  return full > 0 ? Math.min(1000, Math.round((planes * 1000) / full)) : 0;
}

interface Entry {
  b: WingBrief;
  planes: number;
}

/**
 * The slots to draw at `zoom`: tokens per wing, group chips, base chips
 * (design §8.2). A wing the fog hides is left out; a chosen wing is always
 * a token. Returns how many slots `out` holds.
 */
export function layoutWings(
  air: WwAirView,
  navy: WwNavyView | null,
  fog: FogModel | undefined,
  input: WingLayoutInput,
  out: WingSlot[],
): number {
  out.length = 0;
  if (!air.live) return 0;
  const lod = tokenLod(input.zoom);
  const step = TOKEN_STEP_PX[lod] / Math.max(input.zoom, 1e-6);
  const briefs = [...air.wingBriefs.values()].sort((a, b) => a.id - b.id);
  const groups = new Map<number, Entry[]>();
  for (const b of briefs) {
    if (b.planes <= 0) continue;
    let planes = b.planes;
    if (fog !== undefined) {
      const v = fog.wingView(b);
      if (!v.visible) continue;
      planes = v.planes;
    }
    const list = groups.get(b.base);
    if (list === undefined) groups.set(b.base, [{ b, planes }]);
    else list.push({ b, planes });
  }
  const xy: [number, number] = [0, 0];
  for (const [base, list] of groups) {
    if (!wingBaseXY(air, navy, base, xy)) continue;
    const x = xy[0];
    const y = xy[1];
    const rest: Entry[] = [];
    const tokens: Entry[] = [];
    for (const e of list) {
      if (input.chosen.has(e.b.id)) tokens.push(e);
      else rest.push(e);
    }
    let k = 0;
    const asTokens = input.airLayer
      ? rest.length < GROUP_MIN_WINGS || input.expanded.has(base)
      : false;
    if (rest.length > 0 && !asTokens) {
      let planes = 0;
      for (const e of rest) planes += e.planes;
      out.push({
        kind: input.airLayer ? SLOT_GROUP : SLOT_BASE,
        wing: rest[0].b.id,
        base,
        owner: rest[0].b.owner,
        x,
        y,
        lod: 1,
        planes,
        wings: rest.length,
        type: rest[0].b.type,
      });
      k = 1;
    } else {
      for (const e of rest) tokens.push(e);
      tokens.sort((a, b) => a.b.id - b.b.id);
    }
    for (const e of tokens) {
      out.push({
        kind: SLOT_TOKEN,
        wing: e.b.id,
        base,
        owner: e.b.owner,
        x,
        y: y + fanSlot(k) * step,
        lod,
        planes: e.planes,
        wings: 1,
        type: e.b.type,
      });
      k++;
    }
  }
  return out.length;
}

/** The slot a tap at tile (tx, ty) hits (the last drawn wins a tie), or null. */
export function pickWingSlot(
  slots: readonly WingSlot[],
  tx: number,
  ty: number,
  zoom: number,
): WingSlot | null {
  const r = TAP_RADIUS_PX / Math.max(zoom, 1e-6);
  let best: WingSlot | null = null;
  let bestD = r * r;
  for (const s of slots) {
    const d = (s.x - tx) * (s.x - tx) + (s.y - ty) * (s.y - ty);
    if (d <= bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * A wing's range as an ellipse in tiles around tile (x, y): `rx` east-west,
 * `ry` north-south for `rangeKm`, from the scenario's own km between tiles
 * (the 1936 map's tile is wider in km at the equator than near the poles).
 */
export function rangeEllipseTiles(
  sc: ScenarioIndex,
  x: number,
  y: number,
  rangeKm: number,
): { rx: number; ry: number } {
  const W = sc.width;
  const t = y * W + x;
  // Ten tiles either way smooths the whole-km rounding of kmBetween.
  const xe = x + 10 < W ? t + 10 : t - 10;
  const ye = (y + 10) * W + x < W * sc.height ? t + 10 * W : t - 10 * W;
  const kmx = Math.max(0.1, sc.kmBetween(t, xe) / 10);
  const kmy = Math.max(0.1, sc.kmBetween(t, ye) / 10);
  return { rx: rangeKm / kmx, ry: rangeKm / kmy };
}
