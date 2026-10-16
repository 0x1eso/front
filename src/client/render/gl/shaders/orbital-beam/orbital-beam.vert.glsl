#version 300 es
precision highp float;

// Unit quad [0,1]
layout(location = 0) in vec2 aPos;

uniform mat3 uCamera;
uniform vec2 uBase;     // impact tile (world tile coords)
uniform float uLength;  // beam length in tiles, up from the impact
uniform float uWidth;   // beam width in tiles

out vec2 vLocal;        // x: -1..1 across the beam, y: 0 at the impact .. 1 at the top

void main() {
  vLocal = vec2(aPos.x * 2.0 - 1.0, aPos.y);
  vec2 world = uBase + 0.5 + vec2(vLocal.x * uWidth * 0.5, -aPos.y * uLength);
  vec3 clip = uCamera * vec3(world, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
