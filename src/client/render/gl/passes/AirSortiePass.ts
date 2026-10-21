/**
 * AirSortiePass — World War 1936 P4 (spec §18.2): the air war on the map,
 * a screen-only show (not engine state, need not be deterministic).
 *
 * - Sorties: on each air zone's day, every deployment record over it flies
 *   min(6, ceil(sorties / 60)) planes (sortiePlanes) from its base (an air
 *   base region's center, or the carrier's fleet) to the zone's center and
 *   back, staggered over the day; a deployment never has more than that in
 *   the air at once. The planes are expanded warfare's: PlanePass's plane
 *   and contrail shaders, plane-atlas.png, a PlaneTrack per leg (one
 *   heading a leg, a smooth glide), the same take-off and landing scale.
 * - Losses: a zone day where the viewer lost planes drops wrecks there
 *   (PlaneFx.wreckAt: tumble, shrink, fade) with a flash and smoke.
 * - Bombing: the viewer's strategic bombing that scored (over one of the
 *   zone's regions), and every new bombing of the viewer's regions
 *   (detail.bombedRegions), lay a carpet of falling bombs
 *   (Warfare.carpetBombPoints through the bomb handler, AirFxPass).
 * - With the air layer on: a chip "✈120" at each zone the viewer has
 *   planes deployed over (ship-atlas glyphs).
 *
 * Paradrop planes and parachutes stay P2's (ParadropFlights). Zoomed far
 * out nothing flies. Planes come from a fixed pool; nothing is allocated
 * per frame.
 */

import {
  AIR_TYPES,
  type AirDeploySummary,
  type AirType,
  type AirZoneData,
  type CountryAirDetail,
} from "@openfront/engine-api/ww1936/AirTypes";
import { carpetBombPoints } from "@openfront/engine-lib/warfare/Warfare";
import { assetUrl } from "@openfront/shared/AssetUrls";
import type { WwAirView } from "../../../view/WwAirView";
import type { WwNavyView } from "../../../view/WwNavyView";
import {
  contrailLength,
  flightScale,
  PLANE_ATLAS_ORDER,
  WRECK_MS,
  wreckAt,
  type WreckState,
} from "../../frame/derive/PlaneFx";
import { PlaneTrack, type TilePoint } from "../../frame/derive/PlaneTrack";
import { UT_BOMBER } from "../../types";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import contrailFragSrc from "../shaders/plane/contrail.frag.glsl?raw";
import contrailVertSrc from "../shaders/plane/contrail.vert.glsl?raw";
import planeFragSrc from "../shaders/plane/plane.frag.glsl?raw";
import planeVertSrc from "../shaders/plane/plane.vert.glsl?raw";
import { getPaletteSize } from "../utils/ColorUtils";
import { createProgram, shaderSrc } from "../utils/GlUtils";
import {
  numberGlyphs,
  SHIP_CELL,
  ShipSpriteBatch,
  type ShipSpriteProgram,
  TEXT_DARK,
  TEXT_MAX_GLYPHS,
} from "./FleetTokenPass";

const planeAtlasUrl = assetUrl("atlases/plane-atlas.png");

/** Floats per plane instance (PlanePass's layout). */
const FLOATS = 8;
/** Planes in the air at most (the pool). */
export const SORTIE_CAP = 256;
const WRECK_CAP = 24;
/** Planes a deployment shows a day at most, and sorties per shown plane (spec §18.2). */
export const SORTIE_PLANES_MAX = 6;
export const SORTIES_PER_PLANE = 60;
/** Tiles a second a sortie flies (screen only); each leg lasts LEG_MS_MIN..MAX. */
const PLANE_TILES_PER_SEC = 70;
const LEG_MS_MIN = 1200;
const LEG_MS_MAX = 4000;
/** A day's launches spread over this long. */
const STAGGER_MS = 700;
/** Tiles around the zone center the planes turn back at. */
const TURN_JITTER = 6;
/** Below this zoom (screen px per tile) no plane is drawn or launched. */
export const SORTIE_MIN_ZOOM = 0.6;

/** Planes a deployment flies on its zone's day: min(6, ceil(sorties / 60)). */
export function sortiePlanes(sorties: number): number {
  if (!(sorties > 0)) return 0;
  return Math.min(SORTIE_PLANES_MAX, Math.ceil(sorties / SORTIES_PER_PLANE));
}

