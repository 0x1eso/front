#version 300 es
precision highp float;

// World War 1936 P2 battle markers (spec §15.2), one instance each; ww7
// adds two kinds of marker on the same quad: the band chip of a region
// being taken band by band (outside a battle) and the odds badge of a zone
// region of the chosen army's plan.
layout(location = 0) in vec2 aPos;
// (x, y) tile coords of the region's center, attacker (taker), defender (holder)
layout(location = 1) in vec4 aA;
// progress ‰, LOD (2: a point), kind (0 battle, 1 band chip, 2 odds badge),
// odds level (0 low, 1 medium, 2 high)
layout(location = 2) in vec4 aB;
// bands the region has, bands fallen, 1 while a battle fights the next band, unused
layout(location = 3) in vec4 aC;

uniform mat3 uCamera;
uniform float uTilesPerPx;

out vec2 vLocal;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;

void main() {
  bool point = aB.y > 1.5;
  vec4 ext;
  if (aB.z < 0.5) {
    // Battle: swords over the progress bar and, below it, the band bar.
    ext = point ? vec4(-6.0, -6.0, 6.0, 6.0) : vec4(-14.0, -13.0, 14.0, 28.0);
  } else if (aB.z < 1.5) {
    // Band chip: below the token that stands in the region.
    ext = vec4(-14.0, 29.0, 14.0, 37.0);
  } else {
    // Odds badge: a pill above the token, a dot when zoomed out.
    ext = point ? vec4(-5.0, -17.0, 5.0, -7.0) : vec4(-22.0, -40.0, 22.0, -24.0);
  }
  vec2 px = mix(ext.xy, ext.zw, aPos);
  vec2 world = aA.xy + 0.5 + px * uTilesPerPx;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vLocal = px;
  vA = aA;
  vB = aB;
  vC = aC;
}
