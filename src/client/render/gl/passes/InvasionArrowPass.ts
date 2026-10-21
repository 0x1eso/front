/**
 * InvasionArrowPass — World War 1936 P4 (spec §18.2): the viewer's naval
 * invasions. For each one not yet back: a curved band from the port it
 * sails from (its coast, FleetTokenLayout.dockXY) through the route's sea
 * regions to the target region, with a head; light stripes flow along it
 * while it sails or lands. At the target a ring shows the preparation
 * (gold arc prepDone / prepDays, green pulse when ready), and at each route
 * region a chip says whether our last supremacy there allows the landing
 * (✓ at WW_INVASION_LAUNCH_SUP_PM and above, ✗ below; spec §11).
 *
 * The bands reuse P2's plan-arrow shaders (PlanArrowPass's piece format,
 * built here along a Catmull-Rom curve through the route); the ring and
 * chips are ship sprites. A route across the date line is drawn at both
 * ends of the map. Rebuilt only when the view or the zoom changed (the
 * head stops a few screen px short of the target).
 */

import { WW_INVASION_LAUNCH_SUP_PM } from "@openfront/engine-api/ww1936/NavyTypes";
import { dockXY } from "../../../view/FleetTokenLayout";
import type { WwNavyView } from "../../../view/WwNavyView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/plan-arrow/plan-arrow.frag.glsl?raw";
import vertSrc from "../shaders/plan-arrow/plan-arrow.vert.glsl?raw";
import { createProgram } from "../utils/GlUtils";
import {
  RING_PREP,
  RING_READY,
  SHIP_CELL,
  ShipSpriteBatch,
  type ShipSpriteProgram,
  TEXT_GREEN,
  TEXT_RED,
} from "./FleetTokenPass";
import {
  STYLE_BAND,
  STYLE_DOTS,
  STYLE_FLOW,
  STYLE_HEAD,
} from "./PlanArrowPass";

/** Floats per piece (PlanArrowPass's layout). */
const FLOATS = 12;
/** Screen px: band width, dotted line width. */
const BAND_PX = 8;
const DOTS_PX = 3;
/** The head's tip stops this far (px) short of the target. */
const HEAD_SHORT_PX = 18;
const HEAD_PX = BAND_PX * 2;
/** Curve samples per span between two route points. */
const SPAN_SAMPLES = 8;
/** Screen px: the preparation ring's radius. */
const RING_PX = 17;

/**
 * Pieces for P2's plan-arrow program: curved bands with heads and dotted
 * lines along polylines, rebuilt into reused arrays.
 */
export class ArrowBatch {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uStart: WebGLUniformLocation;
  /** Floats written since clear() (reused). */
  readonly data: number[] = [];
  private count = 0;

