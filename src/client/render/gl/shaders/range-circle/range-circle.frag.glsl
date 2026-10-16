#version 300 es
precision highp float;

in vec2 vLocal; // [-1, +1]

uniform float uRadius;
uniform vec3 uColor;
uniform float uOutlineOnly; // 1.0: no fill (0.0, the default, keeps it)

out vec4 fragColor;

void main() {
  float dist = length(vLocal) * (uRadius + 1.0); // world-space distance from center
  float edge = uRadius;

  // Smooth fill: inside the circle at 20% white
  float fill = 1.0 - smoothstep(edge - 0.5, edge + 0.5, dist);

  // Stroke: 1-tile-wide ring at the edge
  float strokeInner = edge - 1.0;
  float strokeOuter = edge;
  float stroke = smoothstep(strokeInner - 0.5, strokeInner + 0.5, dist)
               * (1.0 - smoothstep(strokeOuter - 0.5, strokeOuter + 0.5, dist));

  float alpha = fill * 0.2 * (1.0 - uOutlineOnly) + stroke * 0.5;
  if (alpha < 0.001) discard;

  fragColor = vec4(uColor, alpha);
}
