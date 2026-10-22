/**
 * WwMinePass — World War 1936 P6 (spec §15.1): the mine pattern over the
 * sea layer: my side's mines as blue dots, the enemy's I know of (naval
 * intelligence close or better) as red dots. A sea region's dots are a
 * stable sample of its tiles; the dot count follows the density mines /
 * 200,000 per tile. Rewritten only when the depth view changes.
 */

import { ID_NAVY } from "@openfront/engine-api/ww1936/DepthTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { intelBand } from "@openfront/engine-lib/ww1936/IntelRules";
import type { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import type { WwDepthView } from "../../../view/WwDepthView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/mine/mine.frag.glsl?raw";
import vertSrc from "../shaders/mine/mine.vert.glsl?raw";
import { createProgram } from "../utils/GlUtils";

const FLOATS = 4;
/** Tiles per mine at density 1 (spec: density = mines / 200,000). */
export const MINE_DENSITY_DIV = 200_000;
/** Most dots one sea region and side draw. */
export const MINE_DOTS_MAX = 400;

/** A deterministic 32-bit hash of a tile. */
export function tileHash(t: number): number {
  let h = Math.imul(t ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export interface MineSamples {
  /** Strategic region id → [area in tiles, its sample tiles ordered by hash]. */
  bySr: Map<number, { area: number; tiles: Uint32Array }>;
}

/** One scan of the map: each sea region's area and up to MINE_DOTS_MAX sample tiles. */
export function buildMineSamples(
  sc: ScenarioIndex,
  ids: Uint16Array,
): MineSamples {
  const area = new Map<number, number>();
  const srOf = new Int32Array(ids.length);
  for (let t = 0; t < ids.length; t++) {
    const id = ids[t];
    const sr = id >= SEA_ZONE_BASE ? sc.zoneSr(id) : 0;
    srOf[t] = sr;
    if (sr !== 0) area.set(sr, (area.get(sr) ?? 0) + 1);
  }
  const picked = new Map<number, number[]>();
  for (let t = 0; t < ids.length; t++) {
    const sr = srOf[t];
    if (sr === 0) continue;
    const a = area.get(sr)!;
    // Expect about MINE_DOTS_MAX tiles; the hash decides which.
    if (tileHash(t) / 4294967296 < MINE_DOTS_MAX / a) {
      let l = picked.get(sr);
      if (l === undefined) picked.set(sr, (l = []));
      l.push(t);
    }
  }
  const bySr = new Map<number, { area: number; tiles: Uint32Array }>();
  for (const [sr, a] of area) {
    const l = (picked.get(sr) ?? []).sort(
      (x, y) => tileHash(x) - tileHash(y) || x - y,
    );
    bySr.set(sr, { area: a, tiles: Uint32Array.from(l) });
  }
  return { bySr };
}

/** How many dots `mines` of a region draw. */
export function dotCount(mines: number, area: number, have: number): number {
  return Math.min(have, Math.ceil((mines * area) / MINE_DENSITY_DIV));
}

/**
 * Writes the dots into `out` (x, y, kind 0 mine / 1 enemy, 0) and returns
 * how many. `show(owner)` gives 0 mine, 1 known enemy, -1 hidden.
 */
export function mineInstances(
  samples: MineSamples,
  mines: readonly (readonly number[])[],
  mapW: number,
  show: (owner: number) => number,
  out: Float32Array,
): number {
  let n = 0;
  for (const [sr, owner, count] of mines) {
    const kind = show(owner);
    const s = samples.bySr.get(sr);
    if (kind < 0 || s === undefined || count <= 0) continue;
    const k = dotCount(count, s.area, s.tiles.length);
    for (let i = 0; i < k && (n + 1) * FLOATS <= out.length; i++) {
      const t = s.tiles[i];
      out[n * FLOATS] = t % mapW;
      out[n * FLOATS + 1] = Math.floor(t / mapW);
      out[n * FLOATS + 2] = kind;
      out[n * FLOATS + 3] = 0;
      n++;
    }
  }
  return n;
}

export class WwMinePass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private count = 0;
  private seenVersion = -1;
  private seenView: WwDepthView | null = null;
  private samples: MineSamples | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private sc: ScenarioIndex,
    private ids: Uint16Array,
    private mapW: number,
  ) {
    this.program = createProgram(gl, vertSrc, fragSrc, "WwMinePass");
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uTilesPerPx = gl.getUniformLocation(this.program, "uTilesPerPx")!;
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    this.buf = new DynamicInstanceBuffer(gl, gl.createBuffer()!, 256, FLOATS);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FLOATS * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }

  get instanceCount(): number {
    return this.count;
  }

  /** Rewrites the dots when the depth view changed. `me` is the viewer's smallID. */
  update(depth: WwDepthView, me: number): void {
    if (depth === this.seenView && depth.version === this.seenVersion) return;
    this.seenView = depth;
    this.seenVersion = depth.version;
    const mines = depth.minesData;
    if (mines.length === 0) {
      this.count = 0;
      return;
    }
    this.samples ??= buildMineSamples(this.sc, this.ids);
    const row = depth.intelRow(me);
    const show = (owner: number) =>
      owner === me
        ? 0
        : row === undefined || intelBand(row[owner * 4 + ID_NAVY]) >= 2
          ? 1
          : -1;
    this.buf.ensureCapacity(mines.length * MINE_DOTS_MAX);
    this.count = mineInstances(
      this.samples,
      mines,
      this.mapW,
      show,
      this.buf.float32,
    );
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.buf.float32,
      0,
      this.count * FLOATS,
    );
  }

  draw(cam: Float32Array, tilesPerPx: number): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
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
