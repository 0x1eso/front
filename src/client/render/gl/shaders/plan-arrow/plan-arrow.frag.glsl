#version 300 es
precision highp float;

// World War 1936 P2 plan arrows (spec §15.2): a warm red band with a dark
// rim and a head; an executing plan's band carries light stripes flowing
// toward the target. A move order's remaining path is a white dotted line.

uniform float uTilesPerPx;
uniform float uTime; // seconds

in vec2 vAcross;
in float vAlong;
in float vArc;
flat in vec4 vB;
flat in float vAlpha;

out vec4 fragColor;

const vec3 BAND = vec3(0.84, 0.2, 0.14);
const vec3 RIM = vec3(0.25, 0.04, 0.02);
const vec3 FLOW = vec3(1.0, 0.72, 0.55);

void main() {
  float style = vB.z;
  float across = abs(vAcross.x);
  float aaw = max(fwidth(vAcross.x), 1e-3);
  float arcPx = vArc / uTilesPerPx;
  vec3 c;
  float a;
  if (style > 2.5) {
    // Dotted path: 7 px dashes every 12 px, white with a dark rim.
    if (mod(arcPx, 12.0) > 7.0) discard;
    c = across > 0.55 ? vec3(0.08) : vec3(1.0);
    a = clamp((1.0 - across) / aaw, 0.0, 1.0);
  } else if (style > 1.5) {
    // Head: |v| shrinks to 0 at the tip.
    float edge = 1.0 - vAlong;
    if (across > edge + aaw) discard;
    c = across > edge - 0.3 ? RIM : BAND;
    a = clamp((edge - across) / aaw + 0.5, 0.0, 1.0);
  } else {
    c = across > 0.7 ? RIM : BAND;
    if (style > 0.5 && across <= 0.7) {
      float s = fract(arcPx / 22.0 - uTime * 1.4);
      c = mix(c, FLOW, 0.65 * (1.0 - smoothstep(0.25, 0.45, s)));
    }
    a = clamp((1.0 - across) / aaw, 0.0, 1.0);
  }
  a *= vAlpha;
  if (a <= 0.003) discard;
  fragColor = vec4(c, a);
}
