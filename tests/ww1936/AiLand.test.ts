// World War 1936 P2 (plan Task 6): the AI's land war (P2 spec §14). The
// pure decisions (thresholds, fronts, targets, training) on plain data;
// then games on the test map (no humans unless said) and one on the real
// world1936 map: an AI fronts its border and takes Warsaw, never orders a
// human's army, sends nobody where no land leads, gives every order
// through land.issue, and Japan holds on in China until 1939.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import {
  AI_ATTACK_ORG_PM,
  AI_HOLD_DIV_WIDTH,
  AI_HOLD_FORT_PCT,
  AI_HOLD_WIDTHS,
  AI_OFFENSE_DEMAND_PCT,
  AI_REATTACK_READY_BP,
  AI_SEA_MAX_KM,
  aiBorderDemand,
  aiFrontPlan,
  AiRole,
  aiTargets,
  aiThresholdPm,
  AiTrainInput,
  aiTrainPlan,
} from "@openfront/engine/ww1936/land/AiLand";
import { leaveFaction } from "@openfront/engine/ww1936/politics/Factions";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  placeArmy,
  pol,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwGameStart,
  wwRunner,
} from "./util";

const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();
const today = (g: Game) => g.worldWar()!.day(g.ticks());
/** Steps until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}

/** Org of an army against its maximum, ‰. */
function orgPm(g: Game, army: number): number {
  const l = land(g);
  const a = l.armies.get(army);
  if (a === undefined) return -1;
  let org = 0;
  let max = 0;
  for (const id of a.divisions) {
    const r = l.divisions.rowOf(id);
    org += l.divisions.org[r];
    max += l.orgMaxOf(r);
  }
  return max === 0 ? 0 : Math.floor((org * 1000) / max);
}

/** Every land.issue call: who, which order, from whom (and the army's org then). */
function spyIssue(g: Game) {
  const l = land(g);
  const calls: {
    smallID: number;
    order: WwOrder;
    by: string;
    orgPm: number;
    planBp: number;
  }[] = [];
  const issue = l.issue.bind(l);
  l.issue = (smallID, order, by = "player") => {
    const org = "army" in order ? orgPm(g, order.army) : -1;
    const planBp =
      "army" in order ? (l.armies.get(order.army)?.planBp ?? -1) : -1;
    calls.push({ smallID, order, by, orgPm: org, planBp });
    return issue(smallID, order, by);
  };
  return calls;
}

/** All-AI test map without the calendar; `a` declares war on `b` after the preparation minute. */
async function aiWar(a: "DEU" | "GBR", b: "POL" | "SUN") {
  const runner = await wwRunner({ historicalAi: false });
  const g = runner.game;
  const calls = spyIssue(g);
  dropPact(g, a, b);
  // P3 spec §14.5: a democracy (Britain) declares only with a war goal.
  const [ai, bi] = [byTag(g, a).smallID(), byTag(g, b).smallID()];
  addWarGoal(pol(g), ai, bi, "conquer", "", 0);
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = g.worldWar()!;
  expect(declareWar(g, ww, byTag(g, a), byTag(g, b), g.ticks())).not.toEqual(
    [],
  );
  return { runner, g, ww, l: land(g), calls, d0: today(g) };
}

