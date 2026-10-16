#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;

uniform mat3 uCamera;
uniform vec2 uBase;     // silo tile (world tile coords)
uniform float uLength;  // streak path length in tiles, straight up
uniform float uWidth;   // streak width in tiles

out vec2 vLocal;        // x: -1..1 across, y: 0 at the silo .. 1 at the top of the path

void main() {
  vLocal = vec2(aPos.x * 2.0 - 1.0, aPos.y);
  vec2 world = uBase + 0.5 + vec2(vLocal.x * uWidth * 0.5, -aPos.y * uLength);
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
