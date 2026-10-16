"""Draw the expanded-warfare plane atlas (plane-atlas.png).

Three 48x48 cells side by side: Transport Plane, Bomber, Cargo Plane. Each is
a clean top-down silhouette, nose up, so the renderer can rotate it to the
plane's heading. Drawn for this fork; licensed CC BY-SA 4.0 like the rest of
resources/. Grayscale like the unit atlas (the shader tints by owner):
  70 outline, 130 detail (engines, cockpit, bomb bay), 180 body.
Transparent pixels carry the outline shade so linear filtering never darkens
the edge. Drawn at 6x and averaged down for smooth edges. From the repo root:
  python3 -I resources/atlases/src/plane-sprites.py resources/atlases/plane-atlas.png
"""

import sys

from PIL import Image, ImageDraw

CELL = 48
SS = 6
OUTLINE, DETAIL, BODY = 70, 130, 180


def mirrored(points):
    """Right half (x >= 24, listed nose to tail) -> the full outline."""
    left = [(48 - x, y) for x, y in reversed(points)]
    return points + left


def poly(d, points, fill):
    d.polygon([(x * SS, y * SS) for x, y in points], fill=fill)


def shape(d, points):
    """A body polygon with an outline stroke in the outline shade."""
    pts = [(x * SS, y * SS) for x, y in points]
    d.polygon(pts, fill=BODY, outline=OUTLINE, width=int(1.6 * SS))


def blob(d, cx, cy, w, h, fill):
    d.ellipse([(cx - w) * SS, (cy - h) * SS, (cx + w) * SS, (cy + h) * SS], fill=fill)


def rect(d, x0, y0, x1, y1, fill):
    d.rounded_rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], radius=SS, fill=fill)


def transport(d):
    wing = mirrored([(24, 17), (46, 19), (46, 24.5), (24, 26)])
    tail = mirrored([(24, 38), (38, 41), (38, 45), (24, 44)])
    fuselage = mirrored(
        [(24, 2), (26.5, 6), (27.5, 12), (27.5, 32), (26, 41), (24, 46)]
    )
    shape(d, wing)
    shape(d, tail)
    shape(d, fuselage)
    for x in (13, 35):  # engines
        rect(d, x - 2, 15, x + 2, 24, DETAIL)
    blob(d, 24, 9, 2.2, 3, DETAIL)  # cockpit


def bomber(d):
    wing = mirrored([(24, 13), (47, 33), (47, 38), (24, 31)])
    tail = mirrored([(24, 37), (35, 44), (35, 46), (24, 44)])
    fuselage = mirrored([(24, 1), (25.6, 6), (26, 14), (26, 34), (24.8, 44), (24, 46)])
    shape(d, wing)
    shape(d, tail)
    shape(d, fuselage)
    for x in (13, 19, 29, 35):  # engines on the leading edge
        y = 13 + (24 - abs(x - 24)) * 0 + abs(x - 24) * 1.42 - 5
        rect(d, x - 1.5, y, x + 1.5, y + 9, DETAIL)
    rect(d, 22.6, 18, 25.4, 30, DETAIL)  # bomb bay
    blob(d, 24, 8, 1.6, 2.6, DETAIL)


def cargo(d):
    wing = mirrored([(24, 15), (47, 16), (47, 23), (24, 25)])
    tail = mirrored([(24, 39), (40, 40), (40, 44.5), (24, 45)])
    fuselage = mirrored(
        [(24, 2), (28, 6), (29.5, 12), (29.5, 36), (27, 44), (24, 46)]
    )
    shape(d, wing)
    shape(d, tail)
    shape(d, fuselage)
    for x in (9, 16.5, 31.5, 39):  # four engines
        rect(d, x - 1.8, 12, x + 1.8, 21, DETAIL)
    blob(d, 24, 9, 3.2, 3.6, DETAIL)  # flight deck
    rect(d, 20.5, 38, 27.5, 43, DETAIL)  # rear ramp


def main(out):
    atlas = Image.new("L", (CELL * 3, CELL), OUTLINE)
    alpha = Image.new("L", (CELL * 3, CELL), 0)
    for i, draw_plane in enumerate((transport, bomber, cargo)):
        big = Image.new("L", (CELL * SS, CELL * SS), OUTLINE)
        draw_plane(ImageDraw.Draw(big))
        # Silhouette: draw again on black; every shade used is above 0.
        back = Image.new("L", (CELL * SS, CELL * SS), 0)
        draw_plane(ImageDraw.Draw(back))
        mask = back.point(lambda v: 255 if v > 0 else 0)
        small = big.resize((CELL, CELL), Image.BOX)
        small_a = mask.resize((CELL, CELL), Image.BOX)
        atlas.paste(small, (i * CELL, 0))
        alpha.paste(small_a, (i * CELL, 0))
    img = Image.merge("RGBA", (atlas, atlas, atlas, alpha))
    img.save(out)


if __name__ == "__main__":
    main(sys.argv[1])
