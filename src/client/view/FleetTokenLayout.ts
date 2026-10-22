// World War 1936 P4: where the fleet tokens go on the map and which one a
// tap hits (spec §18.2, §18.3; plan Task 11). Pure: the renderer
// (FleetTokenPass, through FleetLayoutCache) and the sea-air controller
// (layoutFleets + hitFleet) share it, so a token is tapped where it is
// drawn.
//
// Positions are tile coordinates as WwNavyView.fleetXY gives them (a zone's
// center tile, not the middle of that tile); the passes draw at +0.5.
// `zoom` is screen (CSS) pixels per tile, the TransformHandler's scale.
//
// - A moving fleet glides between zone centers (fleetXY, tick + alpha).
// - A docked fleet sits small on its port region's coast, toward the
//   region's center (dockXY).
// - A fleet on station on a mission slowly circles its strategic region's
//   zone centers, one lap every ORBIT_TICKS ticks (screen only).
// - Still tokens sharing a zone (or a port) fan out as P2's army tokens do;
//   a zone with a battle keeps its center for the battle marker.
// - Across the date line (x < 0 or x ≥ the map width) a token gets a
//   second slot at the other end of the map.
import type {
  FleetSummary,
  ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { fogOfNavy } from "../hud/ww1936/FogModel";
import { fanSlot } from "./LandTokenLayout";
import type { WwNavyView } from "./WwNavyView";

/** One token on the map: the fleet, its tile position and its radius in tiles. */
export interface TokenSlot {
  fleet: number;
  x: number;
  y: number;
  radius: number;
}

/** Tap radius of a token, screen px (spec §18: token tap radius 24 px). */
export const FLEET_HIT_PX = 24;
/** Below this zoom a token is a ship-count chip (spec §18.2 LOD). */
export const FLEET_CHIP_BELOW = 2;
/** Screen px from one fanned token to the next, by LOD (token, chip). */
export const FLEET_STEP_PX: readonly number[] = [34, 20];
/** Ticks for one lap of a mission token around its region (screen only). */
export const ORBIT_TICKS = 600;
/** Tiles: the circle a mission token draws in a one-zone region. */
export const ORBIT_RADIUS = 4;
/** Docked tokens are drawn this much smaller. */
export const DOCKED_SCALE = 0.7;

const GOLDEN = 0.6180339887498949;

/** 0: full token, 1: ship-count chip. */
export function fleetLod(zoom: number): number {
  return zoom < FLEET_CHIP_BELOW ? 1 : 0;
}

/**
 * The classes in the order a token picks its silhouette: the biggest
 * present. Battlecruisers share the battleship silhouette and light
 * cruisers the cruiser one (five silhouettes, spec §18.2).
 */
export const SILHOUETTE_ORDER: readonly ShipClass[] = [
  "bb",
  "cv",
  "bc",
  "ca",
  "cl",
  "dd",
  "ss",
];

/** The class a fleet's token shows (SILHOUETTE_ORDER), null for an empty fleet. */
export function tokenClass(counts: readonly number[]): ShipClass | null {
  for (const cls of SILHOUETTE_ORDER) {
    if ((counts[SHIP_CLASSES.indexOf(cls)] ?? 0) > 0) return cls;
  }
  return null;
}

/** Ships in a fleet (its per-class counts summed). */
export function shipCount(counts: readonly number[]): number {
  let n = 0;
  for (const c of counts) n += c;
  return n;
}

// ---- Docked fleets: the port's coast ----

const dockMemo = new WeakMap<
  ScenarioIndex,
  Map<number, readonly [number, number]>
>();

/**
 * Where a fleet docked in `region` is drawn: the first water tile on the
 * line from the region's center toward its harbor zone's center (the coast
 * on the region's side), lakes skipped. Static, memoised per scenario.
 */
export function dockXY(
  sc: ScenarioIndex,
  region: number,
): readonly [number, number] {
  let memo = dockMemo.get(sc);
  if (memo === undefined) {
    memo = new Map();
    dockMemo.set(sc, memo);
  }
  let p = memo.get(region);
  if (p === undefined) {
    p = coastOf(sc, region);
    memo.set(region, p);
  }
  return p;
}

function coastOf(sc: ScenarioIndex, region: number): [number, number] {
  const W = sc.width;
  const H = sc.height;
  if (sc.region(region) === undefined) return [0, 0];
  const c = sc.centerTile(region);
  const x0 = c % W;
  const y0 = Math.floor(c / W);
  const hz = sc.harborOf(region);
  if (hz === 0) return [x0, y0];
  const h = sc.zoneCenter(hz);
  let x1 = h % W;
  const y1 = Math.floor(h / W);
  if (Math.abs(x1 - x0) > W / 2) x1 += x1 > x0 ? -W : W;
  const n = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))),
  );
  for (let i = 0; i <= n; i++) {
    const x = (((Math.round(x0 + ((x1 - x0) * i) / n) % W) + W) % W) | 0;
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (y < 0 || y >= H) continue;
    const id = sc.regionIds[y * W + x];
    if (id > SEA_ZONE_BASE && !sc.isLake(id)) return [x, y];
  }
  return [((x1 % W) + W) % W, y1];
}

