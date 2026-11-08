// ww162 lane L1 (design ww162 §1.1-§1.3): the battle planner's three lines.
// The lib rules over a stub strip map (the front line between two ends, the
// fallback rings, the order checks), then the engine on the test map: a
// front line that follows the border, a broad line and a spearhead, a goal
// reached or dropped, and the fallback line (by order and by itself).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { idleOrder, WW_ZONE_MAX } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  bestRing,
  borderRegionsOf,
  frontChainBetween,
  frontLineBetween,
  suggestFallback,
  type FrontWorld,
} from "@openfront/engine-lib/ww1936/FrontRules";
import {
  landOrderBlockOf,
  type OrderCheckArmy,
  type OrderCheckWorld,
} from "@openfront/engine-lib/ww1936/LandOrderChecks";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { aiBestRing } from "@openfront/engine/ww1936/land/AiLand";
import { fallbackDue } from "@openfront/engine/ww1936/land/Fronts";
import {
  finishPlan,
  planAxis,
  planTargets,
} from "@openfront/engine/ww1936/land/Plans";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { vi } from "vitest";
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

// ---- A stub strip map: `n` columns, rows of regions behind each other ----
// Row A (1..n) is ours and faces the enemy row B (101..); rows C (201..) and
// D (301..) lie behind A. Neighbours: along each row, and column-wise
// D - C - A - B.
const US = 1;
const THEM = 2;
const NEUTRAL = 3;
const A = (i: number) => i;
const B = (i: number) => 100 + i;
const C = (i: number) => 200 + i;
const D = (i: number) => 300 + i;

function strip(n: number, control: Record<number, number> = {}) {
  const adj = new Map<number, number[]>();
  const link = (x: number, y: number) => {
    adj.set(x, [...(adj.get(x) ?? []), y]);
    adj.set(y, [...(adj.get(y) ?? []), x]);
  };
  for (let i = 1; i <= n; i++) {
    for (const row of [A, B, C, D]) if (i < n) link(row(i), row(i + 1));
    link(A(i), B(i));
    link(C(i), A(i));
    link(D(i), C(i));
  }
  const ids = [...adj.keys()].sort((x, y) => x - y);
  const edges: { to: number; edge: number }[][] = [];
  for (const [u, vs] of adj) {
    edges[u] = [...vs].sort((x, y) => x - y).map((to) => ({ to, edge: 0 }));
  }
  const controller: number[] = [];
  for (const r of ids) controller[r] = r >= 100 && r < 200 ? THEM : US;
  for (const [r, c] of Object.entries(control)) controller[Number(r)] = c;
  const w: OrderCheckWorld = {
    scenario: {
      edgesOf: (r: number) => edges[r] ?? [],
      edge: () => ({ river: 0 }),
      landRegions: ids.map((id) => ({ id })),
      maxRegionId: () => ids[ids.length - 1],
      region: (r: number) => (adj.has(r) ? { vp: 0 } : undefined),
      regionKm: (x: number, y: number) => Math.abs(x - y),
    } as unknown as FrontWorld["scenario"],
    controller,
    sameSide: (x, y) => x > 0 && y > 0 && x === y,
    isEnemy: (x, y) => (x === US && y === THEM) || (x === THEM && y === US),
    me: US,
    day: 0,
    rail: () => 0,
    isPort: () => false,
    vp: () => 0,
    army: () => null,
    armyCount: () => 1,
  };
  return w;
}

