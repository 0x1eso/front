/**
 * ArmyTokenPass — World War 1936 P2 (spec §15.2): one instanced draw of the
 * army tokens (at most WW_MAX_ARMIES a country, ~400 on the map): the
 * country's colour, the branch symbol of the template most of its divisions
 * use, the division count, strength and organisation bars, a state badge
 * (moving, battle, rail, sea, paradrop) and a red ring when encircled. The
 * chosen army's outline breathes. Zoomed out a token is a number chip, then
 * a dot (LandTokenLayout's LOD).
 *
 * Under each of the viewer's armies' front regions sit small dots, one per
 * division the army keeps there (at most five), counted from the viewer's
 * division records (view.details).
 *
 * Instances are rewritten only when the layout, the view, the choice or the
 * zoom level changed; nothing is allocated per frame and nothing is drawn
 * without armies.
 */

import {
  type FogArmyView,
  type FogGhost,
  fogOfLand,
} from "../../../hud/ww1936/FogModel";
import type { WwLandSelection } from "../../../hud/ww1936/LandSelection";
import type { TokenLayoutCache } from "../../../view/LandTokenLayout";
import type { WwLandView } from "../../../view/WwLandView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  CELL_QUESTION,
  CELL_TILDE,
  ICON_BATTLE,
  ICON_MOVE,
  ICON_PARA,
  ICON_RAIL,
  ICON_SEA,
  MAX_NUMBER,
  NUMBER_CELL0,
} from "../LandAtlas";
import fragSrc from "../shaders/army-token/army-token.frag.glsl?raw";
import vertSrc from "../shaders/army-token/army-token.vert.glsl?raw";
import { createProgram, shaderSrc } from "../utils/GlUtils";

/** Floats per instance: three vec4 (see army-token.vert.glsl). */
const FLOATS = 12;
export const KIND_TOKEN = 0;
export const KIND_CHIP = 1;
export const KIND_DOT = 2;
export const KIND_FRONT_DOTS = 3;
/** At most this many front dots in a region (spec §15.2). */
const FRONT_DOTS_MAX = 5;

/** The atlas layout the token and battle shaders share. */
export const ATLAS_DEFINES: Record<string, number> = {
  ATLAS_COLS,
  ATLAS_ROWS,
  NUMBER_CELL0,
  MAX_NUMBER,
  ICON_MOVE,
  ICON_BATTLE,
  ICON_RAIL,
  ICON_SEA,
  ICON_PARA,
  CELL_QUESTION,
  CELL_TILDE,
};

/** Fog flags in an instance's last float (army-token.frag.glsl). */
const FOG_APPROX = 1;
const FOG_GHOST = 2;
const FOG_GRAY = 4;
/** A bar in five steps (spec §8.9, "close" band). */
const stepPm = (pm: number): number =>
  Math.min(1000, Math.ceil(pm / 200) * 200);

const NO_GHOSTS: readonly FogGhost[] = [];

