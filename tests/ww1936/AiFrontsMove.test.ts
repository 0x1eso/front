// ww103: what seven full AI games found. Fronts froze: the AI built level 5
// forts along whole lines, stacked 100 divisions on a region (which starved
// there and could not be attacked at any odds), and its attack gate stopped it
// for years. Men died without battles for the same stacks. So: forts by value,
// a line no deeper than its width, the rest behind it where they are fed, no
// training past what it can feed or use, and a stalemate lowers the bars.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import {
  AI_FORT_LINE_LEVEL,
  AI_FORT_PRESSED_LEVEL,
  AI_LIBERATION_LIFT_ANY_DAYS,
  AI_LIBERATION_LIFT_RATIO_PM,
  AI_LIBERATION_LIFT_WAR_DAYS,
  AI_STALE_FROM_DAYS,
  AI_STALE_FULL_DAYS,
  AI_STALE_LOW_PM,
  AI_STALE_MID_PM,
  AI_TRAIN_HUNGRY_PCT,
  AI_TRAIN_IDLE_MIN,
  aiFortCap,
  aiGatePm,
  aiLiberationOver,
  aiRearArmies,
  aiStaleGate,
  aiTrainStops,
} from "@openfront/engine/ww1936/land/AiLand";
import {
  AI_FORT_DECISION_LEVEL,
  bordersFortified,
} from "@openfront/engine/ww1936/politics/AiPolitics";
import { pickRegions } from "@openfront/engine/ww1936/politics/EffectsEcon";
import { addWarGoal } from "@openfront/engine/ww1936/politics/WarGoals";
import { describe, expect, it } from "vitest";
import {
  byTag,
  clearLand,
  dropPact,
  land,
  placeArmy,
  pol,
  stepTo,
  takeRegion,
  wwRunner,
} from "./util";

/** All-AI test map, no calendar: Germany at war with Poland after the preparation minute. */
async function war() {
  const runner = await wwRunner({ historicalAi: false });
  const g = runner.game;
  dropPact(g, "DEU", "POL");
  const [deu, pl] = [byTag(g, "DEU"), byTag(g, "POL")];
  addWarGoal(pol(g), deu.smallID(), pl.smallID(), "conquer", "", 0);
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = g.worldWar()!;
  expect(declareWar(g, ww, deu, pl, g.ticks())).not.toEqual([]);
  return {
    runner,
    g,
    ww,
    l: land(g),
    deu: deu.smallID(),
    pl: pl.smallID(),
    d0: ww.day(g.ticks()),
  };
}

function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}

