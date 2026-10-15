/**
 * Structure icon atlas (resources/atlases/icon-atlas.png) and the passes that
 * index it.
 *
 * The atlas has one 64×64 cell per STRUCTURE_ATLAS_ORDER entry. The first six
 * cells came from an upstream generator that isn't in this repo, so they must
 * stay byte-identical; the domestic structures (Research Institute, Admin
 * Office) are appended as cells 7 and 8 and must get their own columns rather
 * than borrowing City / Defense Post.
 *
 * The passes run their real constructors against a WebGL2 stand-in that
 * records the calls the tests read back (instance uploads, uniform arrays).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { preloadAtlasData } from "../../../../src/client/render/gl/passes/name-pass/AtlasData";
import { StructureLevelPass } from "../../../../src/client/render/gl/passes/StructureLevelPass";
import { StructurePass } from "../../../../src/client/render/gl/passes/StructurePass";
import { createRenderSettings } from "../../../../src/client/render/gl/RenderSettings";
import type {
  RendererConfig,
  UnitState,
} from "../../../../src/client/render/types";
import {
  ALL_UNIT_TYPES,
  STRUCTURE_ATLAS_ORDER,
  UT_ADMIN_OFFICE,
  UT_CITY,
  UT_DEFENSE_POST,
  UT_RESEARCH_INSTITUTE,
  UT_WARSHIP,
} from "../../../../src/client/render/types";

const ATLAS_PATH = "resources/atlases/icon-atlas.png";
const CELL = 64;
const ORIGINAL_CELLS = 6;
/**
 * sha256 of the original 384×64 atlas's RGBA pixels (row-major), taken before
 * the domestic cells were appended. Same as
 * `magick icon-atlas.png -crop 384x64+0+0 +repage -depth 8 rgba:- | sha256sum`.
 */
const ORIGINAL_CELLS_SHA256 =
  "fba8a4dd261f54b78042add715011bfcb64b6724900663d8e641bc80a51d66b5";

// ---------------------------------------------------------------------------
// Minimal PNG decoder (8-bit RGBA, non-interlaced — what the atlas uses)
// ---------------------------------------------------------------------------

interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8Array;
}

function decodePng(buf: Buffer): DecodedPng {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(signature)) throw new Error("not a PNG");
  let ihdr: Buffer | null = null;
  const idat: Buffer[] = [];
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (ihdr === null) throw new Error("PNG has no IHDR");
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const [bitDepth, colorType, , , interlace] = ihdr.subarray(8, 13);
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `unsupported PNG: depth ${bitDepth}, color type ${colorType}, interlace ${interlace}`,
    );
  }

  const bpp = 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[row - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[row - stride + x - bpp] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      out[row + x] = (raw[src + x] + pred) & 0xff;
    }
  }
  return { width, height, rgba: out };
}

/** RGBA bytes of atlas columns [first, first + count), row-major. */
function columns(png: DecodedPng, first: number, count: number): Uint8Array {
  if ((first + count) * CELL > png.width) {
    throw new Error(`atlas has no column ${first + count - 1}`);
  }
  const w = count * CELL * 4;
  const out = new Uint8Array(png.height * w);
  for (let y = 0; y < png.height; y++) {
    const start = (y * png.width + first * CELL) * 4;
    out.set(png.rgba.subarray(start, start + w), y * w);
  }
  return out;
}

// ---------------------------------------------------------------------------
// WebGL2 stand-in
// ---------------------------------------------------------------------------

interface FakeGL {
  gl: WebGL2RenderingContext;
  /** Arrays passed to bufferSubData, in call order. */
  uploads: Float32Array[];
  /** Last value passed to uniform1fv, by uniform name. */
  uniformArrays: Map<string, Float32Array>;
}

/**
 * Every GL enum reads as 0 and every other method returns a truthy object, so
 * shader compile/link checks pass. getUniformLocation returns {name} so
 * uniform uploads can be read back by name.
 */
function fakeGL(): FakeGL {
  const uploads: Float32Array[] = [];
  const uniformArrays = new Map<string, Float32Array>();
  const overrides: Record<string, unknown> = {
    getUniformLocation: (_program: unknown, name: string) => ({ name }),
    bufferSubData: (_target: number, _offset: number, data: Float32Array) => {
      uploads.push(data.slice());
    },
    uniform1fv: (loc: { name: string }, data: Float32Array) => {
      uniformArrays.set(loc.name, data.slice());
    },
  };
  const gl = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== "string") return undefined;
        if (prop in overrides) return overrides[prop];
        if (/^[A-Z0-9_]+$/.test(prop)) return 0;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, uploads, uniformArrays };
}

const header: RendererConfig = {
  mapWidth: 100,
  mapHeight: 100,
  unitTypes: [...ALL_UNIT_TYPES],
  players: [],
};

function unit(id: number, unitType: string, level = 1): UnitState {
  return {
    id,
    unitType,
    ownerID: 1,
    lastOwnerID: null,
    pos: id,
    lastPos: id,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: true,
    waitTicks: 0,
    markedForDeletion: false,
    health: null,
    underConstruction: false,
    targetUnitId: null,
    targetTile: null,
    troops: 0,
    missileTimerQueue: [],
    level,
    veterancy: 0,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    constructionStartTick: null,
    samUpgradeStartTick: null,
    samUpgradeStartRange: null,
    samUpgradeTargetLevel: null,
    samUpgradeDuration: null,
  };
}

/** One unit per given type, ids 1..n, so map order = types order. */
function unitsOf(types: readonly string[], level = 1): Map<number, UnitState> {
  return new Map(types.map((t, i) => [i + 1, unit(i + 1, t, level)]));
}