describe("ww162 L1: the front line between two ends (lib)", () => {
  test("the chain is the border path between the ends, in drawn order", () => {
    const w = strip(8);
    expect(frontChainBetween(w, US, THEM, A(2), A(6))).toEqual([2, 3, 4, 5, 6]);
    expect(frontChainBetween(w, US, THEM, A(6), A(2))).toEqual([6, 5, 4, 3, 2]);
    expect(frontChainBetween(w, US, 0, A(3), A(3))).toEqual([3]);
  });

  test("an end off the border snaps to the nearest border region over our land", () => {
    const w = strip(8);
    // C4 and D4 lie behind A4.
    expect(frontLineBetween(w, US, THEM, C(4), D(7))).toEqual({
      ends: [4, 7],
      chain: [4, 5, 6, 7],
    });
    // An end the enemy took snaps back to our border too.
    const lost = strip(8, { [A(1)]: THEM });
    expect(frontLineBetween(lost, US, THEM, A(1), A(3))?.ends).toEqual([2, 3]);
  });

  test("an end that reaches no border takes the other's; none: no line", () => {
    // Nobody holds a region of the country named as the enemy.
    const w = strip(4);
    expect(frontLineBetween(w, US, NEUTRAL, A(1), A(3))).toBeNull();
    expect(frontChainBetween(w, US, NEUTRAL, A(1), A(3))).toEqual([]);
  });

  test("ends in different border pieces: the first end's piece", () => {
    // A neutral A4 and B4: the border splits into A1-A3 and A5-A8.
    const w = strip(8, { [A(4)]: NEUTRAL, [B(4)]: NEUTRAL });
    expect(frontChainBetween(w, US, THEM, A(2), A(6))).toEqual([2, 1, 3]);
  });

  test("the chain stops at WW_ZONE_MAX regions", () => {
    const w = strip(WW_ZONE_MAX + 10);
    const chain = frontChainBetween(w, US, THEM, A(1), A(WW_ZONE_MAX + 10));
    expect(chain.length).toBe(WW_ZONE_MAX);
    expect(chain[0]).toBe(1);
    expect(chain[WW_ZONE_MAX - 1]).toBe(WW_ZONE_MAX);
  });

  test("a 30-day advance: an end on the border never moves, and the snap is stable", () => {
    const control: Record<number, number> = {};
    let ends: [number, number] = [A(3), A(9)];
    for (let day = 0; day < 30; day++) {
      // Each day we take one enemy region, left to right then back.
      const col = 1 + ((day * 7) % 12);
      control[B(col)] = US;
      const w = strip(12, control);
      const border = new Set(borderRegionsOf(w, US, THEM));
      const line = frontLineBetween(w, US, THEM, ends[0], ends[1]);
      if (line === null) break;
      for (const k of [0, 1]) {
        if (border.has(ends[k])) expect(line.ends[k]).toBe(ends[k]);
        expect(border.has(line.ends[k])).toBe(true);
      }
      // Asking again with the snapped ends gives the same line.
      expect(frontLineBetween(w, US, THEM, line.ends[0], line.ends[1])).toEqual(
        line,
      );
      ends = line.ends;
    }
  });
});

describe("ww162 L1: the fallback rings (lib)", () => {
  test("bestRing moved from AiLand: the AI's name is the same function", () => {
    expect(aiBestRing).toBe(bestRing);
    const border = { regions: 8, terrain: 0 };
    expect(bestRing(border, [{ regions: 5, terrain: 0, vpLost: 0 }])).toBe(0);
    expect(bestRing(border, [{ regions: 7, terrain: 0, vpLost: 0 }])).toBe(-1);
  });

  test("[추천]: the ring behind the zone, not along the border", () => {
    const w = strip(8);
    // No ring is shorter than the zone: the nearest ring with regions.
    expect(suggestFallback(w, US, THEM, [3, 4, 5])).toEqual([203, 204, 205]);
    // Nothing of ours in the zone: nothing to suggest.
    expect(suggestFallback(w, US, THEM, [B(3)])).toEqual([]);
  });

  test("[추천] takes a shorter ring when one scores better", () => {
    // Columns 1-6; behind the line only C3 and C4 are ours (a neck), so the
    // first ring is 2 regions against a line of 6.
    const control: Record<number, number> = {};
    for (const i of [1, 2, 5, 6]) control[C(i)] = NEUTRAL;
    for (let i = 1; i <= 6; i++) control[D(i)] = NEUTRAL;
    const w = strip(6, control);
    expect(suggestFallback(w, US, THEM, [1, 2, 3, 4, 5, 6])).toEqual([
      203, 204,
    ]);
  });
});

