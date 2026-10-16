#version 300 es
precision highp float;

in vec2 vLocal;

uniform float uAge;  // 0 at the impact .. 1 when the beam is gone

out vec4 fragColor;

void main() {
  float core = 1.0 - smoothstep(0.0, 1.0, abs(vLocal.x));
  float alpha = core * (1.0 - vLocal.y) * (1.0 - uAge) * 0.85;
  if (alpha < 0.01) discard;
  fragColor = vec4(mix(vec3(0.75, 0.9, 1.0), vec3(1.0), core), alpha);
}
