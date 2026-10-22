#version 300 es
precision highp float;

// World War 1936 P5 conference map mode: a stake region's price, centred on
// the region (spec §20.2). One instance per region: its centre tile, the
// price and how many digits it has; the box is font cells of uCellWorld
// world units (screen-constant: the pass scales it by tiles per pixel).

layout(location = 0) in vec2 aCorner; // 0..1
layout(location = 1) in vec4 aInst;   // x, y (centre tile), value, digits

uniform mat3 uCamera;
uniform float uCellWorld;

out vec2 vCell;
flat out int vValue;
flat out int vDigits;

void main() {
  float digits = aInst.w;
  vec2 size = vec2(digits * 4.0 + 1.0, 7.0);
  vec2 local = aCorner * size;
  vec2 world = aInst.xy + vec2(0.5) + (local - size * 0.5) * uCellWorld;
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  vCell = local;
  vValue = int(aInst.z + 0.5);
  vDigits = int(digits + 0.5);
}
