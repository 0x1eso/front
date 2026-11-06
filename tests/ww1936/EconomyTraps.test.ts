// ww115, phase E0 of ww113-economy-design.md: the economy's traps that are
// not in a file of their own (T7 Manpower, T8 EconomyRules, T12
// NationalTraits, T13 Trade and SeaTrade hold theirs).
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { BUILDING_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { effAfterAdding } from "@openfront/engine-lib/ww1936/EconomyRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { queueBuild } from "@openfront/engine/ww1936/economy/Construction";
import {
  addLine,
  changeLine,
  LINE_PEAK_FORGET_DAYS,
  lineStops,
  setLineFactories,
  stepProduction,
} from "@openfront/engine/ww1936/economy/Production";
import {
  byTag,
  clearStartSetup,
  HUMAN,
  stepTo,
  takeRegion,
  withTestPolitics,
  wwRunnerCapture,
} from "./util";

withTestPolitics();

function finishDay(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + 7);
}

async function germany() {
  const { runner, updates } = await wwRunnerCapture({}, [
    { clientID: HUMAN, country: "DEU" },
  ]);
  const g = runner.game;
  const ww = g.worldWar()!;
  const econ = ww.economy;
  const deu = byTag(g, "DEU");
  const ce = econ.country(deu.smallID())!;
  clearStartSetup(econ, ce);
  const region = (name: string) =>
    ww.scenario.landRegions.find((r) => r.name === name)!.id;
  const notices = (key: string) =>
    updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((e) => e.message === key)
      .map((e) => e.params);
  return { runner, g, ww, econ, deu, ce, region, notices };
}

/** A rifle line at 40 % with `n` factories working. */
async function workingLine(n: number) {
  const s = await germany();
  expect(addLine(s.econ, s.ce, "infantry_equipment", 1, n)).toBeNull();
  const line = s.ce.lines[0];
  s.ce.totals.mil = n;
  stepProduction(s.econ, s.ce, 1);
  line.effBp = 4000;
  /** One day with `mil` factories, its efficiency growth left out. */
  const day = (mil: number, d = 1) => {
    s.ce.totals.mil = mil;
    const before = line.effBp;
    stepProduction(s.econ, s.ce, d);
    const after = line.effBp;
    line.effBp = Math.min(before, after);
    return line.effBp;
  };
  return { ...s, line, day };
}

describe("T6: a repaired factory rejoins its line without a penalty", () => {
  test("factories lost and repaired leave the efficiency alone", async () => {
    const { line, day } = await workingLine(10);
    day(6);
    expect(line.active).toBe(6);
    expect(line.peak).toBe(10);
    // Before: back at the floor, (4000 × 6 + 1000 × 4) / 10 = 2800.
    expect(day(10)).toBe(4000);
    expect(line.active).toBe(10);
    expect(line.peak).toBeUndefined();
  });

  test("the real thing: a bombed-out factory that is mended", async () => {
    const { runner, econ, ce, region } = await germany();
    expect(addLine(econ, ce, "infantry_equipment", 1, 6)).toBeNull();
    finishDay(runner, 0);
    const line = ce.lines[0];
    expect(line.active).toBe(6);
    line.effBp = 4000;
    const berlin = region("Berlin");
    const at = berlin * BUILDING_IDS.length + BUILDING_IDS.indexOf("mil");
    econ.damage[at] = 2000;
    finishDay(runner, 1);
    expect(line.active).toBe(4);
    econ.damage[at] = 0;
    finishDay(runner, 2);
    expect(line.active).toBe(6);
    expect(line.effBp).toBeGreaterThanOrEqual(4000);
  });

  test("past the recent count, factories still join at the floor", async () => {
    const { line, day } = await workingLine(10);
    day(6);
    line.factories = 14;
    // Four new ones at the floor over the ten it knew, plus the day's growth.
    const joined = effAfterAdding(4000, 10, 4);
    expect(day(14)).toBeGreaterThanOrEqual(joined);
    expect(line.effBp).toBeLessThan(joined + 100);
  });

  test("the memory fades: a factory a month", async () => {
    const { line, day } = await workingLine(10);
    day(6, 1);
    expect(line.peak).toBe(10);
    day(6, LINE_PEAK_FORGET_DAYS);
    expect(line.peak).toBe(9);
    for (let n = 2; n <= 3; n++) day(6, n * LINE_PEAK_FORGET_DAYS);
    expect(line.peak).toBe(7);
    day(6, 4 * LINE_PEAK_FORGET_DAYS);
    expect(line.peak).toBeUndefined();
  });

  test("an order for fewer factories gives them up, as does a retool", async () => {
    const { econ, ce, line, day } = await workingLine(10);
    expect(setLineFactories(econ, ce, line.id, 6)).toBeNull();
    day(10);
    expect(line.active).toBe(6);
    expect(line.peak).toBeUndefined();
    expect(setLineFactories(econ, ce, line.id, 10)).toBeNull();
    const joined = effAfterAdding(4000, 6, 4);
    expect(day(10)).toBeGreaterThanOrEqual(joined);
    expect(line.effBp).toBeLessThan(joined + 100);

    day(6);
    expect(line.peak).toBe(10);
    expect(changeLine(econ, ce, line.id, "artillery", 1)).toBeNull();
    expect(line.peak).toBeUndefined();
  });
});

