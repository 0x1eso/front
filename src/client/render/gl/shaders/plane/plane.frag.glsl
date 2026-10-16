#version 300 es
precision highp float;

uniform sampler2D uPalette;
uniform sampler2D uAtlas;       // plane-atlas.png, linear filtered
uniform sampler2D uAffiliation; // 256x2 RGBA8, row 1 = unit affiliation
uniform int uAltView;
uniform float uShadow;          // 1 = draw the soft ground shadow

in vec2 vUV;
flat in float vOwner;
flat in float vAlpha;

out vec4 fragColor;

void main() {
  vec4 texel = texture(uAtlas, vUV);
  if (texel.a < 0.02) discard;

  if (uShadow > 0.5) {
    fragColor = vec4(0.0, 0.0, 0.0, 0.26 * texel.a * vAlpha);
    return;
  }

  if (uAltView != 0) {
    vec3 ac = texelFetch(uAffiliation, ivec2(int(vOwner), 1), 0).rgb;
    fragColor = vec4(ac, texel.a * vAlpha);
    return;
  }

  float u = (vOwner + 0.5) / float(PALETTE_SIZE);
  vec3 territory = texture(uPalette, vec2(u, 0.25)).rgb;
  vec3 border = texture(uPalette, vec2(u, 0.75)).rgb;
  // Smooth the atlas shades 70 (outline) .. 180 (body) into the owner's
  // border..territory colours, so the rotated sprite stays clean.
  float g = smoothstep(0.30, 0.72, texel.r);
  fragColor = vec4(mix(border, territory, g), texel.a * vAlpha);
}
