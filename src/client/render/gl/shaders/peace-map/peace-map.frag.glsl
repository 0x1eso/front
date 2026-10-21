#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

// World War 1936 P5 conference map mode (spec §20.2), over the territory.
// Each tile's land region comes from the shared tile codes (uTiles; sea zone
// codes carry bit 14 and count as no region); the region table (uTable,
// PEACE_TEX_SIZE² RGBA8) gives the region's colour (rgb) and its state
// (alpha byte: PEACE_FREE … PEACE_OTHER, | PEACE_SELECTED; 0 = not at
// stake). Outside the stake the map is dimmed; a stake region is lightened
// and drawn by its state:
//   free: a white rim;
//   mine: my colour (lightened) over it and a wide rim in it;
//   decided: the settler's colour, hatched;
//   other: a wide rim in the controlling participant's colour.
// The selected region pulses a white outline. Widths are screen pixels.

uniform usampler2D uTiles;  // R16UI per tile: bit 15 edge, low 15 code
uniform sampler2D uTable;   // RGBA8 PEACE_TEX_SIZE²: colour, state
uniform float uTilesPerPx;  // world tiles per screen (CSS) pixel
uniform float uTime;        // seconds

in vec2 vUV;
out vec4 fragColor;

const uint SEA_BIT = 0x4000u;

uint regionAt(vec2 w) {
  ivec2 tc = clamp(ivec2(floor(w)), ivec2(0), ivec2(MAP_W - 1, MAP_H - 1));
  uint c = texelFetch(uTiles, tc, 0).r & 0x7fffu;
  return c >= SEA_BIT ? 0u : c;
}

vec4 cellOf(uint id) {
  int i = int(id);
  if (i <= 0 || i >= PEACE_TEX_SIZE * PEACE_TEX_SIZE) return vec4(0.0);
  return texelFetch(uTable, ivec2(i % PEACE_TEX_SIZE, i / PEACE_TEX_SIZE), 0);
}

int stateOf(vec4 c) {
  return int(c.a * 255.0 + 0.5);
}

vec4 over(vec4 dst, vec3 c, float a) {
  float oa = a + dst.a * (1.0 - a);
  if (oa <= 1e-4) return vec4(0.0);
  return vec4((c * a + dst.rgb * dst.a * (1.0 - a)) / oa, oa);
}

bool otherAt(vec2 w, uint id, float r) {
  return regionAt(w + vec2(r, 0.0)) != id || regionAt(w - vec2(r, 0.0)) != id ||
    regionAt(w + vec2(0.0, r)) != id || regionAt(w - vec2(0.0, r)) != id;
}

void main() {
  vec2 w = vUV * vec2(float(MAP_W), float(MAP_H));
  uint id = regionAt(w);
  vec4 cell = cellOf(id);
  int s = stateOf(cell);
  int kind = s & 7;
  if (id == 0u || kind == 0) {
    fragColor = vec4(0.02, 0.03, 0.05, 0.58);
    return;
  }
  vec3 c = cell.rgb;
  vec4 col = vec4(1.0, 1.0, 1.0, 0.1);
  // Mine: my colour, lightened so a dark national colour doesn't read as
  // the dimmed outside, with a wide rim in it.
  if (kind == PEACE_MINE) col = over(col, mix(c, vec3(1.0), 0.3), 0.6);
  if (kind == PEACE_DECIDED) {
    col = over(col, c, 0.3);
    float stripe = fract((w.x + w.y) / (9.0 * uTilesPerPx));
    if (stripe < 0.4) col = over(col, c, 0.6);
  }
  float thin = 1.6 * uTilesPerPx;
  float wide = 3.5 * uTilesPerPx;
  if ((kind == PEACE_OTHER || kind == PEACE_MINE) && otherAt(w, id, wide)) {
    col = over(col, c, 0.95);
  } else if (otherAt(w, id, thin)) {
    vec3 rim = kind == PEACE_FREE ? vec3(1.0) : c;
    col = over(col, rim, 0.9);
  }
  if ((s & PEACE_SELECTED) != 0 && otherAt(w, id, wide * 1.4)) {
    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    col = over(col, vec3(1.0), 0.55 + 0.4 * pulse);
  }
  fragColor = col;
}
