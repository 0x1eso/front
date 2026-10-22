// World War 1936 P6 (spec §9, §10, plan Task 1 Step 21): projects, the
// atomic bomb, rockets and raids.
import {
  atomicBombDayMilli,
  inputPm,
  milestoneCrossed,
  nukeInterceptPm,
  nukeOutcome,
  projectBonusPct,
  projectDayMilli,
  raidSuccessPm,
  rocketHits,
  scientistPct,
} from "@openfront/engine-lib/ww1936/ProjectRules";

describe("project rules", () => {
  it("the atomic project: skill 4 and a match, full uranium", () => {
    const pct = scientistPct(4, true);
    expect(pct).toBe(70);
    const day = projectDayMilli(1_900, pct, 1_000, true);
    expect(day).toBe(894);
    expect(Math.ceil(1_000_000 / day)).toBe(1_119);
    expect(projectDayMilli(1_900, pct, 1_000, false)).toBe(447);
    expect(inputPm(1, 2)).toBe(500);
    expect(inputPm(0, 0)).toBe(1000);
  });

  // P6-3 glue (h): the Vemork plant's +10 (+20 with K3's nor_heavy_water).
  it("the content's speed bonuses", () => {
    const none = {
      project: "sp_atomic" as const,
      heavyWater: false,
      radarLab: false,
      vemork: false,
      norHeavyWater: false,
      quebec: false,
    };
    expect(projectBonusPct(none)).toBe(0);
    expect(projectBonusPct({ ...none, vemork: true })).toBe(10);
    expect(
      projectBonusPct({ ...none, vemork: true, norHeavyWater: true }),
    ).toBe(20);
    expect(projectBonusPct({ ...none, norHeavyWater: true })).toBe(0);
    expect(
      projectBonusPct({
        ...none,
        heavyWater: true,
        vemork: true,
        quebec: true,
      }),
    ).toBe(35);
    expect(
      projectBonusPct({ ...none, project: "sp_jet_engine", vemork: true }),
    ).toBe(0);
  });

  it("milestones crossed", () => {
    expect(milestoneCrossed(299_999 / 1000, 300)).toBe(0);
    expect(milestoneCrossed(300, 650)).toBe(1);
    expect(milestoneCrossed(950, 960)).toBe(-1);
  });

  it("a facility makes a bomb in 120 days at full uranium", () => {
    expect(atomicBombDayMilli(1000)).toBe(8_333);
    expect(Math.ceil(1_000_000 / atomicBombDayMilli(1000))).toBe(121);
    expect(atomicBombDayMilli(1000) * 120).toBeLessThan(1_000_000);
  });

  it("interception by air superiority", () => {
    expect(nukeInterceptPm(300)).toBe(0);
    expect(nukeInterceptPm(700)).toBe(200);
    expect(nukeInterceptPm(1000)).toBe(350);
  });

  it("a bomb's effect numbers", () => {
    const o = nukeOutcome(9, 5, 0, 0);
    expect(o.destroy).toEqual({ civ: 2, mil: 1, dock: 0 });
    expect(o.surrenderCutPp).toBe(-10);
    expect(nukeOutcome(9, 5, 0, 3).surrenderCutPp).toBe(0);
  });

  it("flying bombs that get through carry their remainder", () => {
    expect(rocketHits(0, 10, 500, 2, 0)).toEqual({ hits: 7, restMilli: 200 });
    expect(rocketHits(1, 10, 1000, 5, 0)).toEqual({ hits: 10, restMilli: 0 });
  });

  it("raid success, clamped 50..950", () => {
    const i = {
      expLevel: 2,
      aa: 1,
      supPm: 600,
      enemyDivision: false,
      coastalFort: 1,
      bombers: 100,
    };
    expect(raidSuccessPm(0, i)).toBe(600 + 100 - 60 - 50);
    expect(raidSuccessPm(1, i)).toBe(650 - 80 + 100);
    expect(raidSuccessPm(2, i)).toBe(550 + 10 - 50 - 100);
    expect(raidSuccessPm(0, { ...i, aa: 20 })).toBe(50);
    expect(raidSuccessPm(1, { ...i, expLevel: 10, coastalFort: 0 })).toBe(950);
  });
});
