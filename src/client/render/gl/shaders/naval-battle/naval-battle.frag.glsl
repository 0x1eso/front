#version 300 es
precision highp float;

// World War 1936 P4 naval battle markers (spec §18.2): crossed anchors on a
// dark badge, a progress bar in both sides' colours (the attacker's share
// of the strength left), gun smoke flickering around it from the fx atlas
// (MiniBigSmoke frames); a point when zoomed out.

uniform sampler2D uPalette; // RGBA32F, PALETTE_SIZE x 2
uniform sampler2D uAtlas;   // ship-atlas.png
uniform sampler2D uFx;      // fx-atlas.png
uniform float uTime;        // seconds

in vec2 vLocal;
flat in vec4 vA;
flat in vec4 vB;

out vec4 fragColor;

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

// One smoke puff, 26 x 17 px centered on c, its own frame and flicker.
vec4 puff(vec4 col, vec2 p, vec2 c, float seed) {
  vec2 uv = (p - c) / vec2(26.0, 17.0) + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return col;
  float frame = floor(mod(uTime * 1000.0 / float(SMOKE_MS) + seed * 3.0, float(SMOKE_FRAMES)));
  vec2 t = vec2(
    (frame * float(SMOKE_FW) + clamp(uv.x, 0.02, 0.98) * float(SMOKE_FW)) / float(FX_W),
    (float(SMOKE_Y) + clamp(uv.y, 0.02, 0.98) * float(SMOKE_H)) / float(FX_H)
  );
  vec4 s = texture(uFx, t);
  float flicker = 0.45 + 0.4 * sin(uTime * 5.0 + seed * 7.0);
  return over(col, s.rgb, s.a * flicker);
}

void main() {
  vec2 p = vLocal;
  vec4 col = vec4(0.0);
  if (vB.y > 0.5) {
    float d = length(p) - 4.5;
    col = over(col, vec3(0.08), cover(d));
    col = over(col, vec3(0.95, 0.36, 0.15), cover(d + 1.2));
  } else {
    float ph = vB.z;
    col = puff(col, p, vec2(-13.0, -12.0), ph);
    col = puff(col, p, vec2(12.0, -14.0), ph + 0.37);
    col = puff(col, p, vec2(0.0, -17.0), ph + 0.71);

    float dBadge = length(p) - 11.5;
    col = over(col, vec3(0.92, 0.86, 0.7), 0.92 * cover(dBadge));
    col = over(col, vec3(0.09, 0.12, 0.2), 0.92 * cover(dBadge + 1.3));
    float cell = float(CELL_BATTLE);
    vec2 uv = clamp((p + 10.0) / 20.0, 0.01, 0.99);
    vec2 t = (vec2(mod(cell, float(ATLAS_COLS)), floor(cell / float(ATLAS_COLS))) + uv) /
      vec2(float(ATLAS_COLS), float(ATLAS_ROWS));
    vec4 a = texture(uAtlas, t);
    col = over(col, a.rgb, a.a * cover(dBadge));

    vec3 att = texelFetch(uPalette, ivec2(int(vA.z + 0.5), 0), 0).rgb;
    vec3 def = texelFetch(uPalette, ivec2(int(vA.w + 0.5), 0), 0).rgb;
    float dBar = sdBox(p - vec2(0.0, 16.5), vec2(14.0, 3.0));
    col = over(col, vec3(0.0), 0.78 * cover(dBar));
    float x01 = (p.x + 13.0) / 26.0;
    float share = clamp(vB.x, 0.0, 1.0);
    float inner = cover(sdBox(p - vec2(0.0, 16.5), vec2(13.0, 2.0)));
    col = over(col, x01 <= share ? att : def, inner);
  }
  if (col.a <= 0.003) discard;
  fragColor = col;
}
