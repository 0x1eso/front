/**
 * PeaceMapPass — World War 1936 P5 (spec §20.2): the peace conference's map
 * mode. While the card's "+ Pick regions" mode is on, the regions at stake
 * are bright and everything else is dimmed; each stake region shows its
 * state — nobody's demand (a white rim), my demand (my colour), settled in
 * an earlier round (the settler's colour, hatched), controlled by another
 * participant (a rim in its colour) — and the region tapped last gets a
 * pulsing white outline. From zoom 0.5 (CSS px per tile) on, each stake
 * region shows its price at its centre in small digits.
 *
 * The data comes from a PeaceMapSource (PeaceModel.peaceMapSource): the
 * pass asks for the regions only when the source's key changed, so a
 * steady map costs one string compare a frame. Nothing is made before the
 * mode first turns on. The tile codes are RegionBorderPass's (R16UI: bit 15
 * edge, low 15 bits the land region id or SEA_CODE_BIT | zone): the pass
 * shares that texture when the renderer hands it over (useTiles), else it
 * builds its own copy on first use.
 */

import { DynamicInstanceBuffer } from "../DynamicBuffer";
import labelFragSrc from "../shaders/peace-map/peace-label.frag.glsl?raw";
import vertSrc from "../shaders/peace-map/peace-label.vert.glsl?raw";
import fillFragSrc from "../shaders/peace-map/peace-map.frag.glsl?raw";
import mapVertSrc from "../shaders/region-border/region-border.vert.glsl?raw";
import {
  createMapQuad,
  createProgram,
  createTexture2D,
  shaderSrc,
} from "../utils/GlUtils";
import { regionTileCodes } from "./RegionBorderPass";

/** Side of the region table: region `id` sits at (id % size, floor(id / size)). */
export const PEACE_TEX_SIZE = 200;
/** A region outside the stake (dimmed). */
export const PEACE_OFF = 0;
/** At stake, nobody's demand (a white rim). */
export const PEACE_FREE = 1;
/** In my draft (my colour). */
export const PEACE_MINE = 2;
/** Settled in an earlier round (the settler's colour, hatched). */
export const PEACE_DECIDED = 3;
/** Controlled by another participant (a rim in its colour). */
export const PEACE_OTHER = 4;
/** OR-ed into the state: the region tapped last. */
export const PEACE_SELECTED = 8;
/** Prices show from this zoom (CSS px per tile) on. */
export const PEACE_LABEL_MIN_ZOOM = 0.5;
/** CSS px per font pixel of the price digits. */
export const PEACE_LABEL_CELL_PX = 2.4;
/** At most this many digits a price (larger prices show 9999). */
export const PEACE_LABEL_MAX_DIGITS = 4;

/** One stake region as the map mode draws it. */
export interface PeaceMapRegion {
  region: number;
  /** PEACE_FREE … PEACE_OTHER, | PEACE_SELECTED. */
  state: number;
  /** 0xRRGGBB: my colour, the settler's or the controller's. */
  rgb: number;
  /** The price shown at its centre (my price for it now). */
  value: number;
  /** World tile of its centre. */
  x: number;
  y: number;
}

/** What the pass reads (PeaceModel.peaceMapSource). */
export interface PeaceMapSource {
  /** Changes whenever what the map shows changes; "" while the mode is off. */
  key(): string;
  /** The stake regions (read only after the key changed). */
  regions(): readonly PeaceMapRegion[];
}

/** Byte offset of region `id` in the RGBA table. */
export function peaceTableOffset(region: number): number {
  return (
    ((region % PEACE_TEX_SIZE) +
      Math.floor(region / PEACE_TEX_SIZE) * PEACE_TEX_SIZE) *
    4
  );
}

/**
 * The region table (PEACE_TEX_SIZE² RGBA bytes): rgb the region's colour,
 * alpha its state; every other region is PEACE_OFF. `out` is reused.
 */
export function peaceRegionTable(
  regions: readonly PeaceMapRegion[],
  out: Uint8Array = new Uint8Array(PEACE_TEX_SIZE * PEACE_TEX_SIZE * 4),
): Uint8Array {
  out.fill(0);
  for (const r of regions) {
    if (r.region <= 0 || r.region >= PEACE_TEX_SIZE * PEACE_TEX_SIZE) continue;
    const o = peaceTableOffset(r.region);
    out[o] = (r.rgb >> 16) & 0xff;
    out[o + 1] = (r.rgb >> 8) & 0xff;
    out[o + 2] = r.rgb & 0xff;
    out[o + 3] = r.state & 0xff;
  }
  return out;
}