describe("the AI's fronts move (ww103)", () => {
  it("level 5 forts only on the top spots; a line 2, pressed 3", () => {
    expect(aiFortCap(true, false)).toBe(5);
    expect(aiFortCap(false, false)).toBe(AI_FORT_LINE_LEVEL);
    expect(aiFortCap(false, true)).toBe(AI_FORT_PRESSED_LEVEL);
    expect(AI_FORT_PRESSED_LEVEL).toBeLessThanOrEqual(3);
  });

  it("a stalemate lowers the bars to even odds, and no further", () => {
    const g = aiGatePm("democracy");
    expect(aiStaleGate(g, 0)).toEqual(g);
    expect(aiStaleGate(g, AI_STALE_FROM_DAYS)).toEqual(g);
    const half = aiStaleGate(g, (AI_STALE_FROM_DAYS + AI_STALE_FULL_DAYS) / 2);
    expect(half.midPm).toBeLessThan(g.midPm);
    expect(half.midPm).toBeGreaterThan(AI_STALE_MID_PM);
    expect(aiStaleGate(g, 5000)).toEqual({
      midPm: AI_STALE_MID_PM,
      lowPm: AI_STALE_LOW_PM,
    });
    // A bar under the floor stays where it is.
    expect(aiStaleGate({ midPm: 900, lowPm: 600 }, 5000)).toEqual({
      midPm: 900,
      lowPm: 600,
    });
  });

  it("training stops at what it can't feed, and at war at what it can't use", () => {
    const base = { total: 100, hungry: 0, idle: 0, atWar: true };
    expect(aiTrainStops(base)).toBe(false);
    expect(aiTrainStops({ ...base, hungry: AI_TRAIN_HUNGRY_PCT })).toBe(false);
    expect(aiTrainStops({ ...base, hungry: AI_TRAIN_HUNGRY_PCT + 1 })).toBe(
      true,
    );
    expect(aiTrainStops({ ...base, idle: AI_TRAIN_IDLE_MIN })).toBe(true);
    // At peace an idle army is an army at peace; a small one is no mass.
    expect(aiTrainStops({ ...base, idle: 90, atWar: false })).toBe(false);
    expect(aiTrainStops({ ...base, total: 30, idle: 20 })).toBe(false);
  });

  it("an idle army stranded on enemy land fights for the region it stands in", async () => {
    const { runner, g, l, deu, pl, d0 } = await war();
    clearLand(g);
    const WARSAW = 6;
    placeArmy(g, "POL", WARSAW, 3);
    const a = placeArmy(g, "DEU", WARSAW, 3);
    expect(a.order.kind).toBe("idle");
    const t = l.divisions;
    const row = () => t.rowOf(a.divisions[0]);
    expect(t.battle[row()]).toBe(0);
    for (let d = d0; d <= d0 + 6; d++) finishDay(runner, d);
    // In the battle for Warsaw, or it is over and the region was fought for.
    const fought =
      l.battles.has(WARSAW) ||
      l.controller[WARSAW] === deu ||
      !l.armies.has(a.id);
    expect(fought).toBe(true);
    expect(l.controller[WARSAW] === pl && !l.battles.has(WARSAW)).toBe(
      !l.armies.has(a.id),
    );
  }, 120_000);

  it("the same army with nobody left takes the region", async () => {
    const { runner, g, l, deu, d0 } = await war();
    clearLand(g);
    const WARSAW = 6;
    placeArmy(g, "DEU", WARSAW, 2);
    expect(l.controller[WARSAW]).not.toBe(deu);
    for (let d = d0; d <= d0 + 6; d++) finishDay(runner, d);
    expect(l.controller[WARSAW]).toBe(deu);
  }, 120_000);

  it("a line takes what its width uses; the armies over it stand behind", () => {
    const army = (id: number, n: number, over = {}) => ({
      id,
      divisions: n,
      running: false,
      shock: false,
      behind: false,
      fixed: false,
      ...over,
    });
    // Twelve fill it: the largest stay, the smaller go.
    expect([
      ...aiRearArmies([army(1, 6), army(2, 12), army(3, 9)], 12),
    ]).toEqual([3, 1]);
    // Shock armies keep the line, a running attack is left alone.
    expect([
      ...aiRearArmies(
        [
          army(1, 12),
          army(2, 6, { shock: true }),
          army(3, 6, { running: true }),
        ],
        12,
      ),
    ]).toEqual([1]);
    // Who stands behind stays behind while the line is full.
    expect([
      ...aiRearArmies([army(1, 12, { behind: true }), army(2, 12)], 12),
    ]).toEqual([1]);
    // A line short of divisions sends nobody back.
    expect(aiRearArmies([army(1, 6), army(2, 5)], 12).size).toBe(0);
    // A Defend-only army stays where its owner put it.
    expect(
      aiRearArmies([army(1, 12), army(2, 6, { fixed: true })], 12).size,
    ).toBe(0);
  });

  it("two years in, a democracy no longer only liberates", () => {
    const odds = AI_LIBERATION_LIFT_RATIO_PM;
    expect(aiLiberationOver(AI_LIBERATION_LIFT_WAR_DAYS - 1, odds)).toBe(false);
    expect(aiLiberationOver(AI_LIBERATION_LIFT_WAR_DAYS, odds)).toBe(true);
    expect(aiLiberationOver(AI_LIBERATION_LIFT_WAR_DAYS, 500)).toBe(false);
    expect(aiLiberationOver(AI_LIBERATION_LIFT_ANY_DAYS, 0)).toBe(true);
  });

  it("the fort decision stops where the AI's border stands at its level", async () => {
    const { g, deu } = await war();
    const p = pol(g);
    const econ = g.worldWar()!.economy;
    p.threatBp[byTag(g, "POL").smallID()] = 9000;
    const picks = pickRegions(p, deu, { borderWith: "threat", n: 3 });
    expect(picks.length).toBeGreaterThan(0);
    for (const r of picks) econ.fort[r] = 0;
    expect(bordersFortified(p, deu)).toBe(false);
    econ.fort[picks[0]] = AI_FORT_DECISION_LEVEL;
    expect(bordersFortified(p, deu)).toBe(true);
  }, 120_000);

  it("at peace an army starving with no way out disbands; men come home", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS + 1);
    const l = land(g);
    const LONDON = 10;
    takeRegion(g, LONDON, "DEU");
    // An enclave: no land road home, and no port either.
    g.worldWar()!.economy.buildingArray("naval_base")[LONDON] = 0;
    const a = placeArmy(g, "DEU", LONDON, 40);
    const d0 = g.worldWar()!.day(g.ticks());
    for (let d = d0; d <= d0 + 25; d++) finishDay(runner, d);
    expect(l.armies.has(a.id)).toBe(false);
  }, 120_000);
});