  constructor(private gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, vertSrc, fragSrc, "SeaArrows");
    const u = (n: string) => gl.getUniformLocation(this.program, n)!;
    this.uCamera = u("uCamera");
    this.uTilesPerPx = u("uTilesPerPx");
    this.uTime = u("uTime");
    this.uStart = u("uStart");
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    this.buf = new DynamicInstanceBuffer(gl, gl.createBuffer()!, 64, FLOATS);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    for (const loc of [1, 2, 3]) {
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

  get pieces(): number {
    return this.count;
  }

  clear(): void {
    this.data.length = 0;
  }

  piece(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    arc: number,
    style: number,
    width: number,
    alpha: number,
  ): void {
    this.data.push(x0, y0, x1, y1, arc, 0, style, width, alpha, 0, 0, 0);
  }

  /**
   * A band along the polyline `pts[0..2m)` with a head whose tip stops
   * HEAD_SHORT_PX short of the last point; `tilesPerPx` sizes the head.
   */
  band(
    pts: Float64Array,
    m: number,
    style: number,
    alpha: number,
    tilesPerPx: number,
  ): void {
    if (m < 2) return;
    let total = 0;
    for (let i = 1; i < m; i++) {
      total += Math.hypot(
        pts[i * 2] - pts[i * 2 - 2],
        pts[i * 2 + 1] - pts[i * 2 - 1],
      );
    }
    if (total <= 1e-6) return;
    const headLen = HEAD_PX * tilesPerPx;
    const tipArc = total - Math.min(HEAD_SHORT_PX * tilesPerPx, total * 0.3);
    const bandEnd = tipArc - 0.7 * headLen;
    let arc = 0;
    let tipX = pts[(m - 1) * 2];
    let tipY = pts[(m - 1) * 2 + 1];
    let dirX = 1;
    let dirY = 0;
    for (let i = 1; i < m; i++) {
      const x0 = pts[i * 2 - 2];
      const y0 = pts[i * 2 - 1];
      const len = Math.hypot(pts[i * 2] - x0, pts[i * 2 + 1] - y0);
      const ux = len > 0 ? (pts[i * 2] - x0) / len : 1;
      const uy = len > 0 ? (pts[i * 2 + 1] - y0) / len : 0;
      if (arc < bandEnd) {
        const l = Math.min(len, bandEnd - arc);
        this.piece(
          x0,
          y0,
          x0 + ux * l,
          y0 + uy * l,
          arc,
          style,
          BAND_PX,
          alpha,
        );
      }
      if (tipArc >= arc && (tipArc <= arc + len || i === m - 1)) {
        const l = Math.min(len, tipArc - arc);
        tipX = x0 + ux * l;
        tipY = y0 + uy * l;
        dirX = ux;
        dirY = uy;
        break;
      }
      arc += len;
    }
    this.piece(
      tipX - dirX * headLen,
      tipY - dirY * headLen,
      tipX,
      tipY,
      0,
      STYLE_HEAD,
      BAND_PX,
      alpha,
    );
  }

  /** A dotted line along the polyline `pts[0..2m)`. */
  dots(pts: Float64Array, m: number, alpha: number): void {
    let arc = 0;
    for (let i = 1; i < m; i++) {
      const x0 = pts[i * 2 - 2];
      const y0 = pts[i * 2 - 1];
      const x1 = pts[i * 2];
      const y1 = pts[i * 2 + 1];
      this.piece(x0, y0, x1, y1, arc, STYLE_DOTS, DOTS_PX, alpha);
      arc += Math.hypot(x1 - x0, y1 - y0);
    }
  }

  /** Copies the pieces from float index `from` on, shifted by `dx` tiles. */
  repeatShifted(from: number, dx: number): void {
    const d = this.data;
    const end = d.length;
    for (let o = from; o < end; o += FLOATS) {
      d.push(d[o] + dx, d[o + 1], d[o + 2] + dx, d[o + 3]);
      for (let k = 4; k < FLOATS; k++) d.push(d[o + k]);
    }
  }

  upload(): void {
    const n = this.data.length / FLOATS;
    this.count = n;
    if (n === 0) return;
    this.buf.ensureCapacity(n);
    const f = this.buf.float32;
    for (let i = 0; i < this.data.length; i++) f[i] = this.data[i];
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, this.data.length);
  }

  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
    gl.uniform1f(this.uTime, timeSec);
    gl.uniform2f(this.uStart, 0, 0);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    this.buf.dispose();
    gl.deleteBuffer(this.quadBuf);
    gl.deleteVertexArray(this.vao);
  }
}

/**
 * Samples a Catmull-Rom curve through `pts[0..2n)` (SPAN_SAMPLES a span)
 * into `out`; returns the points written. `out` must hold
 * ((n - 1) * SPAN_SAMPLES + 1) * 2 numbers.
 */
