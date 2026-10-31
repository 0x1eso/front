// World War 1936 P6 (plan Task 14): a pack's own focuses draw in the same
// canvas, columns 20 to 35, to the right of the generic tree.
import { PACK_COLUMNS } from "@openfront/engine-api/ww1936/DepthTypes";
import { describe, expect, it } from "vitest";
import {
  isPackFocus,
  packFirst,
} from "../../../src/client/hud/ww1936/DepthMiscModel";
import { computeLayout } from "../../../src/client/hud/ww1936/FocusLayout";

describe("pack focuses on the focus canvas", () => {
  const tree = [
    { x: 0, y: 0 },
    { x: 19, y: 3 },
    { x: 20, y: 5 },
    { x: 35, y: 1 },
  ];

  it("pack focuses draw in columns 20 to 35", () => {
    expect(PACK_COLUMNS).toEqual([20, 35]);
    expect(tree.map(isPackFocus)).toEqual([false, false, true, true]);
    // Auto layout: every card gets a place, none overlap.
    const L = computeLayout(
      tree.map((t, i) => ({ ...t, id: `p${i}`, branch: "army" as const })),
    );
    expect(new Set(L.x.map((x, i) => `${x}:${L.y[i]}`)).size).toBe(4);
  });

  it("the pack chip pans to the top row's leftmost pack card", () => {
    expect(packFirst(tree)).toBe(3);
    expect(packFirst(tree.slice(0, 2))).toBe(-1);
  });
});
