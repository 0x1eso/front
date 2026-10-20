/**
 * PlanArrowPass — World War 1936 P2 (spec §15.2, §15.3): the viewer's chosen
 * army's intentions, as curved bands of instanced pieces.
 *
 * - Its plan: from the middle of its front regions' centers to each target's
 *   center, a quadratic Bézier band with a head; light stripes flow along it
 *   while the plan executes (a time uniform, nothing rebuilt).
 * - Its move order's remaining path (`mine.path`): a dotted line from the
 *   token (which glides, so the first leg follows it each frame) through the
 *   path's region centers.
 * - The screen's plan draft (`selection.targets`): the same arrows, faint.
 * - A first tap waiting for its confirm (`selection.pending`, spec §15.3):
 *   on one of the viewer's side's regions the walking path there (dotted,
 *   shortest by MoveRules.moveNeed over the side's regions, sides from
 *   LandFrontWorld); on another region a faint arrow to it.
 *
 * Widths are screen pixels (the vertex shader scales them); an arrow's head
 * stops a little short of its target's center, where that region's tokens
 * stand, so the pieces are rebuilt when the view, the choice, the viewer or
 * the zoom changes (a few hundred numbers into a reused array). Nothing is
 * drawn without a chosen army of the viewer's.
 */

import { moveNeed, shortestPath } from "@openfront/engine-lib/ww1936/MoveRules";
import type { WwLandSelection } from "../../../hud/ww1936/LandSelection";
import type { LandFrontWorld } from "../../../view/LandFrontWorld";
import type { WwLandView } from "../../../view/WwLandView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/plan-arrow/plan-arrow.frag.glsl?raw";
import vertSrc from "../shaders/plan-arrow/plan-arrow.vert.glsl?raw";
import { createProgram } from "../utils/GlUtils";

const FLOATS = 12;
export const STYLE_BAND = 0;
export const STYLE_FLOW = 1;
export const STYLE_HEAD = 2;
export const STYLE_DOTS = 3;
/** Straight pieces of one curved arrow. */
const ARROW_PIECES = 16;
/** Screen px: band width, dotted path width. */
const BAND_PX = 9;
const DOTS_PX = 4;
/** The head's tip stops this far (px) short of the target's center (at most 30% of the arrow). */
const HEAD_SHORT_PX = 20;
/** Head length, px; the band ends 70% of the way into it. */
const HEAD_PX = BAND_PX * 2;
/** How far the arrow bows sideways, by its length. */
const BOW = 0.22;