describe("the AI's land decisions (spec §14, pure)", () => {
  test("a border region's demand: offensive twice, a held one capped by its width and forts (Task 11)", () => {
    const at = (
      facing: number,
      offensive: boolean,
      dirs = 1,
      fort = 0,
      land: "plains" | "hills" = "plains",
    ) =>
      aiBorderDemand({
        facingMilli: facing * 1000,
        offensive,
        land,
        dirs,
        fort,
      });
    // 1.2 a facing division, tenths; at least 1 division.
    expect(at(5, false)).toBe(60);
    expect(at(0, false)).toBe(10);
    // An offensive front asks double (and its minimum too).
    expect(AI_OFFENSE_DEMAND_PCT).toBe(200);
    expect(at(5, true)).toBe(120);
    expect(at(0, true)).toBe(20);
    expect(at(50, true)).toBe(1200);
    // Held: plains 90 wide, filled twice by 20-wide divisions = 9 of them.
    expect([AI_HOLD_WIDTHS, AI_HOLD_DIV_WIDTH, AI_HOLD_FORT_PCT]).toEqual([
      2, 20, 10,
    ]);
    expect(at(50, false)).toBe(90);
    // Two ways in: 135 wide, 13.5 divisions.
    expect(at(50, false, 2)).toBe(135);
    // A fort takes a tenth a level off: level 5 half.
    expect(at(50, false, 1, 5)).toBe(45);
    // Hills are narrower (80).
    expect(at(50, false, 1, 0, "hills")).toBe(80);
    // Never under the minimum.
    expect(at(50, false, 1, 9)).toBe(45);
  });

  test("thresholds by personality", () => {
    expect(aiThresholdPm("aggressor")).toBe(1100);
    expect(aiThresholdPm("democracy")).toBe(1500);
    expect(aiThresholdPm("minor")).toBe(1300);
  });

  test("front plan splits armies by demand", () => {
    // Two enemies wanting 60 and 30 (tenths of a division); armies of
    // 24, 12 and 12. The 24 takes the bigger demand (60 → −180); the first
    // 12 then the most left, the 30 (→ −90); the second 12 too (−90 > −180).
    const plan = aiFrontPlan({
      armies: [
        { id: 3, divisions: 12 },
        { id: 1, divisions: 24 },
        { id: 2, divisions: 12 },
      ],
      enemies: [
        { id: 7, border: [10, 11], demand: 60 },
        { id: 9, border: [20, 21, 22, 23], demand: 30 },
      ],
    });
    expect(plan.map((p) => [p.army, p.enemy])).toEqual([
      [1, 7],
      [2, 9],
      [3, 9],
    ]);
    // A front's armies spread along its border.
    expect(plan.map((p) => p.anchor)).toEqual([11, 21, 23]);
    // Equal demand: the smaller id.
    expect(
      aiFrontPlan({
        armies: [{ id: 1, divisions: 5 }],
        enemies: [
          { id: 9, border: [1], demand: 40 },
          { id: 4, border: [2], demand: 40 },
        ],
      }),
    ).toEqual([{ army: 1, enemy: 4, anchor: 2 }]);
  });

  test("anchors spread along the border", () => {
    const plan = aiFrontPlan({
      armies: [
        { id: 1, divisions: 9 },
        { id: 2, divisions: 9 },
        { id: 3, divisions: 9 },
      ],
      enemies: [{ id: 5, border: [31, 32, 33, 34, 35, 36], demand: 500 }],
    });
    // floor((i + 0.5) × 6 / 3): border indices 1, 3, 5.
    expect(plan.map((p) => p.anchor)).toEqual([32, 34, 36]);
  });

  test("an army keeps its front while it wants troops; sea armies go only where demand is left", () => {
    const enemies = [
      { id: 0, border: [1, 2], demand: 100 },
      { id: 1, border: [3], demand: 300 },
    ];
    // Without a front: the most demand. Holding front 0 (still short): stays.
    expect(
      aiFrontPlan({ armies: [{ id: 1, divisions: 6 }], enemies })[0].enemy,
    ).toBe(1);
    expect(
      aiFrontPlan({ armies: [{ id: 1, divisions: 6, current: 0 }], enemies })[0]
        .enemy,
    ).toBe(0);
    // Front 0 covered by a bigger army first: the holder moves on.
    expect(
      aiFrontPlan({
        armies: [
          { id: 1, divisions: 12 },
          { id: 2, divisions: 6, current: 0 },
        ],
        enemies: [
          { id: 0, border: [1], demand: 100 },
          { id: 1, border: [3], demand: 50 },
        ],
      }).map((p) => [p.army, p.enemy]),
    ).toEqual([
      [1, 0],
      [2, 1],
    ]);
    // Reach limits the fronts; a sea army takes none once demand is met
    // (front 1: 200 − 240 by the land army), but one where it is left.
    const plan = aiFrontPlan({
      armies: [
        { id: 1, divisions: 24, reach: [1] },
        { id: 2, divisions: 24, reach: [1], sea: true },
        { id: 3, divisions: 6, reach: [0], sea: true },
      ],
      enemies: [
        { id: 0, border: [1, 2], demand: 100 },
        { id: 1, border: [3], demand: 200 },
      ],
    });
    expect(plan.map((p) => [p.army, p.enemy])).toEqual([
      [3, 0],
      [1, 1],
    ]);
    // A front without border regions (no land contact) gets nobody.
    expect(
      aiFrontPlan({
        armies: [{ id: 1, divisions: 6 }],
        enemies: [{ id: 0, border: [], demand: 0 }],
      }),
    ).toEqual([]);
  });

  test("targets rank vp over distance", () => {
    expect(
      aiTargets({
        regions: [
          { region: 5, vp: 4, dist: 1 }, // 200
          { region: 6, vp: 21, dist: 2 }, // 700
          { region: 7, vp: 10, dist: 4 }, // 200
          { region: 8, vp: 30, dist: 6 }, // 428
          { region: 9, vp: 0, dist: 1 },
        ],
      }),
    ).toEqual([6, 8, 5]);
    // A capital counts its points twice; with fewer than 3 worth anything
    // the nearest fill up (then the smaller id).
    expect(
      aiTargets({
        regions: [
          { region: 4, vp: 5, dist: 3, capital: true }, // 250
          { region: 3, vp: 9, dist: 2 }, // 300
          { region: 12, vp: 0, dist: 1 },
          { region: 11, vp: 0, dist: 1 },
          { region: 2, vp: 0, dist: 5 },
        ],
      }),
    ).toEqual([3, 4, 11]);
    expect(aiTargets({ regions: [] })).toEqual([]);
  });

  test("train plan respects manpower, equipment and the per-day cap", () => {
    const counts = (o: Partial<Record<AiRole, number>> = {}) => ({
      infantry: 0,
      armor: 0,
      motorized: 0,
      mountain: 0,
      cavalry: 0,
      ...o,
    });
    const base: AiTrainInput = {
      personality: "aggressor",
      major: true,
      dev: 5,
      hasArmorTech: true,
      hasMountains: false,
      training: 0,
      manpower: 1_000_000,
      counts: counts({ infantry: 40, armor: 5 }),
      templates: [
        { id: 1, key: "infantry", men: 10_000, fillPm: 1000 },
        { id: 2, key: "armored", men: 5_000, fillPm: 1000 },
        { id: 3, key: "mountain", men: 6_000, fillPm: 1000 },
      ],
    };
    // Three a day at most; armour (15%) stays furthest below its share
    // (with 46, 47, 48 divisions it wants 6.9, 7.05, 7.2 and has 5, 6, 7).
    expect(aiTrainPlan(base)).toEqual([2, 2, 2]);
    // Up to the target: a major trains 10 at once, a minor 3.
    expect(aiTrainPlan({ ...base, training: 9 })).toEqual([2]);
    expect(aiTrainPlan({ ...base, training: 10 })).toEqual([]);
    expect(
      aiTrainPlan({
        ...base,
        personality: "minor",
        major: false,
        training: 2,
      }),
    ).toHaveLength(1);
    // Men for two divisions, else that template waits.
    expect(aiTrainPlan({ ...base, manpower: 19_999 })).toEqual([2, 2]);
    expect(aiTrainPlan({ ...base, manpower: 9_999 })).toEqual([]);
    // Half a division's equipment in stock, else the next role.
    const noTanks = base.templates.map((t) =>
      t.id === 2 ? { ...t, fillPm: 499 } : t,
    );
    expect(aiTrainPlan({ ...base, templates: noTanks })).toEqual([1, 1, 1]);
    // Armour only with the tank tech; mountains only for a country with them.
    expect(aiTrainPlan({ ...base, hasArmorTech: false })).toEqual([1, 1, 1]);
    expect(
      aiTrainPlan({
        ...base,
        hasArmorTech: false,
        hasMountains: true,
        counts: counts({ infantry: 40 }),
      }),
    ).toEqual([3, 3, 3]);
  });
});

