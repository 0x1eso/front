#version 300 es
precision highp float;

in vec2 vLocal;

uniform float uMode;    // 0 = ring outline, 1 = satellite badge
uniform float uInner;   // ring: inner edge in local units
uniform float uOuter;   // ring: outer edge in local units
uniform vec3 uColor;
uniform float uAlpha;

out vec4 fragColor;

float box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  float d = length(vLocal);
  float aa = max(fwidth(d), 0.002);
  if (uMode < 0.5) {
    float a = smoothstep(uInner - aa, uInner + aa, d)
            * (1.0 - smoothstep(uOuter - aa, uOuter + aa, d));
    a *= uAlpha;
    if (a < 0.01) discard;
    fragColor = vec4(uColor, a);
    return;
  }
  // Badge: dark disc, coloured rim, white satellite (body + two panels, tilted).
  float disc = 1.0 - smoothstep(0.92 - aa, 0.92 + aa, d);
  float rim = smoothstep(0.74 - aa, 0.74 + aa, d) * disc;
  vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * vLocal;
  float body = box(q, vec2(0.15));
  float panelA = box(q - vec2(-0.42, 0.0), vec2(0.2, 0.11));
  float panelB = box(q - vec2(0.42, 0.0), vec2(0.2, 0.11));
  float arm = box(q, vec2(0.3, 0.025));
  float glyph = 1.0 - smoothstep(-aa, aa, min(min(body, arm), min(panelA, panelB)));
  vec3 col = mix(vec3(0.03, 0.08, 0.12), uColor, rim);
  col = mix(col, vec3(1.0), glyph);
  float a = disc * (0.55 + 0.45 * max(rim, glyph)) * uAlpha;
  if (a < 0.01) discard;
  fragColor = vec4(col, a);
}
