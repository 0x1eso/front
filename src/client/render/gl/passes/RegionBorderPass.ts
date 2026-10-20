/**
 * RegionBorderPass — World War 1936 (spec §8.2): thin lines between land
 * regions, over the territory fill and under the country borders. Hidden
 * when zoomed out, faint at first, full when zoomed in. Sea zones are not
 * drawn in P0 (spec §4.6).
 *
 * P2 (spec §15.2) adds the land war's region flags: a byte per region id
 * (regionFlagBytes) in a 200×200 R8UI texture, uploaded only when it
 * changes, and a second program that draws the chosen army's front line
 * (a thick line in the viewer's colour where a front region meets an enemy
 * region across it), red hatching on the viewer's side's encircled regions
 * and a soft glow on the border regions a front can be given to. A game
 * without the land war never makes the texture or the program.
 */

import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { borderRegionsOf } from "@openfront/engine-lib/ww1936/FrontRules";
import type { WwLandSelection } from "../../../hud/ww1936/LandSelection";
import type { LandFrontWorld } from "../../../view/LandFrontWorld";
import type { WwLandView } from "../../../view/WwLandView";
import fragSrc from "../shaders/region-border/region-border.frag.glsl?raw";
import vertSrc from "../shaders/region-border/region-border.vert.glsl?raw";
import flagsFragSrc from "../shaders/region-border/region-flags.frag.glsl?raw";
import {
  createMapQuad,
  createProgram,
  createTexture2D,
  shaderSrc,
} from "../utils/GlUtils";

/** Lines start to show above this zoom (canvas px per tile)… */
export const REGION_MIN_ZOOM = 1;
/** …and are full from this one. */
export const REGION_FULL_ZOOM = 3;

/** Side of the region-flag texture: region `id` sits at (id % 200, floor(id / 200)). */
export const FLAG_TEX_SIZE = 200;
/** Bit 0: a front region of the chosen army (or of the front preview). */
export const FLAG_FRONT = 1;
/** Bit 1: an enemy region touching that front. */
export const FLAG_ENEMY = 2;
/** Bit 2: an encircled region of the viewer's side. */
export const FLAG_ENCIRCLED = 4;
/** Bit 3: a border region a front can be given to (front mode). */
export const FLAG_PICKABLE = 8;

/** Tile code bit: the tile's right or lower neighbour is another land region. */
export const TILE_EDGE_BIT = 0x8000;
/** Tile code bits: the land region id (0 for water, sea zones and ids past them). */
export const TILE_REGION_MASK = 0x7fff;

function isEdge(ids: Uint16Array, w: number, h: number, t: number): boolean {
  const id = ids[t];
  if (id === 0 || id >= SEA_ZONE_BASE) return false;
  const right = (t % w) + 1 < w ? ids[t + 1] : id;
  const down = t + w < w * h ? ids[t + w] : id;
  return (
    (right !== id && right !== 0 && right < SEA_ZONE_BASE) ||
    (down !== id && down !== 0 && down < SEA_ZONE_BASE)
  );
}

/**
 * 1 where a land tile's right or lower neighbour is another land region; 0
 * elsewhere (coasts, water and tiles outside every region included). Sea
 * zones are ids from SEA_ZONE_BASE up, as ScenarioIndex reads them; P0
 * draws none of their lines (spec §4.6).
 */
export function regionEdgeMask(
  ids: Uint16Array,
  w: number,
  h: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let t = 0; t < w * h; t++) if (isEdge(ids, w, h, t)) out[t] = 1;
  return out;
}

/**
 * The pass's tile texture (R16UI, one value per tile): TILE_EDGE_BIT where
 * regionEdgeMask has a 1, and the land region id in the low 15 bits for the
 * flag lookup (0 for water and sea zones; land ids are far below 32768).
 */
