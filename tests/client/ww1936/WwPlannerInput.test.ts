// ww162 (battle planner, design §2): the land controller's line modes on
// the test map — the drag claim, one order per stroke, taps that stretch or
// trim a line, the card's actions, undo, the [사단] picks, the handles, and
// the ways out (Esc, right-click).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { idleOrder } from "@openfront/engine-api/ww1936/LandTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import {
  landSelectionOf,
  WwDrawModeEvent,
  WwPlannerEvent,
  WwPlanViewEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import {
  ClaimDragEvent,
  CloseViewEvent,
  ContextCancelEvent,
  MouseDownEvent,
  TouchEvent,
  WwStrokeEvent,
} from "../../../src/client/InputHandler";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  ID,
  landDetail,
  LandOptions,
  landRegion,
  mine,
  scenario,
} from "./LandFixture";

const SCALE = 4;
const W = scenario.width;
const POL = ID("POL");

/** A tile of region `r` well away from its centre (and the token there), tile coords. */
function away(r: number): [number, number] {
  const t0 = scenario.centerTile(r);
  const cx = t0 % W;
  const cy = Math.floor(t0 / W);
  for (let t = 0; t < scenario.regionIds.length; t++) {
    const x = t % W;
    const y = Math.floor(t / W);
    if (
      scenario.regionAt(t) === r &&
      Math.abs(x - cx) + Math.abs(y - cy) > 12
    ) {
      return [x + 0.5, y + 0.5];
    }
  }
  throw new Error(`no tile of ${r} away from its centre`);
}
const center = (r: number): [number, number] => {
  const t = scenario.centerTile(r);
  return [(t % W) + 0.5, Math.floor(t / W) + 0.5];
};

