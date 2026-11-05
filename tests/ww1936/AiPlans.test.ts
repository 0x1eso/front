import {
  AI_PLAN_DEFAULT,
  AI_PLAN_STOP_OFFENSE_PCT,
  AI_PLANS,
  planOf,
  planStance,
  planStrengthPct,
} from "@openfront/engine-lib/ww1936/AiPlans";
import {
  AI_ATTACK_ORG_PM,
  AI_OFFENSE_DEMAND_PCT,
  AI_REGROUP_ORG_PM,
  AI_RESERVE_PCT,
  aiBorderDemand,
} from "@openfront/engine/ww1936/land/AiLand";
import { describe, expect, it } from "vitest";

/** A seed giving the country a strength of exactly `want`, %. */
function seedAt(smallID: number, want: number): number {
  for (let s = 1; s < 100_000; s++) {
    if (planStrengthPct(s, smallID) === want) return s;
  }
  throw new Error("no seed");
}

describe("planOf (ww91 section 8.4)", () => {
  it("same seed same plan; seeds differ; strength stays 60-140", () => {
    expect(planOf("DEU", 7, 3)).toEqual(planOf("DEU", 7, 3));
    const strengths = new Set<number>();
    for (let s = 0; s < 400; s++) strengths.add(planStrengthPct(s, 3));
    expect(strengths.size).toBeGreaterThan(40);
    expect(Math.min(...strengths)).toBeGreaterThanOrEqual(60);
    expect(Math.max(...strengths)).toBeLessThanOrEqual(140);
  });

  it("at full strength the table stands; at 60 and 140 it moves from the default", () => {
    const s100 = seedAt(3, 100);
    const p = planOf("DEU", s100, 3);
    for (const [k, v] of Object.entries(AI_PLANS.DEU!)) {
      expect(p[k as keyof typeof p]).toBe(v);
    }
    expect(planOf("DEU", seedAt(3, 60), 3).offensePct).toBe(224);
    expect(planOf("DEU", seedAt(3, 140), 3).offensePct).toBe(256);
    expect(planOf("USA", seedAt(3, 60), 3).skyBarPm).toBe(580);
  });

  it("a whole-number lean survives the weakest seed; one enemy stops at 100", () => {
    expect(planOf("USA", seedAt(3, 60), 3).milPerCiv).toBe(2);
    expect(planOf("DEU", seedAt(3, 140), 3).milPerCiv).toBe(4);
    expect(planOf("DEU", seedAt(3, 140), 3).oneEnemyPct).toBe(100);
    expect(planOf("SUN", seedAt(3, 60), 3).counterPm).toBe(1400);
  });

  it("a human and a minor play the defaults", () => {
    expect(planOf("DEU", 7, 3, true)).toBe(AI_PLAN_DEFAULT);
    expect(planOf("POL", 7, 3)).toBe(AI_PLAN_DEFAULT);
  });

  it("the defaults are the numbers the AI had", () => {
    expect(AI_PLAN_DEFAULT.offensePct).toBe(AI_OFFENSE_DEMAND_PCT);
    expect(AI_PLAN_DEFAULT.reservePct).toBe(AI_RESERVE_PCT);
    expect(AI_PLAN_DEFAULT.regroupPm).toBe(AI_REGROUP_ORG_PM);
    expect(AI_PLAN_DEFAULT.reattackPm).toBe(AI_ATTACK_ORG_PM);
  });
});

describe("demand from the plan", () => {
  const base = { facingMilli: 10_000, land: "plains" as const, dirs: 1 };
  it("offensePct and holdCenti size a border region's demand", () => {
    const off = aiBorderDemand({ ...base, offensive: true, fort: 0 });
    expect(off).toBe(240);
    expect(
      aiBorderDemand({ ...base, offensive: true, fort: 0, offensePct: 140 }),
    ).toBe(168);
    const held = aiBorderDemand({ ...base, offensive: false, fort: 0 });
    const dense = aiBorderDemand({
      ...base,
      offensive: false,
      fort: 0,
      holdCenti: 300,
    });
    expect(dense).toBeGreaterThan(held);
    expect(
      aiBorderDemand({ ...base, offensive: false, fort: 0, holdCenti: 200 }),
    ).toBe(held);
  });
});

describe("rule 2: strike while strong", () => {
  const de = { ...AI_PLAN_DEFAULT, gateMidPct: 90, fuelStopPm: 250 };
  it("the low bar holds while fuel and armour hold", () => {
    expect(planStance(de, 800, 1000).midPct).toBe(90);
    expect(planStance(de, 400, 1000).midPct).toBe(100);
    expect(planStance(de, 800, 300).midPct).toBe(100);
  });
  it("under the stop line the demand falls, the bars rise and rings open", () => {
    const st = planStance({ ...de, offensePct: 240 }, 200, 1000);
    expect(st.stopped).toBe(true);
    expect(st.offensePct).toBe(AI_PLAN_STOP_OFFENSE_PCT);
    expect(st.midPct).toBe(120);
    expect(st.lowPct).toBe(120);
  });
  it("a plan with a high bar keeps it whatever the fuel; no stop line, no stop", () => {
    const fr = { ...AI_PLAN_DEFAULT, gateMidPct: 115 };
    expect(planStance(fr, 0, 0).midPct).toBe(115);
    expect(planStance(fr, 0, 0).stopped).toBe(false);
  });
});
