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
  aiBestRing,
  aiBorderDemand,
  aiTrainPlan,
} from "@openfront/engine/ww1936/land/AiLand";
import {
  choosePool,
  trainTargetArmy,
} from "@openfront/engine/ww1936/land/AiArmies";
import {
  effortScore,
  enemyFrontScore,
  offMainDemand,
  pickMainEnemy,
  pickMainSector,
} from "@openfront/engine/ww1936/land/AiEffort";
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

describe("rule 1: one enemy at a time", () => {
  const rich = { enemy: 5, vp: 19, capital: false, divisions: 20 };
  const poor = { enemy: 9, vp: 3, capital: false, divisions: 20 };
  const flat = () => 10; // no lean

  it("value over the divisions facing, the capital counted", () => {
    expect(enemyFrontScore(rich)).toBe(1000);
    expect(enemyFrontScore({ ...rich, capital: true })).toBe(1500);
    expect(enemyFrontScore({ ...rich, divisions: 0 })).toBe(20_000);
  });

  it("the best enemy wins; the seeded lean settles a close call", () => {
    expect(pickMainEnemy([poor, rich], flat)).toBe(5);
    const a = { ...poor, vp: 19 };
    expect(pickMainEnemy([a, rich], (e) => (e === 9 ? 20 : 0))).toBe(9);
    expect(pickMainEnemy([a, rich], (e) => (e === 9 ? 0 : 20))).toBe(5);
    expect(pickMainEnemy([], flat)).toBe(0);
  });

  it("the enemy being fought stays while it is close to the best", () => {
    const near = { ...rich, enemy: 2, vp: 17 };
    expect(pickMainEnemy([near, rich], flat, 2)).toBe(2);
    expect(pickMainEnemy([poor, rich], flat, 9)).toBe(5);
  });

  it("off the main enemy a front keeps what the plan leaves it", () => {
    expect(offMainDemand(100, 300, 100)).toBe(100);
    expect(offMainDemand(100, 300, 70)).toBe(160);
    expect(offMainDemand(100, 300, 0)).toBe(300);
    expect(offMainDemand(300, 100, 50)).toBe(300);
  });
});

describe("rule 3: trade space, hold a fist", () => {
  const border = { regions: 10, terrain: 0 };
  const ring = { regions: 7, terrain: 0, vpLost: 2 };

  it("a ring gives up points by the plan's count", () => {
    expect(aiBestRing(border, [ring])).toBe(0);
    expect(aiBestRing(border, [{ ...ring, vpLost: 4 }])).toBe(-1);
    expect(aiBestRing(border, [{ ...ring, vpLost: 4 }], 50)).toBe(0);
    expect(aiBestRing(border, [ring], 200)).toBe(-1);
  });

  const army = (id: number, n: number, fist = false, back = false) => ({
    id,
    n,
    fist,
    back,
  });

  it("the pool takes the fist first, about its share", () => {
    const list = [army(1, 20), army(2, 20, true), army(3, 20), army(4, 20)];
    expect(choosePool(list, 15, 10)).toEqual([2]);
    expect(choosePool(list, 0, 10)).toEqual([]);
  });

  it("an army already behind the line stays in it", () => {
    const list = [army(1, 12), army(2, 12, true), army(3, 12, false, true)];
    expect(choosePool(list, 20, 5)[0]).toBe(3);
  });

  it("the line keeps a division a region, and one army; two armies pool nothing", () => {
    const list = [army(1, 6, true), army(2, 6), army(3, 6)];
    expect(choosePool(list, 34, 13)).toEqual([]);
    expect(choosePool([army(1, 40, true), army(2, 40)], 15, 2)).toEqual([]);
    expect(choosePool(list, 90, 1)).toHaveLength(2);
  });

  it("no army of more than twice the share", () => {
    const list = [army(1, 24, true), army(2, 24), army(3, 24)];
    expect(choosePool(list, 10, 5)).toEqual([]);
  });
});

describe("rule 4: sky first", () => {
  const region = (id: number, skyPm: number, vp = 0) => ({
    region: id,
    vp,
    capital: false,
    fort: 0,
    width: 80,
    defence: 100,
    extra: 0,
    skyPm,
  });

  it("a sector under the enemy's sky is left out while another stands", () => {
    const list = [region(1, 700, 40), region(2, 0)];
    expect(pickMainSector(list, 0)).toBe(2);
  });

  it("with every sector under it the best halved score still decides", () => {
    expect(pickMainSector([region(1, 900, 40), region(2, 900)], 0)).toBe(1);
  });

  it("the plan's bar sets where the sky counts", () => {
    const list = [region(1, 550, 40), region(2, 0)];
    expect(pickMainSector(list, 0)).toBe(1);
    expect(pickMainSector(list, 0, 0, false, 15, 500)).toBe(2);
    expect(effortScore(region(1, 550), false, 500)).toBe(
      Math.floor(effortScore(region(1, 0)) / 2),
    );
  });
});

describe("rule 8: post the good troops", () => {
  const facts = (id: number, n: number, apart = 0, armour = 0) => ({
    id,
    n,
    apart,
    armour,
  });

  it("the good troops gather in an army of their own", () => {
    const armies = [facts(1, 12), facts(2, 3, 3), facts(3, 6, 5)];
    expect(trainTargetArmy(false, armies, true)).toBe(3);
    expect(trainTargetArmy(false, [facts(1, 12)], true)).toBe(0);
    expect(trainTargetArmy(false, armies)).toBe(1);
  });

  it("Germany's motorized share doubles with its national unit", () => {
    const train = (motorUnit: boolean) =>
      aiTrainPlan({
        personality: "aggressor",
        major: true,
        dev: 5,
        hasArmorTech: false,
        hasAssault: false,
        training: 0,
        manpower: 1_000_000,
        counts: { infantry: 92, armor: 0, motorized: 7, mountain: 0, cavalry: 0 },
        templates: [
          { id: 1, key: "infantry", men: 10, fillPm: 1000 },
          { id: 2, key: "motorized", men: 10, fillPm: 1000 },
        ],
        motorUnit,
      })[0];
    expect(train(false)).toBe(1);
    expect(train(true)).toBe(2);
  });
});
