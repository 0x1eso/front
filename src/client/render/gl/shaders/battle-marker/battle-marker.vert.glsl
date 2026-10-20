#version 300 es
precision highp float;

// World War 1936 P2 battle markers (spec §15.2), one instance a battle.
layout(location = 0) in vec2 aPos;
// (x, y) tile coords of the defending region's center, attacker, defender
layout(location = 1) in vec4 aA;
// progress ‰, LOD (2: a point), unused, unused
layout(location = 2) in vec4 aB;

uniform mat3 uCamera;
uniform float uTilesPerPx;

out vec2 vLocal;
flat out vec4 vA;
flat out vec4 vB;

void main() {
  vec4 ext = aB.y > 1.5 ? vec4(-6.0, -6.0, 6.0, 6.0)
                        : vec4(-14.0, -13.0, 14.0, 19.0);
  vec2 px = mix(ext.xy, ext.zw, aPos);
  vec2 world = aA.xy + 0.5 + px * uTilesPerPx;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vLocal = px;
  vA = aA;
  vB = aB;
}
