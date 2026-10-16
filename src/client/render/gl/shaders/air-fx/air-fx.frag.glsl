#version 300 es
precision highp float;

in vec2 vLocal;

uniform sampler2D uPalette;
uniform float uMode;     // 0 = falling bomb, 1 = parachute, 2 = impact flash, 3 = smoke puff, 4 = evade flare
uniform float uOwner;    // parachute canopy colour
uniform float uProgress; // 0..1 through the effect
uniform float uAlpha;

out vec4 fragColor;

float box(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  float aa = max(fwidth(length(vLocal)), 0.003);
  if (uMode < 0.5) {
    // Bomb seen from above: dark body, light nose, little tail fins.
    float body = box(vLocal, vec2(0.26, 0.62));
    float fins = box(vLocal - vec2(0.0, 0.58), vec2(0.55, 0.1));
    float shape = min(body, fins);
    float a = (1.0 - smoothstep(-aa, aa, shape)) * uAlpha;
    if (a < 0.02) discard;
    vec3 col = mix(vec3(0.12, 0.12, 0.14), vec3(0.95, 0.8, 0.35),
                   smoothstep(-0.35, -0.62, vLocal.y));
    fragColor = vec4(col, a);
    return;
  }
  if (uMode < 1.5) {
    // Parachute: striped half-disc canopy, rigging lines, a tiny trooper.
    vec2 q = vLocal - vec2(0.0, -0.1);
    float d = length(q);
    float canopy = (1.0 - smoothstep(0.7 - aa, 0.7 + aa, d)) * step(q.y, 0.0);
    float stripe = step(0.5, fract((q.x + 1.0) * 2.0));
    vec3 owner = texture(uPalette, vec2((uOwner + 0.5) / float(PALETTE_SIZE), 0.25)).rgb;
    vec3 canopyCol = mix(owner, vec3(1.0), stripe * 0.75);
    vec2 pa = vec2(abs(vLocal.x), vLocal.y) - vec2(0.7, -0.1);
    vec2 ba = vec2(0.0, 0.78) - vec2(0.7, -0.1);
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float line = 1.0 - smoothstep(0.015, 0.04, length(pa - ba * h));
    float man = 1.0 - smoothstep(0.1 - aa, 0.1 + aa, length(vLocal - vec2(0.0, 0.78)));
    vec3 col = canopyCol;
    float a = canopy;
    if (a < 0.5) {
      col = vec3(0.1, 0.1, 0.1);
      a = max(line * 0.7, man);
    }
    a *= uAlpha;
    if (a < 0.02) discard;
    fragColor = vec4(col, a);
    return;
  }
  if (uMode > 2.5 && uMode < 3.5) {
    // Smoke puff: a soft grey-brown disc.
    float d = length(vLocal);
    float a = (1.0 - smoothstep(0.35, 1.0, d)) * uAlpha;
    if (a < 0.02) discard;
    fragColor = vec4(mix(vec3(0.16, 0.15, 0.15), vec3(0.45, 0.43, 0.42), uProgress), a);
    return;
  }
  if (uMode > 3.5) {
    // Evade flare: a small bright star that pops and fades, with a thin ring.
    float p = uProgress;
    float d = length(vLocal);
    float star = max(0.0, 1.0 - 6.0 * min(abs(vLocal.x), abs(vLocal.y))) * (1.0 - smoothstep(0.0, 0.95, d));
    float core = (1.0 - smoothstep(0.0, 0.4, d));
    float ring = 1.0 - smoothstep(0.0, 0.08, abs(d - (0.3 + 0.6 * p)));
    float a = clamp(star + core * (1.0 - p) + ring * 0.6, 0.0, 1.0) * (1.0 - p) * uAlpha;
    if (a < 0.02) discard;
    fragColor = vec4(mix(vec3(0.7, 0.95, 1.0), vec3(1.0), core), a);
    return;
  }
  // Impact flash: a hot core and a thin ring that opens up quickly.
  float p = uProgress;
  float d = length(vLocal);
  float core = pow(1.0 - p, 2.0) * (1.0 - smoothstep(0.0, 0.55, d));
  float r = 0.25 + 0.75 * p;
  float ring = (1.0 - smoothstep(0.0, 0.12 * (1.0 - p) + 0.02, abs(d - r))) * (1.0 - p);
  float a = clamp(core + ring * 0.8, 0.0, 1.0) * uAlpha;
  if (a < 0.02) discard;
  fragColor = vec4(mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.95, 0.75), core), a);
}
