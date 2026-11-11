#version 300 es
precision highp float;
precision highp usampler2D;

// The Imjin map (ww175 design §4): the river kind of a land region edge
// tile (RegionBorderPass.riverEdgeCodes): 1 small river, 2 great river,
// 3 ford. Drawn in the water's colour over the region lines.
uniform usampler2D uRivers;
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
  uint k = texelFetch(uRivers, tc, 0).r;
  if (k == 0u) discard;
  vec3 c = k == 2u ? vec3(0.16, 0.36, 0.74)
    : k == 3u ? vec3(0.62, 0.84, 0.96)
    : vec3(0.32, 0.56, 0.86);
  fragColor = vec4(c, (k == 2u ? 0.95 : 0.8) * uAlpha);
}
