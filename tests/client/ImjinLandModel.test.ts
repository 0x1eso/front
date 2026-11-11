// ww177 I3b: the Imjin land battle's client model (phase clock, ambush lock,
// volley clock, crossings, the siege panel, routs).
import {
  ARMY_MOVING,
  ARMY_RETREAT,
  type ArmySummary,
  type BattleSummary,
} from "@openfront/engine-api/ww1936/LandTypes";
import { describe, expect, test } from "vitest";
import {
  ambushLockTicks,
  crossingView,
  ImjinBattleClock,
  phaseClock,
  RoutWatch,
  siegePanel,
  volleyView,
  type SiegeMap,
} from "../../src/client/hud/ww1936/ImjinLandModel";

describe("Imjin land battle model", () => {
  test("the phase clock counts rounds and phases from round 1's tick", () => {
    expect(phaseClock(100, 100)).toEqual({
      round: 1,
      phase: 1,
      ticksLeft: 50,
      step: "opening",
    });
    expect(phaseClock(100, 149)).toMatchObject({ round: 10, ticksLeft: 1 });
    expect(phaseClock(100, 150)).toMatchObject({
      round: 11,
      phase: 2,
      ticksLeft: 50,
      step: "clash",
    });
    const c = new ImjinBattleClock();
    c.note({ orders: [{ region: 7 } as never] }, 30);
    c.note({ orders: [{ region: 7 } as never, { region: 9 } as never] }, 40);
    expect(c.firstRound(7)).toBe(30);
    expect(c.firstRound(9)).toBe(40);
    c.note({ orders: [] }, 50);
    expect(c.firstRound(7)).toBeUndefined();
    // Ambushed: two phases (20 rounds) without orders.
    expect(ambushLockTicks(true, 100, 100)).toBe(100);
    expect(ambushLockTicks(true, 100, 200)).toBe(0);
    expect(ambushLockTicks(false, 100, 100)).toBe(0);
  });

  test("the volley clock: massed fire, reloads, and the hidden enemy rhythm", () => {
    const at = (round: number) =>
      volleyView("JPN", "massed_volley", "JOS", "charge", round);
    expect(at(1).mine).toEqual({ mode: "massed", beat: "fire", nextFire: 0 });
    expect(at(2).mine).toEqual({ mode: "massed", beat: "reload", nextFire: 2 });
    expect(at(3).mine).toEqual({ mode: "massed", beat: "reload", nextFire: 1 });
    expect(at(4).mine?.beat).toBe("fire");
    expect(at(1).foe).toBeNull();
    const jos = volleyView("JOS", "hold", "JPN", "volley_advance", 2);
    expect(jos.mine).toBeNull();
    expect(jos.foe).toBe("hidden");
    expect(
      volleyView("JOS", "hold", "JPN", "volley_advance", 2, 3).foe,
    ).toMatchObject({ beat: "reload" });
  });

  test("crossings: phases left, and the frozen great river is a ford", () => {
    expect(crossingView(2, 6, 1)).toMatchObject({
      edge: "great_river",
      phasesLeft: 2,
      attackerPct: -50,
      widthDen: 2,
      frozen: false,
    });
    expect(crossingView(2, 6, 11)?.phasesLeft).toBe(1);
    expect(crossingView(2, 6, 21)?.phasesLeft).toBe(0);
    expect(crossingView(2, 1, 1)).toMatchObject({
      frozen: true,
      phases: 1,
      attackerPct: -20,
    });
    expect(crossingView(0, 6, 1)).toBeNull();
  });

  test("the siege panel: breach with cannon, else starve; who sees what", () => {
    const owners: Record<number, string> = { 1: "JOS", 2: "JPN", 3: "MIN" };
    const map = (neighbourOwner: number) => {
      const m = {
        data: { imjin: {} },
        region: () => ({ imjinTerrain: "walled" }),
        edgeBetween: () => -1,
        edge: () => ({ river: 0 }),
        regionNeighbours: () => [2],
        tagOfSmallId: (id: number) => owners[id],
      } as unknown as SiegeMap;
      return { m, controller: [0, 1, neighbourOwner] };
    };
    const siege = { region: 1, grainDays: 0, fort: 2, morale: 800 };
    const enemy = (a: number, b: number) => a !== b && a !== 0 && b !== 0;
    const jpn = map(2);
    const p = siegePanel(siege, jpn.m, jpn.controller, 2, enemy);
    expect(p).toMatchObject({
      method: "starve",
      breachEvery: 0,
      starving: true,
      role: "besieger",
    });
    const min = map(3);
    const q = siegePanel(siege, min.m, min.controller, 1, enemy);
    expect(q).toMatchObject({ method: "breach", breachEvery: 6 });
    expect(q.role).toBe("defender");
  });

  test("a rout is an army whose retreat began since the last look", () => {
    const army = (state: number, region: number) =>
      ({ id: 5, owner: 2, region, state }) as ArmySummary;
    const battle = { region: 4, attacker: 2, defender: 1 } as BattleSummary;
    const w = new RoutWatch();
    expect(w.update([army(ARMY_RETREAT, 4)], [battle])).toEqual([]);
    expect(w.update([army(0, 4)], [battle])).toEqual([]);
    expect(w.update([army(ARMY_MOVING | ARMY_RETREAT, 4)], [])).toEqual([
      { army: 5, owner: 2, region: 4, foe: 1 },
    ]);
    expect(w.update([army(ARMY_MOVING | ARMY_RETREAT, 3)], [])).toEqual([]);
  });
});
