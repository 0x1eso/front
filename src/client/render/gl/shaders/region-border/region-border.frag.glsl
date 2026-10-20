#version 300 es
precision highp float;
precision highp usampler2D;

// Per-tile edge mask (R8UI): 0 none, 1 land region edge. Sea zones are not
// drawn in P0 (spec §4.6).
uniform usampler2D uEdges;
// 0..1 with the zoom.
uniform float uAlpha;

in vec2 vUV;
out vec4 fragColor;

void main() {
  ivec2 tc = clamp(
    ivec2(int(vUV.x * float(MAP_W)), int(vUV.y * float(MAP_H))),
    ivec2(0),
    ivec2(MAP_W - 1, MAP_H - 1)
  );
  uint e = texelFetch(uEdges, tc, 0).r;
  if (e == 0u) discard;
  fragColor = vec4(0.0, 0.0, 0.0, 0.35 * uAlpha);
}