// ---- Mission tokens: a slow lap of the region ----

/** A closed loop through a sea region's zone centers (x unwrapped around the region's center). */
export interface OrbitLoop {
  /** x0, y0, x1, y1, … */
  pts: Float64Array;
  /** Arc length at each point; arcs[n] closes the loop. */
  arcs: Float64Array;
  total: number;
}

const orbitMemo = new WeakMap<ScenarioIndex, Map<number, OrbitLoop | null>>();

/**
 * The loop a mission token laps in sea region `sr`: its zones' centers by
 * angle around the region's center, the short way across the date line; a
 * one-zone region gets a circle of ORBIT_RADIUS tiles. Null for a land or
 * unknown region. Static, memoised per scenario.
 */
export function orbitLoop(sc: ScenarioIndex, sr: number): OrbitLoop | null {
  let memo = orbitMemo.get(sc);
  if (memo === undefined) {
    memo = new Map();
    orbitMemo.set(sc, memo);
  }
  let loop = memo.get(sr);
  if (loop === undefined) {
    loop = buildLoop(sc, sr);
    memo.set(sr, loop);
  }
  return loop;
}

function buildLoop(sc: ScenarioIndex, sr: number): OrbitLoop | null {
  const s = sc.sr(sr);
  if (s === undefined || s.kind !== "sea" || s.members.length === 0) {
    return null;
  }
  const W = sc.width;
  const cx = s.center % W;
  const cy = Math.floor(s.center / W);
  const near = (x: number) =>
    Math.abs(x - cx) > W / 2 ? x + (x > cx ? -W : W) : x;
  const pts: [number, number][] = [];
  if (s.members.length === 1) {
    const c = sc.zoneCenter(s.members[0]);
    const zx = near(c % W);
    const zy = Math.floor(c / W);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push([
        zx + Math.cos(a) * ORBIT_RADIUS,
        zy + Math.sin(a) * ORBIT_RADIUS,
      ]);
    }
  } else {
    for (const z of s.members) {
      const c = sc.zoneCenter(z);
      pts.push([near(c % W), Math.floor(c / W)]);
    }
    pts.sort(
      (a, b) =>
        Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx),
    );
  }
  const n = pts.length;
  const flat = new Float64Array(n * 2);
  const arcs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    flat[i * 2] = pts[i][0];
    flat[i * 2 + 1] = pts[i][1];
  }
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1];
    const b = pts[i % n];
    arcs[i] = arcs[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return { pts: flat, arcs, total: arcs[n] };
}

/** The point at lap fraction `u` (0..1) of `loop`, into `out`. */
export function orbitPoint(
  loop: OrbitLoop,
  u: number,
  out: { x: number; y: number },
): void {
  const n = loop.arcs.length - 1;
  const p = loop.pts;
  if (n === 1 || loop.total <= 0) {
    out.x = p[0];
    out.y = p[1];
    return;
  }
  const s = (u - Math.floor(u)) * loop.total;
  let i = 1;
  while (i < n && loop.arcs[i] < s) i++;
  const a0 = loop.arcs[i - 1];
  const len = loop.arcs[i] - a0;
  const k = len > 0 ? (s - a0) / len : 0;
  const j = i % n;
  out.x = p[(i - 1) * 2] + (p[j * 2] - p[(i - 1) * 2]) * k;
  out.y = p[(i - 1) * 2 + 1] + (p[j * 2 + 1] - p[(i - 1) * 2 + 1]) * k;
}

