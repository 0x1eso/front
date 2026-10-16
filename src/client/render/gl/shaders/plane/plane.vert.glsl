#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;
// Per instance: (centre x, centre y, heading radians, size in tiles)
layout(location = 1) in vec4 aInst;
// Per instance: (atlas column, owner id, alpha, contrail length in tiles)
layout(location = 2) in vec4 aInst2;

uniform mat3 uCamera;
uniform vec2 uShadowOffset;  // world tiles; (0,0) for the plane itself
uniform float uShadowScale;  // 1 for the plane, a little less for its shadow

out vec2 vUV;
flat out float vOwner;
flat out float vAlpha;

void main() {
  float size = aInst.w * uShadowScale;
  vec2 local = (aPos - 0.5) * size;
  float c = cos(aInst.z);
  float s = sin(aInst.z);
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 world = aInst.xy + rotated + uShadowOffset;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vUV = vec2((aInst2.x + aPos.x) / float(PLANE_COLS), aPos.y);
  vOwner = aInst2.y;
  vAlpha = aInst2.z;
}
