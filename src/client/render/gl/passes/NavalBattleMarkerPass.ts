/**
 * NavalBattleMarkerPass — World War 1936 P4 (spec §18.2): one instanced
 * draw of the naval battles (at most ~10 at once), a marker at each battle
 * zone's center: crossed anchors (ship atlas) over a progress bar in both
 * sides' colours, the attacker's share of the strength left, and gun smoke
 * flickering around it (fx-atlas MiniBigSmoke frames); a point when zoomed
 * out (FleetTokenLayout's chip LOD).
 *
 * Instances are rewritten only when the view or the LOD changed. A battle's
 * update that sank ships calls the sink handler (the renderer spawns the
 * sinking-ship effect there). Nothing is drawn, and the fx atlas is not
 * loaded, until a battle exists.
 */

import type { NavalBattleSummary } from "@openfront/engine-api/ww1936/NavyTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import fxAtlasMeta from "resources/atlases/fx-atlas-meta.json";
import { fogOfNavy } from "../../../hud/ww1936/FogModel";
import type { WwNavyView } from "../../../view/WwNavyView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/naval-battle/naval-battle.frag.glsl?raw";
import vertSrc from "../shaders/naval-battle/naval-battle.vert.glsl?raw";
import { createProgram, shaderSrc } from "../utils/GlUtils";
import { SHIP_ATLAS_COLS, SHIP_ATLAS_ROWS, SHIP_CELL } from "./FleetTokenPass";

const fxAtlasUrl = assetUrl("atlases/fx-atlas.png");
const FLOATS = 8;
/** fx-atlas row 8: MiniBigSmoke, 5 frames of 24 px, 120 ms each (FxSpritePass). */
const SMOKE_ROW = fxAtlasMeta.rows[8];

/**
 * The attacker's share of what both sides have left (ships × the mean of
 * HP and organisation), 0..1; a half when neither has anything.
 */
export function battleShare(b: NavalBattleSummary): number {
  const a = b.ships[0] * (b.hpPm[0] + b.orgPm[0]);
  const d = b.ships[1] * (b.hpPm[1] + b.orgPm[1]);
  return a + d > 0 ? a / (a + d) : 0.5;
}

export class NavalBattleMarkerPass {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private buf: DynamicInstanceBuffer;
  private fxTex: WebGLTexture;
  private uCamera: WebGLUniformLocation;
  private uTilesPerPx: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private count = 0;
  private seenView: WwNavyView | null = null;
  private seenVersion = -1;
  private seenLod = -1;
  private seenFog = -1;
  private fxRequested = false;
  private disposed = false;
  /** Each zone's battle update as last seen: a new one with sinkings calls onSunk. */
  private readonly seen = new Map<number, NavalBattleSummary>();
  private onSunk: ((x: number, y: number, ships: number) => void) | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private paletteTex: WebGLTexture,
    private atlasTex: WebGLTexture,
  ) {
    const defs = {
      ATLAS_COLS: SHIP_ATLAS_COLS,
      ATLAS_ROWS: SHIP_ATLAS_ROWS,
      CELL_BATTLE: SHIP_CELL.battle,
      FX_W: fxAtlasMeta.width,
      FX_H: fxAtlasMeta.height,
      SMOKE_Y: SMOKE_ROW.yOffset,
      SMOKE_H: SMOKE_ROW.height,
      SMOKE_FW: SMOKE_ROW.worldWidth,
      SMOKE_FRAMES: 5,
      SMOKE_MS: 120,
    };
    this.program = createProgram(
      gl,
      vertSrc,
      shaderSrc(fragSrc, defs),
      "NavalBattleMarkerPass",
    );
    const u = (n: string) => gl.getUniformLocation(this.program, n)!;
    this.uCamera = u("uCamera");
    this.uTilesPerPx = u("uTilesPerPx");
    this.uTime = u("uTime");
    gl.useProgram(this.program);
    gl.uniform1i(u("uPalette"), 0);
    gl.uniform1i(u("uAtlas"), 1);
    gl.uniform1i(u("uFx"), 2);

    this.fxTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(4),
    );

    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    this.buf = new DynamicInstanceBuffer(gl, gl.createBuffer()!, 16, FLOATS);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    for (const loc of [1, 2]) {
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

  /** Called with a battle's zone center and how many ships its new update sank. */
  setSinkHandler(fn: ((x: number, y: number, ships: number) => void) | null) {
    this.onSunk = fn;
  }

  get instanceCount(): number {
    return this.count;
  }

  /** Rewrites the markers when the view or the LOD (0 marker, 1 point) changed. */
  update(view: WwNavyView, lod: number): void {
    // P6 (spec §8.9): a battle the fog hides gets no marker.
    const fog = fogOfNavy(view);
    const fogStamp = fog?.stamp() ?? -1;
    if (
      fogStamp === this.seenFog &&
      view === this.seenView &&
      view.version === this.seenVersion &&
      lod === this.seenLod
    ) {
      return;
    }
    const sameView = view === this.seenView;
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenLod = lod;
    this.seenFog = fogStamp;
    const n = view.battles.size;
    this.count = n;
    const sc = view.scenario;
    const w = sc.width;
    for (const zone of this.seen.keys()) {
      if (!view.battles.has(zone)) this.seen.delete(zone);
    }
    if (n === 0) return;
    if (!this.fxRequested) {
      this.fxRequested = true;
      void this.loadFx();
    }
    this.buf.ensureCapacity(n);
    const f = this.buf.float32;
    let o = 0;
    let shownCount = 0;
    for (const b of view.battles.values()) {
      if (fog && !fog.navalBattleVisible(b.attacker, b.defender, b.zone)) {
        continue;
      }
      shownCount++;
      const t = sc.zoneCenter(b.zone);
      const x = t % w;
      const y = Math.floor(t / w);
      if (this.seen.get(b.zone) !== b) {
        if (sameView && b.sunk.length > 0) this.onSunk?.(x, y, b.sunk.length);
        this.seen.set(b.zone, b);
      }
      f[o] = x;
      f[o + 1] = y;
      f[o + 2] = b.attacker;
      f[o + 3] = b.defender;
      f[o + 4] = battleShare(b);
      f[o + 5] = lod;
      f[o + 6] = (b.zone * 0.618034) % 1;
      f[o + 7] = 0;
      o += FLOATS;
    }
    this.count = shownCount;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, o);
  }

  private async loadFx(): Promise<void> {
    if (typeof Image === "undefined") return;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = fxAtlasUrl;
      await img.decode();
      if (this.disposed) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    } catch (e) {
      console.warn("[NavalBattleMarkerPass] fx atlas failed to load", e);
    }
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
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.fxTex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    this.disposed = true;
    const gl = this.gl;
    gl.deleteProgram(this.program);
    this.buf.dispose();
    gl.deleteBuffer(this.quadBuf);
    gl.deleteVertexArray(this.vao);
    gl.deleteTexture(this.fxTex);
  }
}
