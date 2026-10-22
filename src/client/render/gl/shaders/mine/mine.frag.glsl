#version 300 es
precision highp float;

flat in float vKind;
in vec2 vLocal;
out vec4 fragColor;

void main() {
  float d = length(vLocal);
  if (d > 0.5) discard;
  vec3 c = vKind < 0.5 ? vec3(0.25, 0.55, 1.0) : vec3(0.95, 0.2, 0.2);
  fragColor = vec4(c, d > 0.38 ? 0.55 : 0.95);
}
