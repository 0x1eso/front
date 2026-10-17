/**
 * PlanePass — expanded-warfare aircraft (transport plane, bomber, cargo
 * plane) drawn as planes: a top-down silhouette turned to its heading, bigger
 * than the old 13px sprites, with a soft offset ground shadow, a thin fading
 * contrail, and a size that grows after take-off and shrinks before arrival.
 *
 * UnitPass leaves these types out; every other unit still draws there,
 * unrotated. A plane is drawn on the straight line of its flight, not on its
 * tile, with one heading for the whole flight, gliding between ticks
 * (PlaneTrack): drawn tile to tile, the engine's rounded path is a staircase
 * that shook the plane and its contrail every tick.
 *
 * Layers: `drawShadows` runs with the ground units (below structures),
 * `drawAir` with the missiles (above them). Nothing is allocated per frame;
 * nothing is drawn, and the atlas is not even loaded, until a plane exists.
 */

import type { Config } from "@openfront/engine-lib/configuration/Config";
import { assetUrl } from "@openfront/shared/AssetUrls";
import {
  contrailLength,
  flightProgress,
  flightScale,
  isInterceptablePlane,
  PLANE_ATLAS_ORDER,
  PLANE_SIZE,
  PLANE_TYPES,
  planeAlpha,
  SHOOT_DOWN_MATCH_TILES,
  wasShotDown,
  WRECK_MS,
  wreckAt,
  type WreckState,
} from "../../frame/derive/PlaneFx";
import {
  bomberFlightEnd,
  findFlightPath,
  nextTickSpan,
  PlaneTrack,
  type TilePoint,
} from "../../frame/derive/PlaneTrack";
import type { RendererConfig, UnitState } from "../../types";
import { UT_AIRPORT, UT_BOMBER, UT_SAM_MISSILE } from "../../types";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import contrailFragSrc from "../shaders/plane/contrail.frag.glsl?raw";
import contrailVertSrc from "../shaders/plane/contrail.vert.glsl?raw";
import planeFragSrc from "../shaders/plane/plane.frag.glsl?raw";
import planeVertSrc from "../shaders/plane/plane.vert.glsl?raw";
import { getPaletteSize } from "../utils/ColorUtils";
import { createProgram, shaderSrc } from "../utils/GlUtils";

const planeAtlasUrl = assetUrl("atlases/plane-atlas.png");

/** Floats per instance: (x, y, heading, size) + (col, owner, alpha, trail). */
const FLOATS = 8;

/** The shadow lands this far (tiles, at size 22) down-right of the plane. */
const SHADOW_OFFSET = 1.6;
const SHADOW_SCALE = 0.9;

/** More game ticks than this between two updates is a seek: planes jump there. */
const MAX_GLIDE_TICKS = 3;

const NO_AIRPORTS: readonly TilePoint[] = [];

/** Persistent per-plane flight info (kept across ticks). */
interface Flight {
  /** Where it was first seen (its airport, unless it was seen mid-flight). */
  seenX: number;
  seenY: number;
  /** Its line, heading and glide. */
  track: PlaneTrack;
  /** Straight-leg length, origin to target; 0 when the target is unknown. */
  total: number;
  seen: number;
  type: string;
  col: number;
  owner: number;
  /** Where it was last seen (tile coords). */
  x: number;
  y: number;
  /** A SAM missile was chasing it as of the last tick. */
  hunted: boolean;
}

/** A plane hit by a SAM: it tumbles, shrinks and fades for WRECK_MS. */
interface Wreck {
  active: boolean;
  start: number;
  x: number;
  y: number;
  heading: number;
  col: number;
  owner: number;
  size: number;
}

const WRECK_CAPACITY = 16;

/** This tick's plane, ready for per-frame interpolation. */
interface PlaneRec {
  flight: Flight;
  col: number;
  owner: number;
  type: string;
  size: number;
  alpha: number;
}

export class PlanePass {
  private gl: WebGL2RenderingContext;
  private mapW: number;
  private mapH: number;
  private planeProg: WebGLProgram;
  private trailProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private atlasTex: WebGLTexture;
  private paletteTex: WebGLTexture;
  private affiliationTex: WebGLTexture | null = null;
  private altView = false;
  private atlasRequested = false;
  private disposed = false;

  private uCam: WebGLUniformLocation;
  private uShadowOffset: WebGLUniformLocation;
  private uShadowScale: WebGLUniformLocation;
  private uAlt: WebGLUniformLocation;
  private uShadow: WebGLUniformLocation;
  private tCam: WebGLUniformLocation;

