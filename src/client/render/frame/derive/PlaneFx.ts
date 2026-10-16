/**
 * PlaneFx — the pure logic behind the expanded-warfare plane visuals (no GL):
 * which unit types are planes, heading from motion, the take-off / landing
 * scale curve, translucency, contrail length, and the timed effects (falling
 * bombs, parachutes, impact flashes) in fixed-size pools so a run of blasts
 * never allocates per frame.
 */

import { UT_BOMBER, UT_CARGO_PLANE, UT_TRANSPORT_PLANE } from "../../types";

/** The plane types PlanePass draws (UnitPass leaves them out). */
export const PLANE_TYPES: ReadonlySet<string> = new Set([
  UT_TRANSPORT_PLANE,
  UT_BOMBER,
  UT_CARGO_PLANE,
]);

/** Plane atlas columns, in the order plane-atlas.png is drawn. */
export const PLANE_ATLAS_ORDER = [
  UT_TRANSPORT_PLANE,
  UT_BOMBER,
  UT_CARGO_PLANE,
] as const;

/** Only planes turn to their heading; every other unit draws unrotated. */
export function rotatesWithHeading(unitType: string): boolean {
  return PLANE_TYPES.has(unitType);
}

/** Quad size in tiles per plane (the old sprites drew 13 tiles wide). */
export const PLANE_SIZE: Readonly<Record<string, number>> = {
  [UT_TRANSPORT_PLANE]: 22,
  [UT_BOMBER]: 26,
  [UT_CARGO_PLANE]: 28,
};

/** Cargo planes are a constant background traffic: a little see-through. */
export function planeAlpha(unitType: string): number {
  return unitType === UT_CARGO_PLANE ? 0.72 : 1;
}

/**
 * Rotation (radians, clockwise on screen) that turns a nose-up sprite to
 * face the motion (dx, dy) in tile coordinates (y grows downward). While the
 * plane is not moving this tick the previous heading is kept.
 */
export function headingOf(dx: number, dy: number, previous: number): number {
  if (dx * dx + dy * dy < 1e-6) return previous;
  return Math.atan2(dx, -dy);
}

export const TAKEOFF_FRACTION = 0.14;
export const LANDING_FRACTION = 0.14;
export const MIN_SCALE = 0.45;

