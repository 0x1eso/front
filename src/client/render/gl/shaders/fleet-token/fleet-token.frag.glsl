#version 300 es
precision highp float;

// World War 1936 P4 ship sprites (spec §18.2):
//   0 token: the country's colour in a rounded box, the white silhouette of
//     its biggest class, the ship count, HP and organisation bars, the
//     mission icon (left badge), the state icon (right badge: battle,
//     repair) and a red dot when short of fuel; the chosen fleet's outline
//     breathes. No ensigns, no insignia: colour and silhouette only.
//   1 chip: the ship count in the country's colour (zoomed out).
//   2 text chip: up to five atlas glyphs on a dark, green, red or owner chip.
//   3 sprite: one atlas cell (a convoy ship), mirrored to its heading.
//   4 ring: invasion preparation progress, ready pulse, convoy-loss splash.

uniform sampler2D uPalette; // RGBA32F, PALETTE_SIZE x 2: territory, border
uniform sampler2D uAtlas;   // ship-atlas.png
uniform float uTime;        // seconds

in vec2 vLocal;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;

out vec4 fragColor;

const int ST_BATTLE = 1;
const int ST_REPAIR = 2;
const int ST_LOW_FUEL = 4;

const vec3 HP = vec3(0.90, 0.86, 0.66);
const vec3 ORG = vec3(0.36, 0.78, 0.36);
const vec3 GLOW = vec3(1.0, 0.9, 0.5);
const vec3 GOLD = vec3(1.0, 0.8, 0.25);
const vec3 READY = vec3(0.35, 0.9, 0.4);
const vec3 FOAM = vec3(0.86, 0.95, 1.0);

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

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
  vec2 t = (vec2(col, row) + clamp(uv, 0.01, 0.99)) /
    vec2(float(ATLAS_COLS), float(ATLAS_ROWS));
  return texture(uAtlas, t);
}

float inUnit(vec2 uv) {
  return step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
}

// Atlas cell `cell` in a `size` px square centered on c.
vec4 overCell(vec4 col, vec2 p, vec2 c, float size, float cell) {
  vec2 uv = (p - c) / size + 0.5;
  vec4 t = atlas(cell, uv);
  return over(col, t.rgb, t.a * inUnit(uv));
}

// A whole number (0..999) of atlas digits centered on c, `size` px each.
vec4 number(vec4 col, vec2 p, vec2 c, float n, float size) {
  n = clamp(floor(n + 0.5), 0.0, 999.0);
  float digits = n >= 100.0 ? 3.0 : (n >= 10.0 ? 2.0 : 1.0);
  float adv = size * 0.47;
  float x0 = c.x - adv * (digits - 1.0) * 0.5;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    if (fi >= digits) break;
    float place = pow(10.0, digits - 1.0 - fi);
    float d = mod(floor(n / place + 0.001), 10.0);
    col = overCell(col, p, vec2(x0 + adv * fi, c.y), size, float(DIGIT0) + d);
  }
  return col;
}

vec4 badge(vec4 col, vec2 p, vec2 c, float cell) {
  float d = length(p - c) - 7.5;
  col = over(col, vec3(0.08), 0.9 * cover(d));
  vec2 uv = (p - c) / 14.0 + 0.5;
  vec4 t = atlas(cell, uv);
  return over(col, t.rgb, t.a * cover(d));
}

vec4 glow(vec4 col, float d) {
  float g = (1.0 - smoothstep(0.0, 5.0, d)) * step(-0.5, d);
  return over(col, GLOW, g * (0.6 + 0.25 * sin(uTime * 3.5)));
}

float glyphAt(int i) {
  if (i == 0) return vB.x;
  if (i == 1) return vB.y;
  if (i == 2) return vB.z;
  if (i == 3) return vB.w;
  return vC.x;
}

float glyphAdv(float cell) {
  if (abs(cell - float(CELL_PLANE)) < 0.5) return 15.0;
  if (cell < float(DIGIT0) - 0.5) return 13.0;
  return 9.0;
}