function setup(o: LandOptions = {}) {
  const g = fakeLandGame({
    ticks: 700,
    wars: [
      ["DEU", "POL"],
      ["DEU", "SUN"],
    ],
    details: [detail("DEU")],
    landDetails: [
      landDetail("DEU", { divisions: [division(1, 1, 3), division(2, 1, 3)] }),
    ],
    armies: [army(1, "DEU", 3, { mine: mine({ front: [3, 4] }) })],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  let now = 10_000;
  const controller = new WwLandController(
    g.game as never,
    bus,
    {
      scale: SCALE,
      screenToWorldCoordinatesFloat: (x, y) => ({ x: x / SCALE, y: y / SCALE }),
    },
    {
      layout: (view) =>
        [...view.armies.values()].map((a) => {
          const t = scenario.centerTile(a.region);
          return { army: a.id, x: t % W, y: Math.floor(t / W), lod: 0 };
        }),
      hit: (ps, wx, wy, r) =>
        ps.find((p) => (p.x - wx) ** 2 + (p.y - wy) ** 2 <= r * r)?.army ??
        null,
      markers: () => [],
      now: () => now,
    },
  );
  controller.init();
  const sel = landSelectionOf(g.game);
  const tap = ([x, y]: [number, number]) => {
    now += 500;
    bus.emit(new MouseDownEvent(x * SCALE, y * SCALE));
    bus.emit(new TouchEvent(x * SCALE, y * SCALE));
  };
  const claim = ([x, y]: [number, number], shift = false) => {
    const q = new ClaimDragEvent(x * SCALE, y * SCALE, shift);
    bus.emit(q);
    return q;
  };
  /** A drag through the tiles given (claimed at the first). */
  const stroke = (...pts: [number, number][]) => {
    const q = claim(pts[0]);
    bus.emit(new WwStrokeEvent("start", pts[0][0] * SCALE, pts[0][1] * SCALE));
    for (const [x, y] of pts.slice(1)) {
      bus.emit(new WwStrokeEvent("move", x * SCALE, y * SCALE));
    }
    const [lx, ly] = pts[pts.length - 1];
    bus.emit(new WwStrokeEvent("end", lx * SCALE, ly * SCALE));
    return q;
  };
  // Choose the army in Berlin.
  tap(center(3));
  return {
    ...g,
    bus,
    sent,
    sel,
    tap,
    claim,
    stroke,
    advance: (ms: number) => (now += ms),
  };
}

describe("the battle planner's input (design §2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("[전선]: a drag along the border is one army_front_line; Esc leaves", () => {
    const m = setup();
    expect(m.sel.army).toBe(1);
    m.bus.emit(new WwDrawModeEvent("front"));
    expect(m.sel.draw).toBe("front");
    // Shift + drag pans: not claimed, but the draw mode is told.
    expect(m.claim(away(3), true)).toMatchObject({
      claimed: false,
      drawMode: true,
    });
    const q = m.stroke(away(3), away(3), away(4));
    expect(q).toMatchObject({ claimed: true, drawMode: true });
    expect(m.sent).toEqual([
      { kind: "army_front_line", army: 1, ends: [3, 4], enemy: POL },
    ]);
    expect(m.sel.line).toMatchObject({
      kind: "front",
      regions: [3, 4],
      live: false,
    });
    // The same chip again turns the mode off; Esc does too.
    m.bus.emit(new WwDrawModeEvent("front"));
    expect(m.sel.draw).toBe("none");
    m.bus.emit(new WwDrawModeEvent("front"));
    m.bus.emit(new CloseViewEvent());
    expect(m.sel).toMatchObject({ draw: "none", army: 1 });
    // Outside a draw mode a press away from the handles is the map's.
    expect(m.claim([150, 110])).toMatchObject({
      claimed: false,
      drawMode: false,
    });
  });

  it("the preview is worked out again only when the region changes", () => {
    const m = setup();
    m.bus.emit(new WwDrawModeEvent("front"));
    m.claim(away(3));
    m.bus.emit(
      new WwStrokeEvent("start", away(3)[0] * SCALE, away(3)[1] * SCALE),
    );
    const v = m.sel.version;
    const [x, y] = away(3);
    m.bus.emit(new WwStrokeEvent("move", (x + 1) * SCALE, y * SCALE));
    expect(m.sel.version).toBe(v);
    expect(m.sel.line?.live).toBe(true);
    // A second finger cancels: the drawn line goes, nothing is sent.
    m.bus.emit(new WwStrokeEvent("cancel", 0, 0));
    expect(m.sel.line).toBeNull();
    expect(m.sent).toEqual([]);
  });

  it("[공세선]: a swipe's gaps fill; spearhead and stance re-send; a far start is refused", () => {
    const m = setup();
    m.bus.emit(new WwDrawModeEvent("goal"));
    // From Berlin into Warsaw, then Kiev (Krakow skipped by the swipe).
    m.stroke(away(3), away(6), away(9));
    expect(m.sent).toEqual([
      {
        kind: "army_goal",
        army: 1,
        regions: [6, 7, 9],
        spear: false,
        stance: "balanced",
      },
    ]);
    m.bus.emit(new WwPlannerEvent({ kind: "spear", on: true }));
    m.bus.emit(new WwPlannerEvent({ kind: "stance", stance: "aggressive" }));
    expect(m.sent.slice(1)).toEqual([
      {
        kind: "army_goal",
        army: 1,
        regions: [6, 7, 9],
        spear: true,
        stance: "balanced",
      },
      {
        kind: "army_goal",
        army: 1,
        regions: [6, 7, 9],
        spear: true,
        stance: "aggressive",
      },
    ]);
    m.bus.emit(new WwPlannerEvent({ kind: "execute", on: true }));
    expect(m.sent[3]).toEqual({ kind: "army_execute", army: 1, on: true });
  });

  it("an offensive line far from the front is told and not sent", () => {
    const m = setup({
      armies: [army(1, "DEU", 3, { mine: mine({ front: [3] }) })],
    });
    const toasts: string[] = [];
    const onToast = (e: Event) =>
      toasts.push((e as CustomEvent<{ message: string }>).detail.message);
    window.addEventListener("show-message", onToast);
    m.bus.emit(new WwDrawModeEvent("goal"));
    m.stroke(away(9), away(8));
    window.removeEventListener("show-message", onToast);
    expect(m.sent).toEqual([]);
    expect(m.sel.line).toBeNull();
    expect(toasts).toEqual(["[ww1936.planner.refuse_goal_far]"]);
  });

  it("[후퇴선]: taps build the line; undo re-sends the one before; a right-click leaves", () => {
    const m = setup({
      landRegions: [
        landRegion(1, { controller: ID("DEU") }),
        landRegion(2, { controller: ID("DEU") }),
      ],
    });
    m.bus.emit(new WwDrawModeEvent("fallback"));
    m.tap(away(1));
    m.tap(away(2));
    m.bus.emit(new WwPlannerEvent({ kind: "fb_auto", on: false }));
    m.bus.emit(new WwPlannerEvent({ kind: "undo" }));
    m.bus.emit(new WwPlannerEvent({ kind: "undo" }));
    m.bus.emit(new WwPlannerEvent({ kind: "undo" }));
    expect(m.sent).toEqual([
      { kind: "army_fallback", army: 1, regions: [1], manual: false },
      { kind: "army_fallback", army: 1, regions: [1, 2], manual: false },
      { kind: "army_fallback", army: 1, regions: [1, 2], manual: true },
      { kind: "army_fallback", army: 1, regions: [1, 2], manual: false },
      { kind: "army_fallback", army: 1, regions: [1], manual: false },
      { kind: "army_fallback", army: 1, regions: [], manual: false },
    ]);
    m.bus.emit(new WwPlannerEvent({ kind: "fall_back_now" }));
    expect(m.sent[6]).toEqual({ kind: "army_fall_back", army: 1 });
    const cancel = new ContextCancelEvent(0, 0);
    m.bus.emit(cancel);
    expect(cancel.taken).toBe(true);
    expect(m.sel.draw).toBe("none");
    // With no mode on, a right-click is the menu's.
    const again = new ContextCancelEvent(0, 0);
    m.bus.emit(again);
    expect(again.taken).toBe(false);
  });

  it("[사단]: a region tap picks its divisions; two taps move them", () => {
    const m = setup();
    m.bus.emit(new WwDrawModeEvent("divisions"));
    // Divisions are tapped, not drawn: the map pans as usual.
    expect(m.claim(away(3))).toMatchObject({ claimed: false, drawMode: false });
    m.tap(away(3));
    expect(m.sel.divisions).toEqual([1, 2]);
    m.tap(away(4));
    expect(m.sel.pending).toBe(4);
    expect(m.sent).toEqual([]);
    m.tap(away(4));
    expect(m.sent).toEqual([
      { kind: "division_move", army: 1, divisions: [1, 2], region: 4 },
    ]);
    m.bus.emit(new WwPlannerEvent({ kind: "release", divisions: [] }));
    expect(m.sent[1]).toEqual({
      kind: "division_release",
      army: 1,
      divisions: [],
    });
    m.bus.emit(new WwPlannerEvent({ kind: "whole_army" }));
    expect(m.sel).toMatchObject({ draw: "none", divisions: [] });
  });

  it("a press on a waypoint drags it with no mode on; the plan view toggles", () => {
    const order = {
      ...idleOrder(),
      kind: "front" as const,
      enemy: POL,
      goal: [6],
    };
    const m = setup({
      armies: [army(1, "DEU", 3, { mine: mine({ front: [3, 4], order }) })],
    });
    expect(m.sel.draw).toBe("none");
    const q = m.stroke(center(6), away(6), away(7));
    expect(q.claimed).toBe(true);
    expect(m.sent).toEqual([
      {
        kind: "army_goal",
        army: 1,
        regions: [7],
        spear: false,
        stance: "balanced",
      },
    ]);
    m.bus.emit(new WwPlanViewEvent());
    expect(m.sel.planView).toBe(true);
    m.bus.emit(new WwPlanViewEvent(false));
    expect(m.sel.planView).toBe(false);
  });
});
