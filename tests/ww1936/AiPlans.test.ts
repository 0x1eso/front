import {
  type BattalionId,
  TPL_BARE_ARMOR,
  TPL_EXPLOIT,
  WW_MAX_SUPPORT,
  wwMaxSupport,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  AI_LINE_SHAPES,
  AI_PLAN_DEFAULT,
  AI_PLAN_STOP_OFFENSE_PCT,
  AI_PLANS,
  buildsForWar,
  type FactoryView,
  nextFactory,
  planOf,
  planPrepared,
  planStance,
  planStrengthPct,
  resourceWorth,
  wantsPeaceFort,
} from "@openfront/engine-lib/ww1936/AiPlans";
import { BATTALIONS } from "@openfront/engine-lib/ww1936/Battalions";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { aiNavalShares } from "@openfront/engine/ww1936/economy/AiEconomy";
import {
  choosePool,
  marchTargets,
  shapeStep,
  trainTargetArmy,
  widthPenaltyBp,
} from "@openfront/engine/ww1936/land/AiArmies";
import {
  effortScore,
  enemyFrontScore,
  offMainDemand,
  pickMainEnemy,
  pickMainSector,
} from "@openfront/engine/ww1936/land/AiEffort";
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
  aiInvasionPick,
  aiInvasionScore,
} from "@openfront/engine/ww1936/navy/AiInvasion";
import { expectedSupPm } from "@openfront/engine/ww1936/navy/AiNavy";
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
        counts: {
          infantry: 92,
          armor: 0,
          motorized: 7,
          mountain: 0,
          cavalry: 0,
        },
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

describe("rule 5: war for resources", () => {
  it("only what it lacks counts, no more of it than the gap", () => {
    expect(resourceWorth([30, 0, 9], [20, 5, 0], 10)).toBe(20);
    expect(resourceWorth([30, 0, 9], [40, 5, 0], 5)).toBe(15);
    expect(resourceWorth([0, 0, 9], [20, 5, 0], 10)).toBe(0);
    expect(resourceWorth([30, 0, 9], [20, 5, 0], 0)).toBe(0);
  });

  it("a landing goes for the oil over the larger town", () => {
    const at = {
      port: false,
      enemyCapital: false,
      islandBase: false,
      divisions: 0,
      routeKm: 0,
      supPm: 1000,
    };
    const town = { ...at, target: 1, vp: 10 };
    const oil = { ...at, target: 2, vp: 3, extra: 20 };
    expect(aiInvasionPick([town, oil])?.target).toBe(2);
    expect(aiInvasionPick([town, { ...oil, extra: 0 }])?.target).toBe(1);
  });
});

describe("rule 6: sea lanes first", () => {
  const at = {
    target: 1,
    vp: 5,
    port: false,
    enemyCapital: false,
    islandBase: true,
    divisions: 0,
    routeKm: 0,
    supPm: 620,
  };
  it("the plan's bar decides the landing", () => {
    expect(aiInvasionPick([at])).not.toBeNull();
    expect(aiInvasionPick([at], 700)).toBeNull();
    expect(aiInvasionPick([{ ...at, supPm: 560 }], 550)).not.toBeNull();
  });
  it("an island base is worth what the plan says", () => {
    expect(aiInvasionScore(at)).toBe(1000);
    expect(aiInvasionScore({ ...at, islandValue: 10 })).toBe(1500);
  });
  it("expected supremacy stays where the invasion planner had it", () => {
    expect(expectedSupPm(3, 1)).toBe(750);
    expect(expectedSupPm(0, 0)).toBe(0);
  });
});

describe("rule 7: build for the plan", () => {
  const at = (over: Partial<FactoryView> = {}): FactoryView => ({
    plan: AI_PLAN_DEFAULT,
    personalityAlertWtBp: 2000,
    atWar: false,
    plannedWar: false,
    wtBp: 400,
    threatPct: 0,
    idleMil: 0,
    starved: false,
    ...over,
  });
  const plan = (over: Partial<typeof AI_PLAN_DEFAULT>) => ({
    ...AI_PLAN_DEFAULT,
    ...over,
  });

  it("a country that expects no war builds civilian factories", () => {
    expect(buildsForWar(at())).toBe(false);
    expect(nextFactory(at(), 0, 0)).toBe("civ");
  });

  it("the plan names its tension; without one the personality's stands", () => {
    const sun = plan({ alertWtBp: 2000 });
    expect(buildsForWar(at({ plan: sun, wtBp: 1999 }))).toBe(false);
    expect(buildsForWar(at({ plan: sun, wtBp: 2000 }))).toBe(true);
    expect(buildsForWar(at({ personalityAlertWtBp: 0 }))).toBe(true);
    expect(
      buildsForWar(at({ plan: sun, wtBp: 0, personalityAlertWtBp: 0 })),
    ).toBe(false);
  });

  it("war, a planned war or a stronger neighbour end the wait", () => {
    expect(buildsForWar(at({ atWar: true }))).toBe(true);
    expect(buildsForWar(at({ plannedWar: true }))).toBe(true);
    expect(buildsForWar(at({ threatPct: 149 }))).toBe(false);
    expect(buildsForWar(at({ threatPct: 150 }))).toBe(true);
  });

  it("the mix follows the plan, and leans further with high tension", () => {
    const de = at({ plan: plan({ milPerCiv: 4 }), wtBp: 0 });
    const alerted = { ...de, personalityAlertWtBp: 0 };
    expect(nextFactory(alerted, 3, 0)).toBe("mil");
    expect(nextFactory(alerted, 4, 0)).toBe("civ");
    expect(nextFactory({ ...alerted, wtBp: 3500 }, 4, 0)).toBe("mil");
    expect(nextFactory({ ...alerted, wtBp: 3500 }, 8, 0)).toBe("civ");
    const us = { ...alerted, plan: plan({ milPerCiv: 2 }) };
    expect(nextFactory(us, 2, 0)).toBe("civ");
  });

  it("at war or with a war planned, only military", () => {
    expect(nextFactory(at({ atWar: true }), 30, 0)).toBe("mil");
    expect(nextFactory(at({ plannedWar: true }), 30, 0)).toBe("mil");
  });

  it("factories the lines can't feed are not built, even at war", () => {
    expect(nextFactory(at({ atWar: true, starved: true }), 0, 0)).toBe("civ");
    expect(nextFactory(at({ atWar: true }), 0, 0)).toBe("mil");
    expect(nextFactory(at({ atWar: true, idleMil: 3 }), 0, 0)).toBe("civ");
  });

  it("forts before a war: on a threat's border, up to the plan's level", () => {
    const fra = plan({ fortLevel: 4 });
    expect(wantsPeaceFort(fra, 3, true)).toBe(true);
    expect(wantsPeaceFort(fra, 4, true)).toBe(false);
    expect(wantsPeaceFort(fra, 0, false)).toBe(false);
    expect(wantsPeaceFort(AI_PLAN_DEFAULT, 0, true)).toBe(false);
  });
});