export class PlanArrowPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uStart: WebGLUniformLocation;
  private count = 0;
  /** Floats written while building (reused). */
  private readonly data: number[] = [];
  /** One arrow's curve: points and arc lengths (reused). */
  private readonly curve = new Float64Array((ARROW_PIECES + 1) * 2);
  private readonly arcs = new Float64Array(ARROW_PIECES + 1);
  private tilesPerPx = 1;

  private seenView: WwLandView | null = null;
  private seenVersion = -1;
  private seenSelection = -1;
  private seenMe = -1;
  private seenTilesPerPx = -1;

  // The first-tap walking path, kept while its ends stay.
  private previewFrom = -1;
  private previewTo = -1;
  private previewPath: number[] = [];

  constructor(private gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, vertSrc, fragSrc, "PlanArrowPass");
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

  get instanceCount(): number {
    return this.count;
  }

  /** Rebuilds the pieces when the view, the choice, the viewer or the zoom changed. */
  update(
    view: WwLandView,
    selection: WwLandSelection,
    me: number,
    tilesPerPx: number,
    world: LandFrontWorld,
  ): void {
    if (
      view === this.seenView &&
      view.version === this.seenVersion &&
      selection.version === this.seenSelection &&
      me === this.seenMe &&
      tilesPerPx === this.seenTilesPerPx
    ) {
      return;
    }
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenSelection = selection.version;
    this.seenMe = me;
    this.seenTilesPerPx = tilesPerPx;
    this.tilesPerPx = tilesPerPx;
    this.data.length = 0;
    this.build(view, selection, me, world);
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

  private build(
    view: WwLandView,
    sel: WwLandSelection,
    me: number,
    world: LandFrontWorld,
  ): void {
    const army = sel.army === null ? undefined : view.armies.get(sel.army);
    if (army === undefined || army.owner !== me || army.mine === null) return;
    const mine = army.mine;
    const sc = view.scenario;
    const w = sc.width;
    const cx = (r: number) => sc.centerTile(r) % w;
    const cy = (r: number) => Math.floor(sc.centerTile(r) / w);

    // Plans start from the middle of the front, else from the army.
    let sx = cx(army.region);
    let sy = cy(army.region);
    if (mine.front.length > 0) {
      sx = 0;
      sy = 0;
      for (const f of mine.front) {
        sx += cx(f);
        sy += cy(f);
      }
      sx /= mine.front.length;
      sy /= mine.front.length;
    }

    const plan = mine.order.kind === "plan";
    if (plan) {
      const style = mine.order.executing ? STYLE_FLOW : STYLE_BAND;
      for (const t of mine.order.targets) {
        this.arrow(sx, sy, cx(t), cy(t), style, 0.95);
      }
    }

    if (mine.path.length > 0) this.dots(view, army.region, mine.path, 0.95);

    for (const t of sel.targets) {
      if (plan && mine.order.targets.includes(t)) continue;
      this.arrow(sx, sy, cx(t), cy(t), STYLE_BAND, 0.45);
    }

    const p = sel.pending;
    const tapFlow =
      sel.mode === "none" || sel.mode === "move" || sel.mode === "attack";
    if (p === null || !tapFlow || p === army.region) return;
    const ours = world.sameSide(me, view.controller[p]);
    if (ours && sel.mode !== "attack") {
      if (this.previewFrom !== army.region || this.previewTo !== p) {
        this.previewFrom = army.region;
        this.previewTo = p;
        this.previewPath = shortestPath(
          sc,
          army.region,
          p,
          (r) => world.sameSide(me, view.controller[r]),
          (e, to) => moveNeed(sc.edge(e), sc.landOf(to)),
        );
      }
      if (this.previewPath.length > 1) {
        this.dots(view, army.region, this.previewPath, 0.6);
      }
    } else if (!ours && sel.mode !== "move") {
      this.arrow(
        cx(army.region),
        cy(army.region),
        cx(p),
        cy(p),
        STYLE_BAND,
        0.5,
      );
    }
  }

  private piece(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    arc: number,
    style: number,
    width: number,
    alpha: number,
    fromToken: boolean,
  ): void {
    this.data.push(x0, y0, x1, y1, arc, 0, style, width);
    this.data.push(alpha, 0, fromToken ? 1 : 0, 0);
  }

  /**
   * A curved band from (sx, sy) toward (tx, ty) with its head, the tip held
   * HEAD_SHORT_PX short of the target along the curve.
   */
  private arrow(
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    style: number,
    alpha: number,
  ): void {
    const dx = tx - sx;
    const dy = ty - sy;
    if (dx * dx + dy * dy < 1e-6) return;
    const kx = (sx + tx) / 2 - dy * BOW;
    const ky = (sy + ty) / 2 + dx * BOW;
    const c = this.curve;
    const arcs = this.arcs;
    c[0] = sx;
    c[1] = sy;
    arcs[0] = 0;
    for (let i = 1; i <= ARROW_PIECES; i++) {
      const t = i / ARROW_PIECES;
      const u = 1 - t;
      c[i * 2] = u * u * sx + 2 * u * t * kx + t * t * tx;
      c[i * 2 + 1] = u * u * sy + 2 * u * t * ky + t * t * ty;
      const ex = c[i * 2] - c[i * 2 - 2];
      const ey = c[i * 2 + 1] - c[i * 2 - 1];
      arcs[i] = arcs[i - 1] + Math.sqrt(ex * ex + ey * ey);
    }
    const total = arcs[ARROW_PIECES];
    const tpp = this.tilesPerPx;
    const headLen = HEAD_PX * tpp;
    const tipArc = total - Math.min(HEAD_SHORT_PX * tpp, total * 0.3);
    const bandEnd = tipArc - 0.7 * headLen;
    let tipX = tx;
    let tipY = ty;
    let dirX = 1;
    let dirY = 0;
    for (let i = 1; i <= ARROW_PIECES; i++) {
      const a0 = arcs[i - 1];
      const a1 = arcs[i];
      const x0 = c[i * 2 - 2];
      const y0 = c[i * 2 - 1];
      const len = a1 - a0;
      const ux = len > 0 ? (c[i * 2] - x0) / len : 1;
      const uy = len > 0 ? (c[i * 2 + 1] - y0) / len : 0;
      if (a0 < bandEnd) {
        const l = Math.min(len, bandEnd - a0);
        this.piece(
          x0,
          y0,
          x0 + ux * l,
          y0 + uy * l,
          a0,
          style,
          BAND_PX,
          alpha,
          false,
        );
      }
      if (tipArc >= a0 && (tipArc <= a1 || i === ARROW_PIECES)) {
        const l = Math.min(len, tipArc - a0);
        tipX = x0 + ux * l;
        tipY = y0 + uy * l;
        dirX = ux;
        dirY = uy;
        break;
      }
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
      false,
    );
  }

  /** A dotted line from the token through the centers of `path` (leading `from` skipped). */
  private dots(
    view: WwLandView,
    from: number,
    path: readonly number[],
    alpha: number,
  ): void {
    const sc = view.scenario;
    const w = sc.width;
    let i = 0;
    while (i < path.length && path[i] === from) i++;
    let px = 0;
    let py = 0;
    let arc = 0;
    let first = true;
    for (; i < path.length; i++) {
      const t = sc.centerTile(path[i]);
      const x = t % w;
      const y = Math.floor(t / w);
      if (first) {
        this.piece(0, 0, x, y, 0, STYLE_DOTS, DOTS_PX, alpha, true);
        first = false;
      } else {
        this.piece(px, py, x, y, arc, STYLE_DOTS, DOTS_PX, alpha, false);
        arc += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
      }
      px = x;
      py = y;
    }
  }

  /** (startX, startY): the chosen army's token this frame, tile coords. */
  draw(
    cam: Float32Array,
    tilesPerPx: number,
    timeSec: number,
    startX: number,
    startY: number,
  ): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
    gl.uniform1f(this.uTime, timeSec);
    gl.uniform2f(this.uStart, startX, startY);
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