export function regionTileCodes(
  ids: Uint16Array,
  w: number,
  h: number,
): Uint16Array {
  const out = new Uint16Array(w * h);
  for (let t = 0; t < w * h; t++) {
    const id = ids[t];
    const land = id < SEA_ZONE_BASE && id <= TILE_REGION_MASK ? id : 0;
    out[t] = (isEdge(ids, w, h, t) ? TILE_EDGE_BIT : 0) | land;
  }
  return out;
}

/** Byte of region `id` in the flag texture: (id % 200, floor(id / 200)). */
export function flagIndex(region: number): number {
  return (
    (region % FLAG_TEX_SIZE) +
    Math.floor(region / FLAG_TEX_SIZE) * FLAG_TEX_SIZE
  );
}

function setFlag(out: Uint8Array, region: number, bit: number): void {
  if (region > 0 && region < FLAG_TEX_SIZE * FLAG_TEX_SIZE) {
    out[flagIndex(region)] |= bit;
  }
}

/**
 * The flag byte of every region id (spec §15.2), as the pass uploads it,
 * with the engine's front rules over `world` (LandFrontWorld: WwLand's
 * sides and enemies): bit 0 the chosen army's front regions
 * (`frontPreview` instead while the front mode previews one), bit 1 the
 * regions facing them (FrontRules.facesFront against the army's front
 * enemy — a named enemy counts before the war, spec §14.1), bit 2 the
 * encircled regions of the viewer's side, bit 3 in front mode the border
 * regions a front can be given to (FrontRules.borderRegionsOf, any enemy).
 * Only the viewer's own chosen army counts. `out` is reused when given.
 */
export function regionFlagBytes(
  view: WwLandView,
  selection: WwLandSelection,
  me: number,
  frontPreview: readonly number[],
  world: LandFrontWorld,
  out: Uint8Array = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE),
): Uint8Array {
  out.fill(0);
  const sc = view.scenario;
  const ctl = view.controller;
  for (const r of view.regions.values()) {
    if (r.encircled && world.sameSide(me, ctl[r.id])) {
      setFlag(out, r.id, FLAG_ENCIRCLED);
    }
  }

  const army =
    selection.army === null ? undefined : view.armies.get(selection.army);
  const mine = army !== undefined && army.owner === me ? army.mine : null;
  if (mine === null) return out;

  const preview = frontPreview.length > 0;
  const front = preview ? frontPreview : mine.front;
  const ordered = mine.order.kind === "front" || mine.order.kind === "plan";
  const enemy = !preview && ordered ? mine.order.enemy : 0;
  for (let i = 0; i < front.length; i++) {
    const f = front[i];
    setFlag(out, f, FLAG_FRONT);
    const edges = sc.edgesOf(f);
    for (let j = 0; j < edges.length; j++) {
      const to = edges[j].to;
      if (world.facesFront(me, enemy, ctl[to])) setFlag(out, to, FLAG_ENEMY);
    }
  }

  if (selection.mode === "front") {
    for (const r of borderRegionsOf(world, me, 0)) {
      setFlag(out, r, FLAG_PICKABLE);
    }
  }
  return out;
}

export class RegionBorderPass {
  private program: WebGLProgram;
  private tileTex: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private uCamera: WebGLUniformLocation;
  private uEdges: WebGLUniformLocation;
  private uAlpha: WebGLUniformLocation;