  private flights = new Map<number, Flight>();
  /** Planes that left the map this update (to match against dead-unit events). */
  private vanished: Flight[] = [];
  /** SAM missile id -> the unit it chases, as of the last update. */
  private missiles = new Map<number, number>();
  private nextMissiles = new Map<number, number>();
  private huntedNow = new Set<number>();
  private wrecks: Wreck[] = [];
  private wreckState: WreckState = {
    dx: 0,
    dy: 0,
    spin: 0,
    scale: 1,
    alpha: 1,
  };
  private onEvade: ((x: number, y: number) => void) | null = null;
  private recs: PlaneRec[] = [];
  private count = 0;
  private generation = 0;
  /** Planes plus live wrecks written by the last fill(). */
  private drawn = 0;
  private lastTickMs = 0;
  private lastGameTick = -1;
  private tickIntervalMs: number;
  /** How long a tick's glide lasts: the smoothed time between ticks. */
  private tickSpanMs: number;
  /** The live airports per owner, collected once per update when needed. */
  private airports = new Map<number, TilePoint[]>();
  private airportsGeneration = -1;
  private point: TilePoint = { x: 0, y: 0 };
  private timeFn: () => number = () => performance.now();

  constructor(
    gl: WebGL2RenderingContext,
    header: RendererConfig,
    paletteTex: WebGLTexture,
    config: Config,
  ) {
    this.gl = gl;
    this.mapW = header.mapWidth;
    this.mapH = header.mapHeight;
    this.paletteTex = paletteTex;
    this.tickIntervalMs = config.msPerTick();
    this.tickSpanMs = this.tickIntervalMs;
    for (let i = 0; i < WRECK_CAPACITY; i++) {
      this.wrecks.push({
        active: false,
        start: 0,
        x: 0,
        y: 0,
        heading: 0,
        col: 0,
        owner: 0,
        size: 0,
      });
    }

    this.planeProg = createProgram(
      gl,
      shaderSrc(planeVertSrc, { PLANE_COLS: PLANE_ATLAS_ORDER.length }),
      shaderSrc(planeFragSrc, { PALETTE_SIZE: getPaletteSize() }),
      "PlanePass",
    );
    this.trailProg = createProgram(
      gl,
      contrailVertSrc,
      contrailFragSrc,
      "PlaneContrail",
    );
    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n)!;
    this.uCam = u(this.planeProg, "uCamera");
    this.uShadowOffset = u(this.planeProg, "uShadowOffset");
    this.uShadowScale = u(this.planeProg, "uShadowScale");
    this.uAlt = u(this.planeProg, "uAltView");
    this.uShadow = u(this.planeProg, "uShadow");
    this.tCam = u(this.trailProg, "uCamera");
    gl.useProgram(this.planeProg);
    gl.uniform1i(gl.getUniformLocation(this.planeProg, "uPalette"), 0);
    gl.uniform1i(gl.getUniformLocation(this.planeProg, "uAtlas"), 1);
    gl.uniform1i(gl.getUniformLocation(this.planeProg, "uAffiliation"), 2);

    this.atlasTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    this.setAtlasParams();

    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    const instBuf = gl.createBuffer()!;
    this.buf = new DynamicInstanceBuffer(gl, instBuf, 32, FLOATS);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    for (const loc of [1, 2]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        4,
        gl.FLOAT,
        false,
        FLOATS * 4,
        (loc - 1) * 16,
      );
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  private setAtlasParams(): void {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private async loadAtlas(): Promise<void> {
    if (typeof Image === "undefined") return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = planeAtlasUrl;
      await img.decode();
      if (this.disposed) return;
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.setAtlasParams();
    } catch (e) {
      console.warn("[PlanePass] plane atlas failed to load", e);
    }
  }

  setTimeFn(fn: () => number): void {
    this.timeFn = fn;
  }
  setAltView(active: boolean): void {
    this.altView = active;
  }
  setAffiliationTex(tex: WebGLTexture): void {
    this.affiliationTex = tex;
  }

  /** Called with the bomber's tile when it dodged a SAM missile. */
  setEvadeHandler(fn: ((x: number, y: number) => void) | null): void {
    this.onEvade = fn;
  }