export function curveThrough(
  pts: Float64Array,
  n: number,
  out: Float64Array,
): number {
  if (n < 2) {
    if (n === 1) {
      out[0] = pts[0];
      out[1] = pts[1];
    }
    return n;
  }
  let m = 0;
  const p = (i: number, c: number) =>
    pts[Math.max(0, Math.min(n - 1, i)) * 2 + c];
  for (let s = 0; s < n - 1; s++) {
    for (let k = 0; k < SPAN_SAMPLES; k++) {
      const t = k / SPAN_SAMPLES;
      const t2 = t * t;
      const t3 = t2 * t;
      for (let c = 0; c < 2; c++) {
        const p0 = p(s - 1, c);
        const p1 = p(s, c);
        const p2 = p(s + 1, c);
        const p3 = p(s + 2, c);
        out[m * 2 + c] =
          0.5 *
          (2 * p1 +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
      }
      m++;
    }
  }
  out[m * 2] = pts[(n - 1) * 2];
  out[m * 2 + 1] = pts[(n - 1) * 2 + 1];
  return m + 1;
}

export class InvasionArrowPass {
  private arrows: ArrowBatch;
  private batch: ShipSpriteBatch;
  private seenView: WwNavyView | null = null;
  private seenVersion = -1;
  private seenTilesPerPx = -1;
  private pts = new Float64Array(64);
  private curve = new Float64Array(64 * SPAN_SAMPLES);
  private readonly glyph = [0];

  constructor(
    gl: WebGL2RenderingContext,
    private sprites: ShipSpriteProgram,
  ) {
    this.arrows = new ArrowBatch(gl);
    this.batch = new ShipSpriteBatch(gl);
  }

  /** Arrow pieces and sprites written by the last rebuild. */
  get instanceCount(): number {
    return this.arrows.pieces + this.batch.drawn;
  }

  update(view: WwNavyView, tilesPerPx: number): void {
    if (
      view === this.seenView &&
      view.version === this.seenVersion &&
      tilesPerPx === this.seenTilesPerPx
    ) {
      return;
    }
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenTilesPerPx = tilesPerPx;
    const arrows = this.arrows;
    const batch = this.batch;
    arrows.clear();
    batch.begin(8);
    const invasions = view.detail?.invasions ?? [];
    const sc = view.scenario;
    const W = sc.width;
    const me = view.mySmallID();
    for (const inv of invasions) {
      if (inv.state === "returning") continue;
      const n = inv.route.length + 2;
      if (this.pts.length < n * 2) this.pts = new Float64Array(n * 4);
      const need = ((n - 1) * SPAN_SAMPLES + 1) * 2;
      if (this.curve.length < need) this.curve = new Float64Array(need * 2);
      const pts = this.pts;
      const [px, py] = dockXY(sc, inv.from);
      pts[0] = px;
      pts[1] = py;
      let k = 1;
      let lastX = px;
      const near = (x: number) =>
        Math.abs(x - lastX) > W / 2 ? x + (x > lastX ? -W : W) : x;
      for (const [srId, supPm] of inv.route) {
        const s = sc.sr(srId);
        if (s === undefined) continue;
        const cx = s.center % W;
        const cy = Math.floor(s.center / W);
        pts[k * 2] = near(cx);
        pts[k * 2 + 1] = cy;
        lastX = pts[k * 2];
        k++;
        this.glyph[0] =
          supPm >= WW_INVASION_LAUNCH_SUP_PM
            ? SHIP_CELL.check
            : SHIP_CELL.cross;
        batch.putText(
          cx,
          cy,
          me,
          this.glyph,
          1,
          supPm >= WW_INVASION_LAUNCH_SUP_PM ? TEXT_GREEN : TEXT_RED,
        );
      }
      if (sc.region(inv.target) === undefined) continue;
      const t = sc.centerTile(inv.target);
      const tx = t % W;
      const ty = Math.floor(t / W);
      pts[k * 2] = near(tx);
      pts[k * 2 + 1] = ty;
      k++;
      const m = curveThrough(pts, k, this.curve);
      const from = arrows.data.length;
      const style =
        inv.state === "sailing" || inv.state === "landing"
          ? STYLE_FLOW
          : STYLE_BAND;
      arrows.band(
        this.curve,
        m,
        style,
        inv.state === "preparing" ? 0.6 : 0.95,
        tilesPerPx,
      );
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < k; i++) {
        minX = Math.min(minX, pts[i * 2]);
        maxX = Math.max(maxX, pts[i * 2]);
      }
      if (minX < 0) arrows.repeatShifted(from, W);
      else if (maxX >= W) arrows.repeatShifted(from, -W);

      if (inv.state === "preparing") {
        const prog = inv.prepDays > 0 ? inv.prepDone / inv.prepDays : 0;
        batch.putRing(tx, ty, prog, RING_PX, RING_PREP, 0);
      } else if (inv.state === "ready") {
        batch.putRing(tx, ty, 1, RING_PX, RING_READY, 0);
      }
    }
    arrows.upload();
    batch.upload();
  }

  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    this.arrows.draw(cam, tilesPerPx, timeSec);
    if (this.batch.drawn === 0) return;
    this.sprites.bind(cam, tilesPerPx, timeSec);
    this.batch.draw();
  }

  dispose(): void {
    this.arrows.dispose();
    this.batch.dispose();
  }
}
