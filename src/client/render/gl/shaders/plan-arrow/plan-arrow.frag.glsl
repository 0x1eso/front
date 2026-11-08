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
// ww162: an army's zone colours (RegionBorderPass's ZONE_HUES).
const vec3 ZONE_HUES[4] = vec3[4](
  vec3(0.1, 0.85, 0.95), vec3(0.95, 0.25, 0.85),
  vec3(1.0, 0.9, 0.1), vec3(0.55, 1.0, 0.2)
);

void main() {
  float style = vB.z;
  float across = abs(vAcross.x);
  float aaw = max(fwidth(vAcross.x), 1e-3);
  float arcPx = vArc / uTilesPerPx;
  vec3 c;
  float a;
  int hue = int(vB.y + 0.5);
  vec3 band = hue > 0 ? ZONE_HUES[(hue - 1) & 3] : BAND;
  vec3 rimC = hue > 0 ? band * 0.3 : RIM;
  if (style > 3.5) {
    // ww162: a handle, filled with the hue, a 2 px white rim, a dark edge.
    float R = vB.w * 0.5;
    float rpx = length(vec2(vAlong * 2.0 - 1.0, vAcross.x)) * R;
    if (rpx > R) discard;
    c = rpx > R - 1.0 ? vec3(0.08) : rpx > R - 3.0 ? vec3(1.0) : band;
    a = clamp(R - rpx, 0.0, 1.0);
  } else if (style > 2.5) {
    // Dotted path: 7 px dashes every 12 px, white with a dark rim.
    if (mod(arcPx, 12.0) > 7.0) discard;
    c = across > 0.55 ? vec3(0.08) : vec3(1.0);
    a = clamp((1.0 - across) / aaw, 0.0, 1.0);
  } else if (style > 1.5) {
    // Head: |v| shrinks to 0 at the tip.
    float edge = 1.0 - vAlong;
    if (across > edge + aaw) discard;
    c = across > edge - 0.3 ? rimC : band;
    a = clamp((edge - across) / aaw + 0.5, 0.0, 1.0);
  } else {
    c = across > 0.7 ? rimC : band;
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
