/**
 * RegionBorderPass — World War 1936 (spec §8.2): thin lines between regions
 * and between sea zones, over the territory fill and under the country
 * borders. Hidden when zoomed out, faint at first, full when zoomed in.
 */

import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import fragSrc from "../shaders/region-border/region-border.frag.glsl?raw";
import vertSrc from "../shaders/region-border/region-border.vert.glsl?raw";
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

/**
 * 1 where a land tile's right or lower neighbour is another land region, 2
 * where a water tile's is another sea zone; 0 elsewhere (coasts and tiles
 * outside every region included). Sea zones are ids from SEA_ZONE_BASE up,
 * as ScenarioIndex reads them.
 */
export function regionEdgeMask(
  ids: Uint16Array,
  w: number,
  h: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = y * w + x;
      const id = ids[t];
      if (id === 0) continue;
      const sea = id >= SEA_ZONE_BASE;
      const right = x + 1 < w ? ids[t + 1] : id;
      const down = y + 1 < h ? ids[t + w] : id;
      if (
        (right !== id && right !== 0 && right >= SEA_ZONE_BASE === sea) ||
        (down !== id && down !== 0 && down >= SEA_ZONE_BASE === sea)
      ) {
        out[t] = sea ? 2 : 1;
      }
    }
  }
  return out;
}

export class RegionBorderPass {
  private program: WebGLProgram;
  private edgeTex: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private uCamera: WebGLUniformLocation;
  private uEdges: WebGLUniformLocation;
  private uAlpha: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    regionIds: Uint16Array,
    mapW: number,
    mapH: number,
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
    // One byte per tile: rows are not 4-byte aligned on every map width.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.edgeTex = createTexture2D(gl, {
      width: mapW,
      height: mapH,
      internalFormat: gl.R8UI,
      format: gl.RED_INTEGER,
      type: gl.UNSIGNED_BYTE,
      data: regionEdgeMask(regionIds, mapW, mapH),
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
    gl.bindTexture(gl.TEXTURE_2D, this.edgeTex);
    gl.uniform1i(this.uEdges, 0);
    gl.uniformMatrix3fv(this.uCamera, false, cam);
    gl.uniform1f(this.uAlpha, alpha);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteTexture(this.edgeTex);
    gl.deleteVertexArray(this.vao);
  }
}
