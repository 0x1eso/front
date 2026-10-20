/**
 * BattleMarkerPass — World War 1936 P2 (spec §15.2): one instanced draw of
 * the battles, a marker at each defending region's center (where
 * LandTokenLayout.battleMarkers puts the battle card's tap target): crossed
 * swords over a progress bar in the attacker's and the defender's colours,
 * a point when zoomed out (LOD 2). Rewritten only when the view or the LOD
 * changes; nothing is drawn without battles.
 */

import type { WwLandView } from "../../../view/WwLandView";
import { DynamicInstanceBuffer } from "../DynamicBuffer";
import fragSrc from "../shaders/battle-marker/battle-marker.frag.glsl?raw";
import vertSrc from "../shaders/battle-marker/battle-marker.vert.glsl?raw";
import { createProgram, shaderSrc } from "../utils/GlUtils";
import { ATLAS_DEFINES } from "./ArmyTokenPass";

const FLOATS = 8;

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

  get instanceCount(): number {
    return this.count;
  }

  /** Rewrites the markers when the view or the LOD changed. */
  update(view: WwLandView, lod: number): void {
    if (
      view === this.seenView &&
      view.version === this.seenVersion &&
      lod === this.seenLod
    ) {
      return;
    }
    this.seenView = view;
    this.seenVersion = view.version;
    this.seenLod = lod;
    const n = view.battles.size;
    this.count = n;
    if (n === 0) return;
    this.buf.ensureCapacity(n);
    const f = this.buf.float32;
    const sc = view.scenario;
    const w = sc.width;
    let o = 0;
    for (const b of view.battles.values()) {
      const t = sc.centerTile(b.region);
      f[o] = t % w;
      f[o + 1] = Math.floor(t / w);
      f[o + 2] = b.attacker;
      f[o + 3] = b.defender;
      f[o + 4] = b.progressPm;
      f[o + 5] = lod;
      f[o + 6] = 0;
      f[o + 7] = 0;
      o += FLOATS;
    }
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, f, 0, o);
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
