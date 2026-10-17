/**
 * PlaneTrack — where a plane is drawn and which way it points: on the
 * straight line of its whole flight, not on its tile.
 *
 * The engine flies a plane along straightFlightPath: tile k of a flight from
 * o to e in `steps` ticks is o + round(k (e - o) / steps), PLANE_SPEED tiles a
 * tick. Drawn tile to tile, that rounding is a staircase: each tick's step
 * points up to ~18° off the flight line and is up to a quarter longer or
 * shorter than the last, so a plane turned to its step shook and stuttered.
 *
 * A track rebuilds the engine's path (same origin, end and step count), finds
 * each tick's tile on it and draws the plane at that step's exact point on the
 * line, with one heading for the whole flight. Between ticks it glides from
 * where it is drawn to the new point, so a tick that comes early or late
 * changes the speed a little but never makes it jump.
 *
 * Tiles that are not on the rebuilt path (the origin was missed, or the
 * engine flies differently) are projected onto the line instead: still one
 * heading and no sideways wobble, only less even steps.
 */

import {
  carpetBombPoints,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { headingOf } from "./PlaneFx";

export interface TilePoint {
  x: number;
  y: number;
}

/** straightFlightPath's step count for a flight of (dx, dy) tiles. */
export function flightSteps(dx: number, dy: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / PLANE_SPEED));
}

/**
 * Step index of tile (x, y) on the engine's path from (ox, oy) to (ex, ey) in
 * `steps` steps, or -1 when the tile is not on it. The rounding moves a tile
 * at most 0.71 tiles along the line and a step is at least 1.5 tiles long,
 * so the nearest step is the only candidate.
 */
export function stepOnPath(
  ox: number,
  oy: number,
  ex: number,
  ey: number,
  steps: number,
  x: number,
  y: number,
): number {
  const dx = ex - ox;
  const dy = ey - oy;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return x === ox && y === oy ? 0 : -1;
  const t = ((x - ox) * dx + (y - oy) * dy) / len2;
  const k = Math.min(steps, Math.max(0, Math.round(t * steps)));
  // Exactly as straightFlightPath rounds it.
  const px = ox + Math.round((dx * k) / steps);
  const py = oy + Math.round((dy * k) / steps);
  return px === x && py === y ? k : -1;
}

/**
 * Where a bomber that took off from (ox, oy) aimed at (ax, ay) stops: the last
 * on-map drop point of its carpet (BombingExecution flies on to it). Null
 * when no point is on the map.
 */
export function bomberFlightEnd(
  ox: number,
  oy: number,
  ax: number,
  ay: number,
  mapW: number,
  mapH: number,
): TilePoint | null {
  let end: TilePoint | null = null;
  for (const p of carpetBombPoints(ox, oy, ax, ay)) {
    if (p.x >= 0 && p.x < mapW && p.y >= 0 && p.y < mapH) end = p;
  }
  return end;
}

export interface FlightPath {
  ox: number;
  oy: number;
  ex: number;
  ey: number;
  steps: number;
}

/**
 * The engine path a plane now at (x, y), last at (lx, ly), is flying: from
 * the first of `origins` whose path to `endFor(origin)` has both tiles on it.
 * Null when none has.
 */
export function findFlightPath(
  origins: readonly TilePoint[],
  endFor: (ox: number, oy: number) => TilePoint | null,
  x: number,
  y: number,
  lx: number,
  ly: number,
): FlightPath | null {
  for (const o of origins) {
    const end = endFor(o.x, o.y);
    if (end === null) continue;
    const steps = flightSteps(end.x - o.x, end.y - o.y);
    if (stepOnPath(o.x, o.y, end.x, end.y, steps, x, y) < 0) continue;
    if (stepOnPath(o.x, o.y, end.x, end.y, steps, lx, ly) < 0) continue;
    return { ox: o.x, oy: o.y, ex: end.x, ey: end.y, steps };
  }
  return null;
}

/**
 * How long a tick's glide lasts: the time between ticks, smoothed, so planes
 * keep up when ticks come faster (catch-up, fast replays) and do not stop
 * and go when they come a little late.
 */
