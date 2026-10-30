#version 300 es
precision highp float;

// World War 1936 P2 army tokens (spec §15.2): the country's colour, a
// branch symbol, the division count, strength and organisation bars and a
// state icon; a number chip or a dot when zoomed out. Modest: the chosen
// army's outline breathes, nothing else moves.

uniform sampler2D uPalette; // RGBA32F, PALETTE_SIZE x 2: territory, border
uniform sampler2D uAtlas;   // LandAtlas
uniform float uTime;        // seconds

in vec2 vLocal;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;

out vec4 fragColor;

// ARMY_* state bits (engine-api LandTypes).
const int MOVING = 1;
const int BATTLE = 2;
const int ENCIRCLED = 4;
const int RAIL = 8;
const int SEA = 16;
const int RETREAT = 32;
const int AUTO = 128;
const int PARA = 256;

const vec3 FRAME = vec3(0.94, 0.93, 0.88);
const vec3 STRENGTH = vec3(0.90, 0.86, 0.66);
const vec3 ORG = vec3(0.36, 0.78, 0.36);
const vec3 GLOW = vec3(1.0, 0.9, 0.5);
const vec3 RING = vec3(0.86, 0.1, 0.08);
// Army group colours (hud/ww1936/MultiSelect GROUP_COLORS).
const vec3 GROUP[8] = vec3[8](
  vec3(0.902, 0.098, 0.294), vec3(0.235, 0.706, 0.294),
  vec3(1.000, 0.882, 0.098), vec3(0.263, 0.388, 0.847),
  vec3(0.961, 0.510, 0.192), vec3(0.569, 0.118, 0.706),
  vec3(0.259, 0.831, 0.957), vec3(0.941, 0.196, 0.902));

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

// Coverage of the inside (d < 0) of a distance field in screen px.
float cover(float d) {
  float w = max(fwidth(d), 1e-3);
  return clamp(0.5 - d / w, 0.0, 1.0);
}

vec4 over(vec4 dst, vec3 c, float a) {
  float oa = a + dst.a * (1.0 - a);
  if (oa <= 1e-4) return vec4(0.0);
  return vec4((c * a + dst.rgb * dst.a * (1.0 - a)) / oa, oa);
}

vec4 atlas(float cell, vec2 uv) {
  float col = mod(cell, float(ATLAS_COLS));
  float row = floor(cell / float(ATLAS_COLS));
  vec2 t = (vec2(col, row) + clamp(uv, 0.02, 0.98)) /
    vec2(float(ATLAS_COLS), float(ATLAS_ROWS));
  return texture(uAtlas, t);
}

vec4 overTexel(vec4 dst, vec4 t, float inside) {
  return over(dst, t.rgb, t.a * inside);
}

float stateIcon(int s) {
  if ((s & BATTLE) != 0) return float(ICON_BATTLE);
  if ((s & PARA) != 0) return float(ICON_PARA);
  if ((s & SEA) != 0) return float(ICON_SEA);
  if ((s & RAIL) != 0) return float(ICON_RAIL);
  if ((s & (MOVING | RETREAT)) != 0) return float(ICON_MOVE);
  return -1.0;
}

// The chosen army's breathing outline and the encircled army's red ring
// around a shape whose distance is d.
vec4 rings(vec4 col, float d, bool chosen, bool encircled) {
  if (chosen) {
    float g = (1.0 - smoothstep(0.0, 5.0, d)) * step(-0.5, d);
    col = over(col, GLOW, g * (0.55 + 0.2 * sin(uTime * 3.5)));
  }
  if (encircled) {
    col = over(col, RING, cover(abs(d - 2.5) - 1.1));
  }
  return col;
}