describe("the division shapes (8.4, the table decides)", () => {
  const flat = (rows: readonly (readonly [BattalionId, number])[]) =>
    rows.flatMap(([b, n]) => new Array<BattalionId>(n).fill(b));
  const def = (rows: readonly (readonly [BattalionId, number])[]) => ({
    name: "",
    battalions: flat(rows),
    support: [],
  });
  const width = (rows: readonly (readonly [BattalionId, number])[]) =>
    flat(rows).reduce((w, b) => w + BATTALIONS[b].width, 0);

  it("every shape sits on a free width; Japan's line is the one exception", () => {
    for (const [tag, s] of Object.entries(AI_LINE_SHAPES)) {
      expect(widthPenaltyBp(width(s.armour)) === 0, `${tag} armour`).toBe(true);
      if (tag === "JPN") continue;
      expect(widthPenaltyBp(width(s.line)) === 0, `${tag} line`).toBe(true);
    }
    expect(width(AI_LINE_SHAPES.JPN!.line)).toBe(17);
    expect(widthPenaltyBp(17)).toBeLessThan(widthPenaltyBp(19));
  });

  it("ww105: a line keeps its organisation: guns come as companies, and four fit", () => {
    for (const [tag, s] of Object.entries(AI_LINE_SHAPES)) {
      const stats = templateStats(def(s.line), emptyStats(), GEN1);
      expect(stats.orgMilli, `${tag} org`).toBeGreaterThanOrEqual(48_000);
      expect(wwMaxSupport(flat(s.line).length), tag).toBe(WW_MAX_SUPPORT);
    }
    for (const tag of ["SUN", "USA", "GBR", "FRA"] as const) {
      expect(AI_LINE_SHAPES[tag]!.company).toBe("support_anti_tank");
    }
  });

  it("armour shapes run through and are never bare", () => {
    for (const s of Object.values(AI_LINE_SHAPES)) {
      const flags = templateStats(def(s.armour), emptyStats(), GEN1).flags;
      expect(flags & TPL_EXPLOIT).not.toBe(0);
      expect(flags & TPL_BARE_ARMOR).toBe(0);
    }
  });

  it("one step at a time: the excess goes, one battalion comes", () => {
    const target = [
      ["artillery", 2],
      ["infantry", 8],
    ] as const;
    const now = new Array<BattalionId>(12).fill("infantry");
    now.push("artillery");
    const next = shapeStep(now, target)!;
    expect(next.filter((b) => b === "artillery")).toHaveLength(2);
    expect(next.filter((b) => b === "infantry")).toHaveLength(8);
    expect(shapeStep(next, target)).toBeNull();
    expect(shapeStep(["cavalry", "infantry"], [["infantry", 1]])).toEqual([
      "infantry",
    ]);
  });
});

describe("the plan's small situation rules", () => {
  it("Germany's foot marches a region at a time", () => {
    expect(marchTargets(4, [5, 6], true)).toEqual([4]);
    expect(marchTargets(4, [5, 6], false)).toEqual([4, 5, 6]);
  });

  it("France waits for its readiness; others have no such wait", () => {
    const fra = { ...AI_PLAN_DEFAULT, readyPct: 90 };
    expect(planPrepared(fra, 2699, 3000)).toBe(false);
    expect(planPrepared(fra, 2700, 3000)).toBe(true);
    expect(planPrepared(AI_PLAN_DEFAULT, 0, 3000)).toBe(true);
    expect(planOf("FRA", seedAt(3, 140), 3).readyPct).toBe(95);
  });

  it("Japan's escorts rise with losses, out of the big ships first", () => {
    const calm = aiNavalShares("JPN", false);
    const hit = aiNavalShares("JPN", false, 20);
    expect(hit.dd).toBe(calm.dd + 10);
    expect(hit.convoy).toBe(calm.convoy + 10);
    expect(hit.bb).toBe(0);
    expect(hit.cv).toBeLessThan(calm.cv);
    const sum = (o: Record<string, number>) =>
      Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(hit)).toBe(sum(calm));
  });
});
