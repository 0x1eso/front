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
 * ww162 (army design §3.1): it draws the layout's counters, which group by
 * zoom: below zoom 1.5 a merged chip per country per region, from zoom 6
 * one counter per division of mine (a token at 75 %, its pin notch and
 * battle badge) with "+N" past four in a region. Same program, atlas and
 * instance layout; mine carry their army's zone-hue rim.
 *
 * Instances are rewritten only when the layout, the view, the choice or the
 * zoom level changed; nothing is allocated per frame and nothing is drawn
 * without armies.
 */

import {
  ARMY_AUTO,
  ARMY_EXECUTING,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  type FogArmyView,
  type FogGhost,
  fogOfLand,
} from "../../../hud/ww1936/FogModel";
import type { WwLandSelection } from "../../../hud/ww1936/LandSelection";
import {
  armyGroupColorsOf,
  multiSelectOf,
} from "../../../hud/ww1936/MultiSelect";
import {
  BARS_GRAY,
  C_ARMY,
  C_DIVISION,
  C_REGION,
  type Counter,
  LEVEL_ARMY,
  LEVEL_DIVISION,
  LEVEL_REGION,
  stepPm,
  type TokenLayoutCache,
} from "../../../view/LandTokenLayout";
import { autoLevelOf } from "../../../view/WarBadges";
import type { WwLandView } from "../../../view/WwLandView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  CELL_AUTO,
  CELL_QUESTION,
  CELL_TILDE,
  ICON_BATTLE,
  ICON_MOVE,
  ICON_PARA,
  ICON_RAIL,
  ICON_SEA,
  MAX_NUMBER,
  NUMBER_CELL0,
  ODDS_CELL0,
} from "../LandAtlas";
import fragSrc from "../shaders/army-token/army-token.frag.glsl?raw";
import vertSrc from "../shaders/army-token/army-token.vert.glsl?raw";
import { createProgram, shaderSrc } from "../utils/GlUtils";
import { wrapMidX } from "./WrapMid";

/** Floats per instance: three vec4 (see army-token.vert.glsl). */
const FLOATS = 12;
export const KIND_TOKEN = 0;
export const KIND_CHIP = 1;
export const KIND_DOT = 2;
export const KIND_FRONT_DOTS = 3;
/** ww162 §3.1: a "+N" chip (more of my divisions in a region). */
export const KIND_MORE = 4;
/** ww162 §3.1: one of my divisions, a token at 75 % (DIVISION_SCALE). */
export const KIND_DIVISION = 5;
/** At most this many front dots in a region (spec §15.2). */
const FRONT_DOTS_MAX = 5;
/** Front-row state codes the shader reads (army-token.frag.glsl): pills 8..11 and 16, an order badge 24. */
const CODE_ATK = 8;
const CODE_WALK = 16;
const CODE_ORDER = 24;
/** Vertical step between the stacked pills of one region, screen px. */
const PILL_STEP_PX = 17;

/** The atlas layout the token and battle shaders share. */
export const ATLAS_DEFINES: Record<string, number> = {
  ATLAS_COLS,
  ATLAS_ROWS,
  NUMBER_CELL0,
  MAX_NUMBER,
  ODDS_CELL0,
  ICON_MOVE,
  ICON_BATTLE,
  ICON_RAIL,
  ICON_SEA,
  ICON_PARA,
  CELL_QUESTION,
  CELL_TILDE,
  CELL_AUTO,
};

/** Fog flags in an instance's last float (army-token.frag.glsl). */
const FOG_APPROX = 1;
const FOG_GHOST = 2;
const FOG_GRAY = 4;
/** The army group colour sits above the fog bits in the same float (army-token.frag.glsl). */
const GROUP_UNIT = 8;
/** Flag bits in an instance's tenth float (army-token.frag.glsl): chosen, then the zone hue + 1 (0: no rim), then a pin. */
const FLAG_CHOSEN = 1;
const HUE_UNIT = 2;
const FLAG_PIN = 16;

