// ww240: a country's map name sits on its home block, not on the middle of
// the box its colonies span (a civil-war side holding a few colonies had
// its name over the sea).
import {
  homeBlock,
  homeBlockBox,
  type LabelBlockScenario,
} from "@openfront/engine-lib/ww1936/LabelBlock";
import { describe, expect, it } from "vitest";

interface R {
  id: number;
  tiles: number;
  core: boolean;
  vp: number;
  n: number[];
  box: [number, number, number, number];
}

function scenario(rs: R[]): LabelBlockScenario {
  const by = new Map(rs.map((r) => [r.id, r]));
  return {
    landRegions: rs,
    region: (id) => by.get(id),
    regionNeighbours: (id) => by.get(id)?.n ?? [],
    bbox: (id) => by.get(id)?.box ?? [-1, -1, -1, -1],
  };
}

// 1-2: a homeland pair (Paris and Lyon); 3: an island of the homeland
// (Corsica); 4-5: a big colony block (North Africa), far to the south.
const MAP = scenario([
  { id: 1, tiles: 40, core: true, vp: 10, n: [2], box: [100, 100, 110, 110] },
  { id: 2, tiles: 60, core: true, vp: 3, n: [1], box: [100, 111, 115, 125] },
  { id: 3, tiles: 20, core: true, vp: 1, n: [], box: [140, 150, 145, 156] },
  { id: 4, tiles: 900, core: false, vp: 5, n: [5], box: [60, 220, 160, 300] },
  { id: 5, tiles: 700, core: false, vp: 4, n: [4], box: [161, 220, 260, 300] },
]);

describe("ww240: the home block (the map name's box)", () => {
  it("the block with the most homeland points, not the colonies' span", () => {
    const ctl = [0, 7, 7, 7, 7, 7];
    expect(homeBlock(MAP, ctl, 7)).toEqual([1, 2]);
    expect(homeBlockBox(MAP, ctl, 7)).toEqual({
      minX: 100,
      minY: 100,
      maxX: 115,
      maxY: 125,
    });
  });

  it("a side holding an island of the homeland and colonies: the island", () => {
    // The live case: the rebels hold Corsica and North Africa.
    const ctl = [0, 1, 1, 9, 9, 9];
    expect(homeBlock(MAP, ctl, 9)).toEqual([3]);
  });

  it("only colonies: the block with the most tiles; nothing held: no box", () => {
    const colonies = [0, 1, 1, 1, 4, 4];
    expect(homeBlock(MAP, colonies, 4)).toEqual([4, 5]);
    expect(homeBlockBox(MAP, colonies, 6)).toBeNull();
  });
});
