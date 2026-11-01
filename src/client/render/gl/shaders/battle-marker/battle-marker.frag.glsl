#version 300 es
precision highp float;

// World War 1936 P2 battle markers (spec §15.2): crossed swords on a dark
// badge over a small progress bar (attacker's colour up to the progress,
// the defender's after it); a point when zoomed out. Static.
//
// ww7: below the progress bar a band bar (one segment per depth band, the
// taker's colour for the bands fallen, gold for the band being fought);
// the same bar alone as the chip of a region being taken outside a battle;
// and the odds badge: a coloured pill with its word (low / medium / high)
// from the atlas, a dot when zoomed out.

uniform sampler2D uPalette; // RGBA32F, PALETTE_SIZE x 2
uniform sampler2D uAtlas;   // LandAtlas

in vec2 vLocal;
flat in vec4 vA;
flat in vec4 vB;
flat in vec4 vC;

out vec4 fragColor;

const vec3 ODDS_LOW = vec3(0.78, 0.2, 0.17);
const vec3 ODDS_MID = vec3(0.82, 0.62, 0.12);
const vec3 ODDS_HIGH = vec3(0.17, 0.58, 0.28);

float sdBox(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
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

vec3 palette(float smallId) {
  return texelFetch(uPalette, ivec2(int(smallId + 0.5), 0), 0).rgb;
}

// The band bar centred on q = 0: depth segments, the first `filled` in the
// taker's colour, the next gold while a battle fights it, the rest dim.
vec4 bandBar(vec4 col, vec2 q) {
  float depth = max(vC.x, 1.0);
  float filled = vC.y;
  float hw = 12.0;
  col = over(col, vec3(0.0), 0.75 * cover(sdBox(q, vec2(hw, 2.75))));
  float inner = cover(sdBox(q, vec2(hw - 1.0, 1.75)));
  float segW = 2.0 * (hw - 1.0) / depth;
  float x = q.x + (hw - 1.0);
  float seg = clamp(floor(x / segW), 0.0, depth - 1.0);
  float lx = x - seg * segW;
  // A hairline between segments.
  float gap = (seg > 0.5 && lx < 0.9) ? 0.0 : 1.0;
  vec3 taker = palette(vA.z);
  vec3 holder = palette(vA.w);
  vec3 c = seg < filled - 0.5 ? taker
    : (seg < filled + 0.5 && vC.z > 0.5) ? vec3(1.0, 0.86, 0.25)
    : holder * 0.55;
  return over(col, c, inner * gap);
}

void main() {
  vec2 p = vLocal;
  vec4 col = vec4(0.0);
  if (vB.z > 1.5) {
    // The odds badge.
    float level = vB.w;
    vec3 c = level < 0.5 ? ODDS_LOW : level < 1.5 ? ODDS_MID : ODDS_HIGH;
    if (vB.y > 1.5) {
      float d = length(p - vec2(0.0, -12.0)) - 4.0;
      col = over(col, vec3(0.1), cover(d));
      col = over(col, c, cover(d + 1.0));
    } else {
      vec2 q = p - vec2(0.0, -32.0);
      float dPill = sdBox(q, vec2(20.0, 6.5)) - 2.0;
      col = over(col, vec3(0.06), 0.9 * cover(dPill));
      col = over(col, c, cover(dPill + 1.5));
      float cell = float(ODDS_CELL0) + level;
      vec2 uv = clamp(q / 44.0 + 0.5, 0.02, 0.98);
      vec2 t = (vec2(mod(cell, float(ATLAS_COLS)), floor(cell / float(ATLAS_COLS))) + uv) /
        vec2(float(ATLAS_COLS), float(ATLAS_ROWS));
      vec4 word = texture(uAtlas, t);
      col = over(col, word.rgb, word.a * cover(dPill + 1.5));
    }
  } else if (vB.z > 0.5) {
    // The band chip of a region being taken outside a battle.
    col = bandBar(col, p - vec2(0.0, 33.0));
  } else if (vB.y > 1.5) {
    float d = length(p) - 4.0;
    col = over(col, vec3(0.1), cover(d));
    col = over(col, vec3(0.95, 0.36, 0.15), cover(d + 1.0));
  } else {
    float cell = float(ICON_BATTLE);
    vec2 uv = clamp((p + 9.0) / 18.0, 0.02, 0.98);
    vec2 t = (vec2(mod(cell, float(ATLAS_COLS)), floor(cell / float(ATLAS_COLS))) + uv) /
      vec2(float(ATLAS_COLS), float(ATLAS_ROWS));
    vec4 sw = texture(uAtlas, t);
    float dBadge = length(p) - 10.5;
    col = over(col, vec3(0.92, 0.86, 0.7), 0.9 * cover(dBadge));
    col = over(col, vec3(0.12, 0.1, 0.09), 0.88 * cover(dBadge + 1.25));
    col = over(col, sw.rgb, sw.a * cover(dBadge));

    vec3 att = palette(vA.z);
    vec3 def = palette(vA.w);
    float dBar = sdBox(p - vec2(0.0, 15.0), vec2(12.0, 2.75));
    col = over(col, vec3(0.0), 0.75 * cover(dBar));
    float x01 = (p.x + 11.0) / 22.0;
    float prog = clamp(vB.x / 1000.0, 0.0, 1.0);
    float inner = cover(sdBox(p - vec2(0.0, 15.0), vec2(11.0, 1.75)));
    col = over(col, x01 <= prog ? att : def, inner);
    // ww7: the band bar under it, when the region has more than one band.
    if (vC.x > 1.5) col = bandBar(col, p - vec2(0.0, 22.0));
  }
  if (col.a <= 0.003) discard;
  fragColor = col;
}
