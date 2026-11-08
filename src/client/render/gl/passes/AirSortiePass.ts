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
  type AirZoneResult,
  type CountryAirDetail,
  WP_FERRY,
} from "@openfront/engine-api/ww1936/AirTypes";
import { carpetBombPoints } from "@openfront/engine-lib/warfare/Warfare";
import { assetUrl } from "@openfront/shared/AssetUrls";
import { fogOfAir, fogOfNavy } from "../../../hud/ww1936/FogModel";
import {
  drawnPlanes,
  flightPose,
  targetTile,
  wingBaseXY,
  type WingPose,
} from "../../../view/WingTokenLayout";
import { deploymentPlanes, type WwAirView } from "../../../view/WwAirView";
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
  TEXT_RED,
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
/** ww8: how long an air battle's icon and loss number stay (ms), and how far the number rises (tiles). */
export const FIGHT_FX_MS = 2500;
const FIGHT_RISE_TILES = 6;
/** ww8: a wing's leg is drawn at least this long (ms), screen only. */
export const LEG_MIN_DRAW_MS = 400;
/** Below this zoom (screen px per tile) no plane is drawn or launched. */
export const SORTIE_MIN_ZOOM = 0.6;

/** Planes a deployment flies on its zone's day: min(6, ceil(sorties / 60)). */
export function sortiePlanes(sorties: number): number {
  if (!(sorties > 0)) return 0;
  return Math.min(SORTIE_PLANES_MAX, Math.ceil(sorties / SORTIES_PER_PLANE));
}

/**
 * plane-atlas column and size (tiles) of each type: smaller than expanded
 * warfare's planes, the 1936 map being much bigger.
 */
function planeLook(type: AirType): { col: number; size: number } {
  switch (type) {
    case "fighter":
    case "heavy_fighter":
    case "cv_fighter":
      return { col: PLANE_ATLAS_ORDER.indexOf(UT_BOMBER), size: 7 };
    case "cas":
    case "cv_cas":
      return { col: PLANE_ATLAS_ORDER.indexOf(UT_BOMBER), size: 8 };
    case "strat_bomber":
      return { col: 2, size: 12 };
    case "transport_plane":
      return { col: 2, size: 10 };
    default:
      return { col: 0, size: 9 };
  }
}
const LOOK = new Map(AIR_TYPES.map((t) => [t, planeLook(t)]));

