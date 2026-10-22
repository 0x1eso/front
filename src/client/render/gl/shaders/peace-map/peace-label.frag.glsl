#version 300 es
precision highp float;
precision highp int;

// The price digits: a dark box, white 3 × 5 digits (uFont: bit row × 3 +
// column, column 0 on the left, row 0 on top), one cell of padding.

in vec2 vCell;
flat in int vValue;
flat in int vDigits;

uniform int uFont[10];
uniform float uAlpha;

out vec4 fragColor;

void main() {
  int cx = int(floor(vCell.x));
  int cy = int(floor(vCell.y));
  vec4 col = vec4(0.06, 0.07, 0.09, 0.82);
  int gx = cx - 1;
  int gy = cy - 1;
  if (gx >= 0 && gy >= 0 && gy < 5) {
    int di = gx / 4;
    int c = gx - di * 4;
    if (di < vDigits && c < 3) {
      int p = 1;
      for (int k = 0; k < 3; k++) {
        if (k < vDigits - 1 - di) p *= 10;
      }
      int d = (vValue / p) % 10;
      if (((uFont[d] >> (gy * 3 + c)) & 1) == 1) col = vec4(1.0, 1.0, 1.0, 1.0);
    }
  }
  fragColor = vec4(col.rgb, col.a * uAlpha);
}
