// P4 Task 10 (lane AI): the invasion planner (spec §17.4).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  aiGiveUpInvasion,
  AiInvasionInput,
  aiInvasionPick,
  aiInvasionReviewDue,
  aiInvasionScore,
  expectedSupPm,
} from "@openfront/engine/ww1936/navy/AiInvasion";
import { leaveFaction } from "@openfront/engine/ww1936/politics/Factions";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import {
  HUMAN,
  placeArmy,
  pol,
  step,
  stepTo,
  warAfterPrep,
  wwRunner,
} from "./util";

const target = (over: Partial<AiInvasionInput>): AiInvasionInput => ({
  target: REGION.rome,
  vp: 0,
  port: false,
  enemyCapital: false,
  islandBase: false,
  divisions: 0,
  routeKm: 0,
  ...over,
});

describe("the invasion planner (spec §17.4)", () => {
  test("a target's score by hand", () => {
    // (21 + 5 + 20) × 100 / (1 + 0) / (1 + 0) = 4600.
    const capital = target({ vp: 21, port: true, enemyCapital: true });
    expect(aiInvasionScore(capital)).toBe(4600);
    // Two enemy divisions about and 1,500 km: 4600 / 7 = 657, / 2 = 328.
    expect(aiInvasionScore({ ...capital, divisions: 2, routeKm: 1500 })).toBe(
      328,
    );
    // An island base: + 5; 999 km is still under the first thousand.
    expect(
      aiInvasionScore(target({ vp: 5, islandBase: true, routeKm: 999 })),
    ).toBe(1000);
    // A history beat's window: ×10 (spec §17.6).
    expect(aiInvasionScore({ ...capital, beat: true })).toBe(46_000);
  });

  test("a route the fleet cannot hold at 600‰ is no candidate", () => {
    // Ours 150 against 100 at worst on the route: 600‰, just enough.
    expect(expectedSupPm(150, 100)).toBe(600);
    expect(expectedSupPm(149, 100)).toBe(598);
    expect(expectedSupPm(0, 0)).toBe(0);
    const rich = { ...target({ target: 1, vp: 30 }), supPm: 598 };
    const poor = { ...target({ target: 2, vp: 1 }), supPm: 600 };
    expect(aiInvasionPick([rich, poor])?.target).toBe(2);
    expect(aiInvasionPick([rich])).toBeNull();
    // Ties go to the smaller region.
    const a = { ...target({ target: 7, vp: 3 }), supPm: 1000 };
    const b = { ...target({ target: 4, vp: 3 }), supPm: 1000 };
    expect(aiInvasionPick([a, b])?.target).toBe(4);
  });

  test("an AI with an overseas enemy plans a landing", async () => {
    // ww1936sea: a human Italy at war with an AI Britain (London and
    // Malta are islands: no land front; Britain out of its faction, so
    // France's border is not its front). With a battle fleet and an army
    // in London, Britain readies a landing on Rome within 60 days.
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "ITA" }],
      SEA.map,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const gbr = TAG_ID.GBR;
    leaveFaction(pol(g), gbr, g.ticks());
    ww.navy.createFleet(gbr, REGION.london, [
      ["bb", 2, 2],
      ["dd", 2, 6],
    ]);
    placeArmy(g, "GBR", REGION.london, 4);
    const invades: WwOrder[] = [];
    const issue = ww.navy.issue.bind(ww.navy);
    ww.navy.issue = (id, o, tick, by) => {
      if (id === gbr && o.kind === "army_invade") invades.push(o);
      return issue(id, o, tick, by);
    };
    warAfterPrep(runner, HUMAN, "GBR");
    expect(ww.isAtWar(TAG_ID.ITA, gbr)).toBe(true);
    // A day is 7.5 ticks.
    const end = dayStartTick(ww.day(g.ticks()) + 60, ww.prepEndTick());
    while (g.ticks() < end && invades.length === 0) step(runner);
    expect(invades.length).toBeGreaterThan(0);
    const o = invades[0] as Extract<WwOrder, { kind: "army_invade" }>;
    expect(o.target).toBe(REGION.rome);
    // The army stands in London (a port) and fits the capacity.
    const a = ww.land.armies.get(o.army)!;
    expect(a.owner).toBe(gbr);
    expect(ww.land.armyRegion(a)).toBe(REGION.london);
    expect(a.divisions.length).toBeGreaterThanOrEqual(3);
    expect(a.divisions.length).toBeLessThanOrEqual(10);
  }, 120_000);

  test("a ready invasion that cannot sail is cancelled and its army freed", async () => {
    // Pure: hopeless at once (no convoys to be had, a navy too weak for
    // 500‰, anything else), else on the 30-day review.
    const base = {
      block: "no_convoys" as const,
      convoyStock: 10,
      convoysNeed: 20,
      expectedSupPm: 900,
      reviewDay: false,
    };
    expect(aiGiveUpInvasion(base)).toBe(true);
    expect(aiGiveUpInvasion({ ...base, convoyStock: 40 })).toBe(false);
    expect(
      aiGiveUpInvasion({ ...base, convoyStock: 40, reviewDay: true }),
    ).toBe(true);
    const sup = { ...base, block: "naval_supremacy_low" as const };
    expect(aiGiveUpInvasion(sup)).toBe(false);
    expect(aiGiveUpInvasion({ ...sup, expectedSupPm: 499 })).toBe(true);
    expect(aiGiveUpInvasion({ ...sup, reviewDay: true })).toBe(true);
    expect(aiGiveUpInvasion({ ...base, block: "not_at_war" })).toBe(true);
    expect(aiInvasionReviewDue(3, 33)).toBe(true);
    expect(aiInvasionReviewDue(3, 34)).toBe(false);
    // In a game: Britain's landing on Rome is prepared, but Britain has
    // no convoy left at all: the day it is ready lane I cannot sail it,
    // the AI cancels it and the army is free again.
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "ITA" }],
      SEA.map,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const gbr = TAG_ID.GBR;
    leaveFaction(pol(g), gbr, g.ticks());
    ww.navy.createFleet(gbr, REGION.london, [
      ["bb", 2, 2],
      ["dd", 2, 6],
    ]);
    placeArmy(g, "GBR", REGION.london, 4);
    const cancels: number[] = [];
    const issue = ww.navy.issue.bind(ww.navy);
    ww.navy.issue = (id, o, tick, by) => {
      const r = issue(id, o, tick, by);
      if (id === gbr && o.kind === "invasion_cancel" && r === null) {
        cancels.push(o.army);
      }
      return r;
    };
    warAfterPrep(runner, HUMAN, "GBR");
    const end = dayStartTick(ww.day(g.ticks()) + 40, ww.prepEndTick());
    let army = 0;
    while (g.ticks() < end && cancels.length === 0) {
      step(runner);
      const inv = [...ww.navy.invasions.values()].find((x) => x.owner === gbr);
      if (inv !== undefined && army === 0) {
        army = inv.army;
        // Ready tomorrow, with not a single convoy to carry it.
        inv.prepDone = inv.prepDays - 1;
        ww.economy.country(gbr)!.stock[equipKey("convoy", 1)] = 0;
      }
    }
    expect(army).not.toBe(0);
    expect(cancels).toEqual([army]);
    expect([...ww.navy.invasions.values()].some((x) => x.owner === gbr)).toBe(
      false,
    );
    expect(ww.land.armies.get(army)?.order.kind).toBe("idle");
  }, 120_000);

  test("no fleet, no landing: the route cannot be held", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "ITA" }],
      SEA.map,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const gbr = TAG_ID.GBR;
    leaveFaction(pol(g), gbr, g.ticks());
    placeArmy(g, "GBR", REGION.london, 4);
    let invades = 0;
    const issue = ww.navy.issue.bind(ww.navy);
    ww.navy.issue = (id, o, tick, by) => {
      if (id === gbr && o.kind === "army_invade") invades++;
      return issue(id, o, tick, by);
    };
    warAfterPrep(runner, HUMAN, "GBR");
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 30, ww.prepEndTick()));
    expect(invades).toBe(0);
  }, 120_000);
});
