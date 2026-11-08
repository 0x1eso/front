// ww162 lane L2 (design ww162 §1.1-§1.4): per-division pins and a
// marshal's lines. The lib rules over a stub strip map (where a pin may go,
// a split offensive line), then the engine on the test map: a pinned
// division walks, takes or attacks its region and holds while the army lays
// out without it; the orders that release pins; a group's front, offensive
// and fallback lines cut among its armies and recut by day.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  divisionMoveBlock,
  sectorEnds,
  splitGoal,
} from "@openfront/engine-lib/ww1936/CommandRules";
import type { FrontWorld } from "@openfront/engine-lib/ww1936/FrontRules";
import type { OrderCheckWorld } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { makeMarshal } from "@openfront/engine/ww1936/depth/Command";
import { canServe } from "@openfront/engine/ww1936/land/GeneralsRun";
import { freeRows } from "@openfront/engine/ww1936/land/Plans";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
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

// ---- A stub strip map (as ArmyPlannerLines): row A (1..n) is ours and
// faces the enemy row B (101..); rows C (201..) and D (301..) lie behind A.
const US = 1;
const THEM = 2;
const NEUTRAL = 3;
const A = (i: number) => i;
const B = (i: number) => 100 + i;
const C = (i: number) => 200 + i;

function strip(n: number, control: Record<number, number> = {}) {
  const adj = new Map<number, number[]>();
  const link = (x: number, y: number) => {
    adj.set(x, [...(adj.get(x) ?? []), y]);
    adj.set(y, [...(adj.get(y) ?? []), x]);
  };
  const D = (i: number) => 300 + i;
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

describe("ww162 L2: where a pin may go (lib)", () => {
  test("our land reached over our land; an enemy region next to it", () => {
    const w = strip(8);
    expect(divisionMoveBlock(w, [A(1), C(4)], C(7))).toBeNull();
    expect(divisionMoveBlock(w, [A(1)], B(5))).toBeNull();
    expect(divisionMoveBlock(w, [A(1)], 999)).toBe("bad_region");
  });

  test("an enemy region with no region of ours next to it is out of reach", () => {
    // A3 is theirs too: B3 touches only their land.
    const w = strip(8, { [A(3)]: THEM });
    expect(divisionMoveBlock(w, [A(1)], B(3))).toBe("not_adjacent");
    expect(divisionMoveBlock(w, [A(1)], A(3))).toBeNull();
  });

  test("land at peace is refused; a cut-off division has no way", () => {
    const w = strip(8, {
      [B(6)]: NEUTRAL,
      [A(2)]: THEM,
      [C(1)]: THEM,
    });
    expect(divisionMoveBlock(w, [A(4)], B(6))).toBe("not_at_war");
    // A1 is cut off (A2 and C1 are theirs): it attacks only next to it.
    expect(divisionMoveBlock(w, [A(1)], B(1))).toBeNull();
    expect(divisionMoveBlock(w, [A(1)], B(5))).toBe("no_path");
    expect(divisionMoveBlock(w, [A(4), A(1)], C(5))).toBe("no_path");
  });
});

describe("ww162 L2: a split offensive line (lib)", () => {
  test("each region goes to the army whose sector is nearest, ties to the earlier", () => {
    const w = strip(8);
    expect(
      splitGoal(
        w,
        [B(1), B(4), B(5), B(8)],
        [
          [A(1), A(2)],
          [A(6), A(7)],
        ],
      ),
    ).toEqual([
      [B(1), B(4)],
      [B(5), B(8)],
    ]);
    // An empty sector takes nothing; a region none reaches goes to the first army with a sector.
    expect(splitGoal(w, [B(1), 999], [[], [A(6)]])).toEqual([[], [B(1), 999]]);
    expect(splitGoal(w, [B(1)], [])).toEqual([]);
  });

  test("a sector's ends are its first and last region", () => {
    expect(sectorEnds([4, 5, 6])).toEqual([4, 6]);
    expect(sectorEnds([4])).toEqual([4, 4]);
    expect(sectorEnds([])).toBeNull();
  });
});

// ---- The engine on the test map (Berlin 3, Munich 4, Rome 5 (Italy, our
// side) face Warsaw 6 and Krakow 7; Paris 1 is France's) ----

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
  return {
    runner,
    g,
    l,
    deu: byTag(g, "DEU").smallID(),
    pol: byTag(g, "POL").smallID(),
  };
}

function rowOf(l: WwLand, id: number): number {
  return l.divisions.rowOf(id);
}

