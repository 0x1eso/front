// ww162 (battle planner, design §1-§3): the screen's line rules on the test
// map ww1936mini — snapping to the border, the front chain, gap fill and
// caps, the offensive line's start check, taps, undo and handles.
import { idleOrder, WW_GOAL_MAX } from "@openfront/engine-api/ww1936/LandTypes";
import type { FrontWorld } from "@openfront/engine-lib/ww1936/FrontRules";
import { describe, expect, it } from "vitest";
import {
  appendRegion,
  chainFromSamples,
  enemyFacing,
  extendFront,
  frontChainBetween,
  frontFromSamples,
  goalStartOk,
  hitHandle,
  lineHandles,
  LineUndo,
  moveFrontEnd,
  orderCarries,
  restoreOrder,
  shownHandles,
  tapFallback,
  tapGoal,
  UNDO_DEPTH,
} from "../../../src/client/hud/ww1936/PlannerModel";
import { army, ID, mine, scenario } from "./LandFixture";

// Regions: 1 Paris, 2 Lyon (FRA), 3 Berlin, 4 Munich (DEU), 5 Rome (ITA),
// 6 Warsaw, 7 Krakow (POL), 8 Moscow, 9 Kiev (SUN), 10 London (GBR).
const DEU = ID("DEU");
const POL = ID("POL");
const SUN = ID("SUN");

/** Germany also holds Paris and Lyon; at war with Poland (and `alsoSun`: the Soviets). */
function world(alsoSun = false): FrontWorld {
  const controller = Uint16Array.from(scenario.ownerByRegion());
  controller[1] = DEU;
  controller[2] = DEU;
  const war = (a: number, b: number) =>
    (a === DEU && (b === POL || (alsoSun && b === SUN))) ||
    (b === DEU && (a === POL || (alsoSun && a === SUN)));
  return {
    scenario,
    controller,
    sameSide: (a, b) => a > 0 && a === b,
    isEnemy: (a, b) => war(a, b),
  };
}

describe("the front line (design §1.1)", () => {
  it("ends snap to the nearest border region; the chain runs between them", () => {
    const w = world();
    // Paris and Lyon lie behind the line: Berlin and Munich face Poland.
    expect(frontChainBetween(w, DEU, POL, 1, 2)).toEqual([3, 4]);
    expect(frontChainBetween(w, DEU, POL, 3, 3)).toEqual([3]);
    expect(frontChainBetween(w, DEU, POL, 4, 3)).toEqual([4, 3]);
    // No border against Italy's ally that is not at war: Italy itself is.
    expect(frontChainBetween(w, DEU, ID("SUN"), 3, 4)).toEqual([]);
  });

  it("a stroke from our land faces the enemy at war, its ends snapped", () => {
    const w = world();
    // Lyon touches Italy (not at war) first; the nearest war is Poland's.
    expect(enemyFacing(w, DEU, 2)).toBe(POL);
    expect(enemyFacing(w, DEU, 7)).toBe(POL);
    expect(frontFromSamples(w, DEU, [1, 3, 2])).toEqual({
      ends: [3, 4],
      enemy: POL,
      chain: [3, 4],
    });
    // Before any war a front can still face a neighbour.
    const peace: FrontWorld = { ...w, isEnemy: () => false };
    expect(enemyFacing(peace, DEU, 3)).toBe(POL);
  });

  it("a tap stretches the nearer end; a handle moves its own", () => {
    const w = world();
    const one = extendFront(w, DEU, null, 3)!;
    expect(one).toMatchObject({ ends: [3, 3], chain: [3] });
    expect(extendFront(w, DEU, one, 2)).toMatchObject({
      ends: [3, 4],
      chain: [3, 4],
    });
    expect(
      moveFrontEnd(w, DEU, { ends: [3, 4], enemy: POL, chain: [3, 4] }, 1, 1),
    ).toMatchObject({ ends: [3, 3], chain: [3] });
  });
});

