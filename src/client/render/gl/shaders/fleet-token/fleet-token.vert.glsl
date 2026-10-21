#version 300 es
precision highp float;

// World War 1936 P4 ship sprites (spec §18.2), one instance each: fleet
// tokens and ship-count chips, text chips ("✈120", ✓/✗), convoy ships and
// rings (invasion preparation, convoy-loss splashes). Sizes are screen px:
// sprites keep their size at every zoom.
// Unit quad [0,1]
layout(location = 0) in vec2 aPos;
// (x, y) tile coords, kind (0 token, 1 chip, 2 text, 3 sprite, 4 ring), owner
layout(location = 1) in vec4 aA;
// token/chip: silhouette cell, ships, HP ‰, organisation ‰
// text: glyph cells 0..3; sprite: cell, flip (-1 mirrored), alpha, size px
// ring: progress 0..1, radius px, style (0 preparing, 1 splash, 2 ready), phase
layout(location = 2) in vec4 aB;
// token/chip: mission cell (-1 none), state bits, flags (1 chosen, 2 docked), unused
// text: glyph cell 4, style (0 dark, 1 green, 2 red, 3 owner), width px, glyphs
layout(location = 3) in vec4 aC;

uniform mat3 uCamera;
// World tiles per screen (CSS) pixel.
uniform float uTilesPerPx;

out vec2 vLocal;
flat out vec4 vA;
flat out vec4 vB;
flat out vec4 vC;

void main() {
  float kind = aA.z;
  vec4 ext;
  float scale = 1.0;
  if (kind < 1.5) {
    ext = kind < 0.5 ? vec4(-31.0, -21.0, 31.0, 21.0)
                     : vec4(-16.0, -11.0, 16.0, 11.0);
    if (mod(floor(aC.z / 2.0), 2.0) > 0.5) scale = DOCKED_SCALE;
  } else if (kind < 2.5) {
    float hw = aC.z * 0.5 + 1.0;
    ext = vec4(-hw, -11.0, hw, 11.0);
  } else if (kind < 3.5) {
    float h = aB.w * 0.5;
    ext = vec4(-h, -h, h, h);
  } else {
    float r = aB.y + 5.0;
    ext = vec4(-r, -r, r, r);
  }
  vec2 px = mix(ext.xy, ext.zw, aPos);
  vec2 world = aA.xy + 0.5 + px * scale * uTilesPerPx;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vLocal = px;
  vA = aA;
  vB = aB;
  vC = aC;
}
