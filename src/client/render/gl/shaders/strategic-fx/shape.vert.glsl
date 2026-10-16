#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;

uniform mat3 uCamera;
uniform vec2 uCenter;  // world tile coords
uniform float uHalf;   // half the quad size, in tiles

out vec2 vLocal;      // [-1, +1]

void main() {
  vLocal = aPos * 2.0 - 1.0;
  vec2 world = uCenter + 0.5 + vLocal * uHalf;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