/** plane-atlas column and size (tiles) of each type. */
function planeLook(type: AirType): { col: number; size: number } {
  switch (type) {
    case "fighter":
    case "heavy_fighter":
    case "cv_fighter":
      return { col: PLANE_ATLAS_ORDER.indexOf(UT_BOMBER), size: 14 };
    case "cas":
    case "cv_cas":
      return { col: PLANE_ATLAS_ORDER.indexOf(UT_BOMBER), size: 16 };
    case "strat_bomber":
      return { col: 2, size: 26 };
    case "transport_plane":
      return { col: 2, size: 22 };
    default:
      return { col: 0, size: 20 };
  }
}
const LOOK = new Map(AIR_TYPES.map((t) => [t, planeLook(t)]));

interface Sortie {
  active: boolean;
  dep: number;
  owner: number;
  col: number;
  size: number;
  track: PlaneTrack;
  /** When the leg out starts (ms), each leg's length (ms), which leg. */
  start: number;
  legMs: number;
  leg: number;
  bx: number;
  by: number;
  cx: number;
  cy: number;
  len: number;
}

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

export class AirSortiePass {
  private planeProg: WebGLProgram;
  private trailProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private atlasTex: WebGLTexture;
  private atlasRequested = false;
  private disposed = false;
  private uCam: WebGLUniformLocation;
  private uShadowOffset: WebGLUniformLocation;
  private uShadowScale: WebGLUniformLocation;
  private uAlt: WebGLUniformLocation;
  private uShadow: WebGLUniformLocation;
  private tCam: WebGLUniformLocation;

  private readonly sorties: Sortie[] = [];
  private readonly wrecks: Wreck[] = [];
  private readonly wreckState: WreckState = {
    dx: 0,
    dy: 0,
    spin: 0,
    scale: 1,
    alpha: 1,
  };
  private readonly point: TilePoint = { x: 0, y: 0 };
  /** Planes in the air per deployment id. */
  private readonly airborne = new Map<number, number>();
  /** Each zone's day as last seen (a new object is a new day). */
  private readonly seenZone = new Map<number, AirZoneData>();
  private readonly changed = new Set<number>();
  /** Bomb points per region of the viewer's detail, as last seen. */
  private readonly seenBombed = new Map<number, number>();
  private seenDetail: CountryAirDetail | null = null;
  private seenView: WwAirView | null = null;
  private seenVersion = -1;
  private planesDrawn = 0;
  private trailsDrawn = 0;

  // The air layer's chips.
  private chips: ShipSpriteBatch;
  private chipsVersion = -1;
  private chipsOn = false;
  private readonly chipSum = new Map<number, number>();
  private readonly glyphs: number[] = new Array(TEXT_MAX_GLYPHS).fill(0);