// ---- The layout ----

const MODE_STILL = 0;
const MODE_MOVING = 1;
const MODE_ORBIT = 2;

/**
 * The tokens' slots frame after frame, without allocating once the pools
 * are big enough: when the view or the zoom changes it sorts the fleets by
 * id and works out each still token's place (dock, zone center, fan); every
 * frame it places the moving and circling ones at `tick + alpha` and adds
 * the date line's second slots.
 */
export class FleetLayoutCache {
  /** The first `count` are this frame's slots. */
  readonly slots: TokenSlot[] = [];
  /** The fleet of each slot (a date-line token has two slots). */
  readonly slotFleet: FleetSummary[] = [];
  /** Each slot's place in `fleets` (by id). */
  readonly slotIndex: number[] = [];
  count = 0;
  /** Bumped each time the fleets were sorted and placed again (view or zoom moved). */
  samples = 0;
  /** fleetLod of the last zoom. */
  lod = 0;
  /** Some token moves or circles: slots change every frame. */
  moving = false;

  private readonly list: FleetSummary[] = [];
  private mode = new Uint8Array(64);
  private bx = new Float64Array(64);
  private by = new Float64Array(64);
  private dx = new Float64Array(64);
  private dy = new Float64Array(64);
  private phase = new Float64Array(64);
  private loops: (OrbitLoop | null)[] = [];
  private readonly fan = new Map<number, number>();
  private readonly pt = { x: 0, y: 0 };
  private seenView: WwNavyView | null = null;
  private seenVersion = -1;
  private seenZoom = Number.NaN;
  private seenFog = -1;
  private lastT = Number.NaN;
  private baseTick = Number.NaN;

  /** The fleets by id, as last sampled (slotIndex points into it). */
  get fleets(): readonly FleetSummary[] {
    return this.list;
  }

  /** Lays the tokens out at `tick + alpha`; true when a slot changed. */
  update(view: WwNavyView, tick: number, alpha: number, zoom: number): boolean {
    const resample =
      view !== this.seenView ||
      view.version !== this.seenVersion ||
      (fogOfNavy(view)?.stamp() ?? -1) !== this.seenFog ||
      zoom !== this.seenZoom;
    if (resample) this.sample(view, zoom);
    if (resample || tick !== this.baseTick) this.glide(view, tick);
    const t = tick + alpha;
    if (!resample && (!this.moving || t === this.lastT)) return false;
    this.lastT = t;
    this.place(view, alpha, t, zoom);
    return true;
  }

  /**
   * A new tick: each moving token's point at this tick and the next
   * (fleetXY is linear between them), so frames only interpolate.
   */
  private glide(view: WwNavyView, tick: number): void {
    this.baseTick = tick;
    for (let i = 0; i < this.list.length; i++) {
      if (this.mode[i] !== MODE_MOVING) continue;
      const id = this.list[i].id;
      const a = view.fleetXY(id, tick, 0);
      const b = view.fleetXY(id, tick + 1, 0);
      this.bx[i] = a[0];
      this.by[i] = a[1];
      this.dx[i] = b[0] - a[0];
      this.dy[i] = b[1] - a[1];
    }
  }