/** The flags float: chosen, my counter's zone-hue rim (hue -1: none), a pinned division. */
export function counterFlags(
  chosen: boolean,
  hue: number,
  pinned: boolean,
): number {
  return (
    (chosen ? FLAG_CHOSEN : 0) +
    HUE_UNIT * (hue < 0 ? 0 : (hue % 4) + 1) +
    (pinned ? FLAG_PIN : 0)
  );
}

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
  private seenMulti = -1;
  private seenGroups = -1;
  private seenFog = -1;
  private seenView: WwLandView | null = null;

  /** Front-dot rows (FLOATS each), rebuilt when the view changes. */
  private readonly perFront = new Map<number, number>();
  private readonly frontData: number[] = [];
  private frontRows = 0;
  private frontVersion = -1;
  private frontMe = -1;
  private frontChosen: number | null = null;
  private readonly directData: number[] = [];

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
    const multi = multiSelectOf(selection);
    const groups = armyGroupColorsOf(view);
    // P6 (spec §8.9, §20.7): an enemy token the fog hides gets no instance.
    const fog = fogOfLand(view);
    const fogStamp = fog?.stamp() ?? -1;
    if (
      fogStamp === this.seenFog &&
      !layoutChanged &&
      multi.version === this.seenMulti &&
      groups.version === this.seenGroups &&
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
    this.seenMulti = multi.version;
    this.seenGroups = groups.version;
    this.seenFog = fogStamp;

    const n = layout.counterCount;
    const level = layout.level;
    const ghosts: readonly FogGhost[] = fog?.ghosts() ?? NO_GHOSTS;
    const lod = layout.count > 0 ? layout.placements[0].lod : 0;
    // ww162: the front dots and the direct attack's region pills stand for
    // divisions, which the division level draws one by one.
    const armyLevel = level === LEVEL_ARMY && lod <= 1;
    const fronts = armyLevel ? this.frontDots(view, me, selection.army) : 0;
    const directRows =
      armyLevel || level === LEVEL_DIVISION
        ? this.directDots(view, me, selection.army, !armyLevel)
        : 0;
    this.buf.ensureCapacity(n + fronts + directRows + ghosts.length);
    const f = this.buf.float32;
    let o = 0;
    for (let i = 0; i < fronts * FLOATS; i++) f[o++] = this.frontData[i];
    for (let i = 0; i < directRows * FLOATS; i++) f[o++] = this.directData[i];
    const kind =
      level === LEVEL_REGION
        ? KIND_CHIP
        : lod === 0
          ? KIND_TOKEN
          : lod === 1
            ? KIND_CHIP
            : KIND_DOT;
    for (const g of ghosts) o = this.writeGhost(f, o, g, kind);
    const sel = selection.army;
    // The chosen army's counters (and those multi-select holds) last, on top.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const c = layout.counters[i];
        let chosen = false;
        for (const id of c.members) {
          if (id === sel || multi.has(id)) chosen = true;
        }
        if (chosen !== (pass === 1)) continue;
        if (c.type === C_ARMY) {
          const id = layout.armies[c.index].id;
          const fv = fog?.armyView(id) ?? null;
          if (fv !== null && !fv.visible) continue;
          o = this.writeToken(
            f,
            o,
            layout,
            c.index,
            kind,
            chosen,
            groups.colorOf(id),
            fv,
            me,
            c,
          );
        } else {
          o = this.writeCounter(f, o, c, chosen, groups.colorOf(c.army));
        }
      }
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
    group: number,
    fog: FogArmyView | null,
    me: number,
    c: Counter,
  ): number {
    const a = layout.armies[i];
    f[o] = c.x;
    f[o + 1] = c.y;
    f[o + 2] = kind;
    f[o + 3] = a.owner;
    f[o + 4] = a.symbol;
    const fv = fog !== null && fog.visible ? fog : null;
    f[o + 5] = fv === null ? a.divisions : fv.shown;
    f[o + 6] =
      fv === null || fv.bars === "exact" ? a.strengthPm : stepPm(a.strengthPm);
    f[o + 7] = fv === null || fv.bars === "exact" ? a.orgPm : stepPm(a.orgPm);
    // Automation: the "A" mark shows on the viewer's own auto armies only.
    f[o + 8] =
      a.owner === me ? a.state : a.state & ~(ARMY_AUTO | ARMY_EXECUTING);
    f[o + 9] = counterFlags(chosen, c.hue, false);
    // ww7: the auto level (1 defence, 2 full) of the viewer's own armies,
    // shown beside the "A".
    f[o + 10] =
      a.owner === me && a.mine !== null && (a.state & ARMY_AUTO) !== 0
        ? Math.max(1, autoLevelOf(a.mine))
        : 0;
    // Fog bits (FOG_*) and, above them, the army group's palette colour
    // (1..8, 0 none: a thin band under the token; U1 and U3 share the float).
    f[o + 11] =
      (fv === null
        ? 0
        : (fv.approx ? FOG_APPROX : 0) | (fv.bars === "gray" ? FOG_GRAY : 0)) +
      GROUP_UNIT * group;
    if (fv !== null && fv.bars === "gray") {
      // Unknown strength: nothing real reaches the instance.
      f[o + 6] = 0;
      f[o + 7] = 0;
    }
    return o + FLOATS;
  }

  /**
   * ww162 §3.1: a region chip (KIND_CHIP, its armies summed as the layout
   * worked them out through the fog), one of my divisions (KIND_DIVISION)
   * or a "+N" chip (KIND_MORE).
   */
  private writeCounter(
    f: Float32Array,
    o: number,
    c: Counter,
    chosen: boolean,
    group: number,
  ): number {
    f[o] = c.x;
    f[o + 1] = c.y;
    f[o + 2] =
      c.type === C_REGION
        ? KIND_CHIP
        : c.type === C_DIVISION
          ? KIND_DIVISION
          : KIND_MORE;
    f[o + 3] = c.owner;
    f[o + 4] = c.symbol;
    f[o + 5] = c.shown;
    f[o + 6] = c.strengthPm;
    f[o + 7] = c.orgPm;
    f[o + 8] = c.state;
    f[o + 9] = counterFlags(chosen, c.hue, c.pinned);
    f[o + 10] = 0;
    f[o + 11] =
      (c.approx ? FOG_APPROX : 0) |
      (c.bars === BARS_GRAY ? FOG_GRAY : 0) |
      (c.type === C_DIVISION ? GROUP_UNIT * group : 0);
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
  private frontDots(
    view: WwLandView,
    me: number,
    chosen: number | null,
  ): number {
    if (
      view.version === this.frontVersion &&
      me === this.frontMe &&
      chosen === this.frontChosen
    ) {
      return this.frontRows;
    }
    this.frontVersion = view.version;
    this.frontMe = me;
    this.frontChosen = chosen;
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
      // ww42: the chosen direct attack's divisions are drawn by state instead.
      if (a.id === chosen && a.mine.direct !== undefined) continue;
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

  /**
   * ww42/ww44: the chosen own army's direct attack, from the engine's counts
   * (mine.direct): in each region a pill per kind of what its divisions do
   * (holding the border, waiting, recovering, walking) with their number; the
   * attacking count sits halfway along its arrow, and each
   * target carries its order (1, 2, 3). Own armies only (mine is the
   * fog-safe field).
   */
  private directDots(
    view: WwLandView,
    me: number,
    chosen: number | null,
    noRegionPills = false,
  ): number {
    const data = this.directData;
    data.length = 0;
    if (chosen === null) return 0;
    const a = view.armies.get(chosen);
    const dv = a?.mine?.direct;
    if (a === undefined || a.owner !== me || dv === undefined) return 0;
    const w = view.scenario.width;
    const row = (
      x: number,
      y: number,
      code: number,
      n: number,
      yoff: number,
    ) => {
      data.push(x, y, KIND_FRONT_DOTS, a.owner);
      data.push(-1, Math.min(MAX_NUMBER, n), 0, yoff);
      data.push(code, 0, 0, 0);
    };
    const xy = (region: number): [number, number] => {
      const t = view.scenario.centerTile(region);
      return [t % w, Math.floor(t / w)];
    };
    // Per region the pills stand one above the other.
    const per = new Map<number, [number, number][]>();
    const put = (region: number, code: number, n: number) => {
      const list = per.get(region);
      if (list === undefined) per.set(region, [[code, n]]);
      else list.push([code, n]);
    };
    for (const [from, to, n] of dv.atk) {
      const [fx, fy] = xy(from);
      const [tx, ty] = xy(to);
      row(wrapMidX(fx, tx, w), (fy + ty) / 2, CODE_ATK, n, 0);
    }
    for (const [region, kind, n] of dv.at) {
      if (noRegionPills) break;
      put(region, kind === 3 ? CODE_WALK : CODE_ATK + 1 + kind, n);
    }
    for (const [region, list] of per) {
      const [x, y] = xy(region);
      list.forEach(([code, n], j) => {
        row(x, y, code, n, (j - (list.length - 1) / 2) * PILL_STEP_PX);
      });
    }
    if (a.mine!.order.direct === true) {
      a.mine!.order.targets.forEach((t, i) => {
        const [x, y] = xy(t);
        row(x, y, CODE_ORDER, i + 1, 0);
      });
    }
    return data.length / FLOATS;
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