  /**
   * A plane of `type`/`owner` that just vanished without reaching its target
   * (dead tile `pos`): the shot-down plane to wreck, or null when no SAM
   * was chasing a plane like it (it was lost another way). Consumes the match.
   */
  takeShotDown(
    type: string,
    owner: number,
    pos: number,
    reachedTarget: boolean,
  ): { x: number; y: number; heading: number; col: number } | null {
    if (!isInterceptablePlane(type)) return null;
    const px = pos % this.mapW;
    const py = (pos - px) / this.mapW;
    let best = -1;
    let bestD = SHOOT_DOWN_MATCH_TILES * SHOOT_DOWN_MATCH_TILES;
    for (let i = 0; i < this.vanished.length; i++) {
      const f = this.vanished[i];
      if (f.type !== type || f.owner !== owner) continue;
      if (!wasShotDown(reachedTarget, f.hunted)) continue;
      const d = (f.x - px) * (f.x - px) + (f.y - py) * (f.y - py);
      if (d <= bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return null;
    const f = this.vanished[best];
    this.vanished.splice(best, 1);
    return { x: px, y: py, heading: f.track.heading, col: f.col };
  }

  /** Start the falling wreck of a shot-down plane at tile (x, y). */
  spawnWreck(
    x: number,
    y: number,
    heading: number,
    col: number,
    owner: number,
    type: string,
  ): void {
    const now = this.timeFn();
    let pick = this.wrecks[0];
    for (const w of this.wrecks) {
      if (!w.active) {
        pick = w;
        break;
      }
      if (w.start < pick.start) pick = w;
    }
    pick.active = true;
    pick.start = now;
    pick.x = x;
    pick.y = y;
    pick.heading = heading;
    pick.col = col;
    pick.owner = owner;
    pick.size = PLANE_SIZE[type] ?? 22;
    if (!this.atlasRequested) {
      this.atlasRequested = true;
      void this.loadAtlas();
    }
  }

  private liveWrecks(): number {
    const now = this.timeFn();
    let n = 0;
    for (const w of this.wrecks) {
      if (!w.active) continue;
      if (now - w.start >= WRECK_MS) w.active = false;
      else n++;
    }
    return n;
  }

  /** Number of planes in flight this tick. */
  get planeCount(): number {
    return this.count;
  }

  /** Per-tick: collect the planes and keep their flight info. */
  updateUnits(
    units: ReadonlyMap<number, UnitState>,
    gameTick: number,
    structures: ReadonlyMap<number, UnitState>,
  ): void {
    const now = this.timeFn();
    const newTick = gameTick !== this.lastGameTick;
    // A seek (or the first update): planes are placed, not flown there.
    const jumped =
      this.lastGameTick < 0 ||
      gameTick < this.lastGameTick ||
      gameTick - this.lastGameTick > MAX_GLIDE_TICKS;
    if (newTick) {
      if (!jumped) {
        this.tickSpanMs = nextTickSpan(
          this.tickSpanMs,
          now - this.lastTickMs,
          this.tickIntervalMs,
        );
      }
      this.lastGameTick = gameTick;
      this.lastTickMs = now;
    }
    this.generation++;
    let n = 0;
    const w = this.mapW;
    this.vanished.length = 0;
    this.nextMissiles.clear();
    this.huntedNow.clear();
    for (const unit of units.values()) {
      if (unit.unitType !== UT_SAM_MISSILE || !unit.isActive) continue;
      if (unit.targetUnitId === null) continue;
      this.nextMissiles.set(unit.id, unit.targetUnitId);
      this.huntedNow.add(unit.targetUnitId);
    }
    for (const unit of units.values()) {
      if (!PLANE_TYPES.has(unit.unitType)) continue;
      if (!unit.isActive || unit.waitTicks > 0) continue;
      const col = PLANE_ATLAS_ORDER.indexOf(
        unit.unitType as (typeof PLANE_ATLAS_ORDER)[number],
      );
      if (col < 0) continue;
      const x = unit.pos % w;
      const y = (unit.pos - x) / w;
      const lx = unit.lastPos % w;
      const ly = (unit.lastPos - lx) / w;

      let flight = this.flights.get(unit.id);
      const isNew = flight === undefined;
      if (flight === undefined) {
        flight = {
          seenX: lx,
          seenY: ly,
          track: new PlaneTrack(lx, ly),
          total: 0,
          seen: 0,
          type: unit.unitType,
          col,
          owner: unit.ownerID,
          x,
          y,
          hunted: false,
        };
        this.flights.set(unit.id, flight);
      }
      flight.seen = this.generation;
      flight.x = x;
      flight.y = y;
      flight.hunted = this.huntedNow.has(unit.id);

      if (isNew || newTick) {
        this.layLine(flight, unit, x, y, lx, ly, structures, now);
        const track = flight.track;
        const along = track.alongOf(x, y);
        if (isNew || jumped) {
          const from = track.alongOf(lx, ly);
          track.jumpTo(Number.isNaN(from) ? along : from, now);
        }
        track.glideTo(along, now, this.tickSpanMs);
      }

      let rec = this.recs[n];
      if (rec === undefined) {
        rec = {
          flight,
          col: 0,
          owner: 0,
          type: "",
          size: 0,
          alpha: 1,
        };
        this.recs[n] = rec;
      }
      rec.flight = flight;
      rec.col = col;
      rec.owner = unit.ownerID;
      rec.type = unit.unitType;
      rec.size = PLANE_SIZE[unit.unitType];
      rec.alpha = planeAlpha(unit.unitType);
      n++;
    }
    this.count = n;
    if (this.flights.size > n) {
      for (const [id, f] of this.flights) {
        if (f.seen === this.generation) continue;
        this.flights.delete(id);
        this.vanished.push(f);
      }
    }
    // A missile that vanished while its bomber flies on: the bomber dodged.
    for (const [missileId, targetId] of this.missiles) {
      if (this.nextMissiles.has(missileId)) continue;
      const f = this.flights.get(targetId);
      if (
        f !== undefined &&
        f.seen === this.generation &&
        f.type === UT_BOMBER
      ) {
        this.onEvade?.(f.x, f.y);
      }
    }
    const swap = this.missiles;
    this.missiles = this.nextMissiles;
    this.nextMissiles = swap;
    if (n > 0 && !this.atlasRequested) {
      this.atlasRequested = true;
      void this.loadAtlas();
    }
  }

  /**
   * Keep the plane's straight line: the engine's own path once its tiles are
   * found on it (from the airport it took off from to its target), else the
   * line from where it was first seen to its target, its tiles projected
   * onto it. Without a target it points the way it has flown.
   */
  private layLine(
    f: Flight,
    unit: UnitState,
    x: number,
    y: number,
    lx: number,
    ly: number,
    structures: ReadonlyMap<number, UnitState>,
    now: number,
  ): void {
    const track = f.track;
    const target = this.targetOf(unit, structures);
    if (track.exact && !Number.isNaN(track.alongOf(x, y))) {
      // Still on the engine's path.
    } else if (target !== null) {
      const bomber = unit.unitType === UT_BOMBER;
      const endFor = (ox: number, oy: number): TilePoint | null =>
        bomber
          ? bomberFlightEnd(ox, oy, target.x, target.y, this.mapW, this.mapH)
          : target;
      const path = findFlightPath(
        this.originsOf(f, unit.ownerID, structures),
        endFor,
        x,
        y,
        lx,
        ly,
      );
      if (path !== null) {
        track.setLine(path.ox, path.oy, path.ex, path.ey, path.steps, now);
      } else {
        const end = endFor(f.seenX, f.seenY) ?? target;
        track.setLine(f.seenX, f.seenY, end.x, end.y, 0, now);
      }
    } else if (x !== f.seenX || y !== f.seenY) {
      track.setLine(f.seenX, f.seenY, x, y, 0, now);
    }
    f.total =
      target === null
        ? 0
        : Math.hypot(target.x - track.ox, target.y - track.oy);
  }

  /** The tile a plane flies to: its target tile, or its target airport's. */
  private targetOf(
    unit: UnitState,
    structures: ReadonlyMap<number, UnitState>,
  ): TilePoint | null {
    let tile: number | null = unit.targetTile;
    if (tile === null && unit.targetUnitId !== null) {
      tile = structures.get(unit.targetUnitId)?.pos ?? null;
    }
    if (tile === null) return null;
    const x = tile % this.mapW;
    return { x, y: (tile - x) / this.mapW };
  }

  /**
   * Where a plane may have taken off: its owner's airports and where it was
   * first seen, that one first when it is one of the airports.
   */
  private originsOf(
    f: Flight,
    owner: number,
    structures: ReadonlyMap<number, UnitState>,
  ): TilePoint[] {
    if (this.airportsGeneration !== this.generation) {
      this.airportsGeneration = this.generation;
      this.airports.clear();
      for (const s of structures.values()) {
        if (s.unitType !== UT_AIRPORT || !s.isActive) continue;
        let list = this.airports.get(s.ownerID);
        if (list === undefined) this.airports.set(s.ownerID, (list = []));
        const x = s.pos % this.mapW;
        list.push({ x, y: (s.pos - x) / this.mapW });
      }
    }
    const airports = this.airports.get(owner) ?? NO_AIRPORTS;
    const seen = { x: f.seenX, y: f.seenY };
    const atAirport = airports.some((a) => a.x === seen.x && a.y === seen.y);
    return atAirport ? [seen, ...airports] : [...airports, seen];
  }

  /**
   * Where the nearest bomber of `owner` is right now (any owner when that
   * owner has none), for bombs to fall from. False if no bomber flies.
   */
  bomberPosition(
    owner: number,
    nearX: number,
    nearY: number,
    out: { x: number; y: number },
  ): boolean {
    const now = this.timeFn();
    const p = this.point;
    let best = Infinity;
    let found = false;
    for (let pass = 0; pass < 2 && !found; pass++) {
      for (let i = 0; i < this.count; i++) {
        const r = this.recs[i];
        if (r.type !== UT_BOMBER) continue;
        if (pass === 0 && r.owner !== owner) continue;
        const track = r.flight.track;
        track.pointAt(track.shownAt(now), p);
        const x = p.x;
        const y = p.y;
        const d = (x - nearX) * (x - nearX) + (y - nearY) * (y - nearY);
        if (d < best) {
          best = d;
          out.x = x;
          out.y = y;
          found = true;
        }
      }
    }
    return found;
  }

  /** Write this frame's instances (positions on each flight's line). Returns count. */
  private fill(): number {
    const n = this.count;
    this.buf.ensureCapacity(n + WRECK_CAPACITY);
    const f = this.buf.float32;
    const now = this.timeFn();
    const p = this.point;
    for (let i = 0; i < n; i++) {
      const r = this.recs[i];
      const fl = r.flight;
      const track = fl.track;
      // Tiles flown from the line's start (the airport, once it is known).
      const flown = track.shownAt(now);
      track.pointAt(flown, p);
      const scale = flightScale(r.type, flightProgress(flown, fl.total));
      const o = i * FLOATS;
      f[o] = p.x + 0.5;
      f[o + 1] = p.y + 0.5;
      f[o + 2] = track.heading;
      f[o + 3] = r.size * scale;
      f[o + 4] = r.col;
      f[o + 5] = r.owner;
      f[o + 6] = r.alpha;
      f[o + 7] = contrailLength(flown, scale);
    }
    // Wrecks follow the planes: tumbling, shrinking, fading.
    let total = n;
    if (this.liveWrecks() > 0) {
      const now = this.timeFn();
      for (const wr of this.wrecks) {
        if (!wr.active) continue;
        if (!wreckAt(wr.heading, now - wr.start, this.wreckState)) continue;
        const ws = this.wreckState;
        const o = total * FLOATS;
        f[o] = wr.x + ws.dx + 0.5;
        f[o + 1] = wr.y + ws.dy + 0.5;
        f[o + 2] = wr.heading + ws.spin;
        f[o + 3] = wr.size * ws.scale * 0.8;
        f[o + 4] = wr.col;
        f[o + 5] = wr.owner;
        f[o + 6] = ws.alpha;
        f[o + 7] = 0;
        total++;
      }
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, total * FLOATS);
    this.drawn = total;
    return total;
  }

  private bindPlaneState(cam: Float32Array): void {
    const gl = this.gl;
    gl.useProgram(this.planeProg);
    gl.uniformMatrix3fv(this.uCam, false, cam);
    gl.uniform1i(this.uAlt, this.altView ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
    if (this.affiliationTex) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.affiliationTex);
    }
  }

  /** Ground shadows; draw with the ground units. Fills this frame's data. */
  drawShadows(cam: Float32Array): void {
    if (this.count === 0 && this.liveWrecks() === 0) {
      this.drawn = 0;
      return;
    }
    const n = this.fill();
    const gl = this.gl;
    this.bindPlaneState(cam);
    gl.uniform1f(this.uShadow, 1);
    gl.uniform2f(this.uShadowOffset, SHADOW_OFFSET, SHADOW_OFFSET * 1.4);
    gl.uniform1f(this.uShadowScale, SHADOW_SCALE);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
  }

  /** Contrails and planes; draw with the missiles (above structures). */
  drawAir(cam: Float32Array): void {
    if (this.drawn === 0) return;
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    if (this.count > 0) {
      gl.useProgram(this.trailProg);
      gl.uniformMatrix3fv(this.tCam, false, cam);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    }

    this.bindPlaneState(cam);
    gl.uniform1f(this.uShadow, 0);
    gl.uniform2f(this.uShadowOffset, 0, 0);
    gl.uniform1f(this.uShadowScale, 1);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.drawn);
  }

  dispose(): void {
    this.disposed = true;
    const gl = this.gl;
    gl.deleteProgram(this.planeProg);
    gl.deleteProgram(this.trailProg);
    this.buf.dispose();
    gl.deleteBuffer(this.quadBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.atlasTex);
  }
}
