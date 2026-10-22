/**
 * WwStrikeFxPass — World War 1936 P6 (spec §9.6, §9.7): the short effects of
 * the atomic bomb, rockets, raids and dam strikes. It is a scheduler over
 * the strategic weapons' passes (the sinks the Renderer hands it): it reads
 * WwDepthView.takeFx() and, on a timeline, asks for
 *   nuke      three planes base -> target, then ONE atom explosion sprite,
 *             ONE shockwave and ONE ring at the impact, the region owner's
 *             border pulsing 3 s at 0.5 Hz (brightness 0.5), a light that
 *             fades over 20 s, the sound "atom-hit" (loud when the camera
 *             sees it), and a single red flash on the EDGES of the victim's
 *             screen (no shake);
 *   rocket    a thin stream and one small explosion, no sound;
 *   raid, dam one small explosion.
 * It never changes the map: no tile, no water, no fallout tile, no screen
 * cover, no mushroom cloud, and nothing that shows people or losses. Nothing
 * is allocated per frame: the event slots, the pulse owners and the point
 * are fixed.
 */
import type { WwDepthFx } from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwDepthView } from "../../../view/WwDepthView";

/** Everything the pass may ask for: drawing calls only, no tile access. */
export interface StrikeFxSinks {
  /** Tile position of a region's center; false when unknown. */
  regionXY(region: number, out: { x: number; y: number }): boolean;
  ownerOf(region: number): number;
  /** AirSortiePass: planes flying from -> to and back. */
  flight(
    owner: number,
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    planes: number,
    startMs: number,
  ): void;
  /** FxSpritePass: the atom bomb explosion sprite. */
  atomSprite(x: number, y: number, nowMs: number): void;
  /** FxShockwavePass: one ring of the atom bomb. */
  shockwave(x: number, y: number): void;
  /** StrategicFxPass: one ring at the impact. */
  ring(x: number, y: number): void;
  /** StrategicFxPass: a thin stream rising from a launch site. */
  stream(x: number, y: number): void;
  /** FxSpritePass: a small explosion. */
  miniExplosion(x: number, y: number, nowMs: number): void;
  /** StrategicFxPass.pulseOwners: borders of these owners flash. */
  pulse(owners: Uint32Array, count: number, brightness: number): void;
  /** FalloutBloomPass: a light that dies over `durationMs` (no tile). */
  light(x: number, y: number, durationMs: number): void;
  /** The red flash on the screen's edges, 0..1. */
  edgeFlash(alpha: number): void;
  sound(name: "atom-hit", loud: boolean): void;
  /** True when the camera looks at the point. */
  cameraSees(x: number, y: number): boolean;
}

export const FLIGHT_MS = 2400;
export const ROCKET_MS = 1500;
export const PULSE_MS = 3000;
export const PULSE_HZ = 0.5;
export const PULSE_BRIGHTNESS = 0.5;
export const LIGHT_MS = 20_000;
export const FLASH_MS = 900;
/** The strongest the edge flash gets; the middle of the screen stays clear. */
export const FLASH_PEAK = 0.35;
/** Inside this share of the half-screen the flash weight is zero. */
export const FLASH_INNER = 0.7;
export const NUKE_PLANES = 3;
const SLOTS = 8;
const PULSES = 4;

/** The edge flash's weight at a screen point (nx, ny in -1..1): 0 inside FLASH_INNER, 1 at the border. */
export function edgeWeight(nx: number, ny: number): number {
  const d = Math.max(Math.abs(nx), Math.abs(ny));
  return d <= FLASH_INNER
    ? 0
    : Math.min(1, (d - FLASH_INNER) / (1 - FLASH_INNER));
}

/** The flash alpha t ms after it began: up fast, down slow, once. */
export function flashAlpha(t: number): number {
  if (t < 0 || t >= FLASH_MS) return 0;
  const up = 120;
  return FLASH_PEAK * (t < up ? t / up : 1 - (t - up) / (FLASH_MS - up));
}

/** The border pulse brightness t ms after it began: PULSE_HZ blinks up to PULSE_BRIGHTNESS. */
export function pulseBrightness(t: number): number {
  if (t < 0 || t >= PULSE_MS) return 0;
  const phase = (t / 1000) * PULSE_HZ;
  return PULSE_BRIGHTNESS * (0.5 - 0.5 * Math.cos(phase * 2 * Math.PI));
}

const K_NONE = 0;
const K_NUKE = 1;
const K_ROCKET = 2;
const K_SMALL = 3;
const K_INTERCEPT = 4;

interface Slot {
  kind: number;
  region: number;
  from: number;
  owner: number;
  /** When the impact happens (ms). */
  at: number;
  fired: boolean;
}

export class WwStrikeFxPass {
  private readonly slots: Slot[] = [];
  private readonly pulseOwners = new Uint32Array(PULSES);
  private readonly activeOwners = new Uint32Array(PULSES);
  private readonly pulseEnd = new Float64Array(PULSES);
  private readonly pulseStart = new Float64Array(PULSES);
  private readonly p = { x: 0, y: 0 };
  private readonly q = { x: 0, y: 0 };
  private seenVersion = -1;
  private flashStart = -1e9;
  private flashShown = 0;
  private lightEnd = 0;
  private pulseShown = -1;

