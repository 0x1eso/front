// ww42: the direct attack's pure model — the breakdown from the engine's
// counts, the red warning, the tap's target list and the orders it sends.
import type { DirectView } from "@openfront/engine-api/ww1936/LandTypes";
import { idleOrder } from "@openfront/engine-api/ww1936/LandTypes";
import { describe, expect, it } from "vitest";
import {
  directBreakdown,
  directOrder,
  directSettings,
  directTargetsOf,
  directWarning,
  tapDirectTargets,
} from "../../../src/client/hud/ww1936/LandModel";
import { army, mine } from "./LandFixture";

const view = (over: Partial<DirectView> = {}): DirectView => ({
  flags: 0,
  atk: [
    [3, 6, 3],
    [4, 6, 6],
  ],
  hold: 4,
  wait: 5,
  rec: 2,
  walk: 4,
  why: 0,
  ratioPm: -1,
  at: [
    [5, 0, 4],
    [3, 1, 5],
    [4, 2, 2],
    [1, 3, 4],
  ],
  ...over,
});

describe("ww42 direct attack model", () => {
  it("the breakdown follows the engine's counts: attackers by region, biggest first", () => {
    const parts = directBreakdown(view());
    expect(parts.map((p) => [p.kind, p.n])).toEqual([
      ["atk", 9],
      ["hold", 4],
      ["wait", 5],
      ["rec", 2],
      ["walk", 4],
    ]);
    expect(parts[0].regions).toEqual([
      [4, 6],
      [3, 3],
    ]);
    expect(parts[1].regions).toEqual([[5, 4]]);
    // Empty groups are left out.
    expect(
      directBreakdown(view({ atk: [], hold: 0, wait: 0, rec: 0, at: [] })).map(
        (p) => p.kind,
      ),
    ).toEqual(["walk"]);
  });

  it("the red warning shows only under the Low line, with the lowest win chance", () => {
    const a = (odds: [number, number, number][]) =>
      army(1, "DEU", 3, { mine: mine({ odds }) });
    expect(directWarning(a([[3, 6, 70]]))).toBeNull();
    expect(
      directWarning(
        a([
          [3, 6, 70],
          [4, 6, 22],
        ]),
      ),
    ).toBe(22);
    expect(directWarning(a([]))).toBeNull();
  });

  it("taps: add in order up to three, a repeat removes; the orders are the engine's", () => {
    expect(tapDirectTargets([], 6)).toEqual([6]);
    expect(tapDirectTargets([6], 7)).toEqual([6, 7]);
    expect(tapDirectTargets([6, 7, 8], 9)).toEqual([6, 7, 8]);
    expect(tapDirectTargets([6, 7], 6)).toEqual([7]);
    expect(directOrder(1, [6, 7])).toEqual({
      kind: "army_direct",
      army: 1,
      targets: [6, 7],
    });
    expect(directSettings(1, { allIn: true })).toEqual({
      kind: "army_direct",
      army: 1,
      allIn: true,
    });
    const order = {
      ...idleOrder(),
      kind: "plan" as const,
      targets: [6],
      direct: true,
    };
    expect(
      directTargetsOf(army(1, "DEU", 3, { mine: mine({ order }) })),
    ).toEqual([6]);
    // An older plan (no direct flag) is not a direct attack's list.
    expect(
      directTargetsOf(
        army(1, "DEU", 3, {
          mine: mine({ order: { ...order, direct: undefined } }),
        }),
      ),
    ).toEqual([]);
  });
});
