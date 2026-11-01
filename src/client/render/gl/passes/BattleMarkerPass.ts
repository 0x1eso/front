/**
 * BattleMarkerPass — World War 1936 P2 (spec §15.2): one instanced draw of
 * the battles, a marker at each defending region's center (where
 * LandTokenLayout.battleMarkers puts the battle card's tap target): crossed
 * swords over a progress bar in the attacker's and the defender's colours,
 * a point when zoomed out (LOD 2). Rewritten only when the view or the LOD
 * changes; nothing is drawn without battles.
 *
 * War overhaul (ww7) adds, on the same quad and program:
 * - the band bar under a battle's progress bar (the battle's or the
 *   region's depth, band): one segment per depth band, the fallen ones in
 *   the taker's colour, the one being fought in gold;
 * - the band chip of a region being taken band by band outside any battle
 *   (0 < prog < depth, no battle in it);
 * - the chosen army's odds badges: a pill with its word (low / medium /
 *   high, WarBadges.oddsLevel) on each zone region of its plan (mine.odds).
 */

import { fogOfLand } from "../../../hud/ww1936/FogModel";
import type { WwLandSelection } from "../../../hud/ww1936/LandSelection";
import { ODDS_INDEX, oddsLevel } from "../../../view/WarBadges";
import type { WwLandView } from "../../../view/WwLandView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/battle-marker/battle-marker.frag.glsl?raw";
import vertSrc from "../shaders/battle-marker/battle-marker.vert.glsl?raw";
import { createProgram, shaderSrc } from "../utils/GlUtils";
import { ATLAS_DEFINES } from "./ArmyTokenPass";

const FLOATS = 12;
/** Instance kinds (aB.z). */
export const MARKER_BATTLE = 0;
export const MARKER_BAND = 1;
export const MARKER_ODDS = 2;

type Odds = readonly (readonly [number, number, number])[];
const NO_ODDS: Odds = [];

export class BattleMarkerPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private count = 0;
  private seenView: WwLandView | null = null;
  private seenVersion = -1;
  private seenLod = -1;
  private seenFog = -1;
  private seenSelection = -1;
  private seenArmy: number | null = null;
  private seenMe = -1;

  constructor(
    private gl: WebGL2RenderingContext,
    private paletteTex: WebGLTexture,
    private atlasTex: WebGLTexture,
  ) {
    this.program = createProgram(
      gl,
      vertSrc,
      shaderSrc(fragSrc, ATLAS_DEFINES),
      "BattleMarkerPass",
    );
    const u = (n: string) => gl.getUniformLocation(this.program, n)!;
    this.uCamera = u("uCamera");
    this.uTilesPerPx = u("uTilesPerPx");
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
    this.buf = new DynamicInstanceBuffer(gl, gl.createBuffer()!, 32, FLOATS);
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

  /**
   * Rewrites the markers when the view, the LOD, the fog, or (the odds
   * badges) the chosen army or the viewer changed.
   */
  update(
    view: WwLandView,
    lod: number,
    selection: WwLandSelection | null = null,
    me = -1,
  ): void {
    const fog = fogOfLand(view);
    const fogStamp = fog?.stamp() ?? -1;
    if (
      view === this.seenView &&
      view.version === this.seenVersion &&
      fogStamp === this.seenFog &&
      lod === this.seenLod &&
      (selection?.version ?? -1) === this.seenSelection &&
      (selection?.army ?? null) === this.seenArmy &&
      me === this.seenMe
    ) {
      return;
    }
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenLod = lod;
    this.seenFog = fogStamp;
    this.seenSelection = selection?.version ?? -1;
    this.seenArmy = selection?.army ?? null;
    this.seenMe = me;
    this.count = 0;

    const odds = this.oddsOf(view, selection, me);
    // Battles, regions in band progress, odds badges: at most this many.
    const cap = view.battles.size + view.regions.size + odds.length;
    if (cap === 0) return;
    this.buf.ensureCapacity(cap);
    const f = this.buf.float32;
    const sc = view.scenario;
    const w = sc.width;
    let o = 0;
    for (const b of view.battles.values()) {
      // P6 (spec §8.9): a battle the player cannot see gets no marker.
      if (fog && !fog.landBattleVisible(b.region, b.attacker, b.defender)) {
        continue;
      }
      const r = view.regions.get(b.region);
      const t = sc.centerTile(b.region);
      f[o] = t % w;
      f[o + 1] = Math.floor(t / w);
      f[o + 2] = b.attacker;
      f[o + 3] = b.defender;
      f[o + 4] = b.progressPm;
      f[o + 5] = lod;
      f[o + 6] = MARKER_BATTLE;
      f[o + 7] = 0;
      // The band being fought is the one after the bands fallen.
      f[o + 8] = b.depth ?? r?.depth ?? 0;
      f[o + 9] = b.band ?? r?.prog ?? 0;
      f[o + 10] = 1;
      f[o + 11] = 0;
      o += FLOATS;
    }
    // A point has no room for a bar: no chips when zoomed far out.
    if (lod <= 1) {
      for (const r of view.regions.values()) {
        const depth = r.depth ?? 0;
        const prog = r.prog ?? 0;
        if (depth < 2 || prog <= 0 || prog >= depth) continue;
        if (view.battles.has(r.id)) continue;
        const taker = r.taker ?? 0;
        if (fog && !fog.landBattleVisible(r.id, taker, r.controller)) continue;
        const t = sc.centerTile(r.id);
        f[o] = t % w;
        f[o + 1] = Math.floor(t / w);
        f[o + 2] = taker;
        f[o + 3] = r.controller;
        f[o + 4] = 0;
        f[o + 5] = lod;
        f[o + 6] = MARKER_BAND;
        f[o + 7] = 0;
        f[o + 8] = depth;
        f[o + 9] = prog;
        f[o + 10] = 0;
        f[o + 11] = 0;
        o += FLOATS;
      }
    }
    for (let i = 0; i < odds.length; i++) {
      const [region, , pct] = odds[i];
      const t = sc.centerTile(region);
      f[o] = t % w;
      f[o + 1] = Math.floor(t / w);
      f[o + 2] = 0;
      f[o + 3] = 0;
      f[o + 4] = pct * 10;
      f[o + 5] = lod;
      f[o + 6] = MARKER_ODDS;
      f[o + 7] = ODDS_INDEX[oddsLevel(pct)];
      f[o + 8] = 0;
      f[o + 9] = 0;
      f[o + 10] = 0;
      f[o + 11] = 0;
      o += FLOATS;
    }
    this.count = o / FLOATS;
    if (o === 0) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, o);
  }

  /** The chosen army's odds ([our region, enemy region, win %]); mine only. */
  private oddsOf(
    view: WwLandView,
    selection: WwLandSelection | null,
    me: number,
  ): Odds {
    if (selection === null || selection.army === null) return NO_ODDS;
    const a = view.armies.get(selection.army);
    if (a === undefined || a.owner !== me || a.mine === null) return NO_ODDS;
    return a.mine.odds ?? NO_ODDS;
  }

  draw(cam: Float32Array, tilesPerPx: number): void {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uTilesPerPx, tilesPerPx);
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
