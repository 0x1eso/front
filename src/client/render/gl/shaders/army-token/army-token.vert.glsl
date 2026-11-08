#version 300 es
precision highp float;

// World War 1936 P2 army tokens (spec §15.2), one instance each.
// Unit quad [0,1]
layout(location = 0) in vec2 aPos;
// (x, y) tile coords of the token, kind (0 token, 1 chip, 2 dot, 3 front dots,
// 4 "+N" chip, 5 division counter: a token at 75 %), owner
layout(location = 1) in vec4 aA;
// branch symbol (-1 none), divisions, strength ‰, organisation ‰
layout(location = 2) in vec4 aB;
// state bits (ARMY_*), flags (1 chosen + 2 × (zone hue + 1) + 16 pinned), front dots,
// fog bits (1..7) + 8 × group colour (1..8)
layout(location = 3) in vec4 aC;

uniform mat3 uCamera;
// World tiles per screen (CSS) pixel: tokens keep their size on screen.
uniform float uTilesPerPx;

out vec2 vLocal;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;

void main() {
  float kind = aA.z;
  // Quad extent in screen px around the token's point (y down).
  vec4 ext;
  if (kind < 0.5) ext = vec4(-26.0, -20.0, 26.0, 27.0);
  else if (kind < 1.5) ext = vec4(-22.0, -15.0, 22.0, 20.0);
  else if (kind < 2.5) ext = vec4(-8.0, -8.0, 8.0, 8.0);
  else if (kind < 3.5) ext = vec4(-20.0, -48.0, 20.0, 48.0);
  else if (kind < 4.5) ext = vec4(-16.0, -11.0, 16.0, 11.0);
  else ext = vec4(-26.0, -20.0, 26.0, 27.0) * 0.75; // LandTokenLayout DIVISION_SCALE
  vec2 px = mix(ext.xy, ext.zw, aPos);
  vec2 world = aA.xy + 0.5 + px * uTilesPerPx;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vLocal = px;
  vA = aA;
  vB = aB;
  vC = aC;
}