describe("the AI's land war on the test map (spec §14)", () => {
  test("an AI at war fronts its border and attacks when strong", async () => {
    const { runner, g, ww, l, calls, d0 } = await aiWar("DEU", "POL");
    const deu = byTag(g, "DEU").smallID();
    const pol = byTag(g, "POL").smallID();
    finishDay(runner, d0);
    // Its armies front Poland along Germany's side of the border
    // (Berlin, Munich and Rome); a guard holds Berlin (4 edges or less).
    const fronts = l.armiesOf(deu).filter((a) => a.order.kind === "front");
    expect(fronts.length).toBeGreaterThan(0);
    for (const a of fronts) {
      expect(a.order.enemy).toBe(pol);
      expect([3, 4, 5]).toContain(a.order.anchor);
    }
    expect(
      l
        .armiesOf(deu)
        .some((a) => a.divisions.length === 2 && l.armyRegion(a) === 3),
    ).toBe(true);
    // The orders are the AI's, through land.issue.
    expect(calls.some((c) => c.smallID === deu && c.by === "ai")).toBe(true);
    // No attack before the plan is ready (spec §14.4).
    finishDay(runner, d0 + 5);
    expect(l.battles.size).toBe(0);
    // Within 30 days Germany holds Warsaw.
    let day = d0 + 6;
    while (l.controller[6] !== deu && day <= d0 + 30) finishDay(runner, day++);
    expect(l.controller[6]).toBe(deu);
    expect(ww.isAtWar(deu, pol) || !byTag(g, "POL").isAlive()).toBe(true);
  }, 120_000);

  test("an AI regroups when its org runs low and waits for it before attacking again", async () => {
    const { runner, g, calls, d0 } = await aiWar("DEU", "POL");
    const deu = byTag(g, "DEU").smallID();
    for (let d = d0; d <= d0 + 60; d++) finishDay(runner, d);
    // Every offensive Germany starts, it starts with its army at 85% org
    // or more (controller ruling 5): never on what recovered overnight.
    const on = calls.filter(
      (c) => c.smallID === deu && c.order.kind === "army_execute" && c.order.on,
    );
    expect(on.length).toBeGreaterThan(0);
    for (const c of on)
      expect(c.orgPm).toBeGreaterThanOrEqual(AI_ATTACK_ORG_PM);
  }, 120_000);

  test("an auto army waits for readiness before it attacks, even late in a war (Task 11, ruling 6)", async () => {
    // A human's auto army runs on the AI's gates. Sixty days into the war
    // the spec's readiness gate is open, but no attack on defenders starts
    // under AI_REATTACK_READY_BP: the army fronts Warsaw from 0 readiness
    // and attacks on the day it reaches 500 (100 a day), at full org. (An
    // even fight: three against three, under the pursuit ratio, where no
    // floor applies.)
    // (Poland is human too, so its division stays in Warsaw.)
    const runner = await wwRunner({ historicalAi: false }, [
      { clientID: HUMAN, country: "DEU" },
      { clientID: "HUMAN002", country: "POL" },
    ]);
    const g = runner.game;
    const l = land(g);
    // Germany alone: P3's call to arms (lane D) would bring its 1936
    // faction partner Italy (AI) in, which takes all of Poland's land within
    // the 61 days and leaves no Polish border to front.
    const p = g.worldWar()!.politics;
    const ita = byTag(g, "ITA").smallID();
    expect(p.factionIdx(ita)).toBe(p.factionIdx(byTag(g, "DEU").smallID()));
    leaveFaction(p, ita, g.ticks());
    warAfterPrep(runner, HUMAN, "POL");
    const d0 = today(g);
    finishDay(runner, d0 + 61);
    clearLand(g);
    const deu = byTag(g, "DEU").smallID();
    const pol = byTag(g, "POL").smallID();
    for (const id of [deu, pol]) {
      const ce = l.econ.country(id)!;
      ce.manpower += 1_000_000;
      for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 10_000;
    }
    const a = placeArmy(g, "DEU", 3, 3);
    placeArmy(g, "POL", 6, 3);
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol }),
    ).toBe(null);
    expect(l.issue(deu, { kind: "army_auto", army: a.id, on: true })).toBe(
      null,
    );
    const calls = spyIssue(g);
    const from = today(g);
    for (let d = from; d < from + 12; d++) finishDay(runner, d);
    const on = calls.filter(
      (c) => c.smallID === deu && c.order.kind === "army_execute" && c.order.on,
    );
    expect(on.length).toBeGreaterThan(0);
    expect(AI_REATTACK_READY_BP).toBe(500);
    expect(on[0].planBp).toBeGreaterThanOrEqual(500);
    expect(on[0].orgPm).toBeGreaterThanOrEqual(AI_ATTACK_ORG_PM);
  }, 120_000);

  test("a democracy at war with an aggressor only plans to take back its camp's land (Task 11)", async () => {
    // The all-AI test map's calendar: France joins Germany's war in 1939.
    // Its offensives aim only at French and British 1936 regions (the
    // Phoney War); Germany's take Polish land.
    const runner = await wwRunner();
    const g = runner.game;
    const l = land(g);
    const calls = spyIssue(g);
    stepTo(runner, 12_000);
    const owners = l.scenario.ownerByRegion();
    const fra = byTag(g, "FRA").smallID();
    const gbr = byTag(g, "GBR").smallID();
    const deu = byTag(g, "DEU").smallID();
    const plans = (id: number) =>
      calls.flatMap((c) =>
        c.smallID === id && c.order.kind === "army_plan" ? c.order.targets : [],
      );
    expect(g.worldWar()!.isAtWar(fra, deu)).toBe(true);
    for (const r of plans(fra)) expect([fra, gbr]).toContain(owners[r]);
    expect(plans(deu).length).toBeGreaterThan(0);
    // Round 2: once Germany holds Paris, the rule is lifted: France plans
    // into German land too (Germany's divisions gone, so France attacks).
    takeRegion(g, 1, "DEU");
    for (let r = 0; r < l.divisions.rows; r++) {
      if (l.divisions.alive(r) && l.divisions.owner[r] === deu) {
        l.killDivision(r, false);
      }
    }
    const from = calls.length;
    stepTo(runner, 12_000 + 30 * 8);
    const later = calls
      .slice(from)
      .flatMap((c) =>
        c.smallID === fra && c.order.kind === "army_plan"
          ? c.order.targets
          : [],
      );
    expect(later.some((r) => owners[r] === deu)).toBe(true);
  }, 120_000);

  test("guards hold the capital and the victory points near the enemy, measured on the high-water mark", async () => {
    // Germany (45 divisions) at war with Poland: a guard of 2 in Berlin
    // (the capital, on the border) and, with 10% of 45 = 4 divisions of
    // reserve, one more on Munich (4 points, next to Poland).
    const { runner, g, l, d0 } = await aiWar("DEU", "POL");
    const deu = byTag(g, "DEU").smallID();
    const guards = () =>
      l
        .armiesOf(deu)
        .filter((a) => a.divisions.length === 2 && a.order.kind !== "front")
        .map((a) => (a.order.kind === "move" ? a.order.to : l.armyRegion(a)))
        .sort((a, b) => a - b);
    finishDay(runner, d0);
    finishDay(runner, d0 + 1);
    expect(guards()).toEqual([3, 4]);
    expect(l.country(deu)!.peakDivisions).toBe(45);
    // The front armies lose 27 divisions: 18 are left, but the reserve is
    // still measured on the 45 Germany had (controller ruling 2).
    const guardIds = new Set(
      l
        .armiesOf(deu)
        .filter((a) => a.divisions.length === 2)
        .flatMap((a) => a.divisions),
    );
    let lost = 0;
    for (let r = 0; r < l.divisions.rows && lost < 27; r++) {
      const t = l.divisions;
      if (!t.alive(r) || t.owner[r] !== deu || guardIds.has(t.id[r])) continue;
      l.killDivision(r, true);
      lost++;
    }
    finishDay(runner, d0 + 2);
    finishDay(runner, d0 + 3);
    expect(l.country(deu)!.peakDivisions).toBe(45);
    expect(guards()).toEqual([3, 4]);
  }, 120_000);

  test("an AI never orders a human's army", async () => {
    const runner = await wwRunner({ historicalAi: false }, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    const l = land(g);
    const calls = spyIssue(g);
    warAfterPrep(runner, HUMAN, "POL");
    const deu = byTag(g, "DEU").smallID();
    const [first, second] = l.armiesOf(deu);
    const d0 = today(g);
    for (let d = d0; d < d0 + 10; d++) finishDay(runner, d);
    // Poland's AI is busy; Germany's armies only had the player's orders.
    expect(calls.some((c) => c.by === "ai" && c.smallID !== deu)).toBe(true);
    expect(calls.filter((c) => c.smallID === deu)).toEqual([]);
    expect(first.order.kind).toBe("idle");
    expect(second.order.kind).toBe("idle");
    // An auto army is the AI's (spec §8.5); the other one stays the player's.
    expect(l.issue(deu, { kind: "army_auto", army: first.id, on: true })).toBe(
      null,
    );
    for (let d = d0 + 10; d < d0 + 13; d++) finishDay(runner, d);
    const ai = calls.filter((c) => c.by === "ai" && c.smallID === deu);
    expect(ai.length).toBeGreaterThan(0);
    for (const c of ai) {
      expect("army" in c.order && c.order.army).toBe(first.id);
    }
    expect(first.auto).toBe(true);
    expect(first.order.kind).not.toBe("idle");
    expect(second.order.kind).toBe("idle");
    expect(l.country(deu)!.training).toEqual([]);
  }, 120_000);

  test("a war politics plans (a held war goal) fronts the border before it starts", async () => {
    // P3: plannedWars (60 days) replaces the P0 calendar. Germany holds a
    // war goal on Poland, no war yet: its armies front the Polish border.
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = g.worldWar()!;
    const l = land(g);
    const deu = byTag(g, "DEU").smallID();
    const pol = byTag(g, "POL").smallID();
    const d0 = today(g);
    ww.politics.country(deu)!.warGoals.push({
      on: pol,
      type: "conquer",
      group: "",
      untilDay: d0 + 365,
    });
    expect(ww.politics.plannedWars(deu, d0)).toEqual([pol]);
    finishDay(runner, d0 + 1);
    const fronts = l.armiesOf(deu).filter((a) => a.order.kind === "front");
    expect(fronts.length).toBeGreaterThan(0);
    for (const a of fronts) expect(a.order.enemy).toBe(pol);
    expect(ww.isAtWar(deu, pol)).toBe(false);
    expect(l.battles.size).toBe(0);
  }, 120_000);

  test("an AI without land contact sends nobody", async () => {
    // Britain is an island: at war with the Soviet Union it has no front
    // (no region of its side touches a Soviet one), so its army stays in
    // London (spec §13.3).
    const { runner, g, l, calls, d0 } = await aiWar("GBR", "SUN");
    const gbr = byTag(g, "GBR").smallID();
    for (let d = d0; d <= d0 + 30; d++) finishDay(runner, d);
    const armies = l.armiesOf(gbr);
    expect(armies.length).toBeGreaterThan(0);
    for (const a of armies) {
      expect(a.order.kind).not.toBe("front");
      expect(a.order.kind).not.toBe("plan");
      for (const id of a.divisions) {
        expect(l.divisions.region[l.divisions.rowOf(id)]).toBe(10);
      }
    }
    const moves = calls.filter(
      (c) =>
        c.smallID === gbr &&
        ["army_front", "army_plan", "army_move", "army_sea"].includes(
          c.order.kind,
        ),
    );
    expect(moves).toEqual([]);
  }, 120_000);

  test("AI orders go through land.issue", async () => {
    // Two runs of the same all-AI game stay equal tick by tick; every
    // order the AI gives is an "ai" order through land.issue.
    const play = async () => {
      const { runner, g, calls } = await aiWar("DEU", "POL");
      const hashes: number[] = [];
      for (let i = 0; i < 400; i++) {
        step(runner);
        hashes.push(hash(runner));
      }
      return { hashes, calls, g };
    };
    const a = await play();
    const b = await play();
    expect(a.hashes).toEqual(b.hashes);
    expect(a.calls.length).toBeGreaterThan(0);
    expect(a.calls.every((c) => c.by === "ai")).toBe(true);
    expect(a.calls.map((c) => [c.smallID, c.order])).toEqual(
      b.calls.map((c) => [c.smallID, c.order]),
    );
  }, 120_000);
});

