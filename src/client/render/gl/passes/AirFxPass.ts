/**
 * AirFxPass — small effects around the expanded-warfare air units, all thin
 * and drawn on the map (no full-screen effects, no shake):
 *
 *  - carpet bombing: a small bomb falls from the bomber to the tile, then a
 *    compact blast (the host adds the explosion sprite through `onBombLand`)
 *  - paradrop: a handful of parachutes drift down around the drop tile for
 *    about 1.5 s
 *  - barrage / bomb impact flash: a brief hot core and ring
 *
 * Fixed-size pools, no per-frame allocation, and nothing drawn while idle.
 */

import {
  BOMB_FALL_MS,
  bombFall,
  bombLanded,
  FLASH_MS,
  FxPool,
  PARACHUTE_COUNT,
  PARACHUTE_MS,
  parachuteAt,
  type ParachuteState,
} from "../../frame/derive/PlaneFx";
import fragSrc from "../shaders/air-fx/air-fx.frag.glsl?raw";
import vertSrc from "../shaders/air-fx/air-fx.vert.glsl?raw";
import { getPaletteSize } from "../utils/ColorUtils";
import { createProgram, shaderSrc } from "../utils/GlUtils";

const MODE_BOMB = 0;
const MODE_PARACHUTE = 1;
const MODE_FLASH = 2;

export class AirFxPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private paletteTex: WebGLTexture;
  private uCam: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uHalf: WebGLUniformLocation;
  private uAngle: WebGLUniformLocation;
  private uMode: WebGLUniformLocation;
  private uOwner: WebGLUniformLocation;
  private uProgress: WebGLUniformLocation;
  private uAlpha: WebGLUniformLocation;

  private bombs = new FxPool(32, BOMB_FALL_MS);
  private drops = new FxPool(12, PARACHUTE_MS);
  private flashes = new FxPool(48, FLASH_MS);
  private chute: ParachuteState = { x: 0, y: 0, scale: 1, alpha: 1 };
  private timeFn: () => number = () => performance.now();
  private onBombLand: ((x: number, y: number) => void) | null = null;

  constructor(gl: WebGL2RenderingContext, paletteTex: WebGLTexture) {
    this.gl = gl;
    this.paletteTex = paletteTex;
    this.program = createProgram(
      gl,
      vertSrc,
      shaderSrc(fragSrc, { PALETTE_SIZE: getPaletteSize() }),
      "AirFxPass",
    );
    const u = (n: string) => gl.getUniformLocation(this.program, n)!;
    this.uCam = u("uCamera");
    this.uCenter = u("uCenter");
    this.uHalf = u("uHalf");
    this.uAngle = u("uAngle");
    this.uMode = u("uMode");
    this.uOwner = u("uOwner");
    this.uProgress = u("uProgress");
    this.uAlpha = u("uAlpha");
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "uPalette"), 0);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  setTimeFn(fn: () => number): void {
    this.timeFn = fn;
  }

  /** Called once per bomb as it lands (to add the explosion sprite). */
  setBombLandHandler(fn: ((x: number, y: number) => void) | null): void {
    this.onBombLand = fn;
  }

  /** A bomb starts falling from (fromX, fromY) to tile (x, y). */
  spawnBomb(fromX: number, fromY: number, x: number, y: number): void {
    const s = this.bombs.spawn(this.timeFn());
    s.x = fromX;
    s.y = fromY;
    s.x2 = x;
    s.y2 = y;
    s.angle = Math.atan2(x - fromX, -(y - fromY));
  }

  /** The parachutes of a drop at tile (x, y) for a plane of `owner`. */
  spawnParadrop(x: number, y: number, owner: number): void {
    const s = this.drops.spawn(this.timeFn());
    s.x = x;
    s.y = y;
    s.owner = owner;
  }

  /** A short impact flash on (x, y). */
  spawnFlash(x: number, y: number): void {
    const s = this.flashes.spawn(this.timeFn());
    s.x = x;
    s.y = y;
  }

  isIdle(): boolean {
    return (
      !this.bombs.hasActive() &&
      !this.drops.hasActive() &&
      !this.flashes.hasActive()
    );
  }

  /** Land any bombs that reached the ground: a flash and the blast sprite. */
  private land(now: number): void {
    for (const b of this.bombs.slots) {
      if (!b.active || !bombLanded(b.start, now)) continue;
      b.active = false;
      this.spawnFlash(b.x2, b.y2);
      this.onBombLand?.(b.x2, b.y2);
    }
  }

  draw(cam: Float32Array, zoom: number): void {
    if (this.isIdle()) return;
    const now = this.timeFn();
    this.land(now);
    const live =
      this.bombs.prune(now) + this.drops.prune(now) + this.flashes.prune(now);
    if (live === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCam, false, cam);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
    gl.bindVertexArray(this.vao);
    // Keep small effects readable when zoomed far out.
    const minTiles = 5 / Math.max(zoom, 0.0001);

    gl.uniform1f(this.uMode, MODE_PARACHUTE);
    for (const d of this.drops.slots) {
      if (!d.active) continue;
      const age = now - d.start;
      gl.uniform1f(this.uOwner, d.owner);
      for (let i = 0; i < PARACHUTE_COUNT; i++) {
        if (!parachuteAt(d.x * 31 + d.y, i, d.x, d.y, age, this.chute)) break;
        this.quad(
          this.chute.x,
          this.chute.y,
          Math.max(2.2, minTiles * 0.5) * this.chute.scale,
          0,
          0,
          this.chute.alpha,
        );
      }
    }

    gl.uniform1f(this.uMode, MODE_BOMB);
    for (const b of this.bombs.slots) {
      if (!b.active) continue;
      const t = bombFall(now - b.start);
      this.quad(
        b.x + (b.x2 - b.x) * t,
        b.y + (b.y2 - b.y) * t,
        Math.max(1.6, minTiles * 0.3) * (1.3 - 0.4 * t),
        b.angle,
        0,
        1,
      );
    }

    gl.uniform1f(this.uMode, MODE_FLASH);
    for (const f of this.flashes.slots) {
      if (!f.active) continue;
      const p = (now - f.start) / FLASH_MS;
      this.quad(f.x, f.y, Math.max(5, minTiles), 0, p, 1);
    }
    gl.bindVertexArray(null);
  }

  private quad(
    x: number,
    y: number,
    half: number,
    angle: number,
    progress: number,
    alpha: number,
  ): void {
    const gl = this.gl;
    gl.uniform2f(this.uCenter, x, y);
    gl.uniform1f(this.uHalf, half);
    gl.uniform1f(this.uAngle, angle);
    gl.uniform1f(this.uProgress, progress);
    gl.uniform1f(this.uAlpha, alpha);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  clear(): void {
    this.bombs.clear();
    this.drops.clear();
    this.flashes.clear();
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.quadBuf);
  }
}
