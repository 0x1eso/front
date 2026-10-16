#version 300 es
precision highp float;

in vec2 vTrail;
flat in float vAlpha;

out vec4 fragColor;

void main() {
  float across = 1.0 - smoothstep(0.0, 1.0, abs(vTrail.x));
  float along = pow(1.0 - vTrail.y, 1.6);
  float a = across * along * 0.5 * vAlpha;
  if (a < 0.01) discard;
  fragColor = vec4(1.0, 1.0, 1.0, a);
}