function smooth(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Size factor along the straight flight, progress 0 (take-off) to 1
 * (arrival): small just after take-off, full size in between, small again
 * before landing. A bomber keeps its size to the end: it is still dropping
 * its line of bombs around the aim point.
 */
export function flightScale(unitType: string, progress: number): number {
  const up = smooth(progress / TAKEOFF_FRACTION);
  let s = MIN_SCALE + (1 - MIN_SCALE) * up;
  if (unitType !== UT_BOMBER) {
    const down = smooth((1 - progress) / LANDING_FRACTION);
    s = Math.min(s, MIN_SCALE + (1 - MIN_SCALE) * down);
  }
  return s;
}

/** Flight progress 0..1 from the distance flown and the whole straight leg. */
export function flightProgress(flown: number, total: number): number {
  if (!(total > 0)) return 1;
  const p = flown / total;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

export const CONTRAIL_MAX_TILES = 34;

/** A contrail never starts behind where the plane took off. */
export function contrailLength(flown: number, scale: number): number {
  return Math.min(CONTRAIL_MAX_TILES * scale, Math.max(0, flown));
}

// ---------------------------------------------------------------------------
// Timed effects
// ---------------------------------------------------------------------------

export const BOMB_FALL_MS = 420;
export const FLASH_MS = 380;
export const PARACHUTE_MS = 1500;
export const PARACHUTE_COUNT = 7;
export const PARACHUTE_SPREAD = 6;

export interface FxSlot {
  active: boolean;
  start: number;
  x: number;
  y: number;
  /** Bomb: where it falls to. Flash: unused. Parachute drop: owner id. */
  x2: number;
  y2: number;
  /** Bomb: heading. */
  angle: number;
  owner: number;
}

/** A fixed-size pool of timed effects: spawn reuses a free slot, or the oldest. */
export class FxPool {
  readonly slots: FxSlot[];
  constructor(
    capacity: number,
    private readonly lifetimeMs: number,
  ) {
    this.slots = [];
    for (let i = 0; i < capacity; i++) {
      this.slots.push({
        active: false,
        start: 0,
        x: 0,
        y: 0,
        x2: 0,
        y2: 0,
        angle: 0,
        owner: 0,
      });
    }
  }

  spawn(now: number): FxSlot {
    let pick = this.slots[0];
    for (const s of this.slots) {
      if (!s.active) {
        pick = s;
        break;
      }
      if (s.start < pick.start) pick = s;
    }
    pick.active = true;
    pick.start = now;
    return pick;
  }

  /** Retire expired slots; returns how many are still running. */
  prune(now: number): number {
    let live = 0;
    for (const s of this.slots) {
      if (!s.active) continue;
      if (now - s.start >= this.lifetimeMs) s.active = false;
      else live++;
    }
    return live;
  }

  hasActive(): boolean {
    for (const s of this.slots) if (s.active) return true;
    return false;
  }

  clear(): void {
    for (const s of this.slots) s.active = false;
  }
}

/**
 * A bomb's progress 0..1 while falling from the bomber to the tile. It
 * accelerates (ease-in), so it reads as falling.
 */
export function bombFall(ageMs: number): number {
  const t = ageMs / BOMB_FALL_MS;
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c;
}

/** Whether a bomb that spawned at `start` has reached the ground by `now`. */
export function bombLanded(start: number, now: number): boolean {
  return now - start >= BOMB_FALL_MS;
}

export interface ParachuteState {
  x: number;
  y: number;
  /** Canopy size factor: big while high, smaller as it nears the ground. */
  scale: number;
  alpha: number;
}

function hash01(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Parachute `i` of a drop at (cx, cy), `ageMs` after the plane reached the
 * drop point. Each one drifts outward from the drop tile to its own landing
 * spot within PARACHUTE_SPREAD tiles, sinking (shrinking) as it goes, and
 * fades over the last quarter. `seed` (the drop tile) keeps every client's
 * picture the same. Returns false once the drop is over.
 */
export function parachuteAt(
  seed: number,
  i: number,
  cx: number,
  cy: number,
  ageMs: number,
  out: ParachuteState,
): boolean {
  if (ageMs < 0 || ageMs >= PARACHUTE_MS) return false;
  const t = ageMs / PARACHUTE_MS;
  const angle = hash01(seed + i * 7.31) * Math.PI * 2;
  const dist = PARACHUTE_SPREAD * (0.35 + 0.65 * hash01(seed * 1.7 + i * 3.17));
  const e = 1 - (1 - t) * (1 - t); // fast out, easing in to the landing spot
  out.x = cx + Math.cos(angle) * dist * e;
  out.y = cy + Math.sin(angle) * dist * e - (1 - t) * 3; // sinking from above
  out.scale = 1.25 - 0.45 * t;
  out.alpha = t < 0.75 ? 1 : (1 - t) / 0.25;
  return true;
}

// ---------------------------------------------------------------------------
// Interceptions: a plane shot down, a bomber that dodged
// ---------------------------------------------------------------------------

export const WRECK_MS = 1000;
export const SMOKE_MS = 1100;
export const FLARE_MS = 520;
/** How far (tiles) from the dead plane's tile a hunted plane may have last been seen. */
export const SHOOT_DOWN_MATCH_TILES = 16;

/**
 * Whether a plane's disappearance was an interception: it vanished without
 * reaching its target (paradrop landing, last carpet bomb, cargo arrival all
 * set reachedTarget) while a SAM missile was chasing it. Planes lost any
 * other way (their airport fell...) are not shot down.
 */
export function wasShotDown(reachedTarget: boolean, hunted: boolean): boolean {
  return !reachedTarget && hunted;
}

/** The types a SAM shoots down visibly (cargo planes are not SAM targets). */
export function isInterceptablePlane(unitType: string): boolean {
  return unitType === UT_TRANSPORT_PLANE || unitType === UT_BOMBER;
}

export interface WreckState {
  /** Offset (tiles) from where the plane was hit: it keeps drifting and sinks. */
  dx: number;
  dy: number;
  /** Extra rotation (radians): the tumble. */
  spin: number;
  /** Size factor, 1 -> 0.35. */
  scale: number;
  alpha: number;
}

/**
 * The falling wreck `ageMs` after the hit: tumbles, shrinks and fades over
 * WRECK_MS, drifting along its heading and a little down-screen. False once over.
 */
export function wreckAt(
  heading: number,
  ageMs: number,
  out: WreckState,
): boolean {
  if (ageMs < 0 || ageMs >= WRECK_MS) return false;
  const t = ageMs / WRECK_MS;
  const drift = 5 * t;
  out.dx = Math.sin(heading) * drift;
  out.dy = -Math.cos(heading) * drift + 4 * t * t;
  out.spin = 5.5 * t * t + 2 * t;
  out.scale = 1 - 0.65 * t;
  out.alpha = t < 0.6 ? 1 : (1 - t) / 0.4;
  return true;
}

export interface SmokeState {
  x: number;
  y: number;
  /** Puff radius factor, grows. */
  scale: number;
  alpha: number;
}

export const SMOKE_PUFFS = 3;

/**
 * Smoke puff `i` of a hit at (cx, cy): puffs rise and spread apart and
 * thin out. False once over.
 */
export function smokeAt(
  i: number,
  cx: number,
  cy: number,
  ageMs: number,
  out: SmokeState,
): boolean {
  const delay = i * 140;
  const a = ageMs - delay;
  const life = SMOKE_MS - delay;
  if (a < 0 || a >= life) return false;
  const t = a / life;
  const side = (i - 1) * 2.2;
  out.x = cx + side * t;
  out.y = cy - 3.5 * t + i * 0.6;
  out.scale = 0.6 + 1.1 * t;
  out.alpha = 0.55 * (1 - t);
  return true;
}
