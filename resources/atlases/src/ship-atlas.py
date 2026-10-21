#!/usr/bin/env python3
"""Writes the World War 1936 P4 ship atlas as SVG (16 x 2 cells of 64 px):
white ship silhouettes, mission and state icons, check, cross and digits,
each with a dark rim. Drawn for this fork from scratch: no ensigns, no
insignia, no national marks (P4 spec §22). Cell order:
resources/atlases/ship-atlas-meta.json.

    python3 resources/atlases/src/ship-atlas.py resources/atlases/src/ship-atlas.svg
    rsvg-convert resources/atlases/src/ship-atlas.svg -o resources/atlases/ship-atlas.png
"""
import sys

CELL = 64
COLS = 16
ROWS = 2
OUT = "rgba(0,0,0,0.85)"
W = "#ffffff"

cells = {}


def cell(i, body):
    cells[i] = body


def stroke_pair(d, width, cap="round", join="round"):
    """A path stroked white over a dark rim."""
    return (
        f'<path d="{d}" fill="none" stroke="{OUT}" stroke-width="{width + 5}" '
        f'stroke-linecap="{cap}" stroke-linejoin="{join}"/>'
        f'<path d="{d}" fill="none" stroke="{W}" stroke-width="{width}" '
        f'stroke-linecap="{cap}" stroke-linejoin="{join}"/>'
    )


def solid(d, rim=3.0):
    """A white shape with a dark rim (rim painted under the fill)."""
    return (
        f'<path d="{d}" fill="{OUT}" stroke="{OUT}" stroke-width="{rim}" '
        f'stroke-linejoin="round"/>'
        f'<path d="{d}" fill="{W}"/>'
    )


def ship(parts):
    """Several white parts merged under one dark rim."""
    rim = "".join(
        f'<path d="{d}" fill="{OUT}" stroke="{OUT}" stroke-width="3.2" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        for d in parts
    )
    fill = "".join(f'<path d="{d}" fill="{W}"/>' for d in parts)
    return rim + fill


def rect(x, y, w, h):
    return f"M{x},{y} h{w} v{h} h{-w} Z"


def barrel(x0, y0, x1, y1, t=1.6):
    # A thin gun barrel as a closed quad.
    return f"M{x0},{y0 - t / 2} L{x1},{y1 - t / 2} L{x1},{y1 + t / 2} L{x0},{y0 + t / 2} Z"


# ---- Row 0: ships (bow to the right), the plane glyph, mission and state icons ----

# 0 battleship: long hull, two forward turrets, tower, funnel, aft turret.
cell(
    0,
    ship(
        [
            "M2,38 L60,35.5 L63,34 L58.5,44 L7,44 L2.5,41 Z",
            rect(46, 32, 6, 4),
            barrel(52, 33, 59, 32.2),
            rect(38, 29.5, 6, 6),
            barrel(44, 31, 51, 30),
            "M28,36 L28,24 L30,24 L30,15 L32,15 L32,24 L35,24 L35,36 Z",
            rect(21, 25, 5, 11),
            rect(13, 32, 6, 4.5),
            barrel(13, 33.2, 6, 32.4),
            rect(16, 21, 1.4, 12),
        ]
    ),
)

# 1 carrier: flat deck over a hull, island to starboard (right of middle).
cell(
    1,
    ship(
        [
            "M1,31 L63,31 L63,34 L1,34 Z",
            "M6,34 L59,34 L56,44 L10,44 Z",
            "M41,31 L41,22 L44,22 L44,17 L45.5,17 L45.5,22 L48,22 L48,31 Z",
        ]
    ),
)

