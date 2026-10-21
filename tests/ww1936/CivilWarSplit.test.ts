// World War 1936 P5 (spec §15.2, §23.1; plan Task 1 Step 5): the civil
// war's region split, on small hand graphs.
import {
  RegionGraphView,
  splitRegionsForCivilWar,
} from "@openfront/engine-lib/ww1936/EndgameRules";

function graph(edges: [number, number][]): RegionGraphView {
  const adj = new Map<number, number[]>();
  for (const [a, b] of edges) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  for (const l of adj.values()) l.sort((x, y) => x - y);
  return { neighbours: (r) => adj.get(r) ?? [] };
}

const LINE: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
];
const ten = () => 10;

describe("World War 1936 P5: the civil war split (spec §15.2)", () => {
  it("a line 1–5, capital 1: the far end grows toward the capital", () => {
    const g = graph(LINE);
    const all = [1, 2, 3, 4, 5];
    expect(splitRegionsForCivilWar(g, all, 1, [], ten, 3000)).toEqual([4, 5]);
    expect(splitRegionsForCivilWar(g, all, 1, [], ten, 5000)).toEqual([
      3, 4, 5,
    ]);
    // 35 wanted: 40 reached.
    expect(splitRegionsForCivilWar(g, all, 1, [], ten, 7000)).toEqual([
      2, 3, 4, 5,
    ]);
  });

  it("a content seed starts the rebellion there", () => {
    const g = graph(LINE);
    expect(
      splitRegionsForCivilWar(g, [1, 2, 3, 4, 5], 1, [2], ten, 3000),
    ).toEqual([2, 3]);
  });

  it("an unreachable region tops up the share by its points", () => {
    const g = graph(LINE);
    const vp = (r: number) => (r === 6 ? 30 : 10);
    expect(
      splitRegionsForCivilWar(g, [1, 2, 3, 4, 5, 6], 1, [], vp, 7000),
    ).toEqual([2, 3, 4, 5, 6]);
  });

  it("a region without points follows the side with more neighbours (ties: the government)", () => {
    const vp = (r: number) => (r === 7 ? 0 : 10);
    const cand = [1, 2, 3, 4, 5, 7];
    const three = graph([...LINE, [3, 7], [4, 7], [5, 7]]);
    expect(splitRegionsForCivilWar(three, cand, 1, [], vp, 3000)).toEqual([
      4, 5, 7,
    ]);
    const two = graph([...LINE, [3, 7], [4, 7]]);
    expect(splitRegionsForCivilWar(two, cand, 1, [], vp, 3000)).toEqual([4, 5]);
  });

  it("the capital never joins, and the same input gives the same result", () => {
    const g = graph(LINE);
    const a = splitRegionsForCivilWar(g, [1, 2, 3, 4, 5], 1, [1], ten, 7000);
    expect(a).not.toContain(1);
    expect(
      splitRegionsForCivilWar(g, [1, 2, 3, 4, 5], 1, [1], ten, 7000),
    ).toEqual(a);
  });
});