describe("the offensive and fallback lines (design §1.2, §1.3, §2)", () => {
  it("a fast swipe's gap is filled; our and neutral land are skipped; repeats drop", () => {
    const w = world(true);
    // Warsaw, then (skipping Krakow) Kiev: the way over enemy land fills in.
    expect(chainFromSamples(w, DEU, "goal", [3, 6, 6, 9, 5]).regions).toEqual([
      6, 7, 9,
    ]);
    // A fallback takes our side's land only, filled the same way.
    expect(chainFromSamples(w, DEU, "fallback", [1, 6, 4]).regions).toEqual([
      1, 4,
    ]);
  });

  it("the cap holds and says so", () => {
    const w = world(true);
    const r = appendRegion(w, DEU, "goal", [6, 7], 9, 2);
    expect(r).toEqual({ regions: [6, 7], full: true });
    expect(WW_GOAL_MAX).toBe(24);
  });

  it("an offensive line starts within two regions of the front", () => {
    const w = world(true);
    expect(goalStartOk(w, [3, 4], 3, 6)).toBe(true);
    expect(goalStartOk(w, [3], 3, 9)).toBe(false);
    // No zone: from the army's own region.
    expect(goalStartOk(w, [], 4, 9)).toBe(true);
  });

  it("taps: a waypoint again drops it; a fallback grows at its nearer end", () => {
    const w = world(true);
    expect(tapGoal(w, DEU, [6, 7], 6).regions).toEqual([7]);
    expect(tapGoal(w, DEU, [6], 8).regions).toEqual([6, 8]);
    expect(tapFallback(w, DEU, [3, 4], 1).regions).toEqual([1, 3, 4]);
    expect(tapFallback(w, DEU, [1, 3, 4], 3).regions).toEqual([1, 4]);
  });
});

describe("orders, undo and handles", () => {
  it("undo goes back through the last five, then to the state before", () => {
    const u = new LineUndo();
    const order = (n: number) => ({
      kind: "army_goal" as const,
      army: 1,
      regions: [n],
      spear: false,
      stance: "balanced" as const,
    });
    const before = order(0);
    for (let n = 1; n <= UNDO_DEPTH + 2; n++)
      u.push(1, "goal", order(n), before);
    expect(u.canUndo(1, "front")).toBe(false);
    const back: number[] = [];
    for (;;) {
      const o = u.undo(1, "goal");
      if (o === null) break;
      back.push((o as { regions: number[] }).regions[0]);
    }
    // Seven sent: undo reaches back five steps (6, 5, 4, 3, 2).
    expect(back).toEqual([6, 5, 4, 3, 2]);
    // The first entry is the state before when fewer were sent.
    const v = new LineUndo();
    v.push(2, "goal", order(9), before);
    expect(v.undo(2, "goal")).toEqual(before);
  });

  it("an army's lines go back as they were; a draft gives way once carried", () => {
    const a = army(1, "DEU", 3, {
      mine: mine({
        order: {
          ...idleOrder(),
          kind: "front",
          enemy: POL,
          ends: [3, 4],
          goal: [6],
        },
      }),
    });
    expect(restoreOrder(a, "front")).toEqual({
      kind: "army_front_line",
      army: 1,
      ends: [3, 4],
      enemy: POL,
    });
    expect(restoreOrder(a, "fallback")).toEqual({
      kind: "army_fallback",
      army: 1,
      regions: [],
      manual: false,
    });
    const d = {
      kind: "goal" as const,
      army: 1,
      front: null,
      regions: [6],
      live: false,
      sentAt: 1,
    };
    expect(orderCarries(a.mine!.order, d)).toBe(true);
    expect(orderCarries(a.mine!.order, { ...d, regions: [6, 7] })).toBe(false);
  });

  it("handles sit on the front's ends and the waypoints, hit within the radius", () => {
    const w = world(true);
    const hs = lineHandles(
      w,
      DEU,
      { ends: [3, 4], enemy: POL, chain: [3, 4] },
      [6, 9],
    );
    expect(hs.map((h) => [h.kind, h.index, h.region])).toEqual([
      ["end", 0, 3],
      ["end", 1, 4],
      ["wp", 0, 6],
      ["wp", 1, 9],
    ]);
    // Berlin's handle sits halfway to Warsaw, on the line.
    const t3 = scenario.centerTile(3);
    const t6 = scenario.centerTile(6);
    const W = scenario.width;
    expect(hs[0].x).toBeCloseTo(((t3 % W) + (t6 % W)) / 2 + 0.5);
    expect(hitHandle(hs, hs[2].x + 1, hs[2].y, 3)).toBe(hs[2]);
    expect(hitHandle(hs, hs[2].x + 10, hs[2].y, 3)).toBeNull();
    // In the fallback mode no handle is shown; with no mode both kinds.
    const a = army(1, "DEU", 3, {
      mine: mine({
        front: [3, 4],
        order: {
          ...idleOrder(),
          kind: "front",
          enemy: POL,
          ends: [3, 4],
          goal: [6],
        },
      }),
    });
    expect(shownHandles(w, DEU, a, { draw: "fallback", line: null })).toEqual(
      [],
    );
    expect(shownHandles(w, DEU, a, { draw: "none", line: null })).toHaveLength(
      3,
    );
    expect(shownHandles(w, DEU, a, { draw: "goal", line: null })).toHaveLength(
      1,
    );
  });
});
