import { describe, expect, it } from "vitest";
import {
  focusGroups,
  groupKey,
  hiddenCards,
  recommendedIndex,
  searchMatches,
} from "../../../src/client/hud/ww1936/FocusGroups";
import {
  FOCUS_DONE,
  FOCUS_OPEN,
  FOCUS_PREREQ,
} from "../../../src/client/hud/ww1936/FocusLayout";

describe("FocusGroups", () => {
  const tree = [
    { id: "a", group: "x_war", branch: "army" as const },
    { id: "b", group: "x_war", branch: "army" as const },
    { id: "c", branch: "navy" as const },
  ];
  it("groups by group, else by branch, and collapses with keep-alive", () => {
    expect(groupKey(tree[2])).toBe("branch:navy");
    const g = focusGroups(tree, [FOCUS_DONE, FOCUS_OPEN, FOCUS_OPEN]);
    expect(g.map((x) => [x.key, x.done, x.members.length])).toEqual([
      ["x_war", 1, 2],
      ["branch:navy", 0, 1],
    ]);
    expect(hiddenCards(tree, new Set(["x_war"]), new Set([1]))).toEqual([
      true,
      false,
      false,
    ]);
  });
  it("searches names and stars the next open historical focus", () => {
    expect(searchMatches(["Rhine", "Navy"], " nav ")).toEqual([1]);
    expect(searchMatches(["Rhine"], "")).toEqual([]);
    const st = [FOCUS_DONE, FOCUS_OPEN, FOCUS_PREREQ];
    expect(recommendedIndex(tree, st, ["a", "b", "c"])).toBe(1);
    expect(
      recommendedIndex(tree, [FOCUS_DONE, FOCUS_PREREQ, 0], ["a", "b"]),
    ).toBe(-1);
  });
});
