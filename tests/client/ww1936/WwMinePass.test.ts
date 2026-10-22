// World War 1936 P6 (plan Task 14): the mine pattern's dots — density
// mines / 200,000 per tile, mine blue, a known enemy's red, an unknown one hidden.
import { describe, expect, it } from "vitest";
import {
  dotCount,
  mineInstances,
  mineVisibility,
  type MineSamples,
} from "../../../src/client/render/gl/passes/WwMinePass";

const samples: MineSamples = {
  bySr: new Map([
    [7, { area: 100_000, tiles: Uint32Array.from([5, 12, 30, 41]) }],
  ]),
};

describe("WwMinePass", () => {
  it("the dot count follows mines / 200,000 per tile", () => {
    expect(dotCount(100, 100_000, 400)).toBe(50);
    expect(dotCount(0, 100_000, 400)).toBe(0);
    expect(dotCount(1000, 100_000_000, 3)).toBe(3);
  });

  it("mine dots are blue, a known enemy's red, an unknown one's hidden", () => {
    const out = new Float32Array(64);
    const n = mineInstances(
      samples,
      [
        [7, 1, 2_000],
        [7, 2, 2_000],
        [7, 3, 2_000],
      ],
      10,
      (owner) => (owner === 1 ? 0 : owner === 2 ? 1 : -1),
      out,
    );
    // 2000 * 100000 / 200000 = 1000 → capped by the 4 samples, twice.
    expect(n).toBe(8);
    expect(out[2]).toBe(0);
    expect(out[4 * 4 + 2]).toBe(1);
    expect([out[0], out[1]]).toEqual([5, 0]);
  });

  it("without an intel row no enemy mine shows; a spectator sees all", () => {
    expect(mineVisibility(2, 1, undefined, false)).toBe(-1);
    expect(mineVisibility(2, 1, undefined, true)).toBe(1);
    expect(mineVisibility(1, 1, undefined, false)).toBe(0);
    const row = new Uint8Array(12);
    row[2 * 4 + 2] = 60;
    expect(mineVisibility(2, 1, row, false)).toBe(1);
    row[2 * 4 + 2] = 30;
    expect(mineVisibility(2, 1, row, false)).toBe(-1);
  });
});
