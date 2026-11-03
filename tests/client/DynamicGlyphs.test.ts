import { describe, expect, it } from "vitest";
import { buildGlyphTables } from "../../src/client/render/gl/passes/name-pass/AtlasData";
import {
  alphaToField,
  DYN_BASE,
  DYN_CELL,
  DYN_COUNT,
  DynamicGlyphs,
  NAME_CHAR_RANGE,
  type GlyphMetrics,
} from "../../src/client/render/gl/passes/name-pass/DynamicGlyphs";
import { layoutString } from "../../src/client/render/gl/passes/name-pass/TextLayout";
import {
  CHAR_RANGE,
  MAX_CHARS,
} from "../../src/client/render/gl/passes/name-pass/Types";

const HI = DYN_CELL * 2;

/** A filled square of `side` hi-res pixels in the middle of the cell. */
function square(side: number): Uint8Array {
  const a = new Uint8Array(HI * HI);
  const lo = (HI - side) / 2;
  for (let y = lo; y < lo + side; y++)
    for (let x = lo; x < lo + side; x++) a[y * HI + x] = 255;
  return a;
}

function makeGlyphs() {
  const glyph = buildGlyphTables([], NAME_CHAR_RANGE);
  const metrics: GlyphMetrics[] = [];
  const dyn = new DynamicGlyphs(
    glyph,
    1024,
    1024,
    2048,
    (m) => metrics.push(m),
    () => ({ alpha: square(40), advance: 38.4 }),
  );
  return { glyph, metrics, dyn };
}

describe("alphaToField", () => {
  it("is a distance field: 255 deep inside, 0 far outside, about 128 on the edge", () => {
    const f = alphaToField(square(40)); // a 20 px square in cell pixels
    const at = (x: number, y: number) => f[y * DYN_CELL + x];
    expect(at(32, 32)).toBeGreaterThan(230);
    expect(at(2, 2)).toBe(0);
    // The left edge lies at x = 22: a pixel just in and just out straddle 128.
    expect(at(22, 32)).toBeGreaterThan(128);
    expect(at(21, 32)).toBeLessThan(128);
    expect(at(22, 32) - at(21, 32)).toBeLessThan(40);
    // Monotone from outside to inside across the edge.
    for (let x = 14; x < 30; x++)
      expect(at(x + 1, 32)).toBeGreaterThanOrEqual(at(x, 32));
  });
});

describe("DynamicGlyphs", () => {
  it("keeps baked atlas ids, gives other letters one cell each, once", () => {
    const { dyn, metrics, glyph } = makeGlyphs();
    expect(dyn.idFor("A".charCodeAt(0))).toBe(65);
    const han = "한".charCodeAt(0);
    const id = dyn.idFor(han);
    expect(id).toBe(DYN_BASE);
    expect(dyn.idFor(han)).toBe(id);
    expect(dyn.idFor("국".charCodeAt(0))).toBe(DYN_BASE + 1);
    expect(metrics).toHaveLength(2);
    expect(glyph.advance[id]).toBe(38);
    // Cells pack along the baked atlas's bottom edge, 16 to a row.
    expect(metrics[0].v0).toBe(1024 / 2048);
    expect(metrics[1].u0).toBe(DYN_CELL / 1024);
    const cells = dyn.takePending();
    expect(cells.map((c) => [c.x, c.y])).toEqual([
      [0, 1024],
      [DYN_CELL, 1024],
    ]);
    expect(cells[0].pixels).toHaveLength(DYN_CELL * DYN_CELL * 4);
    expect(dyn.takePending()).toHaveLength(0);
  });

  it("draws nothing for a lone surrogate, and for letters past the cells", () => {
    const { dyn } = makeGlyphs();
    expect(dyn.idFor(0xd83d)).toBe(0);
    for (let i = 0; i < DYN_COUNT; i++) {
      expect(dyn.idFor(0x4e00 + i)).toBe(DYN_BASE + i);
    }
    expect(dyn.idFor(0x5000)).toBe(0);
  });

  it("lays out a Hangul name centred, without a kerning lookup past the atlas", () => {
    const { dyn, glyph } = makeGlyphs();
    const kern = new Int8Array(CHAR_RANGE * CHAR_RANGE);
    const ids = new Uint16Array(MAX_CHARS);
    const cursors = new Float32Array(MAX_CHARS);
    const half = layoutString("독일", glyph, kern, ids, cursors, (u) =>
      dyn.idFor(u),
    );
    expect([...ids.slice(0, 3)]).toEqual([DYN_BASE, DYN_BASE + 1, 0]);
    // Two 38 px letters: 76 px wide, centred on 0.
    expect(half).toBe(38);
    expect(cursors[0]).toBe(-38);
    expect(cursors[1]).toBe(0);
  });
});