  // P2 region flags: made on the first flags that are not all zero.
  private flagTex: WebGLTexture | null = null;
  private flagProgram: WebGLProgram | null = null;
  private flagsOn = false;
  private fCamera: WebGLUniformLocation | null = null;
  private fTilesPerPx: WebGLUniformLocation | null = null;
  private fTime: WebGLUniformLocation | null = null;
  private fMe: WebGLUniformLocation | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    regionIds: Uint16Array,
    private mapW: number,
    private mapH: number,
  ) {
    this.program = createProgram(
      gl,
      shaderSrc(vertSrc, { MAP_W: mapW, MAP_H: mapH }),
      shaderSrc(fragSrc, { MAP_W: mapW, MAP_H: mapH }),
      "RegionBorderPass",
    );
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uEdges = gl.getUniformLocation(this.program, "uEdges")!;
    this.uAlpha = gl.getUniformLocation(this.program, "uAlpha")!;
    // Two bytes per tile: rows are not 4-byte aligned on every map width.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // Region ids exceed 8 bits: a 16-bit integer texture (P2 flags read them).
    this.tileTex = createTexture2D(gl, {
      width: mapW,
      height: mapH,
      internalFormat: gl.R16UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_SHORT,
      data: regionTileCodes(regionIds, mapW, mapH),
      filter: gl.NEAREST,
    });
    this.vao = createMapQuad(gl, mapW, mapH);
  }

  draw(cam: Float32Array, zoom: number): void {
    const alpha = Math.min(
      1,
      Math.max(
        0,
        (zoom - REGION_MIN_ZOOM) / (REGION_FULL_ZOOM - REGION_MIN_ZOOM),
      ),
    );
    if (alpha <= 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tileTex);
    gl.uniform1i(this.uEdges, 0);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uAlpha, alpha);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  /** True while some region has a flag (the flag program draws). */
  get hasFlags(): boolean {
    return this.flagsOn;
  }

  /**
   * P2: the region flag bytes (FLAG_TEX_SIZE² of them, regionFlagBytes).
   * The caller sends them only when they changed; the texture is made on
   * the first that are not all zero.
   */
  setRegionFlags(flags: Uint8Array): void {
    let any = false;
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] !== 0) {
        any = true;
        break;
      }
    }
    this.flagsOn = any;
    if (!any && this.flagTex === null) return;
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (this.flagTex === null) {
      this.flagTex = createTexture2D(gl, {
        width: FLAG_TEX_SIZE,
        height: FLAG_TEX_SIZE,
        internalFormat: gl.R8UI,
        format: gl.RED_INTEGER,
        type: gl.UNSIGNED_BYTE,
        data: flags,
        filter: gl.NEAREST,
      });
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.flagTex);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      FLAG_TEX_SIZE,
      FLAG_TEX_SIZE,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      flags,
    );
  }

  private ensureFlagProgram(): WebGLProgram {
    if (this.flagProgram !== null) return this.flagProgram;
    const gl = this.gl;
    const defs = { MAP_W: this.mapW, MAP_H: this.mapH, FLAG_TEX_SIZE };
    const p = createProgram(
      gl,
      shaderSrc(vertSrc, defs),
      shaderSrc(flagsFragSrc, defs),
      "RegionBorderPass.flags",
    );
    const u = (n: string) => gl.getUniformLocation(p, n);
    this.fCamera = u("uCamera");
    this.fTilesPerPx = u("uTilesPerPx");
    this.fTime = u("uTime");
    this.fMe = u("uMe");
    gl.useProgram(p);
    gl.uniform1i(u("uTiles"), 0);
    gl.uniform1i(u("uFlags"), 1);
    gl.uniform1i(u("uPalette"), 2);
    this.flagProgram = p;
    return p;
  }

  /**
   * P2: the flagged regions (spec §15.2) at any zoom: the front line in the
   * viewer's (`me`) colour from `palette`, hatching, glow.
   */
  drawFlags(
    cam: Float32Array,
    tilesPerPx: number,
    timeSec: number,
    palette: WebGLTexture,
    me: number,
  ): void {
    if (!this.flagsOn || this.flagTex === null) return;
    const gl = this.gl;
    gl.useProgram(this.ensureFlagProgram());
    gl.uniformMatrix3fv(this.fCamera, false, cam);
    gl.uniform1f(this.fTilesPerPx, tilesPerPx);
    gl.uniform1f(this.fTime, timeSec);
    gl.uniform1i(this.fMe, me);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tileTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.flagTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, palette);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.tileTex);
    gl.deleteVertexArray(this.vao);
    if (this.flagProgram !== null) gl.deleteProgram(this.flagProgram);
    if (this.flagTex !== null) gl.deleteTexture(this.flagTex);
    this.flagProgram = null;
    this.flagTex = null;
  }
}