void main() {
  vec2 p = vLocal;
  float kind = vA.z;
  int owner = int(vA.w + 0.5);
  vec3 terr = texelFetch(uPalette, ivec2(owner, 0), 0).rgb;
  vec3 edge = mix(terr, vec3(0.0), 0.62);
  int state = int(vC.x + 0.5);
  bool chosen = mod(vC.y, 2.0) > 0.5;
  bool encircled = (state & ENCIRCLED) != 0;
  // P6 fog (spec §8.9): vC.w bits 1 band's top ("~"), 2 ghost (alpha 0.4), 4 gray bars;
  // above them (× 8) the army group colour 1..8 (0 none).
  int packedW = int(vC.w + 0.5);
  int fogFlags = packedW & 7;
  int groupColor = packedW >> 3;
  bool approx = (fogFlags & 1) != 0;
  bool ghost = (fogFlags & 2) != 0;
  bool grayBars = (fogFlags & 4) != 0;
  vec4 col = vec4(0.0);

  if (kind < 0.5) {
    // Full token: box 36x22, symbol frame, count, bars, state badge.
    vec2 symUV = (p - vec2(-15.0, -7.0)) / 14.0;
    vec2 numUV = (p - vec2(-1.0, -10.0)) / 20.0;
    vec2 iconC = vec2(17.0, -11.0);
    vec2 iconUV = (p - iconC + 7.5) / 15.0;
    float count = clamp(floor(vB.y + 0.5), 0.0, float(MAX_NUMBER));
    float numCell = vB.y < -0.5 ? float(CELL_QUESTION) : float(NUMBER_CELL0) + count;
    vec4 tSym = atlas(vB.x, symUV);
    vec4 tNum = atlas(numCell, numUV);
    vec4 tTilde = atlas(float(CELL_TILDE), (p - vec2(14.0, -8.0)) / 9.0 + 0.5);
    float icon = stateIcon(state);
    vec4 tIcon = atlas(max(icon, 0.0), iconUV);

    float dAll = sdBox(p - vec2(0.0, 4.5), vec2(18.0, 15.5), 4.0);
    col = rings(col, dAll, chosen, encircled);

    float dBox = sdBox(p, vec2(18.0, 11.0), 3.0);
    col = over(col, edge, cover(dBox));
    col = over(col, terr, cover(dBox + 1.5));
    float dFrame = sdBox(p - vec2(-8.0, 0.0), vec2(7.0, 7.0), 1.0);
    col = over(col, FRAME, cover(dFrame));
    if (vB.x >= 0.0) col = overTexel(col, tSym, cover(dFrame));
    col = overTexel(col, tNum, cover(sdBox(p - vec2(9.0, 0.0), vec2(9.0, 10.0), 0.0)));
    if (approx) col = overTexel(col, tTilde, cover(sdBox(p - vec2(14.0, -8.0), vec2(4.5, 4.5), 0.0)));

    // Strength and organisation bars under the box.
    float dBars = sdBox(p - vec2(0.0, 16.5), vec2(18.0, 4.0), 1.0);
    col = over(col, vec3(0.0), 0.7 * cover(dBars));
    float x01 = (p.x + 17.0) / 34.0;
    float str = clamp(vB.z / 1000.0, 0.0, 1.0);
    float org = clamp(vB.w / 1000.0, 0.0, 1.0);
    float inStr = cover(sdBox(p - vec2(0.0, 14.75), vec2(17.0, 1.25), 0.0));
    float inOrg = cover(sdBox(p - vec2(0.0, 18.25), vec2(17.0, 1.25), 0.0));
    if (grayBars) {
      col = over(col, vec3(0.55), inStr * step(x01, 1.0));
      col = over(col, vec3(0.55), inOrg * step(x01, 1.0));
    } else {
      col = over(col, STRENGTH, inStr * step(x01, str));
      col = over(col, ORG, inOrg * step(x01, org));
    }

    // Army group band under the bars (same colour for the whole group).
    if (groupColor > 0) {
      int gi = clamp(groupColor - 1, 0, 7);
      col = over(col, GROUP[gi], cover(sdBox(p - vec2(0.0, 23.0), vec2(18.0, 1.6), 0.5)));
    }

    if (icon >= 0.0) {
      float dIcon = length(p - iconC) - 7.5;
      col = over(col, vec3(0.1), 0.9 * cover(dIcon));
      col = overTexel(col, tIcon, cover(dIcon));
    }

    // Automation: a small "A" badge at the top-left of an auto army (mine).
    if ((state & AUTO) != 0) {
      vec2 autoC = vec2(-17.0, -11.0);
      float dAuto = length(p - autoC) - 6.0;
      vec4 tAuto = atlas(float(CELL_AUTO), (p - autoC) / 12.0 + 0.5);
      col = over(col, vec3(0.06, 0.45, 0.30), 0.95 * cover(dAuto));
      col = overTexel(col, tAuto, cover(dAuto));
    }
  } else if (kind < 1.5) {
    // Number chip.
    float count = clamp(floor(vB.y + 0.5), 0.0, float(MAX_NUMBER));
    float numCell = vB.y < -0.5 ? float(CELL_QUESTION) : float(NUMBER_CELL0) + count;
    vec4 tNum = atlas(numCell, (p + 9.0) / 18.0);
    vec4 tTilde = atlas(float(CELL_TILDE), (p - vec2(8.0, -4.0)) / 8.0 + 0.5);
    float dBox = sdBox(p, vec2(12.0, 7.5), 3.0);
    col = rings(col, dBox, chosen, encircled);
    col = over(col, edge, cover(dBox));
    col = over(col, terr, cover(dBox + 1.25));
    col = overTexel(col, tNum, cover(dBox));
    if (approx) col = overTexel(col, tTilde, cover(sdBox(p - vec2(8.0, -4.0), vec2(4.0, 4.0), 0.0)));
  } else if (kind < 2.5) {
    // Dot.
    float d = length(p) - 3.5;
    if (chosen) col = over(col, vec3(1.0), cover(abs(d - 2.0) - 0.9));
    if (encircled) col = over(col, RING, cover(abs(d - 2.0) - 0.9));
    col = over(col, edge, cover(d));
    col = over(col, terr, cover(d + 1.0));
  } else {
    // Front dots: up to five, one per division of the army in that region.
    float n = clamp(vC.z, 1.0, 5.0);
    float i = clamp(floor(p.x / 7.0 + (n - 1.0) * 0.5 + 0.5), 0.0, n - 1.0);
    float cx = (i - (n - 1.0) * 0.5) * 7.0;
    float d = length(p - vec2(cx, 0.0)) - 2.6;
    col = over(col, edge, cover(d));
    col = over(col, terr, cover(d + 0.9));
  }
  if (ghost) col.a *= 0.4;
  if (col.a <= 0.003) discard;
  fragColor = col;
}
