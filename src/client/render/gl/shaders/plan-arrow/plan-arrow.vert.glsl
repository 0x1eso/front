#version 300 es
precision highp float;

// World War 1936 P2 plan arrows and move paths (spec §15.2): one instance
// per straight piece of a curved band, its arrow head or a dotted path leg.
layout(location = 0) in vec2 aPos;
// p0 (x, y), p1 (x, y) in tile coords (cell corners; +0.5 below)
layout(location = 1) in vec4 aA;
// arc length at p0 (tiles), unused, style (0 band, 1 flowing band, 2 head, 3 dots), width px
layout(location = 2) in vec4 aB;
// alpha, unused, from the token (1: p0 = uStart), unused
layout(location = 3) in vec4 aC;

uniform mat3 uCamera;
uniform float uTilesPerPx;
// The chosen army's token this frame (it glides while moving).
uniform vec2 uStart;

out vec2 vAcross;
out float vAlong;
out float vArc;
flat out vec4 vB;
flat out float vAlpha;

void main() {
  vec2 p0 = aC.z > 0.5 ? uStart : aA.xy;
  vec2 p1 = aA.zw;
  vec2 d = p1 - p0;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float style = aB.z;
  float width = aB.w * uTilesPerPx;
  vec2 a;
  vec2 b;
  float half_;
  if (style > 1.5 && style < 2.5) {
    // Head: a triangle from its base p0 to its tip p1.
    a = p0;
    b = p1;
    half_ = width * 1.3;
  } else {
    // Dots keep their ends; bands overlap their neighbours by half a width.
    float ext = style > 2.5 ? 0.0 : width * 0.5;
    a = p0 - dir * ext;
    b = p1 + dir * ext;
    half_ = width * 0.5;
  }
  float v = aPos.y * 2.0 - 1.0;
  vec2 world = mix(a, b, aPos.x) + nrm * v * half_;
  vec3 clip = uCamera * vec3(world + 0.5, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vAcross = vec2(v, 0.0);
  vAlong = aPos.x;
  vArc = aB.x + dot(world - p0, dir);
  vB = aB;
  vAlpha = aC.x;
}