/** Atlas column (float 4 of each `stride`-float instance) in the last upload. */
function uploadedColumns(
  uploads: Float32Array[],
  stride: number,
  count: number,
): number[] {
  const data = uploads[uploads.length - 1];
  return Array.from({ length: count }, (_, i) => data[i * stride + 4]);
}

// jsdom's <img> has no decode(); the passes start loading their atlases in
// the constructor. Leave the load pending — these tests don't need pixels.
// StructureLevelPass also needs the MSDF font metrics, fetched at game load:
// serve the real file from disk.
let hadDecode = false;
beforeAll(async () => {
  hadDecode = "decode" in HTMLImageElement.prototype;
  if (!hadDecode) {
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () => new Promise<void>(() => {}),
    });
  }
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    status: 200,
    json: async () =>
      JSON.parse(readFileSync("resources/atlases/msdf-atlas.json", "utf8")),
  }));
  await preloadAtlasData();
});
afterAll(() => {
  vi.unstubAllGlobals();
  if (!hadDecode) {
    delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("icon-atlas.png", () => {
  const png = decodePng(readFileSync(ATLAS_PATH));

  it("has one 64×64 cell per structure in STRUCTURE_ATLAS_ORDER (512×64)", () => {
    expect(png.width).toBe(512);
    expect(png.height).toBe(CELL);
    expect(png.width / CELL).toBe(STRUCTURE_ATLAS_ORDER.length);
  });

  it("keeps the original six cells byte-identical", () => {
    const hash = createHash("sha256")
      .update(columns(png, 0, ORIGINAL_CELLS))
      .digest("hex");
    expect(hash).toBe(ORIGINAL_CELLS_SHA256);
  });

  it("draws a white glyph on transparency in each new cell, unlike any other cell", () => {
    const cells = STRUCTURE_ATLAS_ORDER.map((_, i) => columns(png, i, 1));
    for (const col of [6, 7]) {
      const cell = cells[col];
      let covered = 0;
      for (let p = 0; p < cell.length; p += 4) {
        const alpha = cell[p + 3];
        if (alpha === 0) continue;
        covered += alpha / 255;
        // Glyphs are pure white; the shader tints them via alpha only.
        expect([cell[p], cell[p + 1], cell[p + 2]]).toEqual([255, 255, 255]);
      }
      // Same visual weight band as the original glyphs (missile ≈ 9%,
      // factory ≈ 27% of the cell).
      const coverage = covered / (CELL * CELL);
      expect(coverage).toBeGreaterThan(0.08);
      expect(coverage).toBeLessThan(0.3);
      // An 8px transparent margin, like the original cells.
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          if (x >= 8 && x < 56 && y >= 8 && y < 56) continue;
          expect(cell[(y * CELL + x) * 4 + 3]).toBe(0);
        }
      }
      for (let other = 0; other < cells.length; other++) {
        if (other === col) continue;
        expect(Buffer.from(cell).equals(Buffer.from(cells[other]))).toBe(false);
      }
    }
  });
});

describe("StructurePass atlas columns", () => {
  it("draws Research Institute and Admin Office from their own columns (6 and 7)", () => {
    const { gl, uploads } = fakeGL();
    const pass = new StructurePass(gl, header, {}, {}, createRenderSettings());
    pass.updateStructures(
      unitsOf([
        UT_CITY,
        UT_DEFENSE_POST,
        UT_RESEARCH_INSTITUTE,
        UT_ADMIN_OFFICE,
        UT_WARSHIP, // not a structure: skipped
      ]),
    );
    expect(uploadedColumns(uploads, 6, 4)).toEqual([0, 3, 6, 7]);
  });

  it("highlights Research Institute without highlighting cities", () => {
    const { gl } = fakeGL();
    const pass = new StructurePass(gl, header, {}, {}, createRenderSettings());
    pass.setHighlightTypes([UT_RESEARCH_INSTITUTE]);
    expect((pass as unknown as { highlightMask: number }).highlightMask).toBe(
      1 << 6,
    );
  });

  it("sizes the per-column shape uniforms for every atlas column", () => {
    const { gl, uniformArrays } = fakeGL();
    const settings = createRenderSettings();
    const pass = new StructurePass(gl, header, {}, {}, settings);
    pass.updateStructures(unitsOf([UT_RESEARCH_INSTITUTE]));
    pass.draw(new Float32Array(9), 2);

    const scales = uniformArrays.get("uShapeScales")!;
    const fills = uniformArrays.get("uIconFills")!;
    expect(scales).toHaveLength(STRUCTURE_ATLAS_ORDER.length);
    expect(fills).toHaveLength(STRUCTURE_ATLAS_ORDER.length);
    STRUCTURE_ATLAS_ORDER.forEach((type, col) => {
      const shape = settings.structure.shapes[type];
      expect(shape, `render-settings shapes["${type}"]`).toBeDefined();
      expect(scales[col]).toBeCloseTo(shape.scale);
      expect(fills[col]).toBeCloseTo(shape.iconFill);
    });
  });
});

describe("StructureLevelPass atlas columns", () => {
  it("tags every structure with the same column as StructurePass", () => {
    const structures = unitsOf(STRUCTURE_ATLAS_ORDER, 2); // level 2 → "2" label
    const n = STRUCTURE_ATLAS_ORDER.length;

    const icons = fakeGL();
    new StructurePass(
      icons.gl,
      header,
      {},
      {},
      createRenderSettings(),
    ).updateStructures(structures);

    const levels = fakeGL();
    new StructureLevelPass(
      levels.gl,
      header,
      createRenderSettings(),
    ).updateStructures(structures);

    const expected = STRUCTURE_ATLAS_ORDER.map((_, col) => col);
    expect(uploadedColumns(icons.uploads, 6, n)).toEqual(expected);
    expect(uploadedColumns(levels.uploads, 5, n)).toEqual(expected);
  });
});
