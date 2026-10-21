/**
 * ConvoyFxPass — World War 1936 P4 (spec §18.2): the viewer's convoys.
 *
 * - Merchant silhouettes (ship atlas) sail the viewer's sea routes: one for
 *   every 50 convoys a route has (at least one while it has any), at most
 *   40 on the map (convoyShips). They run along the route's zone centers,
 *   every other one the other way, fading in and out at the ends, mirrored
 *   to their heading; across the date line at both ends of the map.
 * - Splashes ring where the viewer's convoys were sunk yesterday: at the
 *   route zones inside each such sea region, else at the region's center.
 * - With the sea layer on, the routes themselves as thin dotted lines (P2's
 *   plan-arrow dots).
 *
 * Screen only. The routes are rebuilt when the viewer's detail changes,
 * the splashes when the view moves; each frame only moves the ships (a few
 * dozen instances, nothing allocated).
 */

import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { WwNavyView } from "../../../view/WwNavyView";
import {
  RING_SPLASH,
  SHIP_CELL,
  ShipSpriteBatch,
  type ShipSpriteProgram,
} from "./FleetTokenPass";
import { ArrowBatch } from "./InvasionArrowPass";

/** Convoys a drawn merchant ship stands for. */
export const CONVOYS_PER_SHIP = 50;
/** Merchant ships on the map at most. */
export const MAX_CONVOY_SHIPS = 40;
/** Screen px of a merchant silhouette. */
const SHIP_PX = 18;
/** Tiles a second a merchant sails (screen only). */
const SHIP_TILES_PER_SEC = 2.5;
/** Splashes per loss region at most. */
const SPLASHES_PER_REGION = 3;
const SPLASH_PX = 13;

/**
 * Ships drawn per route for its assigned convoys `got` (spec §18.2: one per
 * 50, at least one while it has any, 40 on the map at most; the biggest
 * routes give way first). Written into `out`, which is returned.
 */
export function convoyShips(
  got: readonly number[],
  out: number[] = [],
): number[] {
  out.length = got.length;
  let total = 0;
  for (let i = 0; i < got.length; i++) {
    out[i] =
      got[i] > 0 ? Math.max(1, Math.round(got[i] / CONVOYS_PER_SHIP)) : 0;
    total += out[i];
  }
  while (total > MAX_CONVOY_SHIPS) {
    let big = 0;
    for (let i = 1; i < out.length; i++) if (out[i] > out[big]) big = i;
    out[big]--;
    total--;
  }
  return out;
}

export class ConvoyFxPass {
  private batch: ShipSpriteBatch;
  private dots: ArrowBatch;
  private seenView: WwNavyView | null = null;
  private seenVersion = -1;
  /** The viewer's detail the routes were built from (replaced on its updates). */
  private seenDetail: WwNavyView["detail"] = null;
  private seenDots = false;

  // Route polylines: points (x unwrapped along the route) and arc lengths,
  // packed; route r's points start at routeStart[r].
  private pts = new Float64Array(256);
  private arcs = new Float64Array(128);
  private routeStart: number[] = [];
  private routeLen: number[] = [];
  private routeTotal: number[] = [];
  // Ships: route index, lap offset, direction (+1 / -1).
  private shipRoute: number[] = [];
  private shipOffset: number[] = [];
  private shipDir: number[] = [];
  // Splashes (tile coords).
  private splashX: number[] = [];
  private splashY: number[] = [];
  private readonly perRoute: number[] = [];
  private readonly gots: number[] = [];
  private mapW = 0;

  constructor(
    gl: WebGL2RenderingContext,
    private sprites: ShipSpriteProgram,
  ) {
    this.batch = new ShipSpriteBatch(gl);
    this.dots = new ArrowBatch(gl);
  }

  get shipCount(): number {
    return this.shipRoute.length;
  }

  /**
   * Rebuilds the routes, ships and splashes when the view moved; the dotted
   * routes when the sea layer was switched.
   */
  update(view: WwNavyView, seaLayer: boolean): void {
    const fresh = view !== this.seenView;
    const routes = fresh || view.detail !== this.seenDetail;
    const moved = fresh || view.version !== this.seenVersion;
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenDetail = view.detail;
    if (routes) this.rebuildRoutes(view);
    if (moved) this.rebuildSplashes(view);
    if (routes || seaLayer !== this.seenDots) {
      this.seenDots = seaLayer;
      this.dots.clear();
      if (seaLayer) {
        for (let r = 0; r < this.routeStart.length; r++) {
          const from = this.dots.data.length;
          const sub = this.pts.subarray(
            this.routeStart[r] * 2,
            (this.routeStart[r] + this.routeLen[r]) * 2,
          );
          this.dots.dots(sub, this.routeLen[r], 0.75);
          let minX = Infinity;
          let maxX = -Infinity;
          for (let i = 0; i < this.routeLen[r]; i++) {
            minX = Math.min(minX, sub[i * 2]);
            maxX = Math.max(maxX, sub[i * 2]);
          }
          if (minX < 0) this.dots.repeatShifted(from, this.mapW);
          else if (maxX >= this.mapW) this.dots.repeatShifted(from, -this.mapW);
        }
      }
      this.dots.upload();
    }
  }