/** 3 × 5 digits, rows from the top; "#" lit. */
const DIGITS: readonly string[] = [
  "###,#.#,#.#,#.#,###",
  ".#.,##.,.#.,.#.,###",
  "###,..#,###,#..,###",
  "###,..#,###,..#,###",
  "#.#,#.#,###,..#,..#",
  "###,#..,###,..#,###",
  "###,#..,###,#.#,###",
  "###,..#,..#,..#,..#",
  "###,#.#,###,#.#,###",
  "###,#.#,###,..#,###",
];

/** Each digit's bits: bit (row × 3 + column), column 0 on the left (the label shader reads them). */
export function peaceDigitFont(): Int32Array {
  const out = new Int32Array(10);
  DIGITS.forEach((d, i) => {
    d.split(",").forEach((row, r) => {
      for (let c = 0; c < 3; c++) {
        if (row[c] === "#") out[i] |= 1 << (r * 3 + c);
      }
    });
  });
  return out;
}

/** How many digits a price shows (1 … PEACE_LABEL_MAX_DIGITS). */
export function peaceDigits(value: number): number {
  const v = Math.max(0, Math.min(9999, Math.floor(value)));
  return v >= 1000 ? 4 : v >= 100 ? 3 : v >= 10 ? 2 : 1;
}

const LABEL_FLOATS = 4;