describe("T12: a line that makes nothing says why", () => {
  test("no factory left for it, or its equipment no longer allowed", async () => {
    const { econ, ce } = await germany();
    expect(addLine(econ, ce, "infantry_equipment", 1, 4)).toBeNull();
    expect(addLine(econ, ce, "artillery", 1, 4)).toBeNull();
    // Not yet stepped: the screens do not call a new line stopped.
    ce.totals.mil = 8;
    expect(lineStops(econ, ce)).toEqual([undefined, undefined]);
    ce.totals.mil = 4;
    expect(lineStops(econ, ce)).toEqual([undefined, "no_factories"]);
    // Set to 0 by hand: no reason needed. A licence's end: the reason.
    ce.lines[1].factories = 0;
    expect(lineStops(econ, ce)).toEqual([undefined, undefined]);
    ce.researched.delete("artillery_1");
    expect(lineStops(econ, ce)).toEqual([undefined, "not_allowed"]);
  });
});

describe("T9: the occupation share rounds on the country's total", () => {
  test("two regions that each round to 0 still give a factory", async () => {
    const { runner, ww, econ, ce, deu, g, region } = await germany();
    const [lyon, krakow] = [region("Lyon"), region("Krakow")];
    econ.addBuilding(krakow, "mil", 3); // Lyon 2, Krakow 4 at the 20 % share
    stepTo(runner, WW_PREP_TICKS + 1);
    const home = ce.totals.mil;
    const tick = runner.game.ticks();
    ww.setWar(deu.smallID(), byTag(g, "FRA").smallID(), tick);
    ww.setWar(deu.smallID(), byTag(g, "POL").smallID(), tick);
    takeRegion(g, lyon, "DEU");
    takeRegion(g, krakow, "DEU");
    finishDay(runner, 1);
    expect(econ.controlPct(lyon)).toBe(20);
    expect(econ.controlPct(krakow)).toBe(20);
    // 2 × 20 % + 4 × 20 % = 1.2; rounded alone they were 0 and 0.
    expect(ce.totals.mil).toBe(home + 1);
  });
});

describe("T11: a dropped queue entry is said aloud", () => {
  test("no room left when it completes", async () => {
    const { runner, econ, ce, region, notices } = await germany();
    const munich = region("Munich");
    expect(queueBuild(econ, ce, munich, "civ", 1)).toBeNull();
    stepTo(runner, WW_PREP_TICKS + 1);
    econ.addBuilding(munich, "civ", 40);
    ce.queue[0].progress = 1e9;
    finishDay(runner, 0);
    expect(ce.queue).toEqual([]);
    expect(notices("events_display.ww1936_build_dropped_full")).toEqual([
      { building: "civ", region: munich },
    ]);
  });

  test("the region lost", async () => {
    const { runner, ww, econ, ce, deu, g, region, notices } = await germany();
    const munich = region("Munich");
    expect(queueBuild(econ, ce, munich, "civ", 1)).toBeNull();
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), byTag(g, "FRA").smallID(), runner.game.ticks());
    takeRegion(g, munich, "FRA");
    finishDay(runner, 1);
    expect(ce.queue).toEqual([]);
    expect(notices("events_display.ww1936_build_dropped_lost")).toEqual([
      { building: "civ", region: munich },
    ]);
  });
});