export function nextTickSpan(
  span: number,
  gapMs: number,
  msPerTick: number,
): number {
  const gap = Math.min(2 * msPerTick, Math.max(msPerTick / 10, gapMs));
  return span + (gap - span) * 0.35;
}

export class PlaneTrack {
  /** Start of the line: the airport, once the engine's path is known. */
  ox: number;
  oy: number;
  /** End of the line. */
  ex: number;
  ey: number;
  /** The engine path's step count; 0 while tiles are projected instead. */
  steps = 0;
  /** Rotation of the nose-up sprite, constant along the line. */
  heading = 0;
  /** False until the line has a direction. */
  hasLine = false;
  private ux = 0;
  private uy = -1;
  private length = 0;
  /** The glide, in tiles along the line from the origin. */
  private from = 0;
  private to = 0;
  private start = 0;
  private span = 1;

  /** A plane first seen at tile (x, y): a line starts there. */
  constructor(x: number, y: number) {
    this.ox = this.ex = x;
    this.oy = this.ey = y;
  }

  /** Whether the tiles are matched to the engine's path. */
  get exact(): boolean {
    return this.steps > 0;
  }

  /**
   * Lay the line from (ox, oy) to (ex, ey); `steps` > 0 when it is the
   * engine's path of that many steps, 0 to project tiles onto it. The plane
   * stays where it is drawn (projected onto the new line).
   */
  setLine(
    ox: number,
    oy: number,
    ex: number,
    ey: number,
    steps: number,
    nowMs: number,
  ): void {
    if (
      this.hasLine &&
      ox === this.ox &&
      oy === this.oy &&
      ex === this.ex &&
      ey === this.ey &&
      steps === this.steps
    ) {
      return;
    }
    const s = this.shownAt(nowMs);
    const px = this.ox + this.ux * s;
    const py = this.oy + this.uy * s;
    this.ox = ox;
    this.oy = oy;
    this.ex = ex;
    this.ey = ey;
    this.steps = steps;
    const dx = ex - ox;
    const dy = ey - oy;
    this.length = Math.sqrt(dx * dx + dy * dy);
    if (this.length > 0) {
      this.ux = dx / this.length;
      this.uy = dy / this.length;
      this.heading = headingOf(dx, dy, this.heading);
      this.hasLine = true;
    }
    const kept = Math.max(0, (px - ox) * this.ux + (py - oy) * this.uy);
    this.from = this.to = kept;
    this.start = nowMs;
  }

  /**
   * Tiles along the line where tile (x, y) is drawn: its step's exact point
   * on the engine's path, or its projection. NaN when the track is exact
   * but the tile is off the path.
   */
  alongOf(x: number, y: number): number {
    if (this.steps > 0) {
      const k = stepOnPath(
        this.ox,
        this.oy,
        this.ex,
        this.ey,
        this.steps,
        x,
        y,
      );
      return k < 0 ? NaN : (k * this.length) / this.steps;
    }
    return Math.max(0, (x - this.ox) * this.ux + (y - this.oy) * this.uy);
  }

  /** Put the plane at `along` at once (first sight, a seek). */
  jumpTo(along: number, nowMs: number): void {
    this.from = this.to = along;
    this.start = nowMs;
  }

  /** A new tick: glide from where it is drawn now to `along` in `spanMs`. */
  glideTo(along: number, nowMs: number, spanMs: number): void {
    this.from = this.shownAt(nowMs);
    this.to = along;
    this.start = nowMs;
    this.span = Math.max(1, spanMs);
  }

  /** Tiles along the line where the plane is drawn at `nowMs`. */
  shownAt(nowMs: number): number {
    const t = (nowMs - this.start) / this.span;
    const c = t < 0 ? 0 : t > 1 ? 1 : t;
    return this.from + (this.to - this.from) * c;
  }

  /** The point `along` tiles down the line. */
  pointAt(along: number, out: TilePoint): TilePoint {
    out.x = this.ox + this.ux * along;
    out.y = this.oy + this.uy * along;
    return out;
  }
}