/** The receiving country's result in a zone's day, null when it has none. */
function resultOf(zone: AirZoneData, id: number): AirZoneResult | null {
  for (const [k, r] of zone.result) if (k === id) return r;
  return null;
}

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
  /** Indices of the sorties not in the air (a stack). */
  private readonly free: number[] = [];
  /** The viewer's planes per (zone, type): sr * 16 + AIR_TYPES index. */
  private readonly myPlanes = new Map<number, number>();
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

  // ww8: the wing model's flights (drawn from the schedule rows each frame)
  // and the air battles' icons.
  private readonly pose: WingPose = {
    x: 0,
    y: 0,
    heading: 0,
    progress: 0,
    flown: 0,
    loiter: false,
  };
  private readonly baseXY: [number, number] = [0, 0];
  private readonly targetXY: [number, number] = [0, 0];
  private flightTick = 0;
  private flightMinLeg = 0;
  private flightAir: WwAirView | null = null;
  private flightNavy: WwNavyView | null = null;
  /** Air battle icons: zone -> start ms, planes lost, tile. */
  private readonly fightFx = new Map<
    number,
    { start: number; lost: number; x: number; y: number }
  >();
  private fx: ShipSpriteBatch;

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
      this.free.push(SORTIE_CAP - 1 - i);
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
    this.fx = new ShipSpriteBatch(gl);
  }

  private setAtlasParams(): void {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /**
   * The plane atlas loads on first need. Every path that draws a plane asks
   * (a sortie, a wreck, a wing in flight): the wing model draws no sortie
   * and a quiet sky no wreck, and the planes were blank without the atlas.
   */
  private requestAtlas(): void {
    if (this.atlasRequested) return;
    this.atlasRequested = true;
    void this.loadAtlas();
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
    if (!first) this.noteFights(air, nowMs);
    const detail = air.detail;
    if (detail !== this.seenDetail) {
      this.seenDetail = detail;
      for (const [region, points] of detail?.bombedRegions ?? []) {
        const before = this.seenBombed.get(region);
        this.seenBombed.set(region, points);
        // New damage only (repairs lower it day by day: no carpet then).
        if (!first && points > (before ?? 0)) {
          this.carpetAtRegion(air, region, -1, -1);
        }
      }
    }
    if (changed.size === 0 || zoom < SORTIE_MIN_ZOOM) return;
    const me = air.mySmallID();
    const sc = air.scenario;
    const W = sc.width;
    const mine = this.myPlanes;
    mine.clear();
    for (const d of air.deployments.values()) {
      if (d.owner !== me) continue;
      const key = d.sr * 16 + AIR_TYPES.indexOf(d.type);
      mine.set(key, (mine.get(key) ?? 0) + deploymentPlanes(d));
    }
    for (const d of air.deployments.values()) {
      if (!changed.has(d.sr)) continue;
      const zone = air.zones.get(d.sr)!;
      const s = sc.sr(d.sr);
      if (s === undefined) continue;
      const base = this.baseOf(air, navy, d, me);
      if (base === null) continue;
      // P6 (spec §8.9): another owner's planes through the air band.
      const seen =
        d.owner === me
          ? this.sortiesOf(air, zone, d, me)
          : (fogOfAir(air)?.planesSeen(
              d.owner,
              this.sortiesOf(air, zone, d, me),
            ) ?? this.sortiesOf(air, zone, d, me));
      const k = sortiePlanes(seen);
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
        const res = resultOf(zone, me);
        if (res !== null && res.bombPoints > 0 && s.members.length > 0) {
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
  }

  /**
   * ww8: this update's air battles (the fog decides which show): an icon
   * with the planes lost rising off it, and wrecks falling over the zone.
   */
  private noteFights(air: WwAirView, nowMs: number): void {
    const sc = air.scenario;
    const W = sc.width;
    const fog = fogOfAir(air);
    const mySide = air.mySide();
    for (const [sr, side, lost] of air.fights) {
      if (fog !== undefined && !fog.fightVisible(sr, side)) continue;
      const z = sc.sr(sr);
      if (z === undefined) continue;
      const x = z.center % W;
      const y = Math.floor(z.center / W);
      const old = this.fightFx.get(sr);
      this.fightFx.set(sr, {
        start: nowMs,
        lost:
          (old !== undefined && nowMs - old.start < FIGHT_FX_MS
            ? old.lost
            : 0) + lost,
        x,
        y,
      });
      const n = Math.min(3, Math.ceil(lost / 5));
      for (let i = 0; i < n; i++) {
        this.spawnWreck(
          x + this.jitter() * TURN_JITTER,
          y + this.jitter() * TURN_JITTER,
          this.jitter() * Math.PI,
          0,
          side === mySide ? air.mySmallID() : side < 100_000 ? side : 0,
          16,
          nowMs,
        );
      }
    }
  }

  /**
   * ww8: the clock the wing flights are drawn at: the fractional game tick
   * and the shortest leg the screen shows (LEG_MIN_DRAW_MS in ticks).
   */
  setFlightClock(
    tickF: number,
    msPerTick: number,
    navy: WwNavyView | null,
  ): void {
    this.flightTick = tickF;
    this.flightMinLeg = LEG_MIN_DRAW_MS / Math.max(1, msPerTick);
    this.flightNavy = navy;
  }

  /**
   * ww8: writes the wings' planes into the instance floats from `n` on
   * (at most SORTIE_CAP in all); returns the new count. A wing the fog
   * hides in flight draws nothing, and nor does one whose carrier it hides.
   */
  private fillWings(air: WwAirView, f: Float32Array, n: number): number {
    const sc = air.scenario;
    const W = sc.width;
    const fog = fogOfAir(air);
    const navy = this.flightNavy;
    const pose = this.pose;
    const base = this.baseXY;
    const target = this.targetXY;
    const me = air.mySmallID();
    for (const [id, row] of air.flights) {
      if (n >= SORTIE_CAP) break;
      const b = air.wingBriefs.get(id);
      if (b === undefined) continue;
      const mine = b.owner === me;
      if (!mine && fog !== undefined && !fog.wingFlightVisible(b)) continue;
      if (!wingBaseXY(air, navy, b.base, base)) continue;
      // Another owner's carrier launches only from a fleet the fog shows.
      if (!mine && b.base < 0 && navy !== null) {
        let hidden = false;
        for (const fl of navy.fleets.values()) {
          for (const sh of fl.ships) {
            if (
              sh.id === -b.base &&
              fogOfNavy(navy)?.fleetView(fl.id).visible === false
            ) {
              hidden = true;
            }
          }
        }
        if (hidden) continue;
      }
      if (row[1] === WP_FERRY) {
        // A ferry flies from the base it left (the row's target) to its base.
        if (!wingBaseXY(air, navy, row[6], target)) continue;
      } else {
        const t = targetTile(sc, row[6], b.flySr);
        if (t < 0) continue;
        target[0] = t % W;
        target[1] = Math.floor(t / W);
      }
      if (
        !flightPose(
          W,
          base,
          target,
          row,
          this.flightTick,
          this.flightMinLeg,
          pose,
        )
      ) {
        continue;
      }
      const seen = mine
        ? b.planes
        : (fog?.planesSeen(b.owner, b.planes) ?? b.planes);
      const k = drawnPlanes(seen);
      if (k > 0) this.requestAtlas();
      const look = LOOK.get(AIR_TYPES[b.type])!;
      const scale = flightScale(UT_BOMBER, pose.progress);
      const px = -Math.sin(pose.heading);
      const py = Math.cos(pose.heading);
      for (let i = 0; i < k && n < SORTIE_CAP; i++) {
        const off = (i - (k - 1) / 2) * 3;
        const o = n * FLOATS;
        f[o] = pose.x + px * off + 0.5;
        f[o + 1] = pose.y + py * off + 0.5;
        f[o + 2] = pose.heading;
        f[o + 3] = look.size * scale;
        f[o + 4] = look.col;
        f[o + 5] = b.owner;
        f[o + 6] = 1;
        f[o + 7] = contrailLength(pose.flown, scale) * 0.5;
        n++;
      }
    }
    return n;
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
    const planes = deploymentPlanes(d);
    if (d.owner !== me) return planes;
    const side = air.mySide();
    const ti = AIR_TYPES.indexOf(d.type);
    let flown = 0;
    for (const s of zone.sides) if (s.side === side) flown = s.sorties[ti] ?? 0;
    const mine = this.myPlanes.get(d.sr * 16 + ti) ?? 0;
    return mine > 0 ? (flown * planes) / mine : 0;
  }

  /**
   * Where `d` takes off: its base region's center, or its carrier's fleet.
   * P6 (spec §8.9, final review C I5): another owner's carrier launches
   * only from a fleet the fog shows — a hidden fleet's place never reaches
   * the GPU (null: the deployment flies nothing).
   */
  private baseOf(
    air: WwAirView,
    navy: WwNavyView | null,
    d: AirDeploySummary,
    me: number,
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
      let has = false;
      for (const s of f.ships) if (s.id === ship) has = true;
      if (!has) continue;
      if (
        d.owner !== me &&
        fogOfNavy(navy)?.fleetView(f.id).visible === false
      ) {
        return null;
      }
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
    const i = this.free.pop();
    if (i === undefined) return false;
    const s = this.sorties[i];
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
    this.requestAtlas();
    return true;
  }

  /** World War 1936 P6 (WwStrikeFxPass): `planes` bombers fly out to a target and back, once. */
  spawnStrikeFlight(
    owner: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    planes: number,
    startMs: number,
  ): void {
    const look = LOOK.get("strat_bomber")!;
    const d = { id: -1, owner } as AirDeploySummary;
    for (let i = 0; i < planes; i++) {
      this.launch(d, look, bx, by, cx, cy, startMs + i * 250);
    }
  }

  private land(s: Sortie, i: number): void {
    s.active = false;
    this.free.push(i);
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
    this.requestAtlas();
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
  private fill(nowMs: number, air: WwAirView): number {
    const f = this.buf.float32;
    const p = this.point;
    let n = 0;
    for (let i = 0; i < this.sorties.length; i++) {
      const s = this.sorties[i];
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
        this.land(s, i);
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
    n = this.fillWings(air, f, n);
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

  /** ww8: the air battles' crossed-swords icons with the planes lost rising off them. */
  private updateFightFx(nowMs: number): void {
    const b = this.fx;
    if (this.fightFx.size === 0 && b.drawn === 0) return;
    b.begin(this.fightFx.size * 2);
    for (const [sr, e] of this.fightFx) {
      const age = nowMs - e.start;
      if (age >= FIGHT_FX_MS) {
        this.fightFx.delete(sr);
        continue;
      }
      const t = age / FIGHT_FX_MS;
      b.putSprite(e.x + 0.5, e.y + 0.5, SHIP_CELL.battle, 1, 1 - t * t, 44);
      if (e.lost > 0) {
        const k = numberGlyphs(SHIP_CELL.cross, e.lost, this.glyphs);
        b.putText(
          e.x + 0.5,
          e.y + 0.5 - t * FIGHT_RISE_TILES,
          0,
          this.glyphs,
          k,
          TEXT_RED,
        );
      }
    }
    b.upload();
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
        sum.set(d.sr, (sum.get(d.sr) ?? 0) + deploymentPlanes(d));
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
      const planes = this.fill(nowMs, air);
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
      for (let i = 0; i < this.sorties.length; i++) {
        const s = this.sorties[i];
        if (s.active && nowMs >= s.start + 2 * s.legMs) this.land(s, i);
      }
    }
    this.updateFightFx(nowMs);
    this.updateChips(air, airLayer);
    if (this.chips.drawn > 0) {
      this.sprites.bind(cam, tilesPerPx, timeSec);
      this.chips.draw();
    }
    if (this.fx.drawn > 0) {
      this.sprites.bind(cam, tilesPerPx, timeSec);
      this.fx.draw();
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
    this.fx.dispose();
  }
}
