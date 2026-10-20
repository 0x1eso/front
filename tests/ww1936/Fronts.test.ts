// World War 1936 P2 (plan Task 3 Step 5): front assignment on the test map
// (P2 spec §8.1) — divisions spread by the threat they face, the front
// follows an advance, yesterday's assignment holds within one.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { MOVE_NONE } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Army } from "@openfront/engine/ww1936/land/WwLand";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwRunner,
} from "./util";

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];

/** Runs until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}
const today = (g: Game) => g.worldWar()!.day(g.ticks());

/** Division ids by their dest. */
function byDest(g: Game, a: Army): Map<number, number[]> {
  const l = land(g);
  const out = new Map<number, number[]>();
  for (const id of a.divisions) {
    const d = l.divisions.dest[l.divisions.rowOf(id)];
    out.set(d, [...(out.get(d) ?? []), id]);
  }
  return out;
}

/** Steps until no division of the army moves (at most `max` ticks). */
function settle(runner: GameRunner, a: Army, max = 400) {
  const l = land(runner.game);
  for (let i = 0; i < max; i++) {
    const moving = a.divisions.some(
      (id) => l.divisions.mode[l.divisions.rowOf(id)] !== MOVE_NONE,
    );
    if (!moving) return;
    step(runner);
  }
  throw new Error("the army never settled");
}

async function atWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  return {
    runner,
    g,
    l: land(g),
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
  };
}

describe("World War 1936 P2: fronts (P2 spec §8.1)", () => {
  test("divisions spread by threat", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 6);
    placeArmy(g, "POL", 6, 8);
    const ids = [...a.divisions];
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol }),
    ).toBe(null);
    step(runner);
    // Six divisions: two regions. Weights 2 + 8 (Warsaw) each: 3 and 3,
    // the three highest ids off to Munich.
    expect(a.front).toEqual([3, 4]);
    expect(byDest(g, a)).toEqual(
      new Map([
        [3, ids.slice(0, 3)],
        [4, ids.slice(3)],
      ]),
    );
    settle(runner, a);
    const where = a.divisions.map(
      (id) => l.divisions.region[l.divisions.rowOf(id)],
    );
    expect(where).toEqual([3, 3, 3, 4, 4, 4]);
  });

  test("the front follows an advance", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    // Nine divisions: three regions. Rome is Italy's, our side, and faces
    // Krakow (spec §7.1: fronts are the side's).
    const a = placeArmy(g, "DEU", 3, 9);
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol }),
    ).toBe(null);
    step(runner);
    expect(a.front).toEqual([3, 4, 5]);
    settle(runner, a);
    takeRegion(g, 6, "DEU");
    // Berlin is no border region now: the next day the anchor moves to the
    // nearest one over our land (Munich, the smaller of Munich and Warsaw).
    finishDay(runner, today(g) + 1);
    expect(a.order.anchor).toBe(4);
    expect(a.front).toEqual([4, 5, 6]);
    expect([...byDest(g, a).keys()].sort()).toEqual([4, 5, 6]);
    // Every border gone (Poland holds nothing next to us): the army waits.
    takeRegion(g, 7, "DEU");
    finishDay(runner, today(g) + 1);
    expect(a.order.kind).toBe("idle");
    expect(a.front).toEqual([]);
  });

  test("yesterday's assignment holds within one", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 6);
    const warsaw = placeArmy(g, "POL", 6, 8);
    expect(
      l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol }),
    ).toBe(null);
    step(runner);
    settle(runner, a);
    finishDay(runner, today(g) + 1);
    const before = byDest(g, a);
    expect(before.get(3)).toHaveLength(3);
    expect(before.get(4)).toHaveLength(3);
    // Warsaw empties, two Polish divisions in Krakow: weights 2 and 4,
    // shares 2 and 4 — one off each: nobody moves.
    for (const id of [...warsaw.divisions]) {
      l.killDivision(l.divisions.rowOf(id), false);
    }
    placeArmy(g, "POL", 7, 2);
    finishDay(runner, today(g) + 1);
    expect(byDest(g, a)).toEqual(before);
    // Four more in Krakow: weights 2 and 8, shares 1 and 5. Berlin is two
    // over: its two highest ids go to Munich.
    placeArmy(g, "POL", 7, 4);
    finishDay(runner, today(g) + 1);
    const berlin = before.get(3)!;
    expect(byDest(g, a)).toEqual(
      new Map([
        [3, berlin.slice(0, 1)],
        [4, [...before.get(4)!, ...berlin.slice(1)].sort((x, y) => x - y)],
      ]),
    );
  });
});
