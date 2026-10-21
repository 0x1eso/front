// World War 1936 P5 (spec §20.3): the occupation map pass — its table
// bytes, and that it rebuilds and uploads only when what it shows changed.
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
import { flagIndex } from "../../../src/client/render/gl/passes/RegionBorderPass";

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
});
