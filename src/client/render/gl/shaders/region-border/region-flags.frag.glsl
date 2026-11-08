#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

// World War 1936 P2 region flags (spec §15.2), drawn over the territory at
// any zoom:
//   bit 0 (ww7, zone): the chosen army's zone, a soft fill in the viewer's
//     colour with a rim;
//   bit 5 (ww7, gap): a border region nobody covers, blinking red;
//   bit 1 (enemy) next to bit 0 (front): a thick ribbon in the viewer's
//     colour on the enemy's side of the boundary, between dark rims;
//   bit 2: red hatching (an encircled region of the viewer's side);
//   bit 3: a soft breathing glow and a bright outline (pickable border
//     region in front mode);
//   bit 4 (P4): orange hatching the other way (a region of the viewer's
//     bombed lately, air layer).
// ww162 (battle planner) reads a second byte per region from row FLAG2_ROW
// on (RegionBorderPass FLAG2_*):
//   bit 0 (fallback): a dashed line (6 px on, 4 px off) in the line's hue
//     (bits 1-2) at 70 %, on the region's side of its outer edges (the
//     regions with bit 5);
//   bit 3: the region's zone belongs to another army: drawn at 40 % (the
//     plan view), its front ribbon too; bit 4 the same for a fallback.
// Two zones of different hues that meet get a white 2 px tick on the join.
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
const vec3 BOMBED = vec3(0.96, 0.55, 0.1);
const vec3 GAP = vec3(0.95, 0.12, 0.1);
// An army's zone colours (cyan, magenta, yellow, lime): far from red (gaps)
// and each other, and from the territory fills.
const vec3 ZONE_HUES[4] = vec3[4](
  vec3(0.1, 0.85, 0.95), vec3(0.95, 0.25, 0.85),
  vec3(1.0, 0.9, 0.1), vec3(0.55, 1.0, 0.2)
);

// The viewer's colour, a little livelier than the territory fill.
vec3 viewerColor() {
  vec3 c = texelFetch(uPalette, ivec2(uMe, 0), 0).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return clamp(mix(vec3(l), c, 1.3), 0.0, 1.0);
}

uint regionAt(vec2 w) {
  ivec2 tc = clamp(ivec2(floor(w)), ivec2(0), ivec2(MAP_W - 1, MAP_H - 1));
  return texelFetch(uTiles, tc, 0).r & 0x7fffu;
}

uint flagsOf(uint id) {
  if (id == 0u) return 0u;
  int i = int(id);
  return texelFetch(uFlags, ivec2(i % FLAG_TEX_SIZE, i / FLAG_TEX_SIZE), 0).r;
}

// ww162: the region's second flag byte.
uint flags2Of(uint id) {
  if (id == 0u) return 0u;
  int i = int(id);
  return texelFetch(uFlags, ivec2(i % FLAG_TEX_SIZE, FLAG2_ROW + i / FLAG_TEX_SIZE), 0).r;
}

bool frontAt(vec2 w) {
  return (flagsOf(regionAt(w)) & 1u) != 0u;
}

bool frontAround(vec2 w, float r) {
  return frontAt(w + vec2(r, 0.0)) || frontAt(w - vec2(r, 0.0)) ||
    frontAt(w + vec2(0.0, r)) || frontAt(w - vec2(0.0, r));
}

// ww162: a front region within r whose zone is shown full (not faint).
bool fullFrontAt(vec2 w) {
  uint id = regionAt(w);
  return (flagsOf(id) & 1u) != 0u && (flags2Of(id) & 8u) == 0u;
}

bool fullFrontAround(vec2 w, float r) {
  return fullFrontAt(w + vec2(r, 0.0)) || fullFrontAt(w - vec2(r, 0.0)) ||
    fullFrontAt(w + vec2(0.0, r)) || fullFrontAt(w - vec2(0.0, r));
}

// ww162: a region across a fallback line's outer edge.
bool outerAt(vec2 w) {
  return (flags2Of(regionAt(w)) & 32u) != 0u;
}

