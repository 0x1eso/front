#version 300 es
precision highp float;

in vec2 vLocal;

uniform float uAge;    // 0 at launch .. 1 when gone
uniform vec3 uColor;

out vec4 fragColor;

void main() {
  float head = 1.0 - pow(1.0 - uAge, 2.0);   // fast off the pad, easing out
  float tail = 0.3;
  float along = (vLocal.y - (head - tail)) / tail;
  if (along < 0.0 || vLocal.y > head) discard;
  float core = 1.0 - smoothstep(0.0, 1.0, abs(vLocal.x));
  float alpha = core * along * (1.0 - uAge * uAge) * 0.9;
  if (alpha < 0.01) discard;
  fragColor = vec4(mix(uColor, vec3(1.0), core * 0.6), alpha);
}
