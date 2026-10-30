// World War 1936 P5 (spec §20.3): the occupation map pass — its table
// bytes, and that it rebuilds and uploads only when what it shows changed.
// Final review M6: its pack and compare touch only the cells' texels, with
// the very uploads (and bytes) of the old full pack and compare.
import { describe, expect, it } from "vitest";
import { resistanceColor } from "../../../src/client/hud/ww1936/EndgameModel";
import {
  OCC_BLINK,
  OCC_HATCH,
  OCC_LEVEL_MAX,
  type OccupationCell,
  OccupationPass,
  packOccupationTable,
} from "../../../src/client/render/gl/passes/OccupationPass";
import {
  FLAG_TEX_SIZE,
  flagIndex,
} from "../../../src/client/render/gl/passes/RegionBorderPass";

/** A WebGL2 context that does nothing but count the calls. */
function fakeGl() {
  const calls = new Map<string, number>();
  const gl = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (typeof k !== "string") return undefined;
        if (/^[A-Z0-9_]+$/.test(k)) return 1;
        return () => {
          calls.set(k, (calls.get(k) ?? 0) + 1);
          return {};
        };
      },
    },
  ) as unknown as WebGL2RenderingContext;
  return { gl, count: (k: string) => calls.get(k) ?? 0 };
}

const cell = (
  region: number,
  over: Partial<OccupationCell> = {},
): OccupationCell => ({
  region,
  rgb: [10, 20, 30],
  level: 36,
  flags: 0,
  ...over,
});

describe("OccupationPass (P5 spec §20.3)", () => {
  it("packs each region's colour, strength and flags", () => {
    const t = packOccupationTable([
      cell(7, { flags: OCC_HATCH | OCC_BLINK }),
      cell(12, { rgb: [200, 100, 50], level: 999 }),
      cell(0),
    ]);
    const at = (r: number) => [
      ...t.subarray(flagIndex(r) * 4, flagIndex(r) * 4 + 4),
    ];
    expect(at(7)).toEqual([10, 20, 30, (36 << 2) | OCC_HATCH | OCC_BLINK]);
    // The strength is clamped; region 0 (no region) is skipped.
    expect(at(12)).toEqual([200, 100, 50, OCC_LEVEL_MAX << 2]);
    expect(at(0)).toEqual([0, 0, 0, 0]);
    expect(at(8)).toEqual([0, 0, 0, 0]);
  });

  it("resistance runs green, yellow, red", () => {
    const [g0, g1] = [resistanceColor(0), resistanceColor(10_000)];
    expect(g0[1]).toBeGreaterThan(g0[0]);
    expect(g1[0]).toBeGreaterThan(g1[1]);
    const mid = resistanceColor(5_000);
    expect(mid[0]).toBeGreaterThan(200);
    expect(mid[1]).toBeGreaterThan(200);
  });

  it("rebuilds the cells only when the key moves, uploads only when a byte changed", () => {
    const { gl, count } = fakeGl();
    let on = false;
    let key = "a";
    let cells = [cell(7)];
    let built = 0;
    const pass = new OccupationPass(gl, new Uint16Array(4), 2, 2, {
      on: () => on,
      key: () => key,
      cells: () => {
        built++;
        return cells;
      },
    });
    // Off: nothing is built or made.
    expect(pass.sync()).toBe(false);
    expect(built).toBe(0);
    on = true;
    expect(pass.sync()).toBe(true);
    expect(built).toBe(1);
    expect(count("texImage2D")).toBe(1);
    // The same key: nothing.
    pass.sync();
    pass.sync();
    expect(built).toBe(1);
    expect(count("texSubImage2D")).toBe(0);
    // A new key with the same cells: rebuilt, not uploaded.
    key = "b";
    pass.sync();
    expect(built).toBe(2);
    expect(count("texSubImage2D")).toBe(0);
    // A changed cell: uploaded once.
    key = "c";
    cells = [cell(7, { flags: OCC_HATCH })];
    pass.sync();
    expect(built).toBe(3);
    expect(count("texSubImage2D")).toBe(1);
    // Off and on again: the key is read afresh, the table is the same.
    on = false;
    pass.sync();
    on = true;
    pass.sync();
    expect(built).toBe(4);
    expect(count("texSubImage2D")).toBe(1);
  });

  it("final review M6: uploads what the old full pack and compare did, byte for byte", () => {
    // The pass before M6: the whole table packed and compared at each key.
    const oldTable = new Uint8Array(FLAG_TEX_SIZE * FLAG_TEX_SIZE * 4);
    const oldSent = new Uint8Array(oldTable.length);
    let oldMade = false;
    const oldUploads: Uint8Array[] = [];
    const oldSync = (cells: readonly OccupationCell[]) => {
      packOccupationTable(cells, oldTable);
      if (oldMade) {
        let same = true;
        for (let i = 0; same && i < oldTable.length; i++) {
          if (oldTable[i] !== oldSent[i]) same = false;
        }
        if (same) return;
      }
      oldSent.set(oldTable);
      oldMade = true;
      oldUploads.push(oldTable.slice());
    };
    // The pass now, its uploads' bytes captured.
    const uploads: Uint8Array[] = [];
    const gl = new Proxy(
      {},
      {
        get: (_t, k) => {
          if (typeof k !== "string") return undefined;
          if (/^[A-Z0-9_]+$/.test(k)) return 1;
          if (k === "texSubImage2D") {
            return (...a: unknown[]) =>
              uploads.push((a[8] as Uint8Array).slice());
          }
          if (k === "texImage2D") {
            return (...a: unknown[]) =>
              uploads.push((a[8] as Uint8Array).slice());
          }
          return () => ({});
        },
      },
    ) as unknown as WebGL2RenderingContext;
    let key = 0;
    let cells: OccupationCell[] = [];
    const pass = new OccupationPass(gl, new Uint16Array(4), 2, 2, {
      on: () => true,
      key: () => String(key),
      cells: () => cells,
    });
    let seed = 7;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return seed % n;
    };
    const regions = [1, 5, 7, 199, 200, 201, 4321, 39_999, 40_000, 0, -3];
    for (let i = 0; i < 400; i++) {
      key++;
      // Often the same cells again (the key moves every tick), sometimes a
      // region more or less, a colour, a level, a flag; duplicates too.
      if (rnd(3) === 0) {
        cells = Array.from({ length: rnd(6) }, () =>
          cell(regions[rnd(regions.length)], {
            rgb: [rnd(3) * 100, rnd(2) * 50, 7],
            level: rnd(80) - 5,
            flags: rnd(4),
          }),
        );
      }
      pass.sync();
      oldSync(cells);
      expect(uploads.length).toBe(oldUploads.length);
    }
    expect(uploads.length).toBeGreaterThan(5);
    const same = (a: Uint8Array, b: Uint8Array) =>
      a.length === b.length && a.every((x, j) => x === b[j]);
    for (let i = 0; i < uploads.length; i++) {
      expect(same(uploads[i], oldUploads[i])).toBe(true);
    }
  });
});