export class ArmyTokenPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private count = 0;

  // What the instances were written from.
  private seenVersion = -1;
  private seenSelection = -1;
  private seenArmy: number | null = null;
  private seenMe = -1;
  private seenFog = -1;
  private seenView: WwLandView | null = null;

  /** Front-dot rows (FLOATS each), rebuilt when the view changes. */
  private readonly perFront = new Map<number, number>();
  private readonly frontData: number[] = [];
  private frontRows = 0;
  private frontVersion = -1;
  private frontMe = -1;

  constructor(
    private gl: WebGL2RenderingContext,
    private paletteTex: WebGLTexture,
    private atlasTex: WebGLTexture,
  ) {
    this.program = createProgram(
      gl,
      vertSrc,
      shaderSrc(fragSrc, ATLAS_DEFINES),
      "ArmyTokenPass",
    );
    const u = (n: string) => gl.getUniformLocation(this.program, n)!;
    this.uCamera = u("uCamera");
    this.uTilesPerPx = u("uTilesPerPx");
    this.uTime = u("uTime");
    gl.useProgram(this.program);
    gl.uniform1i(u("uPalette"), 0);
    gl.uniform1i(u("uAtlas"), 1);

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

  /** Instances written by the last update (tokens and front-dot rows). */
  get instanceCount(): number {
    return this.count;
  }

  /**
   * Rewrites the instances when `layoutChanged` or the view, the choice or
   * the viewer changed. `layout` must be updated for this frame.
   */
  update(
    view: WwLandView,
    layout: TokenLayoutCache,
    layoutChanged: boolean,
    selection: WwLandSelection,
    me: number,
  ): void {
    // P6 (spec §8.9, §20.7): an enemy token the fog hides gets no instance.
    const fog = fogOfLand(view);
    const fogStamp = fog?.stamp() ?? -1;
    if (
      fogStamp === this.seenFog &&
      !layoutChanged &&
      view === this.seenView &&
      view.version === this.seenVersion &&
      selection.version === this.seenSelection &&
      selection.army === this.seenArmy &&
      me === this.seenMe
    ) {
      return;
    }
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenSelection = selection.version;
    this.seenArmy = selection.army;
    this.seenMe = me;
    this.seenFog = fogStamp;

    const n = layout.count;
    const ghosts: readonly FogGhost[] = fog?.ghosts() ?? NO_GHOSTS;
    const lod = n > 0 ? layout.placements[0].lod : 0;
    const fronts = lod <= 1 ? this.frontDots(view, me) : 0;
    this.buf.ensureCapacity(n + fronts + ghosts.length);
    const f = this.buf.float32;
    let o = 0;
    for (let i = 0; i < fronts * FLOATS; i++) f[o++] = this.frontData[i];
    const kind = lod === 0 ? KIND_TOKEN : lod === 1 ? KIND_CHIP : KIND_DOT;
    let chosen = -1;
    for (const g of ghosts) o = this.writeGhost(f, o, g, kind);
    for (let i = 0; i < n; i++) {
      const fv = fog?.armyView(layout.armies[i].id) ?? null;
      if (fv !== null && !fv.visible) continue;
      if (layout.armies[i].id === selection.army) {
        chosen = i; // drawn last, on top
        continue;
      }
      o = this.writeToken(f, o, layout, i, kind, false, fv);
    }
    if (chosen >= 0) {
      o = this.writeToken(
        f,
        o,
        layout,
        chosen,
        kind,
        true,
        fog?.armyView(layout.armies[chosen].id) ?? null,
      );
    }
    this.count = o / FLOATS;
    if (this.count > 0) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, o);
    }
  }

  private writeToken(
    f: Float32Array,
    o: number,
    layout: TokenLayoutCache,
    i: number,
    kind: number,
    chosen: boolean,
    fog: FogArmyView | null,
  ): number {
    const a = layout.armies[i];
    const p = layout.placements[i];
    f[o] = p.x;
    f[o + 1] = p.y;
    f[o + 2] = kind;
    f[o + 3] = a.owner;
    f[o + 4] = a.symbol;
    const fv = fog !== null && fog.visible ? fog : null;
    f[o + 5] = fv === null ? a.divisions : fv.shown;
    f[o + 6] =
      fv === null || fv.bars === "exact" ? a.strengthPm : stepPm(a.strengthPm);
    f[o + 7] = fv === null || fv.bars === "exact" ? a.orgPm : stepPm(a.orgPm);
    f[o + 8] = a.state;
    f[o + 9] = chosen ? 1 : 0;
    f[o + 10] = 0;
    f[o + 11] =
      fv === null
        ? 0
        : (fv.approx ? FOG_APPROX : 0) | (fv.bars === "gray" ? FOG_GRAY : 0);
    if (fv !== null && fv.bars === "gray") {
      // Unknown strength: nothing real reaches the instance.
      f[o + 6] = 0;
      f[o + 7] = 0;
    }
    return o + FLOATS;
  }

  /** A remembered enemy army: its last place, faded (spec §8.9, alpha 0.4). */
  private writeGhost(
    f: Float32Array,
    o: number,
    g: FogGhost,
    kind: number,
  ): number {
    f[o] = g.x;
    f[o + 1] = g.y;
    f[o + 2] = kind;
    f[o + 3] = g.owner;
    f[o + 4] = g.symbol;
    f[o + 5] = g.shown;
    f[o + 6] = 0;
    f[o + 7] = 0;
    f[o + 8] = 0;
    f[o + 9] = 0;
    f[o + 10] = 0;
    f[o + 11] = FOG_GHOST | FOG_GRAY | (g.approx ? FOG_APPROX : 0);
    return o + FLOATS;
  }

  /**
   * The viewer's armies' front-dot rows (spec §15.2: a dot per division the
   * army keeps in each of its front regions, at most five), counted from its
   * division records; kept until the view or the viewer changes. Returns how
   * many rows frontData holds.
   */
  private frontDots(view: WwLandView, me: number): number {
    if (view.version === this.frontVersion && me === this.frontMe) {
      return this.frontRows;
    }
    this.frontVersion = view.version;
    this.frontMe = me;
    const perFront = this.perFront;
    perFront.clear();
    const data = this.frontData;
    data.length = 0;
    this.frontRows = 0;
    const detail = view.details.get(me);
    if (detail === undefined) return 0;
    for (const d of detail.divisions) {
      const key = d.army * 65536 + d.region;
      perFront.set(key, (perFront.get(key) ?? 0) + 1);
    }
    const w = view.scenario.width;
    for (const a of view.armies.values()) {
      if (a.owner !== me || a.mine === null) continue;
      for (const region of a.mine.front) {
        const n = perFront.get(a.id * 65536 + region) ?? 0;
        if (n === 0) continue;
        const t = view.scenario.centerTile(region);
        data.push(t % w, Math.floor(t / w), KIND_FRONT_DOTS, a.owner);
        data.push(-1, 0, 0, 0);
        data.push(0, 0, Math.min(FRONT_DOTS_MAX, n), 0);
        this.frontRows++;
      }
    }
    return this.frontRows;
  }

  draw(cam: Float32Array, tilesPerPx: number, timeSec: number): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
    gl.uniform1f(this.uTime, timeSec);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
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
