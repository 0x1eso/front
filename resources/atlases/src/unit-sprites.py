"""Append the expanded-warfare plane sprites to unit-atlas.png.

Columns 12-15 (13x13 px each): Transport Plane, Bomber, Cargo Plane, and the strategic weapons' Conventional Missile (the
order of UNIT_ORDER in src/client/render/gl/passes/UnitPass.ts). Barrage
shells reuse the Shell cell. Drawn for this fork; licensed CC BY-SA 4.0
like the rest of resources/. Grayscale like the original cells (the shader
tints them by owner):
  . transparent, a 70, b 100, c 130, d 180, e 255.
The first twelve cells (156 px) are kept byte for byte, so the script can
be re-run. From the repo root:
  python3 -I resources/atlases/src/unit-sprites.py resources/atlases/unit-atlas.png
"""

import sys

from PIL import Image

CELL = 13
ORIGINAL_COLUMNS = 12
SHADES = {"a": 70, "b": 100, "c": 130, "d": 180, "e": 255}

TRANSPORT_PLANE = [
    "......d......",
    ".....ddd.....",
    ".....dad.....",
    ".....dad.....",
    "ddddddadddddd",
    "dccccdadccccd",
    "ddddddadddddd",
    ".....dad.....",
    ".....dad.....",
    ".....dad.....",
    "...ddddddd...",
    "...dcccccd...",
    "...ddddddd...",
]

BOMBER = [
    "......c......",
    ".....cac.....",
    ".....cac.....",
    "....ccacc....",
    "...cccaccc...",
    "..ccccacccc..",
    ".cccccaccccc.",
    "ccccc.a.ccccc",
    "cc...cac...cc",
    ".....cac.....",
    "....ccacc....",
    "...cc.a.cc...",
    ".............",
]

CARGO_PLANE = [
    ".............",
    "......e......",
    ".....ded.....",
    ".....ded.....",
    "..ddddedddd..",
    ".....ded.....",
    ".....ded.....",
    ".....ded.....",
    "....ddedd....",
    ".............",
    ".............",
    ".............",
    ".............",
]

CONVENTIONAL_MISSILE = [
    "......e......",
    ".....ded.....",
    ".....ddd.....",
    ".....dcd.....",
    ".....dcd.....",
    ".....dcd.....",
    ".....dcd.....",
    ".....dcd.....",
    "....ddcdd....",
    "...dd.c.dd...",
    "...d..c..d...",
    "......b......",
    ".............",
]

SPRITES = [TRANSPORT_PLANE, BOMBER, CARGO_PLANE, CONVENTIONAL_MISSILE]


def cell(rows):
    assert len(rows) == CELL, "a sprite has 13 rows"
    img = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        assert len(row) == CELL, f"row {y} has 13 columns: {row!r}"
        assert row == row[::-1], f"row {y} is left-right symmetric: {row!r}"
        for x, ch in enumerate(row):
            if ch != ".":
                v = SHADES[ch]
                img.putpixel((x, y), (v, v, v, 255))
    return img


def main(path):
    atlas = Image.open(path).convert("RGBA")
    width = (ORIGINAL_COLUMNS + len(SPRITES)) * CELL
    out = Image.new("RGBA", (width, CELL), (0, 0, 0, 0))
    out.paste(atlas.crop((0, 0, ORIGINAL_COLUMNS * CELL, CELL)), (0, 0))
    for i, rows in enumerate(SPRITES):
        out.paste(cell(rows), ((ORIGINAL_COLUMNS + i) * CELL, 0))
    out.save(path, optimize=True)


if __name__ == "__main__":
    main(sys.argv[1])