bool outerAround(vec2 w, float r) {
  return outerAt(w + vec2(r, 0.0)) || outerAt(w - vec2(r, 0.0)) ||
    outerAt(w + vec2(0.0, r)) || outerAt(w - vec2(0.0, r));
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
  uint f2 = flags2Of(id);
  // bits 0-5 (6-7: the zone hue), and ww162's fallback: only those regions draw
  if ((f & 63u) == 0u && (f2 & 1u) == 0u) discard;
  vec4 col = vec4(0.0);

  if ((f & 1u) != 0u) {
    // The zone: the army's own colour (one of four, by army id), a clear fill
    // that lets the country colours show through, and a strong rim.
    float r = 2.0 * uTilesPerPx;
    bool rim = regionAt(w + vec2(r, 0.0)) != id || regionAt(w - vec2(r, 0.0)) != id ||
      regionAt(w + vec2(0.0, r)) != id || regionAt(w - vec2(0.0, r)) != id;
    float faint = (f2 & 8u) != 0u ? 0.4 : 1.0;
    col = over(col, ZONE_HUES[int((f >> 6u) & 3u)], (rim ? 0.95 : 0.42) * faint);
    // ww162: where two armies' zones meet (a marshal's sectors, the plan
    // view), a 2 px white tick on the join.
    float t = 2.0 * uTilesPerPx;
    uint hue = f & 192u;
    bool join = false;
    for (int k = 0; k < 4; k++) {
      vec2 d = k == 0 ? vec2(t, 0.0) : k == 1 ? vec2(-t, 0.0) : k == 2 ? vec2(0.0, t) : vec2(0.0, -t);
      uint n = flagsOf(regionAt(w + d));
      if ((n & 1u) != 0u && (n & 192u) != hue) join = true;
    }
    if (join) col = over(col, vec3(1.0), 0.9 * faint);
  }

  if ((f2 & 1u) != 0u) {
    // ww162: the fallback line, the front's thick line dashed, on this
    // region's side of its outer edges, in the line's hue at 70 %.
    float rimW = max(1.2 * uTilesPerPx, 0.12);
    float wide = max(7.0 * uTilesPerPx, 0.9);
    if (outerAround(w, wide)) {
      // Dashes run along the edge: across a left/right edge they step
      // with y, across an upper/lower edge with x.
      bool side = outerAt(w + vec2(wide, 0.0)) || outerAt(w - vec2(wide, 0.0));
      float s = (side ? w.y : w.x) / uTilesPerPx;
      if (mod(s, 10.0) < 6.0) {
        bool edge = outerAround(w, rimW) || !outerAround(w, wide - rimW);
        float faint = (f2 & 16u) != 0u ? 0.4 : 1.0;
        vec3 hue = ZONE_HUES[int((f2 >> 1u) & 3u)];
        col = over(col, edge ? vec3(0.05) : hue, 0.7 * faint);
      }
    }
  }

  if ((f & 32u) != 0u) {
    // A gap: red fill breathing fast, with stripes, so it is not missed.
    float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
    float s = (w.x + w.y) / uTilesPerPx;
    float stripe = 1.0 - step(3.0, mod(s, 10.0));
    col = over(col, GAP, 0.12 + 0.28 * pulse + 0.2 * stripe * pulse);
  }

  if ((f & 4u) != 0u) {
    float s = (w.x + w.y) / uTilesPerPx;
    float stripe = 1.0 - step(2.5, mod(s, 9.0));
    col = over(col, HATCH, 0.06 + 0.42 * stripe);
  }

  if ((f & 16u) != 0u) {
    float s = (w.x - w.y) / uTilesPerPx;
    float stripe = 1.0 - step(2.0, mod(s, 8.0));
    col = over(col, BOMBED, 0.05 + 0.5 * stripe);
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
      vec3 mine = viewerColor();
      bool edge = frontAround(w, rim) || !frontAround(w, wide - rim);
      // ww162: next to only faint zones (the plan view) the ribbon is faint.
      float faint = fullFrontAround(w, wide) ? 1.0 : 0.4;
      col = over(col, edge ? vec3(0.05) : mine, 0.95 * faint);
    }
  }

  if (col.a <= 0.003) discard;
  fragColor = col;
}