export class PeaceMapPass {
  private fillProgram: WebGLProgram | null = null;
  private labelProgram: WebGLProgram | null = null;
  private quad: WebGLVertexArrayObject | null = null;
  private labelVao: WebGLVertexArrayObject | null = null;
  private cornerBuf: WebGLBuffer | null = null;
  private labelBuf: DynamicInstanceBuffer | null = null;
  private ownTiles: WebGLTexture | null = null;
  private sharedTiles: WebGLTexture | null = null;
  private tableTex: WebGLTexture | null = null;
  private readonly table = new Uint8Array(PEACE_TEX_SIZE * PEACE_TEX_SIZE * 4);
  private fCamera: WebGLUniformLocation | null = null;
  private fTilesPerPx: WebGLUniformLocation | null = null;
  private fTime: WebGLUniformLocation | null = null;
  private lCamera: WebGLUniformLocation | null = null;
  private lCellWorld: WebGLUniformLocation | null = null;
  private lAlpha: WebGLUniformLocation | null = null;
  private seenKey = "";
  private on = false;
  private labelCount = 0;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly regionIds: Uint16Array,
    private readonly mapW: number,
    private readonly mapH: number,
  ) {}

  /**
   * The renderer's region tile codes (RegionBorderPass's texture), so the
   * pass needs no copy of its own; null: build one on first use.
   */
  useTiles(tex: WebGLTexture | null): void {
    this.sharedTiles = tex;
    if (tex !== null && this.ownTiles !== null) {
      this.gl.deleteTexture(this.ownTiles);
      this.ownTiles = null;
    }
  }

  /** True while the map mode shows something. */
  get active(): boolean {
    return this.on;
  }

  /** Reads `src` when its key changed; uploads the region table and the price labels. */
  update(src: PeaceMapSource): void {
    const key = src.key();
    if (key === this.seenKey) return;
    this.seenKey = key;
    const regions = key === "" ? [] : src.regions();
    this.on = regions.length > 0;
    if (!this.on) return;
    this.ensure();
    const gl = this.gl;
    peaceRegionTable(regions, this.table);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.tableTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      PEACE_TEX_SIZE,
      PEACE_TEX_SIZE,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.table,
    );
    const buf = this.labelBuf!;
    buf.ensureCapacity(regions.length);
    const f = buf.float32;
    let o = 0;
    for (const r of regions) {
      const v = Math.max(0, Math.min(9999, Math.floor(r.value)));
      f[o] = r.x;
      f[o + 1] = r.y;
      f[o + 2] = v;
      f[o + 3] = peaceDigits(v);
      o += LABEL_FLOATS;
    }
    this.labelCount = regions.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, o);
  }

  /** The map mode over the territory; `tilesPerPx` = world tiles per CSS px. */
  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    if (!this.on || this.fillProgram === null) return;
    const gl = this.gl;
    const tiles = this.sharedTiles ?? this.ensureOwnTiles();
    gl.useProgram(this.fillProgram);
    gl.uniformMatrix3fv(this.fCamera, false, cam);
    gl.uniform1f(this.fTilesPerPx, tilesPerPx);
    gl.uniform1f(this.fTime, timeSec);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tiles);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tableTex);
    gl.bindVertexArray(this.quad);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);

    const zoom = 1 / Math.max(tilesPerPx, 1e-6);
    if (zoom < PEACE_LABEL_MIN_ZOOM || this.labelCount === 0) return;
    gl.useProgram(this.labelProgram);
    gl.uniformMatrix3fv(this.lCamera, false, cam);
    gl.uniform1f(this.lCellWorld, PEACE_LABEL_CELL_PX * tilesPerPx);
    gl.uniform1f(this.lAlpha, 1);
    gl.bindVertexArray(this.labelVao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.labelCount);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.fillProgram !== null) gl.deleteProgram(this.fillProgram);
    if (this.labelProgram !== null) gl.deleteProgram(this.labelProgram);
    if (this.quad !== null) gl.deleteVertexArray(this.quad);
    if (this.labelVao !== null) gl.deleteVertexArray(this.labelVao);
    if (this.cornerBuf !== null) gl.deleteBuffer(this.cornerBuf);
    this.labelBuf?.dispose();
    if (this.ownTiles !== null) gl.deleteTexture(this.ownTiles);
    if (this.tableTex !== null) gl.deleteTexture(this.tableTex);
    this.fillProgram = null;
    this.labelProgram = null;
    this.quad = null;
    this.labelVao = null;
    this.cornerBuf = null;
    this.labelBuf = null;
    this.ownTiles = null;
    this.tableTex = null;
    this.on = false;
    this.seenKey = "";
  }

  private ensureOwnTiles(): WebGLTexture {
    if (this.ownTiles !== null) return this.ownTiles;
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.ownTiles = createTexture2D(gl, {
      width: this.mapW,
      height: this.mapH,
      internalFormat: gl.R16UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_SHORT,
      data: regionTileCodes(this.regionIds, this.mapW, this.mapH),
      filter: gl.NEAREST,
    });
    return this.ownTiles;
  }

  /** The programs, the table texture and the label buffers, made once. */
  private ensure(): void {
    if (this.fillProgram !== null) return;
    const gl = this.gl;
    const defs = {
      MAP_W: this.mapW,
      MAP_H: this.mapH,
      PEACE_TEX_SIZE,
      PEACE_FREE,
      PEACE_MINE,
      PEACE_DECIDED,
      PEACE_OTHER,
      PEACE_SELECTED,
    };
    const fill = createProgram(
      gl,
      shaderSrc(mapVertSrc, defs),
      shaderSrc(fillFragSrc, defs),
      "PeaceMapPass",
    );
    const fu = (n: string) => gl.getUniformLocation(fill, n);
    this.fCamera = fu("uCamera");
    this.fTilesPerPx = fu("uTilesPerPx");
    this.fTime = fu("uTime");
    gl.useProgram(fill);
    gl.uniform1i(fu("uTiles"), 0);
    gl.uniform1i(fu("uTable"), 1);
    this.fillProgram = fill;
    this.quad = createMapQuad(gl, this.mapW, this.mapH);

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.tableTex = createTexture2D(gl, {
      width: PEACE_TEX_SIZE,
      height: PEACE_TEX_SIZE,
      internalFormat: gl.RGBA8,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      data: this.table,
      filter: gl.NEAREST,
    });

    const label = createProgram(
      gl,
      vertSrc,
      labelFragSrc,
      "PeaceMapPass.label",
    );
    const lu = (n: string) => gl.getUniformLocation(label, n);
    this.lCamera = lu("uCamera");
    this.lCellWorld = lu("uCellWorld");
    this.lAlpha = lu("uAlpha");
    gl.useProgram(label);
    gl.uniform1iv(lu("uFont"), peaceDigitFont());
    this.labelProgram = label;
    this.cornerBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    this.labelBuf = new DynamicInstanceBuffer(
      gl,
      gl.createBuffer()!,
      64,
      LABEL_FLOATS,
    );
    this.labelVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.labelVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelBuf.buffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, LABEL_FLOATS * 4, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }
}