  private onBomb:
    | ((fromX: number, fromY: number, x: number, y: number) => void)
    | null = null;
  private onWreck: ((x: number, y: number) => void) | null = null;
  private seed = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    private paletteTex: WebGLTexture,
    private sprites: ShipSpriteProgram,
  ) {
    this.planeProg = createProgram(
      gl,
      shaderSrc(planeVertSrc, { PLANE_COLS: PLANE_ATLAS_ORDER.length }),
      shaderSrc(planeFragSrc, { PALETTE_SIZE: getPaletteSize() }),
      "AirSortiePass",
    );
    this.trailProg = createProgram(
      gl,
      contrailVertSrc,
      contrailFragSrc,
      "AirSortieContrail",
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
      new Uint8Array(4),
    );
    this.setAtlasParams();

    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    this.buf = new DynamicInstanceBuffer(
      gl,
      gl.createBuffer()!,
      SORTIE_CAP + WRECK_CAP,
      FLOATS,
    );
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
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

    for (let i = 0; i < SORTIE_CAP; i++) {
      this.sorties.push({
        active: false,
        dep: 0,
        owner: 0,
        col: 0,
        size: 0,
        track: new PlaneTrack(0, 0),
        start: 0,
        legMs: 0,
        leg: 0,
        bx: 0,
        by: 0,
        cx: 0,
        cy: 0,
        len: 0,
      });
    }
    for (let i = 0; i < WRECK_CAP; i++) {
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
    this.chips = new ShipSpriteBatch(gl);
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
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this.setAtlasParams();
    } catch (e) {
      console.warn("[AirSortiePass] plane atlas failed to load", e);
    }
  }

  /** Bombs fall from (fromX, fromY) to (x, y) (AirFxPass.spawnBomb). */
  setBombHandler(
    fn: ((fromX: number, fromY: number, x: number, y: number) => void) | null,
  ): void {
    this.onBomb = fn;
  }

  /** A wreck starts falling at (x, y) (a flash and smoke there). */
  setWreckHandler(fn: ((x: number, y: number) => void) | null): void {
    this.onWreck = fn;
  }

  /** Planes in the air right now. */
  get airborneCount(): number {
    let n = 0;
    for (const s of this.sorties) if (s.active) n++;
    return n;
  }

  /** A screen-only jitter in [-1, 1). */
  private jitter(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x40000000 - 1;
  }

  /**
   * Reads the air view: a zone's new day launches its deployments'
   * sorties, drops the viewer's lost planes and lays the carpets. `navy`
   * gives the carriers' positions. Call every frame; it works only when
   * the view moved.
   */
  update(
    air: WwAirView,
    navy: WwNavyView | null,
    nowMs: number,
    zoom: number,
  ): void {
    if (air === this.seenView && air.version === this.seenVersion) return;
    const first = air !== this.seenView;
    this.seenView = air;
    this.seenVersion = air.version;
    const changed = this.changed;
    changed.clear();
    for (const [sr, z] of air.zones) {
      if (this.seenZone.get(sr) !== z) {
        this.seenZone.set(sr, z);
        if (!first) changed.add(sr);
      }
    }
    const detail = air.detail;
    if (detail !== this.seenDetail) {
      this.seenDetail = detail;
      for (const [region, points] of detail?.bombedRegions ?? []) {
        const before = this.seenBombed.get(region);
        this.seenBombed.set(region, points);
        if (!first && points > 0 && points !== before) {
          this.carpetAtRegion(air, region, -1, -1);
        }
      }
    }
    if (changed.size === 0 || zoom < SORTIE_MIN_ZOOM) return;
    const me = air.mySmallID();
    const sc = air.scenario;
    const W = sc.width;
    for (const d of air.deployments.values()) {
      if (!changed.has(d.sr)) continue;
      const zone = air.zones.get(d.sr)!;
      const s = sc.sr(d.sr);
      if (s === undefined) continue;
      const base = this.baseOf(air, navy, d);
      if (base === null) continue;
      const k = sortiePlanes(this.sortiesOf(air, zone, d, me));
      let up = this.airborne.get(d.id) ?? 0;
      const look = LOOK.get(d.type)!;
      for (let i = up; i < k; i++) {
        const cx = (s.center % W) + this.jitter() * TURN_JITTER;
        const cy = Math.floor(s.center / W) + this.jitter() * TURN_JITTER;
        const start =
          nowMs + ((i - up + 0.5) / Math.max(1, k - up)) * STAGGER_MS;
        if (!this.launch(d, look, base.x, base.y, cx, cy, start)) break;
        up++;
      }
      this.airborne.set(d.id, up);
      if (d.owner !== me) continue;
      if (d.mission === "strategic_bombing" && s.kind === "land") {
        // The engine picks the regions it hits; the screen shows one of
        // the zone's regions taking the carpet.
        const res = zone.result.find(([id]) => id === me)?.[1];
        if (res !== undefined && res.bombPoints > 0 && s.members.length > 0) {
          const pick = Math.floor(((this.jitter() + 1) / 2) * s.members.length);
          this.carpetAtRegion(
            air,
            s.members[Math.min(pick, s.members.length - 1)],
            base.x,
            base.y,
          );
        }
      }
    }
    // The viewer's losses: wrecks over the zone.
    for (const sr of changed) {
      const zone = air.zones.get(sr)!;
      const res = zone.result.find(([id]) => id === me)?.[1];
      if (res === undefined || res.lost <= 0) continue;
      const s = sc.sr(sr);
      if (s === undefined) continue;
      const n = Math.min(3, Math.ceil(res.lost / 20));
      for (let i = 0; i < n; i++) {
        const x = (s.center % W) + this.jitter() * TURN_JITTER;
        const y = Math.floor(s.center / W) + this.jitter() * TURN_JITTER;
        this.spawnWreck(x, y, this.jitter() * Math.PI, 0, me, 16, nowMs);
      }
    }
  }

  /**
   * Sorties of deployment `d` on the zone's day: the viewer's from its
   * side's tally (split across its deployments of that type by planes),
   * another human's by its planes (about one sortie a plane a day).
   */
  private sortiesOf(
    air: WwAirView,
    zone: AirZoneData,
    d: AirDeploySummary,
    me: number,
  ): number {
    let planes = 0;
    for (const c of d.counts) planes += c;
    if (d.owner !== me) return planes;
    const side = air.mySide();
    const ti = AIR_TYPES.indexOf(d.type);
    let flown = 0;
    for (const s of zone.sides) if (s.side === side) flown = s.sorties[ti] ?? 0;
    let mine = 0;
    for (const o of air.deployments.values()) {
      if (o.owner !== me || o.sr !== d.sr || o.type !== d.type) continue;
      for (const c of o.counts) mine += c;
    }
    return mine > 0 ? (flown * planes) / mine : 0;
  }

  /** Where `d` takes off: its base region's center, or its carrier's fleet. */
  private baseOf(
    air: WwAirView,
    navy: WwNavyView | null,
    d: AirDeploySummary,
  ): TilePoint | null {
    const sc = air.scenario;
    const W = sc.width;
    const p = this.point;
    if (d.base > 0) {
      if (sc.region(d.base) === undefined) return null;
      const t = sc.centerTile(d.base);
      p.x = t % W;
      p.y = Math.floor(t / W);
      return p;
    }
    if (navy === null) return null;
    const ship = -d.base;
    for (const f of navy.fleets.values()) {
      if (!f.ships.some((s) => s.id === ship)) continue;
      const [x, y] = navy.fleetXY(f.id, 0, 0);
      p.x = ((x % W) + W) % W;
      p.y = y;
      return p;
    }
    return null;
  }

  private launch(
    d: AirDeploySummary,
    look: { col: number; size: number },
    bx: number,
    by: number,
    cx: number,
    cy: number,
    start: number,
  ): boolean {
    const s = this.sorties.find((x) => !x.active);
    if (s === undefined) return false;
    const len = Math.hypot(cx - bx, cy - by);
    s.active = true;
    s.dep = d.id;
    s.owner = d.owner;
    s.col = look.col;
    s.size = look.size;
    s.start = start;
    s.leg = 0;
    s.legMs = Math.min(
      LEG_MS_MAX,
      Math.max(LEG_MS_MIN, (len / PLANE_TILES_PER_SEC) * 1000),
    );
    s.bx = bx;
    s.by = by;
    s.cx = cx;
    s.cy = cy;
    s.len = len;
    s.track.setLine(bx, by, cx, cy, 0, start);
    s.track.jumpTo(0, start);
    s.track.glideTo(len, start, s.legMs);
    if (!this.atlasRequested) {
      this.atlasRequested = true;
      void this.loadAtlas();
    }
    return true;
  }

  private land(s: Sortie): void {
    s.active = false;
    const n = (this.airborne.get(s.dep) ?? 1) - 1;
    if (n > 0) this.airborne.set(s.dep, n);
    else this.airborne.delete(s.dep);
  }

  private spawnWreck(
    x: number,
    y: number,
    heading: number,
    col: number,
    owner: number,
    size: number,
    now: number,
  ): void {
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
    pick.size = size;
    this.onWreck?.(x, y);
    if (!this.atlasRequested) {
      this.atlasRequested = true;
      void this.loadAtlas();
    }
  }

  /** A carpet of bombs over `region`, flown from (fromX, fromY) (-1: from the west). */
  private carpetAtRegion(
    air: WwAirView,
    region: number,
    fromX: number,
    fromY: number,
  ): void {
    const sc = air.scenario;
    if (this.onBomb === null || sc.region(region) === undefined) return;
    const W = sc.width;
    const t = sc.centerTile(region);
    const tx = t % W;
    const ty = Math.floor(t / W);
    const ox = fromX < 0 ? tx - 40 : fromX;
    const oy = fromY < 0 ? ty : fromY;
    for (const p of carpetBombPoints(ox, oy, tx, ty)) {
      this.onBomb(p.x - (tx - ox) * 0.02, p.y - (ty - oy) * 0.02, p.x, p.y);
    }
  }

  /** Writes this frame's planes and wrecks; returns the planes (contrails) count. */
  private fill(nowMs: number): number {
    const f = this.buf.float32;
    const p = this.point;
    let n = 0;
    for (const s of this.sorties) {
      if (!s.active) continue;
      if (nowMs < s.start) continue;
      if (s.leg === 0 && nowMs >= s.start + s.legMs) {
        s.leg = 1;
        const t = s.start + s.legMs;
        s.track.setLine(s.cx, s.cy, s.bx, s.by, 0, t);
        s.track.jumpTo(0, t);
        s.track.glideTo(s.len, t, s.legMs);
      }
      if (s.leg === 1 && nowMs >= s.start + 2 * s.legMs) {
        this.land(s);
        continue;
      }
      const flown = s.track.shownAt(nowMs);
      s.track.pointAt(flown, p);
      const prog = s.len > 0 ? flown / s.len : 1;
      const scale =
        s.leg === 0
          ? flightScale(UT_BOMBER, prog)
          : flightScale(UT_BOMBER, 1 - prog);
      const o = n * FLOATS;
      f[o] = p.x + 0.5;
      f[o + 1] = p.y + 0.5;
      f[o + 2] = s.track.heading;
      f[o + 3] = s.size * scale;
      f[o + 4] = s.col;
      f[o + 5] = s.owner;
      f[o + 6] = 1;
      f[o + 7] = contrailLength(flown, scale) * 0.5;
      n++;
    }
    const planes = n;
    for (const w of this.wrecks) {
      if (!w.active) continue;
      if (nowMs - w.start >= WRECK_MS) {
        w.active = false;
        continue;
      }
      if (!wreckAt(w.heading, nowMs - w.start, this.wreckState)) continue;
      const ws = this.wreckState;
      const o = n * FLOATS;
      f[o] = w.x + ws.dx + 0.5;
      f[o + 1] = w.y + ws.dy + 0.5;
      f[o + 2] = w.heading + ws.spin;
      f[o + 3] = w.size * ws.scale * 0.8;
      f[o + 4] = w.col;
      f[o + 5] = w.owner;
      f[o + 6] = ws.alpha;
      f[o + 7] = 0;
      n++;
    }
    this.planesDrawn = n;
    this.trailsDrawn = planes;
    if (n > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, n * FLOATS);
    }
    return planes;
  }

  /** The air layer's "✈N" chips: the viewer's planes deployed over each zone. */
  private updateChips(air: WwAirView, on: boolean): void {
    if (on === this.chipsOn && air.version === this.chipsVersion) return;
    this.chipsOn = on;
    this.chipsVersion = air.version;
    const b = this.chips;
    b.begin(16);
    if (on) {
      const me = air.mySmallID();
      const sum = this.chipSum;
      sum.clear();
      for (const d of air.deployments.values()) {
        if (d.owner !== me) continue;
        let n = 0;
        for (const c of d.counts) n += c;
        sum.set(d.sr, (sum.get(d.sr) ?? 0) + n);
      }
      const sc = air.scenario;
      const W = sc.width;
      for (const [sr, n] of sum) {
        const s = sc.sr(sr);
        if (s === undefined || n <= 0) continue;
        const k = numberGlyphs(SHIP_CELL.plane, n, this.glyphs);
        b.putText(
          s.center % W,
          Math.floor(s.center / W),
          me,
          this.glyphs,
          k,
          TEXT_DARK,
        );
      }
    }
    b.upload();
  }

  draw(
    cam: Float32Array,
    tilesPerPx: number,
    timeSec: number,
    nowMs: number,
    zoom: number,
    air: WwAirView,
    airLayer: boolean,
  ): void {
    const gl = this.gl;
    if (zoom >= SORTIE_MIN_ZOOM) {
      const planes = this.fill(nowMs);
      if (this.planesDrawn > 0) {
        gl.bindVertexArray(this.vao);
        if (planes > 0) {
          gl.useProgram(this.trailProg);
          gl.uniformMatrix3fv(this.tCam, false, cam);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.trailsDrawn);
        }
        gl.useProgram(this.planeProg);
        gl.uniformMatrix3fv(this.uCam, false, cam);
        gl.uniform1i(this.uAlt, 0);
        gl.uniform1f(this.uShadow, 0);
        gl.uniform2f(this.uShadowOffset, 0, 0);
        gl.uniform1f(this.uShadowScale, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
        gl.activeTexture(gl.TEXTURE0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.planesDrawn);
        gl.bindVertexArray(null);
      }
    } else {
      // Zoomed far out: the planes in the air land unseen.
      for (const s of this.sorties) {
        if (s.active && nowMs >= s.start + 2 * s.legMs) this.land(s);
      }
    }
    this.updateChips(air, airLayer);
    if (this.chips.drawn > 0) {
      this.sprites.bind(cam, tilesPerPx, timeSec);
      this.chips.draw();
    }
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
    this.chips.dispose();
  }
}
