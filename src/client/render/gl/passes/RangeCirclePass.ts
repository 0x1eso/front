/**
 * RangeCirclePass — draws a translucent circle showing the effective
 * range of a structure during build-mode ghost preview. White by default,
 * red when the ghost flags a warning (e.g. nuking would break an alliance).
 *
 * Single quad with circle SDF in the fragment shader.
 * Active only when a ghost preview with rangeRadius > 0 is set.
 */

import type { GhostPreviewData } from "../../types";
import { createProgram } from "../utils/GlUtils";

import fragSrc from "../shaders/range-circle/range-circle.frag.glsl?raw";
import vertSrc from "../shaders/range-circle/range-circle.vert.glsl?raw";

export class RangeCirclePass {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;

  private uCamera: WebGLUniformLocation;
  private uCenter: WebGLUniformLocation;
  private uRadius: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uAspect: WebGLUniformLocation;

  private centerX = 0;
  private centerY = 0;
  private radius = 0;
  private warning = false;
  /** ww8: height / width of the shape (1: a circle), and the map's width for the date line (0: no wrap). */
  private aspect = 1;
  private wrapW = 0;
  /** ww8: a wing's range ellipse, set apart from the build ghost's circle. */
  private ellipseOn = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, vertSrc, fragSrc, "RangeCirclePass");

    this.uCamera = gl.getUniformLocation(this.program, "uCamera")!;
    this.uCenter = gl.getUniformLocation(this.program, "uCenter")!;
    this.uRadius = gl.getUniformLocation(this.program, "uRadius")!;
    this.uColor = gl.getUniformLocation(this.program, "uColor")!;
    this.uAspect = gl.getUniformLocation(this.program, "uAspect")!;

    // Unit quad [0,1]
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /**
   * ww8: a wing's range as an ellipse around its base: `rx` tiles east-west,
   * `ry` tiles north-south (the map's tiles are not square in km), drawn
   * again across the date line of a map `mapW` wide. null clears it (the
   * build ghost's circle then comes back).
   */
  setEllipse(
    shape: {
      x: number;
      y: number;
      rx: number;
      ry: number;
      mapW: number;
      warning?: boolean;
    } | null,
  ): void {
    if (shape === null || !(shape.rx > 0) || !(shape.ry > 0)) {
      if (this.ellipseOn) {
        this.ellipseOn = false;
        this.radius = 0;
        this.aspect = 1;
        this.wrapW = 0;
      }
      return;
    }
    this.ellipseOn = true;
    this.centerX = shape.x;
    this.centerY = shape.y;
    this.radius = shape.rx;
    this.aspect = shape.ry / shape.rx;
    this.wrapW = shape.mapW;
    this.warning = shape.warning === true;
  }

  updateGhostPreview(data: GhostPreviewData | null): void {
    if (this.ellipseOn) return;
    if (data && data.rangeRadius > 0) {
      this.centerX = data.radiusTileX;
      this.centerY = data.radiusTileY;
      this.radius = data.rangeRadius;
      this.warning = data.rangeWarning;
    } else {
      this.radius = 0;
      this.warning = false;
    }
  }

  draw(cameraMatrix: Float32Array): void {
    if (this.radius <= 0) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.uCamera, false, cameraMatrix);
    gl.bindVertexArray(this.vao);

    gl.uniform1f(this.uAspect, this.aspect);
    gl.uniform1f(this.uRadius, this.radius);
    if (this.warning) {
      gl.uniform3f(this.uColor, 1.0, 0.2, 0.2);
    } else {
      gl.uniform3f(this.uColor, 1.0, 1.0, 1.0);
    }
    gl.uniform2f(this.uCenter, this.centerX, this.centerY);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // Across the date line: the same shape again where it spills over.
    const W = this.wrapW;
    if (W > 0) {
      if (this.centerX - this.radius < 0) {
        gl.uniform2f(this.uCenter, this.centerX + W, this.centerY);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      if (this.centerX + this.radius > W) {
        gl.uniform2f(this.uCenter, this.centerX - W, this.centerY);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
  }
}
