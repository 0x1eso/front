import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import fs from "fs";
import { describe, expect, it } from "vitest";
import {
  focusGroups,
  groupKey,
  groupLabel,
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

// ww73: the group headers were English words cut from the id.
describe("group labels", () => {
  const lang = (f: string) =>
    JSON.parse(fs.readFileSync(`resources/lang/${f}.json`, "utf8")).ww1936
      .focusui.group as Record<string, string>;
  it("every focus group has an English and a Korean name", () => {
    const en = lang("en");
    const ko = lang("ko");
    const ids = new Set(
      CONTENT.focuses
        .map((f) => groupKey(f))
        .filter((k) => !k.startsWith("branch:")),
    );
    expect(ids.size).toBeGreaterThan(60);
    for (const id of ids) {
      expect(en[id], id).toBeTruthy();
      expect(ko[id], id).toMatch(/[가-힣0-9]/);
    }
  });
  it("an id with no entry reads as words with a capital", () => {
    expect(groupLabel("deu_unlisted_group")).toBe("Unlisted group");
    expect(groupLabel("branch:army")).toBe("army");
  });
});
