#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

// World War 1936 P2 region flags (spec §15.2), drawn over the territory at
// any zoom:
//   bit 1 (enemy) next to bit 0 (front): a thick ribbon in the viewer's
//     colour on the enemy's side of the boundary, between dark rims;
//   bit 2: red hatching (an encircled region of the viewer's side);
//   bit 3: a soft breathing glow and a bright outline (pickable border
//     region in front mode).
// Widths are screen pixels, so the line reads the same at every zoom.

uniform usampler2D uTiles;  // R16UI per tile: bit 15 edge, low 15 region id
uniform usampler2D uFlags;  // R8UI FLAG_TEX_SIZE²: region id -> flag bits
uniform sampler2D uPalette; // RGBA32F, PALETTE_SIZE x 2: territory, border
uniform float uTilesPerPx;  // world tiles per screen (CSS) pixel
uniform float uTime;        // seconds
uniform int uMe;            // the viewer's smallID

in vec2 vUV;
out vec4 fragColor;

const vec3 HATCH = vec3(0.86, 0.1, 0.08);
const vec3 GLOW = vec3(1.0, 0.93, 0.6);

uint regionAt(vec2 w) {
  ivec2 tc = clamp(ivec2(floor(w)), ivec2(0), ivec2(MAP_W - 1, MAP_H - 1));
  return texelFetch(uTiles, tc, 0).r & 0x7fffu;
}

uint flagsOf(uint id) {
  if (id == 0u) return 0u;
  int i = int(id);
  return texelFetch(uFlags, ivec2(i % FLAG_TEX_SIZE, i / FLAG_TEX_SIZE), 0).r;
}

bool frontAt(vec2 w) {
  return (flagsOf(regionAt(w)) & 1u) != 0u;
}

bool frontAround(vec2 w, float r) {
  return frontAt(w + vec2(r, 0.0)) || frontAt(w - vec2(r, 0.0)) ||
    frontAt(w + vec2(0.0, r)) || frontAt(w - vec2(0.0, r));
}

vec4 over(vec4 dst, vec3 c, float a) {
  float oa = a + dst.a * (1.0 - a);
  if (oa <= 1e-4) return vec4(0.0);
  return vec4((c * a + dst.rgb * dst.a * (1.0 - a)) / oa, oa);
}

void main() {
  vec2 w = vUV * vec2(float(MAP_W), float(MAP_H));
  uint id = regionAt(w);
  uint f = flagsOf(id);
  if ((f & 14u) == 0u) discard; // bits 1, 2, 3: only those regions draw
  vec4 col = vec4(0.0);

  if ((f & 4u) != 0u) {
    float s = (w.x + w.y) / uTilesPerPx;
    float stripe = 1.0 - step(2.5, mod(s, 9.0));
    col = over(col, HATCH, 0.06 + 0.42 * stripe);
  }

  if ((f & 8u) != 0u) {
    float breathe = 0.5 + 0.5 * sin(uTime * 2.6);
    col = over(col, GLOW, 0.1 + 0.08 * breathe);
    float r = 1.5 * uTilesPerPx;
    bool rim = regionAt(w + vec2(r, 0.0)) != id || regionAt(w - vec2(r, 0.0)) != id ||
      regionAt(w + vec2(0.0, r)) != id || regionAt(w - vec2(0.0, r)) != id;
    if (rim) col = over(col, GLOW, 0.55 + 0.2 * breathe);
  }

  if ((f & 2u) != 0u) {
    // The front line: a ribbon of the viewer's colour on the enemy's side
    // of the boundary (so it stands out against the enemy's fill), between
    // dark rims; at least 0.9 of a tile wide so the region lines never hide it.
    float rim = max(1.2 * uTilesPerPx, 0.12);
    float wide = max(7.0 * uTilesPerPx, 0.9);
    if (frontAround(w, wide)) {
      vec3 c = texelFetch(uPalette, ivec2(uMe, 0), 0).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 mine = clamp(mix(vec3(l), c, 1.3), 0.0, 1.0);
      bool edge = frontAround(w, rim) || !frontAround(w, wide - rim);
      col = over(col, edge ? vec3(0.05) : mine, 0.95);
    }
  }

  if (col.a <= 0.003) discard;
  fragColor = col;
}