  private sample(view: WwNavyView, zoom: number): void {
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenZoom = zoom;
    this.lod = fleetLod(zoom);
    this.samples++;
    const fleets = this.list;
    fleets.length = 0;
    // P6 (spec §8.9): a fleet the fog hides takes no slot and no fan-out place.
    const fog = fogOfNavy(view);
    this.seenFog = fog?.stamp() ?? -1;
    for (const f of view.fleets.values()) {
      if (fog === undefined || fog.fleetView(f.id).visible) fleets.push(f);
    }
    fleets.sort((a, b) => a.id - b.id);
    const n = fleets.length;
    if (this.mode.length < n) {
      const cap = Math.max(n, this.mode.length * 2);
      this.mode = new Uint8Array(cap);
      this.bx = new Float64Array(cap);
      this.by = new Float64Array(cap);
      this.dx = new Float64Array(cap);
      this.dy = new Float64Array(cap);
      this.phase = new Float64Array(cap);
    }
    this.loops.length = n;
    const sc = view.scenario;
    const step = FLEET_STEP_PX[this.lod] / Math.max(zoom, 1e-6);
    const fan = this.fan;
    fan.clear();
    this.moving = false;
    for (let i = 0; i < n; i++) {
      const f = fleets[i];
      this.loops[i] = null;
      if (f.docked !== 0) {
        const dock = dockXY(sc, f.docked);
        const k = fan.get(f.docked) ?? 0;
        fan.set(f.docked, k + 1);
        this.mode[i] = MODE_STILL;
        this.bx[i] = dock[0];
        this.by[i] = dock[1] + fanSlot(k) * step * DOCKED_SCALE;
        continue;
      }
      if (f.path.length > 0) {
        this.mode[i] = MODE_MOVING;
        this.moving = true;
        continue;
      }
      const loop =
        f.state === "on_station" && f.missionSr !== 0
          ? orbitLoop(sc, f.missionSr)
          : null;
      if (loop !== null) {
        this.mode[i] = MODE_ORBIT;
        this.loops[i] = loop;
        this.phase[i] = (f.id * GOLDEN) % 1;
        this.moving = true;
        continue;
      }
      // Still at sea: the zone's center (fleetXY with no path).
      const c = sc.zoneCenter(f.zone);
      const x = c % sc.width;
      const y = Math.floor(c / sc.width);
      const k = fan.get(f.zone) ?? 0;
      fan.set(f.zone, k + 1);
      const slot = k + (view.battles.has(f.zone) ? 1 : 0);
      this.mode[i] = MODE_STILL;
      this.bx[i] = x;
      this.by[i] = y + fanSlot(slot) * step;
    }
  }

  private place(
    view: WwNavyView,
    alpha: number,
    t: number,
    zoom: number,
  ): void {
    const W = view.scenario.width;
    const radius = FLEET_HIT_PX / Math.max(zoom, 1e-6);
    const pt = this.pt;
    this.count = 0;
    for (let i = 0; i < this.list.length; i++) {
      const f = this.list[i];
      let x: number;
      let y: number;
      const mode = this.mode[i];
      if (mode === MODE_MOVING) {
        x = this.bx[i] + this.dx[i] * alpha;
        y = this.by[i] + this.dy[i] * alpha;
      } else if (mode === MODE_ORBIT) {
        orbitPoint(this.loops[i]!, t / ORBIT_TICKS + this.phase[i], pt);
        x = pt.x;
        y = pt.y;
      } else {
        x = this.bx[i];
        y = this.by[i];
      }
      this.push(f, i, x, y, radius);
      if (x < 0) this.push(f, i, x + W, y, radius);
      else if (x >= W) this.push(f, i, x - W, y, radius);
    }
  }

  private push(
    f: FleetSummary,
    i: number,
    x: number,
    y: number,
    radius: number,
  ): void {
    let s = this.slots[this.count];
    if (s === undefined) {
      s = { fleet: 0, x: 0, y: 0, radius: 0 };
      this.slots.push(s);
    }
    s.fleet = f.id;
    s.x = x;
    s.y = y;
    s.radius = radius;
    this.slotFleet[this.count] = f;
    this.slotIndex[this.count] = i;
    this.count++;
  }
}

/** The tokens to draw at `tick + alpha` and `zoom` (screen px per tile): fresh slots. */
export function layoutFleets(
  view: WwNavyView,
  tick: number,
  alpha: number,
  zoom: number,
): TokenSlot[] {
  const cache = new FleetLayoutCache();
  cache.update(view, tick, alpha, zoom);
  return cache.slots.slice(0, cache.count).map((s) => ({ ...s }));
}

/**
 * The fleet under a tap at tile (x, y), 0 when none: the nearest slot
 * within its radius (FLEET_HIT_PX on screen), the smaller fleet id on a tie.
 */
export function hitFleet(
  slots: readonly TokenSlot[],
  x: number,
  y: number,
): number {
  let best = 0;
  let bestD = Infinity;
  for (const s of slots) {
    const dx = s.x - x;
    const dy = s.y - y;
    const d = dx * dx + dy * dy;
    if (d > s.radius * s.radius) continue;
    if (d < bestD || (d === bestD && s.fleet < best)) {
      best = s.fleet;
      bestD = d;
    }
  }
  return best;
}