describe("ww162 L1: the line orders' checks (lib)", () => {
  const army: OrderCheckArmy = {
    owner: US,
    divisions: 3,
    regions: [A(3)],
    fighting: false,
    allPara: false,
    paraLastDay: -1,
    front: true,
    fallback: [],
  };
  const check = (o: WwOrder, a: OrderCheckArmy = army) => {
    const w = strip(8);
    return landOrderBlockOf({ ...w, army: () => a }, o as never);
  };

  test("army_front_line: ends of our side that reach the border", () => {
    const o = { kind: "army_front_line", army: 1, enemy: THEM } as const;
    expect(check({ ...o, ends: [A(2), C(6)] })).toBeNull();
    expect(check({ ...o, ends: [A(2), B(6)] })).toBe("bad_region");
    expect(check({ ...o, ends: [A(2), 999] })).toBe("bad_region");
    expect(check({ ...o, ends: [A(2), A(3)], enemy: NEUTRAL })).toBe(
      "not_adjacent",
    );
  });

  test("army_goal: enemy regions in reach; empty always fine", () => {
    const o = {
      kind: "army_goal",
      army: 1,
      spear: false,
      stance: "balanced",
    } as const;
    expect(check({ ...o, regions: [] })).toBeNull();
    expect(check({ ...o, regions: [B(2), B(5)] })).toBeNull();
    expect(check({ ...o, regions: [B(2), A(5)] })).toBe("not_at_war");
  });

  test("army_fallback and army_fall_back", () => {
    const o = { kind: "army_fallback", army: 1, manual: false } as const;
    expect(check({ ...o, regions: [C(2), D(3)] })).toBeNull();
    expect(check({ ...o, regions: [C(2), B(3)] })).toBe("bad_region");
    const idle = { ...army, front: false };
    expect(check({ ...o, regions: [C(2)] }, idle)).toBe("not_adjacent");
    expect(check({ ...o, regions: [] }, idle)).toBeNull();
    const back = { kind: "army_fall_back", army: 1 } as const;
    expect(check(back)).toBe("no_path");
    expect(check(back, { ...army, fallback: [C(2)] })).toBeNull();
    expect(check(back, { ...idle, fallback: [C(2)] })).toBe("not_adjacent");
  });
});

describe("ww162 L1: what a plan aims at", () => {
  test("a broad line pushes from every zone region, a spearhead from the nearest", () => {
    const zone = [3, 4, 5];
    const dist = new Int32Array(10);
    dist.set([9, 9, 9, 2, 1, 1, 0, 0, 9, 9]);
    const broad = { ...idleOrder(), kind: "plan" as const, goal: [6, 7] };
    expect(planTargets(broad)).toEqual([6, 7]);
    expect([...planAxis(zone, broad, dist)]).toEqual([3, 4, 5]);
    const spear = { ...broad, goal: [7, 6], spear: true };
    expect(planTargets(spear)).toEqual([7]);
    expect([...planAxis(zone, spear, dist)]).toEqual([4, 5]);
    // No goal: the targets as before.
    const old = { ...idleOrder(), kind: "plan" as const, targets: [6, 7] };
    expect(planTargets(old)).toEqual([6, 7]);
    expect([...planAxis(zone, old, dist)]).toEqual([4, 5]);
  });
});

// ---- The engine on the test map (Berlin 3, Munich 4, Rome 5 (Italy, our
// side) face Warsaw 6 and Krakow 7) ----

const HUMAN_POL = "HUMAN002";
const DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: HUMAN_POL, country: "POL" as const },
];

function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}
const today = (g: Game) => g.worldWar()!.day(g.ticks());

async function atWar() {
  const runner = await wwRunner({}, DEU_POL);
  const g = runner.game;
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const l = land(g);
  const said: string[] = [];
  const show = g.displayMessage.bind(g);
  vi.spyOn(g, "displayMessage").mockImplementation((key, ...rest) => {
    said.push(String(key));
    return show(key, ...rest);
  });
  return {
    runner,
    g,
    l,
    said,
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
  };
}

/** Division counts by dest region, for `regions`. */
function posts(l: WwLand, a: Army, regions: number[]): number[] {
  const t = l.divisions;
  return regions.map(
    (r) => a.divisions.filter((id) => t.dest[t.rowOf(id)] === r).length,
  );
}