async function worldFiles(): Promise<MapFiles> {
  return loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
}

describe("the AI's land war on world1936 (controller ruling 3)", () => {
  test("Germany masses on Poland's border before 1939-09-01 under P3's beats (Task 11)", async () => {
    // P3's planned wars within 60 days (Danzig, Poland, then France's and
    // Britain's joins): all are fronted, and Poland, Germany's own
    // offensive, gets twice its demand while France's front is only held.
    // P3 lane A (owner direction): history is a guide — in some games a
    // strong Germany attacks Poland in the spring; this seed's goes in
    // September, the case this test is about.
    const runner = await createGameRunner(
      { ...wwGameStart(), gameID: "WWSIM006" },
      undefined,
      await worldFiles(),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const l = ww.land;
    const sc = l.scenario;
    const deu = sc.smallIdOf("DEU");
    const pol = sc.smallIdOf("POL");
    const fra = sc.smallIdOf("FRA");
    stepTo(runner, dayStartTick(dayOfDate("1939-08-25"), WW_PREP_TICKS));
    expect(ww.isAtWar(deu, pol)).toBe(false);
    expect(ww.politics.plannedWars(deu, ww.day(g.ticks()))).toContain(pol);
    let onPoland = 0;
    let onFrance = 0;
    let all = 0;
    for (const a of l.armiesOf(deu)) {
      all += a.divisions.length;
      if (a.order.kind !== "front" && a.order.kind !== "plan") continue;
      if (a.order.enemy === pol) onPoland += a.divisions.length;
      if (a.order.enemy === fra) onFrance += a.divisions.length;
    }
    expect(onPoland * 10).toBeGreaterThanOrEqual(all * 4);
    expect(onPoland).toBeGreaterThan(onFrance);
    // They stand on Polish border regions.
    const t = l.divisions;
    let atBorder = 0;
    for (const a of l.armiesOf(deu)) {
      if (a.order.enemy !== pol) continue;
      for (const id of a.divisions) {
        const r = t.region[t.rowOf(id)];
        if (sc.edgesOf(r).some((e) => l.controller[e.to] === pol)) atBorder++;
      }
    }
    expect(atBorder * 10).toBeGreaterThanOrEqual(onPoland * 5);
  }, 600_000);

  test("Italy's 1936 plans on Addis Ababa stand on their own fronts from the start (Task 11, ruling 4)", async () => {
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      await worldFiles(),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    const l = g.worldWar()!.land;
    const sc = l.scenario;
    const ita = sc.smallIdOf("ITA");
    const eth = sc.smallIdOf("ETH");
    const addis = sc.landRegions.find((r) => r.name === "Addis Ababa")!.id;
    const plans = () =>
      l.armiesOf(ita).filter((a) => a.order.targets.includes(addis));
    // Anchored on a border region with Ethiopia of each army's own coast
    // (Eritrea's, Somaliland's), never 0.
    const start = plans();
    expect(start.length).toBe(2);
    for (const a of start) {
      expect(a.order).toMatchObject({ kind: "plan", enemy: eth });
      expect(a.order.executing).toBe(true);
      expect(a.order.anchor).not.toBe(0);
      expect(
        sc.edgesOf(a.order.anchor).some((e) => l.controller[e.to] === eth),
      ).toBe(true);
    }
    expect(new Set(start.map((a) => a.order.anchor)).size).toBe(2);
    // The AI's sea reach (Task 11: 6,000 km) covers Italy's ports to
    // Eritrea's, which 3,000 km did not.
    const napoli = sc.landRegions.find((r) => r.name === "Napoli")!.id;
    const eritrea = sc.landRegions.find((r) => r.name === "Eritrea")!.id;
    expect(sc.isPort(napoli) && sc.isPort(eritrea)).toBe(true);
    expect(sc.regionKm(napoli, eritrea)).toBeGreaterThan(3000);
    expect(sc.regionKm(napoli, eritrea)).toBeLessThanOrEqual(AI_SEA_MAX_KM);
    // Day 0's front step (and the AI's day) keeps them.
    stepTo(runner, dayStartTick(1, WW_PREP_TICKS) + WW_DAY_SPLIT);
    for (const a of start) {
      expect(a.order.kind).toBe("plan");
      expect(a.order.executing).toBe(true);
      expect(a.front.length).toBeGreaterThan(0);
    }
  }, 120_000);

  test("Japan holds on in China until 1939 (historical AI, fixed seed)", async () => {
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      await worldFiles(),
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const l = ww.land;
    const sc = l.scenario;
    const jpn = sc.smallIdOf("JPN");
    const chn = sc.smallIdOf("CHN");
    stepTo(runner, dayStartTick(dayOfDate("1939-01-01"), WW_PREP_TICKS));
    expect(ww.isCapitulated(jpn)).toBe(false);
    expect(byTag(g, "JPN").isAlive()).toBe(true);
    // The calendar's war of 1937 is on, and China stands too.
    expect(ww.isAtWar(jpn, chn)).toBe(true);
    expect(ww.isCapitulated(chn)).toBe(false);
    // Japan keeps Korea and Kwantung, and its army is on the mainland
    // (the home islands' armies crossed the sea, spec §13.3).
    const region = (name: string) =>
      sc.landRegions.find((r) => r.name === name)!.id;
    const seoul = region("Seoul");
    expect(l.controller[seoul]).toBe(jpn);
    expect(l.controller[region("Kwantung")]).toBe(jpn);
    const mainland = new Set<number>([seoul]);
    const queue = [seoul];
    for (let i = 0; i < queue.length; i++) {
      for (const e of sc.edgesOf(queue[i])) {
        if (!mainland.has(e.to)) {
          mainland.add(e.to);
          queue.push(e.to);
        }
      }
    }
    let total = 0;
    let there = 0;
    for (const a of l.armiesOf(jpn)) {
      for (const id of a.divisions) {
        total++;
        if (mainland.has(l.divisions.region[l.divisions.rowOf(id)])) there++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(there * 10).toBeGreaterThanOrEqual(total * 8);
  }, 600_000);
});