  /** Route polylines and their ships, from the viewer's detail. */
  private rebuildRoutes(view: WwNavyView): void {
    const sc = view.scenario;
    const W = sc.width;
    this.mapW = W;
    const routes = view.detail?.routes ?? [];
    this.routeStart.length = 0;
    this.routeLen.length = 0;
    this.routeTotal.length = 0;
    this.gots.length = 0;
    let p = 0;
    for (const route of routes) {
      const zones = route.zones;
      if (this.pts.length < (p + zones.length) * 2) {
        const grown = new Float64Array((p + zones.length) * 4);
        grown.set(this.pts);
        this.pts = grown;
        const arcs = new Float64Array((p + zones.length) * 2);
        arcs.set(this.arcs);
        this.arcs = arcs;
      }
      const start = p;
      let lastX = 0;
      for (let i = 0; i < zones.length; i++) {
        const c = sc.zoneCenter(zones[i]);
        let x = c % W;
        if (i > 0 && Math.abs(x - lastX) > W / 2) x += x > lastX ? -W : W;
        this.pts[p * 2] = x;
        this.pts[p * 2 + 1] = Math.floor(c / W);
        this.arcs[p] =
          i === 0
            ? 0
            : this.arcs[p - 1] +
              Math.hypot(
                x - this.pts[p * 2 - 2],
                this.pts[p * 2 + 1] - this.pts[p * 2 - 1],
              );
        lastX = x;
        p++;
      }
      const len = p - start;
      this.routeStart.push(start);
      this.routeLen.push(len);
      this.routeTotal.push(len > 1 ? this.arcs[p - 1] : 0);
      this.gots.push(len > 1 ? route.got : 0);
    }
    convoyShips(this.gots, this.perRoute);
    this.shipRoute.length = 0;
    this.shipOffset.length = 0;
    this.shipDir.length = 0;
    for (let r = 0; r < this.perRoute.length; r++) {
      const n = this.perRoute[r];
      for (let j = 0; j < n; j++) {
        this.shipRoute.push(r);
        this.shipOffset.push((j + 0.5) / n + r * 0.137);
        this.shipDir.push(j % 2 === 0 ? 1 : -1);
      }
    }
  }

  /** Splashes where my convoys sank yesterday (the sea regions' days). */
  private rebuildSplashes(view: WwNavyView): void {
    const sc = view.scenario;
    const W = sc.width;
    const routes = view.detail?.routes ?? [];
    this.splashX.length = 0;
    this.splashY.length = 0;
    const me = view.mySmallID();
    for (const s of view.seaRegions.values()) {
      let lost = false;
      for (const [id, milli] of s.convoyLoss) {
        if (id === me && milli > 0) lost = true;
      }
      if (!lost) continue;
      let k = 0;
      for (const route of routes) {
        for (const z of route.zones) {
          if (k >= SPLASHES_PER_REGION) break;
          if (z <= SEA_ZONE_BASE || sc.zoneSr(z) !== s.sr) continue;
          const c = sc.zoneCenter(z);
          this.splashX.push(c % W);
          this.splashY.push(Math.floor(c / W));
          k++;
        }
      }
      if (k === 0) {
        const r = sc.sr(s.sr);
        if (r === undefined) continue;
        this.splashX.push(r.center % W);
        this.splashY.push(Math.floor(r.center / W));
      }
    }
  }

  /** Moves the ships to `timeSec` (every frame they exist). */
  private placeShips(timeSec: number): void {
    const b = this.batch;
    b.begin(this.shipRoute.length * 2 + this.splashX.length);
    const W = this.mapW;
    for (let i = 0; i < this.shipRoute.length; i++) {
      const r = this.shipRoute[i];
      const total = this.routeTotal[r];
      if (total <= 0) continue;
      const lap = this.shipOffset[i] + (timeSec * SHIP_TILES_PER_SEC) / total;
      let u = lap - Math.floor(lap);
      if (this.shipDir[i] < 0) u = 1 - u;
      const s = u * total;
      const start = this.routeStart[r];
      const n = this.routeLen[r];
      let k = 1;
      while (k < n - 1 && this.arcs[start + k] < s) k++;
      const a0 = this.arcs[start + k - 1];
      const len = this.arcs[start + k] - a0;
      const f = len > 0 ? (s - a0) / len : 0;
      const x0 = this.pts[(start + k - 1) * 2];
      const y0 = this.pts[(start + k - 1) * 2 + 1];
      const x1 = this.pts[(start + k) * 2];
      const y1 = this.pts[(start + k) * 2 + 1];
      const x = x0 + (x1 - x0) * f;
      const y = y0 + (y1 - y0) * f;
      const flip = (x1 - x0) * this.shipDir[i] < 0 ? -1 : 1;
      const alpha = Math.min(1, Math.min(u, 1 - u) * 12);
      b.putSprite(x, y, SHIP_CELL.merchant, flip, alpha, SHIP_PX);
      if (x < 0)
        b.putSprite(x + W, y, SHIP_CELL.merchant, flip, alpha, SHIP_PX);
      else if (x >= W) {
        b.putSprite(x - W, y, SHIP_CELL.merchant, flip, alpha, SHIP_PX);
      }
    }
    for (let i = 0; i < this.splashX.length; i++) {
      b.putRing(
        this.splashX[i],
        this.splashY[i],
        0,
        SPLASH_PX,
        RING_SPLASH,
        i * 0.31,
      );
    }
    b.upload();
  }

  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    this.dots.draw(cam, tilesPerPx, timeSec);
    if (this.shipRoute.length === 0 && this.splashX.length === 0) return;
    this.placeShips(timeSec);
    this.sprites.bind(cam, tilesPerPx, timeSec);
    this.batch.draw();
  }

  dispose(): void {
    this.batch.dispose();
    this.dots.dispose();
  }
}
