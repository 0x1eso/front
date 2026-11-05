import { planeStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertPlane";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import type { PlaneEntry } from "@openfront/engine-lib/ww1936/hist/Types";
import { describe, expect, test } from "vitest";
import {
  aiKeeps,
  aiPickEntry,
  aiPlaneScore,
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

  test("C5: on the armour curve: armour the enemy can't pierce counts more, a gun that can't pierce less", () => {
    const t = { armor: 5000, pierce: 4000 };
    // Armour just over the pierce stops next to nothing: no ×3/2 at the line.
    expect(thresholdPm(4100, 5000, t)).toBe(1021);
    // Two thirds: half stopped. A third: the whole ×3/2.
    expect(thresholdPm(6000, 5000, t)).toBe(1294);
    expect(thresholdPm(12_000, 5000, t)).toBe(1500);
    // A gun at a third of the armour: the whole ×4/5.
    expect(thresholdPm(100, 1600, t)).toBe(800);
    expect(thresholdPm(12_000, 1600, t)).toBe(1200);
    // A light vehicle stops half at best, whatever the gun.
    expect(thresholdPm(1900, 5000, { armor: 0, pierce: 400 })).toBe(1294);
    expect(thresholdPm(6000, 6000, { armor: 0, pierce: 0 })).toBe(1000);
  });

  test("a more agile fighter scores higher at equal attack", () => {
    expect(fighterScore(100, 50, 14)).toBeGreaterThan(fighterScore(100, 50, 8));
  });

  // ww103: the catalogue's own numbers, as AiHist.planeCands reads them.
  const cand = (key: number, id: string): PickCand => {
    const e = histEntry(id) as PlaneEntry;
    const st = planeStatsOfEntry(e);
    return c(key, aiPlaneScore(st.type, st, e.year), st.costMilli, {
      relPm: st.relPm,
    });
  };

  test.each([
    ["usa_p51d", "usa_p40e"],
    ["usa_b25j", "usa_b18"],
    ["usa_f6f5", "usa_f4f4"],
    ["usa_a20g", "usa_a17"],
    ["usa_p80a", "usa_p51d"],
    ["deu_me262_a1", "deu_fw190_a8"],
    ["gbr_meteor_f3", "gbr_spitfire_v"],
  ])("%s takes a line from %s", (better, older) => {
    const list = [cand(1, older), cand(2, better)];
    for (const q of [0, 60, 100]) {
      expect(aiPickEntry(list, q)).toBe(2);
      expect(aiKeeps(list, q, 1)).toBe(false);
    }
  });

  test("a faster plane of the same year and numbers scores higher", () => {
    const st = planeStatsOfEntry(histEntry("usa_p51d") as PlaneEntry);
    expect(aiPlaneScore("fighter", st, 1944)).toBeGreaterThan(
      aiPlaneScore("fighter", { ...st, speed: st.speed - 100 }, 1944),
    );
  });
});
