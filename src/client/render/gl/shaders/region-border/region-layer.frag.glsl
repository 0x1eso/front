#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

// World War 1936 P4 sea and air layers (spec §18.2), over the territory at
// any zoom. Each tile's strategic region comes from its tile code (uTiles)
// through the lookup (uLut: code -> strategic index + 1); the table (uTable,
// 256 x 2 RGBA8) gives row 0 the region's fill (AirZoneColors: supremacy
// blue <-> red, superiority green <-> red, clear when unknown) and row 1
// its flags (bit 0: my convoys sank there yesterday, the zone blinks).
// Regions below uMinDomain are not in the layer (land under the sea layer).
// Lines between the layer's regions are screen px wide; the chosen region
// (uSel, index + 1) is outlined in white.

uniform usampler2D uTiles; // R16UI per tile: bit 15 edge, low 15 code
uniform usampler2D uLut;   // R8UI SR_LUT_W x 128: code -> strategic index + 1
uniform sampler2D uTable;  // RGBA8 256 x 2: colours, flags
uniform float uTilesPerPx; // world tiles per screen (CSS) pixel
uniform float uTime;       // seconds
uniform int uMinDomain;    // first strategic index + 1 in the layer
uniform int uSel;          // the chosen region's index + 1, 0 none

in vec2 vUV;
out vec4 fragColor;

const vec3 LOSS = vec3(1.0, 0.45, 0.1);

int srAt(vec2 w) {
  ivec2 tc = clamp(ivec2(floor(w)), ivec2(0), ivec2(MAP_W - 1, MAP_H - 1));
  int code = int(texelFetch(uTiles, tc, 0).r & 0x7fffu);
  return int(texelFetch(uLut, ivec2(code % SR_LUT_W, code / SR_LUT_W), 0).r);
}

bool inLayer(int s) {
  return s >= uMinDomain;
}

vec4 over(vec4 dst, vec3 c, float a) {
  float oa = a + dst.a * (1.0 - a);
  if (oa <= 1e-4) return vec4(0.0);
  return vec4((c * a + dst.rgb * dst.a * (1.0 - a)) / oa, oa);
}

void main() {
  vec2 w = vUV * vec2(float(MAP_W), float(MAP_H));
  int s = srAt(w);
  if (!inLayer(s)) discard;
  vec4 fill = texelFetch(uTable, ivec2(s - 1, 0), 0);
  int flags = int(texelFetch(uTable, ivec2(s - 1, 1), 0).r * 255.0 + 0.5);
  vec4 col = vec4(fill.rgb, fill.a);
  if ((flags & 1) != 0) {
    float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
    col = over(col, LOSS, 0.18 + 0.32 * pulse);
  }
  bool chosen = s == uSel;
  if (chosen) col = over(col, vec3(1.0), 0.12);

  // Lines: a neighbour 1.2 px away in another region of the layer.
  float r = 1.2 * uTilesPerPx;
  int e = srAt(w + vec2(r, 0.0));
  int n = srAt(w + vec2(0.0, r));
  int west = srAt(w - vec2(r, 0.0));
  int south = srAt(w - vec2(0.0, r));
  bool line = (e != s && inLayer(e)) || (n != s && inLayer(n)) ||
    (west != s && inLayer(west)) || (south != s && inLayer(south));
  if (line) col = over(col, chosen ? vec3(1.0) : vec3(0.06), chosen ? 0.95 : 0.7);
  else if (chosen) {
    float r2 = 3.0 * uTilesPerPx;
    bool rim = srAt(w + vec2(r2, 0.0)) != s || srAt(w - vec2(r2, 0.0)) != s ||
      srAt(w + vec2(0.0, r2)) != s || srAt(w - vec2(0.0, r2)) != s;
    if (rim) col = over(col, vec3(1.0), 0.85);
  }
  if (col.a <= 0.003) discard;
  fragColor = col;
}
