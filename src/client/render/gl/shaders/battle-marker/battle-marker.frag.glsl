#version 300 es
precision highp float;

// World War 1936 P2 battle markers (spec §15.2): crossed swords on a dark
// badge over a small progress bar (attacker's colour up to the progress,
// the defender's after it); a point when zoomed out. Static.

uniform sampler2D uPalette; // RGBA32F, PALETTE_SIZE x 2
uniform sampler2D uAtlas;   // LandAtlas

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

void main() {
  vec2 p = vLocal;
  vec4 col = vec4(0.0);
  if (vB.y > 1.5) {
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

    vec3 att = texelFetch(uPalette, ivec2(int(vA.z + 0.5), 0), 0).rgb;
    vec3 def = texelFetch(uPalette, ivec2(int(vA.w + 0.5), 0), 0).rgb;
    float dBar = sdBox(p - vec2(0.0, 15.0), vec2(12.0, 2.75));
    col = over(col, vec3(0.0), 0.75 * cover(dBar));
    float x01 = (p.x + 11.0) / 22.0;
    float prog = clamp(vB.x / 1000.0, 0.0, 1.0);
    float inner = cover(sdBox(p - vec2(0.0, 15.0), vec2(11.0, 1.75)));
    col = over(col, x01 <= prog ? att : def, inner);
  }
  if (col.a <= 0.003) discard;
  fragColor = col;
}
