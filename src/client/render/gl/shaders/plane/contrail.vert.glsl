#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;   // x across, y along (0 at the plane)
layout(location = 1) in vec4 aInst;  // (centre x, centre y, heading, plane size)
layout(location = 2) in vec4 aInst2; // (col, owner, alpha, contrail length)

uniform mat3 uCamera;

out vec2 vTrail;
flat out float vAlpha;

void main() {
  float len = aInst2.w;
  float s = sin(aInst.z);
  float c = cos(aInst.z);
  vec2 forward = vec2(s, -c);
  vec2 side = vec2(c, s);
  float width = max(0.9, aInst.w * 0.06) * (1.0 + aPos.y * 1.2);
  vec2 start = aInst.xy - forward * aInst.w * 0.36;
  vec2 world = start - forward * (aPos.y * len) + side * ((aPos.x - 0.5) * width);
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vTrail = vec2(aPos.x * 2.0 - 1.0, aPos.y);
  vAlpha = aInst2.z * step(0.5, len);
}
