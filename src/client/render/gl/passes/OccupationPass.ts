/**
 * OccupationPass — World War 1936 P5 (spec §20.3): the occupation map mode.
 * While the band's "occupation" chip has it on, every land region with a
 * cell (OccupationCell) is filled with its colour: my administered regions
 * by resistance (green → yellow → red), my cores others hold faintly,
 * occupation zones in a neutral grey. A region short of garrison is
 * hatched; one close to an uprising (resistance ≥ 80%) has a blinking rim.
 *
 * One RGBA8 table of FLAG_TEX_SIZE² texels (region id → colour; alpha =
 * strength << 2 | flags), uploaded only when a byte changed, and a 16-bit
 * region-id texture of the map made the first time the mode is shown.
 * Nothing is made while the mode was never on.
 */

import vertSrc from "../shaders/region-border/region-border.vert.glsl?raw";
import {
  createMapQuad,
  createProgram,
  createTexture2D,
  shaderSrc,
} from "../utils/GlUtils";
import { FLAG_TEX_SIZE, flagIndex, tileCodeOf } from "./RegionBorderPass";

/** Cell flag: the region is short of garrison (hatched). */
export const OCC_HATCH = 1;
/** Cell flag: resistance at or above the uprising mark (blinking rim). */
export const OCC_BLINK = 2;
/** Strength steps of a cell's fill (alpha = level / OCC_LEVEL_MAX). */
export const OCC_LEVEL_MAX = 63;

/** One region of the occupation map. */
export interface OccupationCell {
  region: number;
  rgb: readonly [number, number, number];
  /** 1..OCC_LEVEL_MAX. */
  level: number;
  /** OCC_HATCH | OCC_BLINK. */
  flags: number;
}

/** What the renderer reads each frame (EndgameModel.occupationMapSource). */
export interface OccupationSource {
  /** The mode is on. */
  on(): boolean;
  /** Changes whenever the cells may have changed (the mode, the tick). */
  key(): string;
  /** The regions to fill now. */
  cells(): readonly OccupationCell[];
}

/** The table bytes of `cells` (FLAG_TEX_SIZE² × 4), 0 elsewhere. */
export function packOccupationTable(
  cells: readonly OccupationCell[],
  out: Uint8Array = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE * 4),
): Uint8Array {
  out.fill(0);
  writeOccupationCells(cells, out, null);
  return out;
}

/**
 * Writes `cells` into `out` as packOccupationTable does (it leaves the
 * other texels alone) and, with `at`, notes each written texel's byte
 * offset there; the count of offsets written.
 */
function writeOccupationCells(
  cells: readonly OccupationCell[],
  out: Uint8Array,
  at: { offsets: Int32Array } | null,
): number {
  let n = 0;
  for (const c of cells) {
    if (c.region <= 0 || c.region >= FLAG_TEX_SIZE * FLAG_TEX_SIZE) continue;
    const level = Math.max(1, Math.min(OCC_LEVEL_MAX, Math.round(c.level)));
    const o = flagIndex(c.region) * 4;
    out[o] = c.rgb[0];
    out[o + 1] = c.rgb[1];
    out[o + 2] = c.rgb[2];
    out[o + 3] = (level << 2) | (c.flags & 3);
    if (at !== null) {
      if (n >= at.offsets.length) {
        const grown = new Int32Array(Math.max(64, at.offsets.length * 2));
        grown.set(at.offsets);
        at.offsets = grown;
      }
      at.offsets[n] = o;
    }
    n++;
  }
  return n;
}

const FRAG = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform usampler2D uTiles; // R16UI per tile: the land region id, 0 elsewhere
uniform sampler2D uTable;  // RGBA8 FLAG_TEX_SIZE²: colour, strength << 2 | flags
uniform float uTilesPerPx;
uniform float uTime;

in vec2 vUV;
out vec4 fragColor;

const vec3 RIM = vec3(1.0, 0.15, 0.1);

uint regionAt(vec2 w) {
  ivec2 tc = clamp(ivec2(floor(w)), ivec2(0), ivec2(MAP_W - 1, MAP_H - 1));
  return texelFetch(uTiles, tc, 0).r;
}

vec4 cellOf(uint id) {
  int i = int(id);
  return texelFetch(uTable, ivec2(i % FLAG_TEX_SIZE, i / FLAG_TEX_SIZE), 0);
}

