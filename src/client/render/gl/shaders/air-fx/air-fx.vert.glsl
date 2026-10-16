#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;

uniform mat3 uCamera;
uniform vec2 uCenter;  // world tile coords
uniform float uHalf;   // half the quad size, in tiles
uniform float uAngle;  // rotation, radians clockwise

out vec2 vLocal;       // [-1, +1], rotated with the quad (nose / canopy up)

void main() {
  vLocal = aPos * 2.0 - 1.0;
  float c = cos(uAngle);
  float s = sin(uAngle);
  vec2 l = vLocal * uHalf;
  vec2 world = uCenter + 0.5 + vec2(l.x * c - l.y * s, l.x * s + l.y * c);
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
