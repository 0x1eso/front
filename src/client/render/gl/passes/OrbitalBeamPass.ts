/**
 * OrbitalBeamPass — strategic weapons (spec §6.5): a thin beam falling from
 * the sky onto each orbital strike impact, fading out in BEAM_MS. One quad
 * per beam; the blast itself comes from FxPass.spawnOrbitalImpacts.
 */

import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/orbital-beam/orbital-beam.frag.glsl?raw";
import vertSrc from "../shaders/orbital-beam/orbital-beam.vert.glsl?raw";

const BEAM_MS = 1200;
const BEAM_LENGTH_TILES = 60;
const BEAM_WIDTH_TILES = 1.5;

export class OrbitalBeamPass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private uCamera: WebGLUniformLocation;
  private uBase: WebGLUniformLocation;
  private uLength: WebGLUniformLocation;
  private uWidth: WebGLUniformLocation;
  private uAge: WebGLUniformLocation;
  private beams: { x: number; y: number; start: number }[] = [];
  private timeFn: () => number = () => performance.now();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "OrbitalBeamPass");
    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uBase = gl.getUniformLocation(this.program, "uBase")!;
    this.uLength = gl.getUniformLocation(this.program, "uLength")!;
    this.uWidth = gl.getUniformLocation(this.program, "uWidth")!;
    this.uAge = gl.getUniformLocation(this.program, "uAge")!;
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

  spawn(points: readonly { x: number; y: number }[]): void {
    const start = this.timeFn();
    for (const p of points) this.beams.push({ x: p.x, y: p.y, start });
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.beams.length === 0) return;
    const now = this.timeFn();
    this.beams = this.beams.filter((b) => now - b.start < BEAM_MS);
    if (this.beams.length === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.uniform1f(this.uLength, BEAM_LENGTH_TILES);
    gl.uniform1f(this.uWidth, BEAM_WIDTH_TILES);
    gl.bindVertexArray(this.vao);
    for (const b of this.beams) {
      gl.uniform2f(this.uBase, b.x, b.y);
      gl.uniform1f(this.uAge, (now - b.start) / BEAM_MS);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.quadBuf);
  }
}