# 2 cruiser: shorter, two forward turrets, two funnels, a mast, aft turret.
cell(
    2,
    ship(
        [
            "M5,38 L57,36 L61,35 L56.5,43.5 L9,43.5 L5,41 Z",
            rect(45, 33, 5, 3.5),
            barrel(50, 34, 56, 33.4),
            rect(38, 31, 5, 5),
            barrel(43, 32.3, 48, 31.6),
            "M30,36 L30,26 L32,26 L32,19 L33.4,19 L33.4,26 L36,26 L36,36 Z",
            rect(24, 27, 3.5, 9),
            rect(19, 28, 3.5, 8),
            rect(11, 33, 5, 3.5),
            barrel(11, 34, 6.5, 33.4),
        ]
    ),
)

# 3 destroyer: low, slim, a small bridge, two thin funnels, small guns.
cell(
    3,
    ship(
        [
            "M3,39.5 L59,38 L63,37 L58,43.5 L7,43.5 L3,42 Z",
            rect(48, 35.5, 3.5, 2.5),
            barrel(51.5, 36.5, 56, 36.2, 1.3),
            "M38,38 L38,31 L40,31 L40,25 L41.3,25 L41.3,31 L43,31 L43,38 Z",
            rect(30, 31.5, 3, 6.5),
            rect(24, 32.5, 3, 5.5),
            rect(12, 36, 3.5, 2.5),
            barrel(12, 37, 7.5, 36.6, 1.3),
        ]
    ),
)

# 4 submarine: a cigar at the waterline, the conning tower, a periscope.
cell(
    4,
    ship(
        [
            "M4,40 Q8,35.5 30,35.5 L52,35.8 Q61,37 61,40 Q58,43.6 30,43.8 Q8,43.6 4,40 Z",
            "M27,36 L28.5,29 L37,29 L38.5,36 Z",
            rect(33, 23, 1.3, 6.5),
        ]
    ),
)

# 5 merchant: raised bow and stern, a central bridge and funnel, cargo masts.
cell(
    5,
    ship(
        [
            "M5,34 L14,34 L14,37 L48,37 L48,33.5 L60,33 L56.5,44 L9,44 L5,40 Z",
            "M27,37 L27,30 L37,30 L37,37 Z",
            rect(30.5, 24, 4, 6),
            rect(19, 24, 1.4, 13),
            rect(43, 24, 1.4, 13),
            barrel(20, 25.5, 26, 30.5, 1.1),
            barrel(42.6, 25.5, 37.5, 30.5, 1.1),
        ]
    ),
)

# 6 plane glyph (✈, top view, nose up).
cell(
    6,
    solid(
        "M32,6 Q35,6 35,12 L35,25 L56,35 L56,40 L35,35 L34.5,48 L42,53 L42,57 "
        "L32,55 L22,57 L22,53 L29.5,48 L29,35 L8,40 L8,35 L29,25 L29,12 Q29,6 32,6 Z",
        3.5,
    ),
)

# 7 patrol: an eye.
cell(
    7,
    stroke_pair("M7,32 Q32,9 57,32 Q32,55 7,32 Z", 4.5)
    + f'<circle cx="32" cy="32" r="9.5" fill="{OUT}"/><circle cx="32" cy="32" r="7" fill="{W}"/>',
)

# 8 strike: a sword (blade, guard, grip, pommel).
cell(
    8,
    stroke_pair("M46,11 L20,44", 5.5, cap="butt")
    + stroke_pair("M46,11 L50,7", 2.5)
    + stroke_pair("M13,37 L27,51", 4.5)
    + stroke_pair("M20,44 L12,54", 5)
    + f'<circle cx="11" cy="55.5" r="5" fill="{OUT}"/><circle cx="11" cy="55.5" r="3" fill="{W}"/>',
)

# 9 raid: a torpedo with tail fins and a wake.
cell(
    9,
    solid(
        "M14,28 L48,28 Q58,28 58,32 Q58,36 48,36 L14,36 Z", 3.5
    )
    + solid("M14,28 L8,22 L8,42 L14,36 Z", 3)
    + stroke_pair("M4,48 Q12,44 20,48 Q28,52 36,48", 3),
)