void main() {
  vec2 w = vUV * vec2(float(MAP_W), float(MAP_H));
  uint id = regionAt(w);
  if (id == 0u) discard;
  vec4 c = cellOf(id);
  uint a = uint(c.a * 255.0 + 0.5);
  if (a == 0u) discard;
  float alpha = float(a >> 2) / 63.0;
  vec3 col = c.rgb;
  if ((a & 1u) != 0u) {
    float s = (w.x + w.y) / uTilesPerPx;
    float stripe = 1.0 - step(2.0, mod(s, 8.0));
    col = mix(col, vec3(0.08), 0.55 * stripe);
    alpha = max(alpha, 0.35 + 0.35 * stripe);
  }
  if ((a & 2u) != 0u) {
    float r = 2.0 * uTilesPerPx;
    bool rim = regionAt(w + vec2(r, 0.0)) != id || regionAt(w - vec2(r, 0.0)) != id ||
      regionAt(w + vec2(0.0, r)) != id || regionAt(w - vec2(0.0, r)) != id;
    if (rim) {
      float blink = 0.5 + 0.5 * sin(uTime * 5.0);
      col = mix(col, RIM, 0.4 + 0.6 * blink);
      alpha = max(alpha, 0.5 + 0.45 * blink);
    }
  }
  fragColor = vec4(col, alpha);
}
`;

export class OccupationPass {
  private program: WebGLProgram | null = null;
  private tileTex: WebGLTexture | null = null;
  private tableTex: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uCamera: WebGLUniformLocation | null = null;
  private uTilesPerPx: WebGLUniformLocation | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private readonly table = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE * 4);
  private readonly sent = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE * 4);
  private keySent: string | null = null;
  private any = false;
  /**
   * Final review M6: the byte offsets of the texels the table's cells
   * wrote, this pack's and the last one's. The table is 0 everywhere else
   * (as packOccupationTable leaves it) and equals `sent` after each sync,
   * so a new pack clears and compares only those texels, not the whole
   * table — the key moves every tick while the mode is on.
   */
  private written = { offsets: new Int32Array(64) };
  private writtenCount = 0;
  private prior = { offsets: new Int32Array(64) };
  private priorCount = 0;

  constructor(
    private gl: WebGL2RenderingContext,
    private regionIds: Uint16Array,
    private mapW: number,
    private mapH: number,
    private source: OccupationSource,
  ) {}

  /** Rebuilds the table when the source's key moved; sends it when a byte differs. */
  sync(): boolean {
    if (!this.source.on()) {
      this.keySent = null;
      return false;
    }
    const key = this.source.key();
    if (key === this.keySent) return this.any;
    this.keySent = key;
    const cells = this.source.cells();
    this.any = cells.length > 0;
    this.pack(cells);
    if (this.tableTex !== null && this.sameAsSent()) return this.any;
    this.sent.set(this.table);
    this.upload();
    return this.any;
  }

  /** packOccupationTable(cells, table), clearing only the last pack's texels. */
  private pack(cells: readonly OccupationCell[]): void {
    const t = this.table;
    const last = this.written;
    for (let k = 0; k < this.writtenCount; k++) {
      const o = last.offsets[k];
      t[o] = t[o + 1] = t[o + 2] = t[o + 3] = 0;
    }
    // This pack's offsets go in the other list; the last ones stay to compare.
    this.written = this.prior;
    this.prior = last;
    this.priorCount = this.writtenCount;
    this.writtenCount = writeOccupationCells(cells, t, this.written);
  }

  /** The table equals `sent`: they can differ only where this pack or the last wrote. */
  private sameAsSent(): boolean {
    return (
      this.sameAt(this.written.offsets, this.writtenCount) &&
      this.sameAt(this.prior.offsets, this.priorCount)
    );
  }

  private sameAt(offsets: Int32Array, n: number): boolean {
    const t = this.table;
    const s = this.sent;
    for (let k = 0; k < n; k++) {
      const o = offsets[k];
      if (
        t[o] !== s[o] ||
        t[o + 1] !== s[o + 1] ||
        t[o + 2] !== s[o + 2] ||
        t[o + 3] !== s[o + 3]
      ) {
        return false;
      }
    }
    return true;
  }

  private upload(): void {
    const gl = this.gl;
    // RGBA8 rows are 4-byte aligned already: the default unpack state does.
    if (this.tableTex === null) {
      this.tableTex = createTexture2D(gl, {
        width: FLAG_TEX_SIZE,
        height: FLAG_TEX_SIZE,
        internalFormat: gl.RGBA8,
        format: gl.RGBA,
        type: gl.UNSIGNED_BYTE,
        data: this.table,
        filter: gl.NEAREST,
      });
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.tableTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      FLAG_TEX_SIZE,
      FLAG_TEX_SIZE,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.table,
    );
  }

  private ensureProgram(): WebGLProgram {
    if (this.program !== null) return this.program;
    const gl = this.gl;
    const defs = { MAP_W: this.mapW, MAP_H: this.mapH, FLAG_TEX_SIZE };
    const p = createProgram(
      gl,
      shaderSrc(vertSrc, defs),
      shaderSrc(FRAG, defs),
      "OccupationPass",
    );
    this.uCamera = gl.getUniformLocation(p, "uCamera");
    this.uTilesPerPx = gl.getUniformLocation(p, "uTilesPerPx");
    this.uTime = gl.getUniformLocation(p, "uTime");
    gl.useProgram(p);
    gl.uniform1i(gl.getUniformLocation(p, "uTiles"), 0);
    gl.uniform1i(gl.getUniformLocation(p, "uTable"), 1);
    const ids = new Uint16Array(this.mapW * this.mapH);
    for (let t = 0; t < ids.length; t++) {
      // Land region ids only: sea zone codes carry SEA_CODE_BIT.
      const code = tileCodeOf(this.regionIds[t] ?? 0);
      ids[t] = code < 0x4000 ? code : 0;
    }
    // 2-byte texels: rows of an odd width are not 4-byte aligned.
    const align = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.tileTex = createTexture2D(gl, {
      width: this.mapW,
      height: this.mapH,
      internalFormat: gl.R16UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_SHORT,
      data: ids,
      filter: gl.NEAREST,
    });
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, align);
    this.vao = createMapQuad(gl, this.mapW, this.mapH);
    this.program = p;
    return p;
  }

  /** The mode's fill over the territory, at any zoom. */
  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    if (!this.source.on() || !this.any || this.tableTex === null) return;
    const gl = this.gl;
    gl.useProgram(this.ensureProgram());
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
    gl.uniform1f(this.uTime, timeSec);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tileTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tableTex);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.program !== null) gl.deleteProgram(this.program);
    if (this.tileTex !== null) gl.deleteTexture(this.tileTex);
    if (this.tableTex !== null) gl.deleteTexture(this.tableTex);
    if (this.vao !== null) gl.deleteVertexArray(this.vao);
    this.program = null;
    this.tileTex = null;
    this.tableTex = null;
    this.vao = null;
  }
}