/** Days (at most `max`) until `done`; true when it came. */
function until(runner: GameRunner, max: number, done: () => boolean): boolean {
  const g = runner.game;
  for (let i = 0; i < max && !done(); i++) finishDay(runner, today(g) + 1);
  return done();
}

function frontLine(
  l: WwLand,
  deu: number,
  a: Army,
  ends: [number, number],
  enemy: number,
) {
  expect(
    l.issue(deu, { kind: "army_front_line", army: a.id, ends, enemy }),
  ).toBeNull();
}

describe("ww162 L2: pinned divisions in the engine", () => {
  test("a pin on our land: it walks there and holds; the army lays out without it; release takes it back", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 3);
    frontLine(l, deu, a, [3, 3], pol);
    step(runner);
    const [d0, d1, d2] = a.divisions;
    const t = l.divisions;
    expect(
      l.issue(deu, {
        kind: "division_move",
        army: a.id,
        divisions: [d0, d0],
        region: 5,
      }),
    ).toBe("bad_index");
    expect(
      l.issue(deu, {
        kind: "division_move",
        army: a.id,
        divisions: [d0],
        region: 5,
      }),
    ).toBeNull();
    expect(a.pins).toEqual([[d0, 5]]);
    expect(freeRows(l, a).map((r) => t.id[r])).toEqual([d1, d2]);
    step(runner);
    expect(t.dest[rowOf(l, d0)]).toBe(5);
    expect(until(runner, 12, () => t.region[rowOf(l, d0)] === 5)).toBe(true);
    // Days later it still holds Rome, and the army's front holds Berlin.
    finishDay(runner, today(g) + 2);
    expect(t.region[rowOf(l, d0)]).toBe(5);
    expect(t.dest[rowOf(l, d0)]).toBe(5);
    expect(a.front).toEqual([3]);
    expect([d1, d2].map((id) => t.dest[rowOf(l, id)])).toEqual([3, 3]);
    // The summary sends the pin.
    expect(l.armySummary(a).mine!.pins).toEqual([[d0, 5]]);
    // Released, the army takes it back to its front.
    expect(
      l.issue(deu, { kind: "division_release", army: a.id, divisions: [] }),
    ).toBeNull();
    expect(a.pins).toEqual([]);
    step(runner);
    expect(t.dest[rowOf(l, d0)]).toBe(3);
  }, 120_000);

  test("a pin on an empty enemy region: it walks in, takes it and holds there", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 2);
    frontLine(l, deu, a, [3, 3], pol);
    step(runner);
    const [d0] = a.divisions;
    expect(
      l.issue(deu, {
        kind: "division_move",
        army: a.id,
        divisions: [d0],
        region: 6,
      }),
    ).toBeNull();
    step(runner);
    const t = l.divisions;
    expect(t.next[rowOf(l, d0)]).toBe(6);
    expect(until(runner, 12, () => l.controller[6] === deu)).toBe(true);
    finishDay(runner, today(g) + 1);
    expect(t.region[rowOf(l, d0)]).toBe(6);
    expect(a.pins).toEqual([[d0, 6]]);
  }, 120_000);

  test("a pin on a defended enemy region: it attacks it from the region next to it", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    placeArmy(g, "POL", 7, 2);
    const a = placeArmy(g, "DEU", 4, 2);
    frontLine(l, deu, a, [4, 4], pol);
    step(runner);
    const [d0, d1] = a.divisions;
    expect(
      l.issue(deu, {
        kind: "division_move",
        army: a.id,
        divisions: [d0],
        region: 7,
      }),
    ).toBeNull();
    step(runner);
    const t = l.divisions;
    expect(t.battle[rowOf(l, d0)]).toBe(7);
    // The army is not attacking: its free division holds Munich.
    expect(t.battle[rowOf(l, d1)]).toBe(0);
    // France is at peace with us; another army's division is not ours to pin.
    expect(
      l.issue(deu, {
        kind: "division_move",
        army: a.id,
        divisions: [d1],
        region: 1,
      }),
    ).toBe("not_at_war");
    const b = placeArmy(g, "DEU", 3, 1);
    expect(
      l.issue(deu, {
        kind: "division_move",
        army: a.id,
        divisions: [b.divisions[0]],
        region: 3,
      }),
    ).toBe("bad_index");
  }, 120_000);

  test("pins go with the division, and on army-wide orders; front and line orders keep them", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    const a = placeArmy(g, "DEU", 3, 4);
    frontLine(l, deu, a, [3, 3], pol);
    step(runner);
    const [d0, d1, d2, d3] = a.divisions;
    const pin = (ids: number[]) =>
      expect(
        l.issue(deu, {
          kind: "division_move",
          army: a.id,
          divisions: ids,
          region: 4,
        }),
      ).toBeNull();
    pin([d3, d1, d0]);
    expect(a.pins).toEqual([
      [d0, 4],
      [d1, 4],
      [d3, 4],
    ]);
    // A front order, a line order and the stance keep them.
    l.issue(deu, { kind: "army_front", army: a.id, anchor: 3, enemy: pol });
    frontLine(l, deu, a, [3, 4], pol);
    l.issue(deu, {
      kind: "army_goal",
      army: a.id,
      regions: [6],
      spear: false,
      stance: "careful",
    });
    expect(a.pins.length).toBe(3);
    // A split takes the highest id away, its pin with it; a dead one too.
    expect(
      l.issue(deu, { kind: "army_split", army: a.id, count: 1, template: 0 }),
    ).toBeNull();
    expect(a.divisions).not.toContain(d3);
    expect(a.pins).toEqual([
      [d0, 4],
      [d1, 4],
    ]);
    l.killDivision(rowOf(l, d0), true);
    expect(a.pins).toEqual([[d1, 4]]);
    expect(
      l.issue(deu, { kind: "division_release", army: a.id, divisions: [d1] }),
    ).toBeNull();
    expect(a.pins).toEqual([]);
    // The AI taking the army, a halt and a move take every division.
    const orders: WwOrder[] = [
      { kind: "army_auto", army: a.id, on: true },
      { kind: "army_halt", army: a.id },
      { kind: "army_move", army: a.id, region: 4 },
    ];
    for (const o of orders) {
      pin([d1, d2]);
      expect(l.issue(deu, o), o.kind).toBeNull();
      expect(a.pins, o.kind).toEqual([]);
    }
  }, 120_000);

  test("falling back releases the pins", async () => {
    const { runner, g, l, deu, pol } = await atWar();
    takeRegion(g, 6, "DEU");
    const a = placeArmy(g, "DEU", 6, 3);
    frontLine(l, deu, a, [6, 6], pol);
    l.issue(deu, {
      kind: "army_fallback",
      army: a.id,
      regions: [3],
      manual: true,
    });
    step(runner);
    l.issue(deu, {
      kind: "division_move",
      army: a.id,
      divisions: [a.divisions[0]],
      region: 4,
    });
    expect(a.pins.length).toBe(1);
    expect(l.issue(deu, { kind: "army_fall_back", army: a.id })).toBeNull();
    expect(a.pins).toEqual([]);
    step(runner);
    const t = l.divisions;
    expect(a.divisions.map((id) => t.dest[rowOf(l, id)])).toEqual([3, 3, 3]);
  }, 120_000);
});