describe("ww162 L1: the front line in the engine", () => {
  test("army_front_line sets the chain as the front, clears the zone, keeps the plan on the same front", async () => {
    const { runner, l, deu, pol } = await atWar();
    const a = placeArmy(runner.game, "DEU", 3, 6);
    expect(
      l.issue(deu, { kind: "army_zone", army: a.id, regions: [3] }),
    ).not.toBeNull(); // no front yet
    expect(
      l.issue(deu, {
        kind: "army_front_line",
        army: a.id,
        ends: [3, 5],
        enemy: pol,
      }),
    ).toBeNull();
    step(runner);
    expect(a.order.kind).toBe("front");
    expect(a.order.ends).toEqual([3, 5]);
    expect(a.order.zone).toEqual([]);
    expect(a.front).toEqual([3, 4, 5]);
    // Readiness stays on the same front, and goes on another enemy's.
    a.planBp = 500;
    l.issue(deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [5, 4],
      enemy: pol,
    });
    step(runner);
    expect(a.planBp).toBeGreaterThanOrEqual(500);
    expect(a.front).toEqual([5, 4]);
    l.issue(deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [3, 3],
      enemy: 0,
    });
    expect(a.planBp).toBe(0);
    // An old order clears the line.
    step(runner);
    l.issue(deu, { kind: "army_zone", army: a.id, regions: [3, 4] });
    expect(a.order.ends).toBeUndefined();
  }, 60_000);

  test("the line follows the border as regions change hands", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 6);
    l.issue(deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [3, 5],
      enemy: pol,
    });
    step(runner);
    takeRegion(g, 6, "DEU");
    // Berlin is inside now: its end snaps to Munich (the smaller of Munich
    // and Warsaw, one step away); Rome stays.
    finishDay(runner, today(g) + 1);
    expect(a.order.ends).toEqual([4, 5]);
    expect(a.front).toEqual([4, 5]);
    expect(posts(l, a, [4, 5]).reduce((x, y) => x + y)).toBe(6);
  }, 60_000);
});

describe("ww162 L1: the offensive line in the engine", () => {
  test("a broad line spreads the spare evenly; a spearhead masses it by the first waypoint", async () => {
    const { runner, l, deu, pol } = await atWar();
    const a = placeArmy(runner.game, "DEU", 4, 6);
    l.issue(deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [3, 5],
      enemy: pol,
    });
    expect(
      l.issue(deu, {
        kind: "army_goal",
        army: a.id,
        regions: [6, 7],
        spear: false,
        stance: "careful",
      }),
    ).toBeNull();
    step(runner);
    expect(a.order.kind).toBe("plan");
    expect(a.order.goal).toEqual([6, 7]);
    expect(a.order.ends).toEqual([3, 5]);
    expect(a.order.executing).toBe(false);
    expect(posts(l, a, [3, 4, 5])).toEqual([2, 2, 2]);
    l.issue(deu, {
      kind: "army_goal",
      army: a.id,
      regions: [7],
      spear: true,
      stance: "careful",
    });
    step(runner);
    expect(a.order.spear).toBe(true);
    const p = posts(l, a, [3, 4, 5]);
    expect(p[0]).toBe(1);
    expect(p[1] + p[2]).toBe(5);
    // Empty: the line goes, the front stays.
    l.issue(deu, {
      kind: "army_goal",
      army: a.id,
      regions: [],
      spear: false,
      stance: "careful",
    });
    expect(a.order.kind).toBe("front");
    expect(a.order.goal).toBeUndefined();
    expect(a.order.ends).toEqual([3, 5]);
    // An old plan order clears it too.
    l.issue(deu, {
      kind: "army_goal",
      army: a.id,
      regions: [6],
      spear: false,
      stance: "careful",
    });
    l.issue(deu, {
      kind: "army_plan",
      army: a.id,
      targets: [7],
      stance: "careful",
    });
    expect(a.order.goal).toBeUndefined();
    expect(a.order.ends).toBeUndefined();
  }, 60_000);

  test("a goal taken becomes the new front, and its player is told", async () => {
    const { runner, g, l, said, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 3);
    // Krakow is held in strength: only empty Warsaw is walked into.
    placeArmy(g, "POL", 7, 8);
    l.issue(deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [3, 5],
      enemy: pol,
    });
    l.issue(deu, {
      kind: "army_goal",
      army: a.id,
      regions: [6],
      spear: false,
      stance: "balanced",
    });
    expect(l.issue(deu, { kind: "army_execute", army: a.id, on: true })).toBe(
      null,
    );
    for (let i = 0; i < 12 && a.order.kind === "plan"; i++) {
      finishDay(runner, today(g) + 1);
    }
    expect(l.controller[6]).toBe(deu);
    expect(a.order.kind).toBe("front");
    expect(a.order.goal).toBeUndefined();
    // Warsaw is a border region (it faces Krakow): the front sits there.
    expect(a.order.ends).toEqual([6, 6]);
    expect(said).toContain("events_display.ww1936_goal_reached");
  }, 120_000);

  test("a goal region out of the war drops out with the stop notice", async () => {
    const { runner, g, l, said, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 4, 3);
    l.issue(deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [3, 5],
      enemy: pol,
    });
    l.issue(deu, {
      kind: "army_goal",
      army: a.id,
      regions: [7, 6],
      spear: true,
      stance: "careful",
    });
    step(runner);
    // Krakow passes to the Soviets, who are at war with nobody (the day's
    // check, run at once: the occupation would hand it back by tomorrow).
    takeRegion(g, 7, "SUN");
    expect(finishPlan(l, a)).toBe(false);
    expect(a.order.goal).toEqual([6]);
    expect(said).toContain("events_display.ww1936_direct_stop_war");
    expect(said).not.toContain("events_display.ww1936_goal_reached");
  }, 60_000);
});