# 10 escort: a shield.
cell(
    10,
    stroke_pair("M32,7 L52,13 L52,30 Q52,47 32,57 Q12,47 12,30 L12,13 Z", 5)
    + stroke_pair("M32,17 L32,47", 3.5),
)

# 11 invasion support: an anchor.
cell(
    11,
    stroke_pair("M32,17 L32,54", 5)
    + stroke_pair("M21,24 L43,24", 4.5)
    + stroke_pair("M12,38 Q15,53 32,54 Q49,53 52,38", 5)
    + stroke_pair("M12,38 L8,43 M12,38 L17,41 M52,38 L56,43 M52,38 L47,41", 3.5)
    + f'<circle cx="32" cy="12" r="6.5" fill="{OUT}"/><circle cx="32" cy="12" r="3.6" fill="{W}"/>',
)

# 12 training: a plain pennant on a pole (no national pattern).
cell(
    12,
    stroke_pair("M16,8 L16,58", 4.5)
    + solid("M18,10 L52,21 L18,32 Z", 3.5),
)

# 13 battle: two crossed anchors.
def anchor_path():
    return (
        "M0,-19 L0,21 M-7,-13 L7,-13 M-11,11 Q-9,21 0,21 Q9,21 11,11"
    )


cell(
    13,
    f'<g transform="translate(32,31) rotate(-38)">{stroke_pair(anchor_path(), 4)}</g>'
    f'<g transform="translate(32,31) rotate(38)">{stroke_pair(anchor_path(), 4)}</g>',
)

# 14 repairing: a wrench.
cell(
    14,
    solid(
        "M42,8 A12,12 0 1 0 54,24 L47,24 L42,19 L42,12 Z M38,24 L13,49 "
        "Q10,52 13,55 Q16,58 19,55 L44,30 Z",
        3.5,
    ),
)

# 15 low fuel: a red dot.
cell(
    15,
    f'<circle cx="32" cy="32" r="15" fill="{OUT}"/>'
    f'<circle cx="32" cy="32" r="12.5" fill="#e3261b"/>',
)

# ---- Row 1: check, cross, digits 0-9 ----

cell(16, stroke_pair("M14,34 L27,47 L50,17", 7))
cell(17, stroke_pair("M17,17 L47,47 M47,17 L17,47", 7))

DIGITS = [
    "M32,11 A13,21 0 1 1 31.9,11 Z",
    "M24,18 L33,11 L33,53",
    "M20,21 A12,11 0 1 1 42,25 Q38,33 20,53 L45,53",
    "M20,12 L44,12 L30,28 A13,12.5 0 1 1 19,47",
    "M38,53 L38,11 L18,40 L46,40",
    "M43,11 L23,11 L21,30 A13,12 0 1 1 19,49",
    "M41,11 Q23,19 20,40 A12.5,12.5 0 1 0 45,40 A12.5,12.5 0 1 0 20,40",
    "M19,11 L45,11 L28,53",
    "M32,11 A9.5,9.5 0 1 1 31.9,11 Z M32,30 A11.5,11.5 0 1 1 31.9,30 Z",
    "M23,53 Q41,45 44,24 A12.5,12.5 0 1 0 19,24 A12.5,12.5 0 1 0 44,24",
]
for n, d in enumerate(DIGITS):
    cell(18 + n, stroke_pair(d, 7))


def main(path):
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CELL * COLS}" '
        f'height="{CELL * ROWS}" viewBox="0 0 {CELL * COLS} {CELL * ROWS}">',
        "<!-- World War 1936 ship atlas: drawn for this fork (CC BY-SA 4.0). "
        "No ensigns or national marks. Cells 64 px, 16 a row. -->",
    ]
    for i in sorted(cells):
        x = (i % COLS) * CELL
        y = (i // COLS) * CELL
        parts.append(f'<g transform="translate({x},{y})">{cells[i]}</g>')
    parts.append("</svg>")
    with open(path, "w") as f:
        f.write("\n".join(parts) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