void main() {
  vec2 p = vLocal;
  float kind = vA.z;
  int owner = int(vA.w + 0.5);
  vec3 terr = texelFetch(uPalette, ivec2(owner, 0), 0).rgb;
  vec3 edge = mix(terr, vec3(0.0), 0.62);
  vec4 col = vec4(0.0);

  if (kind < 1.5) {
    int state = int(vC.y + 0.5);
    bool chosen = mod(vC.z, 2.0) > 0.5;
    if (kind < 0.5) {
      float dBox = sdBox(p, vec2(22.0, 11.0), 3.0);
      if (chosen) col = glow(col, sdBox(p - vec2(0.0, 3.5), vec2(23.0, 15.0), 4.0));
      col = over(col, edge, cover(dBox));
      col = over(col, terr, cover(dBox + 1.5));
      // The silhouette, darkened a little below so white reads on pale colours.
      col = over(col, vec3(0.0), 0.25 * cover(sdBox(p - vec2(-7.0, 0.0), vec2(13.5, 6.5), 3.0)));
      if (vB.x >= 0.0) col = overCell(col, p, vec2(-7.0, -1.0), 30.0, vB.x);
      col = number(col, p, vec2(13.5, 0.5), vB.y, 17.0);

      float dBars = sdBox(p - vec2(0.0, 16.0), vec2(22.0, 3.6), 1.0);
      col = over(col, vec3(0.0), 0.72 * cover(dBars));
      float x01 = (p.x + 21.0) / 42.0;
      float hp = clamp(vB.z / 1000.0, 0.0, 1.0);
      float org = clamp(vB.w / 1000.0, 0.0, 1.0);
      col = over(col, HP, cover(sdBox(p - vec2(0.0, 14.3), vec2(21.0, 1.2), 0.0)) * step(x01, hp));
      col = over(col, ORG, cover(sdBox(p - vec2(0.0, 17.7), vec2(21.0, 1.2), 0.0)) * step(x01, org));

      if (vC.x >= 0.0) col = badge(col, p, vec2(-22.0, -12.0), vC.x);
      if ((state & ST_BATTLE) != 0) col = badge(col, p, vec2(22.0, -12.0), float(CELL_BATTLE));
      else if ((state & ST_REPAIR) != 0) col = badge(col, p, vec2(22.0, -12.0), float(CELL_REPAIR));
      if ((state & ST_LOW_FUEL) != 0) col = overCell(col, p, vec2(23.5, 5.0), 11.0, float(CELL_LOW_FUEL));
    } else {
      float dBox = sdBox(p, vec2(13.0, 8.5), 3.0);
      if (chosen) col = glow(col, dBox);
      col = over(col, edge, cover(dBox));
      col = over(col, terr, cover(dBox + 1.25));
      col = number(col, p, vec2(0.0, 0.5), vB.y, 15.0);
      if ((state & ST_BATTLE) != 0) {
        float d = length(p - vec2(12.0, -7.0)) - 3.2;
        col = over(col, vec3(0.1), cover(d - 1.0));
        col = over(col, vec3(0.95, 0.36, 0.15), cover(d));
      }
    }
  } else if (kind < 2.5) {
    float hw = vC.z * 0.5;
    float dBox = sdBox(p, vec2(hw, 9.5), 4.0);
    int style = int(vC.y + 0.5);
    vec3 bg = vec3(0.1);
    if (style == 1) bg = vec3(0.15, 0.52, 0.24);
    else if (style == 2) bg = vec3(0.72, 0.17, 0.13);
    else if (style == 3) bg = terr;
    col = over(col, vec3(0.0), 0.9 * cover(dBox));
    col = over(col, bg, 0.92 * cover(dBox + 1.25));
    int n = int(vC.w + 0.5);
    float x = -hw + 5.0;
    for (int i = 0; i < 5; i++) {
      if (i >= n) break;
      float cell = glyphAt(i);
      float adv = glyphAdv(cell);
      col = overCell(col, p, vec2(x + adv * 0.5, 0.0), 18.0, cell);
      x += adv;
    }
  } else if (kind < 3.5) {
    vec2 uv = p / vB.w + 0.5;
    if (vB.y < 0.0) uv.x = 1.0 - uv.x;
    vec4 t = atlas(vB.x, uv);
    col = vec4(t.rgb, t.a * vB.z * inUnit(uv));
  } else {
    float r = vB.y;
    float len = length(p);
    int style = int(vB.z + 0.5);
    if (style == 1) {
      for (int i = 0; i < 2; i++) {
        float t = fract(uTime * 0.7 + vB.w + float(i) * 0.5);
        float rr = r * (0.2 + 0.8 * t);
        col = over(col, FOAM, (1.0 - t) * 0.85 * cover(abs(len - rr) - 1.1));
      }
    } else {
      float d = abs(len - r) - 2.6;
      col = over(col, vec3(0.05), 0.7 * cover(d));
      if (style == 2) {
        col = over(col, READY, (0.65 + 0.3 * sin(uTime * 4.0)) * cover(abs(len - r) - 1.8));
      } else {
        float a = atan(p.x, -p.y);
        float f = (a < 0.0 ? a + 6.2831853 : a) / 6.2831853;
        col = over(col, GOLD, cover(abs(len - r) - 1.8) * step(f, vB.x));
      }
    }
  }
  if (col.a <= 0.003) discard;
  fragColor = col;
}
