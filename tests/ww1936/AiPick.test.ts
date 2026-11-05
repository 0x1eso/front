import { describe, expect, test } from "vitest";
import {
  aiKeeps,
  aiPickEntry,
  fighterScore,
  thresholdPm,
  type PickCand,
} from "../../packages/engine/src/ww1936/depth/AiPick";

const c = (key: number, score: number, cost: number, over = {}): PickCand => ({
  key,
  score,
  cost,
  relPm: 1000,
  ...over,
});

describe("ww81 the AI's entry pick", () => {
  test("an old entry is never picked, however cheap", () => {
    // 60 is under 85% of 100: old.
    expect(aiPickEntry([c(1, 100, 1000), c(2, 60, 100)], 20)).toBe(1);
  });

  test("the lean prefers the better entry, none prefers the cheaper", () => {
    const list = [c(1, 100, 1200), c(2, 87, 1000)];
    expect(aiPickEntry(list, 0)).toBe(2);
    expect(aiPickEntry(list, 100)).toBe(1);
  });

  test("wear and missing resources raise the cost", () => {
    const list = [c(1, 100, 1000, { relPm: 700 }), c(2, 100, 1100)];
    expect(aiPickEntry(list, 0)).toBe(2);
    const res = [c(1, 100, 1000, { resPm: 2500 }), c(2, 100, 1100)];
    expect(aiPickEntry(res, 0)).toBe(2);
  });

  test("a line keeps its entry near the best value, not an old one", () => {
    const list = [c(1, 100, 1000), c(2, 98, 1000), c(3, 60, 100)];
    expect(aiKeeps(list, 20, 2)).toBe(true);
    expect(aiKeeps(list, 20, 3)).toBe(false);
    expect(aiKeeps(list, 20, 9)).toBe(false);
  });

  test("C5: armour past the enemy's pierce counts more, a gun that cannot pierce less", () => {
    const t = { armor: 50, pierce: 40 };
    expect(thresholdPm(60, 60, t)).toBe(1500);
    expect(thresholdPm(30, 30, t)).toBe(800);
    expect(thresholdPm(60, 30, t)).toBe(1200);
    expect(thresholdPm(60, 60, { armor: 0, pierce: 0 })).toBe(1000);
  });

  test("a more agile fighter scores higher at equal attack", () => {
    expect(fighterScore(100, 50, 14)).toBeGreaterThan(fighterScore(100, 50, 8));
  });
});
