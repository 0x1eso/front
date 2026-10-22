#version 300 es
precision highp float;

// World War 1936 P6 mine pattern (spec §15.1): one small square a dot.
layout(location = 0) in vec2 aPos;
// (x, y) tile coords, colour index 0 blue / 1 red, unused, unused
layout(location = 1) in vec4 aA;

uniform mat3 uCamera;
uniform float uTilesPerPx;

flat out float vKind;
out vec2 vLocal;

void main() {
  float size = 3.0 * uTilesPerPx;
  vec2 world = aA.xy + 0.5 + (aPos - 0.5) * size;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vKind = aA.z;
  vLocal = aPos - 0.5;
}