describe("ww162 L1: the fallback line in the engine", () => {
  /** Germany holds Warsaw: Berlin lies behind a front of Munich, Rome and Warsaw. */
  async function behind() {
    const s = await atWar();
    takeRegion(s.g, 6, "DEU");
    const a = placeArmy(s.g, "DEU", 6, 3);
    s.l.issue(s.deu, {
      kind: "army_front_line",
      army: a.id,
      ends: [6, 6],
      enemy: s.pol,
    });
    expect(
      s.l.issue(s.deu, {
        kind: "army_fallback",
        army: a.id,
        regions: [3],
        manual: false,
      }),
    ).toBeNull();
    step(s.runner);
    return { ...s, a };
  }

  test("army_fall_back: the line becomes the zone, the other lines go", async () => {
    const { runner, l, said, deu, a } = await behind();
    expect(a.order.fallback).toEqual([3]);
    expect(a.front).toEqual([6]);
    expect(l.issue(deu, { kind: "army_fall_back", army: a.id })).toBeNull();
    step(runner);
    expect(a.order.kind).toBe("front");
    expect(a.order.zone).toEqual([3]);
    expect(a.order.ends).toBeUndefined();
    expect(a.order.fallback).toBeUndefined();
    expect(a.front).toEqual([3]);
    expect(posts(l, a, [3])).toEqual([3]);
    expect(said).toContain("events_display.ww1936_fell_back");
    // Nothing left to fall back to.
    expect(l.issue(deu, { kind: "army_fall_back", army: a.id })).toBe(
      "no_path",
    );
  }, 60_000);

  test("the fallback line stays on a front order, and an empty one clears it", async () => {
    const { l, deu, pol, a } = await behind();
    l.issue(deu, { kind: "army_front", army: a.id, anchor: 4, enemy: pol });
    expect(a.order.fallback).toEqual([3]);
    l.issue(deu, {
      kind: "army_fallback",
      army: a.id,
      regions: [],
      manual: false,
    });
    expect(a.order.fallback).toBeUndefined();
  }, 60_000);

  test("outnumbered and worn out for two days, the army falls back by itself (not when manual)", async () => {
    const { runner, g, l, said, deu, a } = await behind();
    placeArmy(g, "POL", 7, 8);
    const t = l.divisions;
    const wear = () => {
      for (const id of a.divisions) t.org[t.rowOf(id)] = 0;
    };
    // The next day spent worn out (the org kept at 0 every tick: no rest),
    // up to the tick every country has had its step.
    let day = today(g);
    const wornDay = () => {
      day++;
      const end = dayStartTick(day, WW_PREP_TICKS) + WW_DAY_SPLIT;
      while (g.ticks() < end) {
        wear();
        step(runner);
      }
    };
    wear();
    expect(fallbackDue(l, a)).toBe(true);
    // Manual: the rule holds but nothing happens.
    l.issue(deu, {
      kind: "army_fallback",
      army: a.id,
      regions: [3],
      manual: true,
    });
    wornDay();
    wornDay();
    expect(a.fbDays).toBe(0);
    expect(a.order.ends).toEqual([6, 6]);
    l.issue(deu, {
      kind: "army_fallback",
      army: a.id,
      regions: [3],
      manual: false,
    });
    wornDay();
    expect(a.fbDays).toBe(1);
    expect(a.order.fallback).toEqual([3]);
    wornDay();
    expect(a.order.zone).toEqual([3]);
    expect(a.order.fallback).toBeUndefined();
    expect(a.fbDays).toBe(0);
    expect(said).toContain("events_display.ww1936_fell_back");
  }, 120_000);

  test("fresh, the same odds do not trigger it", async () => {
    const { g, l, a } = await behind();
    placeArmy(g, "POL", 7, 8);
    expect(fallbackDue(l, a)).toBe(false);
  }, 60_000);
});