describe("ww162 L2: a marshal's lines", () => {
  async function group() {
    const s = await atWar();
    const { g, l, deu } = s;
    const ww = g.worldWar()!;
    const fm = l
      .country(deu)!
      .generals.find((x) => x.army === 0 && canServe(l, x, l.day()))!;
    makeMarshal(ww.depth, deu, fm, 0);
    const a = placeArmy(g, "DEU", 3, 2);
    const b = placeArmy(g, "DEU", 4, 2);
    expect(
      ww.depth.issue(
        deu,
        { kind: "ag_create", fm: fm.id, armies: [a.id, b.id] },
        g.ticks(),
      ),
    ).toBeNull();
    const grp = ww.depth.groups.find((x) => x.owner === deu)!;
    return { ...s, d: ww.depth, a, b, grp };
  }

  test("a group front line is cut into one sector per army, and follows the border by day", async () => {
    const { runner, g, l, deu, pol, a, b, grp } = await group();
    expect(
      l.issue(deu, {
        kind: "group_front_line",
        group: grp.id + 1000,
        ends: [3, 5],
        enemy: pol,
      }),
    ).toBe("bad_index");
    expect(
      l.issue(deu, {
        kind: "group_front_line",
        group: grp.id,
        ends: [6, 5],
        enemy: pol,
      }),
    ).toBe("bad_region");
    expect(
      l.issue(deu, {
        kind: "group_front_line",
        group: grp.id,
        ends: [3, 5],
        enemy: pol,
      }),
    ).toBeNull();
    expect(grp.ends).toEqual([3, 5]);
    expect(grp.enemy).toBe(pol);
    // [3, 4, 5] by 2 and 2 divisions: [3, 4] and [5].
    expect(a.order.ends).toEqual([3, 4]);
    expect(b.order.ends).toEqual([5, 5]);
    step(runner);
    expect(a.front).toEqual([3, 4]);
    expect(b.front).toEqual([5]);
    // A broad goal for every army keeps the sectors.
    expect(
      l.issue(deu, {
        kind: "group_goal",
        group: grp.id,
        regions: [7],
        spear: false,
        split: false,
      }),
    ).toBeNull();
    expect(a.order.goal).toEqual([7]);
    expect(b.order.goal).toEqual([7]);
    expect(a.order.kind).toBe("plan");
    // Warsaw falls to us: Berlin is inside, the group's end snaps to Munich;
    // [4, 5] by 2 and 2: [4] and [5]. The plans and their line stay.
    takeRegion(g, 6, "DEU");
    finishDay(runner, today(g) + 1);
    step(runner);
    expect(grp.ends).toEqual([4, 5]);
    expect(a.order.ends).toEqual([4, 4]);
    expect(b.order.ends).toEqual([5, 5]);
    expect(a.order.kind).toBe("plan");
    expect(a.order.goal).toEqual([7]);
    expect(grp.goal).toEqual([7]);
    // A new group front line clears the group's offensive line and the armies'.
    l.issue(deu, {
      kind: "group_front_line",
      group: grp.id,
      ends: [4, 5],
      enemy: pol,
    });
    expect(grp.goal).toBeUndefined();
    expect(a.order.goal).toBeUndefined();
    expect(b.order.kind).toBe("front");
  }, 120_000);

  test("a split goal goes to the nearest sector; an empty one clears the armies' lines", async () => {
    const { l, deu, pol, a, b, grp } = await group();
    l.issue(deu, {
      kind: "group_front_line",
      group: grp.id,
      ends: [3, 5],
      enemy: pol,
    });
    // Warsaw is next to [3, 4] only; Krakow next to both (the earlier army).
    expect(
      l.issue(deu, {
        kind: "group_goal",
        group: grp.id,
        regions: [6, 7, 6],
        spear: true,
        split: true,
      }),
    ).toBeNull();
    expect(grp.goal).toEqual([6, 7]);
    expect(grp.spear).toBe(true);
    expect(grp.split).toBe(true);
    expect(a.order.goal).toEqual([6, 7]);
    expect(a.order.spear).toBe(true);
    expect(b.order.goal).toBeUndefined();
    expect(
      l.issue(deu, {
        kind: "group_goal",
        group: grp.id,
        regions: [8],
        spear: false,
        split: false,
      }),
    ).toBe("not_at_war");
    l.issue(deu, {
      kind: "group_goal",
      group: grp.id,
      regions: [],
      spear: false,
      split: false,
    });
    expect(grp.goal).toBeUndefined();
    expect(grp.split).toBeUndefined();
    expect(a.order.goal).toBeUndefined();
    expect(a.order.kind).toBe("front");
  }, 120_000);

  test("a group fallback line is cut like the front; an army falling back ends the group's lines", async () => {
    const { runner, g, l, d, deu, pol, a, b, grp } = await group();
    l.issue(deu, {
      kind: "group_front_line",
      group: grp.id,
      ends: [3, 5],
      enemy: pol,
    });
    expect(
      l.issue(deu, { kind: "group_fallback", group: grp.id, regions: [6] }),
    ).toBe("bad_region");
    expect(
      l.issue(deu, { kind: "group_fallback", group: grp.id, regions: [4, 3] }),
    ).toBeNull();
    expect(grp.fallback).toEqual([4, 3]);
    expect(a.order.fallback).toEqual([4]);
    expect(b.order.fallback).toEqual([3]);
    // The day's recut keeps the shares.
    finishDay(runner, today(g) + 1);
    expect(a.order.fallback).toEqual([4]);
    expect(b.order.fallback).toEqual([3]);
    expect(grp.ends).toEqual([3, 5]);
    // Army b falls back: the marshal's lines end, the armies keep their orders.
    expect(l.issue(deu, { kind: "army_fall_back", army: b.id })).toBeNull();
    expect(grp.ends).toBeUndefined();
    expect(grp.fallback).toBeUndefined();
    expect(b.order.zone).toEqual([3]);
    expect(a.order.ends).toEqual([3, 4]);
    // The AI taking the group ends its lines too.
    l.issue(deu, {
      kind: "group_fallback",
      group: grp.id,
      regions: [4],
    });
    expect(grp.fallback).toEqual([4]);
    d.issue(deu, { kind: "ag_auto", group: grp.id, on: true }, g.ticks());
    expect(grp.fallback).toBeUndefined();
  }, 120_000);
});