  constructor(
    private readonly view: WwDepthView,
    private readonly sinks: StrikeFxSinks,
    private readonly me: () => number,
  ) {
    for (let i = 0; i < SLOTS; i++) {
      this.slots.push({
        kind: K_NONE,
        region: 0,
        from: 0,
        owner: 0,
        at: 0,
        fired: true,
      });
    }
  }

  /** True while something is scheduled or pulsing (the Renderer may skip update otherwise). */
  busy(): boolean {
    return this.pulseShown > 0 || this.slots.some((s) => s.kind !== K_NONE);
  }

  /** Once a frame. */
  update(nowMs: number): void {
    if (this.view.version !== this.seenVersion) {
      this.seenVersion = this.view.version;
      const fx = this.view.takeFx();
      for (let i = 0; i < fx.length; i++) this.schedule(fx[i], nowMs);
    }
    for (let i = 0; i < SLOTS; i++) {
      const s = this.slots[i];
      if (s.kind !== K_NONE && nowMs >= s.at) this.impact(s, nowMs);
    }
    this.updatePulse(nowMs);
    const a = flashAlpha(nowMs - this.flashStart);
    if (a > 0 || this.flashShown > 0) this.sinks.edgeFlash(a);
    this.flashShown = a;
  }

  private free(): Slot | null {
    for (let i = 0; i < SLOTS; i++) {
      if (this.slots[i].kind === K_NONE) return this.slots[i];
    }
    return null;
  }

  private schedule(fx: WwDepthFx, now: number): void {
    const s = this.free();
    if (s === null) return;
    const sk = this.sinks;
    if (!sk.regionXY(fx.region, this.p)) return;
    s.region = fx.region;
    s.from = fx.from;
    s.owner = fx.owner;
    s.fired = false;
    switch (fx.kind) {
      case "nuke":
        s.kind = K_NUKE;
        s.at = now + FLIGHT_MS;
        if (sk.regionXY(fx.from, this.q)) {
          sk.flight(
            fx.owner,
            this.q.x,
            this.q.y,
            this.p.x,
            this.p.y,
            NUKE_PLANES,
            now,
          );
        }
        break;
      case "nuke_intercepted":
        s.kind = K_INTERCEPT;
        s.at = now + FLIGHT_MS;
        if (sk.regionXY(fx.from, this.q)) {
          sk.flight(
            fx.owner,
            this.q.x,
            this.q.y,
            this.p.x,
            this.p.y,
            NUKE_PLANES,
            now,
          );
        }
        break;
      case "rocket":
        s.kind = K_ROCKET;
        s.at = now + ROCKET_MS;
        if (sk.regionXY(fx.from, this.q)) sk.stream(this.q.x, this.q.y);
        break;
      default:
        s.kind = K_SMALL;
        s.at = now;
    }
  }

  private impact(s: Slot, now: number): void {
    const sk = this.sinks;
    const kind = s.kind;
    s.kind = K_NONE;
    s.fired = true;
    if (!sk.regionXY(s.region, this.p)) return;
    const { x, y } = this.p;
    if (kind === K_NUKE) {
      sk.atomSprite(x, y, now);
      sk.shockwave(x, y);
      sk.ring(x, y);
      sk.sound("atom-hit", sk.cameraSees(x, y));
      sk.light(x, y, LIGHT_MS);
      this.lightEnd = now + LIGHT_MS;
      const victim = sk.ownerOf(s.region);
      this.startPulse(victim, now);
      if (victim !== 0 && victim === this.me()) this.flashStart = now;
    } else if (kind === K_INTERCEPT) {
      sk.ring(x, y);
      sk.miniExplosion(x, y, now);
    } else {
      sk.miniExplosion(x, y, now);
    }
  }

  private startPulse(owner: number, now: number): void {
    if (owner === 0) return;
    let slot = -1;
    for (let i = 0; i < PULSES; i++) {
      if (this.pulseEnd[i] <= now) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    this.pulseOwners[slot] = owner;
    this.pulseStart[slot] = now;
    this.pulseEnd[slot] = now + PULSE_MS;
  }

  private updatePulse(now: number): void {
    let n = 0;
    let best = 0;
    for (let i = 0; i < PULSES; i++) {
      if (this.pulseEnd[i] > now) {
        this.activeOwners[n++] = this.pulseOwners[i];
        best = Math.max(best, pulseBrightness(now - this.pulseStart[i]));
      }
    }
    // One call when the pulse changes or ends.
    if (n > 0 || this.pulseShown > 0) {
      this.sinks.pulse(this.activeOwners, n, best);
    }
    this.pulseShown = n > 0 ? best : 0;
  }

  /** The 20 s light is over (the Renderer may drop it). */
  lightOver(now: number): boolean {
    return now >= this.lightEnd;
  }
}
