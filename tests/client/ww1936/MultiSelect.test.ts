// World War 1936 P2 (spec §15.3, plan decision 25): the map's tap flow on
// the test map — choose a token, preview with a first tap, order with a
// second, cancel elsewhere — with a fake token layout (the render lane's).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

// The fronts are Task 3's (stubs here): border regions are my side's
// regions with an enemy neighbour, a front is its anchor.
vi.mock("@openfront/engine-lib/ww1936/FrontRules", async (orig) => {
  const real =
    await orig<typeof import("@openfront/engine-lib/ww1936/FrontRules")>();
  const borderRegionsOf: typeof real.borderRegionsOf = (w, me, enemy) =>
    w.scenario.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          w.sameSide(me, w.controller[r]) &&
          w.scenario
            .edgesOf(r)
            .some((e) =>
              enemy === 0
                ? w.isEnemy(me, w.controller[e.to])
                : w.controller[e.to] === enemy,
            ),
      );
  return {
    ...real,
    borderRegionsOf,
    frontOf: (_w: unknown, _me: number, _e: number, anchor: number) => [anchor],
  };
});

import { WwMultiSelectEvent } from "../../../src/client/hud/ww1936/DepthEvents";
import { landSelectionOf } from "../../../src/client/hud/ww1936/LandSelection";
import { multiSelectOf } from "../../../src/client/hud/ww1936/MultiSelect";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import {
  DragEvent,
  MouseDownEvent,
  TouchEvent,
} from "../../../src/client/InputHandler";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import type { TokenPlacement } from "../../../src/client/view/LandTokenLayout";
import { detail } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  landDetail,
  LandOptions,
  scenario,
} from "./LandFixture";

/** Screen px per tile: a tap reaches 24 px = 6 tiles. */
const SCALE = 4;
const W = scenario.width;
const center = (r: number) => {
  const t = scenario.centerTile(r);
  return [t % W, Math.floor(t / W)] as const;
};

/** A tile of region `r` well away from its centre (and the token there). */
function awayFromToken(r: number): [number, number] {
  const [cx, cy] = center(r);
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

/** LandTokenLayout.hitToken's contract: the next army in reach after `current`. */
function hit(
  ps: readonly TokenPlacement[],
  wx: number,
  wy: number,
  r: number,
  current: number | null,
): number | null {
  const near = ps
    .filter((p) => (p.x - wx) * (p.x - wx) + (p.y - wy) * (p.y - wy) <= r * r)
    .map((p) => p.army)
    .sort((a, b) => a - b);
  if (near.length === 0) return null;
  const i = current === null ? -1 : near.indexOf(current);
  return near[(i + 1) % near.length];
}

function setup(o: LandOptions = {}) {
  const g = fakeLandGame({
    ticks: 700,
    wars: [["DEU", "POL"]],
    details: [detail("DEU")],
    landDetails: [
      landDetail("DEU", {
        divisions: [division(1, 1, 3), division(2, 1, 3)],
      }),
    ],
    armies: [army(1, "DEU", 3)],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  let now = 10_000;
  const markers: { region: number; x: number; y: number }[] = [];
  const controller = new WwLandController(
    g.game as never,
    bus,
    {
      scale: SCALE,
      screenToWorldCoordinatesFloat: (x, y) => ({ x: x / SCALE, y: y / SCALE }),
    },
    {
      // Every token at its region's centre (a stack shares the spot).
      layout: (view) =>
        [...view.armies.values()].map((a) => {
          const [x, y] = center(a.region);
          return { army: a.id, x, y, lod: 0 };
        }),
      hit,
      markers: () => markers,
      now: () => now,
    },
  );
  controller.init();
  const sel = landSelectionOf(g.game);
  /** A finger tap on tile (x, y); the clock moves on 0.5 s. */
  let taps = 0;
  const tap = (x: number, y: number) => {
    taps++;
    now += 500;
    bus.emit(new MouseDownEvent(x * SCALE, y * SCALE));
    bus.emit(new TouchEvent(x * SCALE, y * SCALE));
  };
  const tapRegion = (r: number) => tap(...awayFromToken(r));
  return {
    ...g,
    bus,
    sent,
    sel,
    controller,
    tap,
    tapRegion,
    markers,
    taps: () => taps,
    countTap: () => taps++,
    advance: (ms: number) => (now += ms),
  };
}

describe("multi-select (spec §20.4)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a long press starts multi-select and a tap toggles an army", () => {
    vi.useFakeTimers();
    const [r1, r2, r3] = [3, 4, 8];
    const m = setup({
      armies: [army(1, "DEU", r1), army(2, "DEU", r2), army(3, "DEU", r3)],
    });
    const multi = multiSelectOf(m.sel);
    const seen: number[][] = [];
    m.bus.on(WwMultiSelectEvent, (e) => seen.push(e.armies));
    // A short press is a plain choice.
    const [x1, y1] = center(r1);
    m.bus.emit(new MouseDownEvent(x1 * SCALE, y1 * SCALE));
    vi.advanceTimersByTime(200);
    m.bus.emit(new TouchEvent(x1 * SCALE, y1 * SCALE));
    expect(multi.active).toBe(false);
    expect(m.sel.army).toBe(1);
    // 500 ms on a token starts the mode with that army; the release is no tap.
    m.bus.emit(new MouseDownEvent(x1 * SCALE, y1 * SCALE));
    vi.advanceTimersByTime(500);
    expect(multi.active).toBe(true);
    expect(multi.armies).toEqual([1]);
    expect(m.sel.army).toBeNull();
    m.bus.emit(new TouchEvent(x1 * SCALE, y1 * SCALE));
    expect(multi.armies).toEqual([1]);
    // Taps on other tokens add and drop them.
    const [x2, y2] = center(r2);
    m.tap(x2, y2);
    expect(multi.armies).toEqual([1, 2]);
    m.tap(x2, y2);
    expect(multi.armies).toEqual([1]);
    m.tap(...center(r3));
    expect(multi.armies).toEqual([1, 3]);
    expect(seen[seen.length - 1]).toEqual([1, 3]);
    // Dropping the last ends the mode.
    m.tap(...center(r3));
    m.tap(x1, y1);
    expect(multi.active).toBe(false);
  });

  it("a press that moved the map is no long press", () => {
    vi.useFakeTimers();
    const m = setup({ armies: [army(1, "DEU", 3)] });
    const [x, y] = center(3);
    m.bus.emit(new MouseDownEvent(x * SCALE, y * SCALE));
    m.bus.emit(new DragEvent(30, 0));
    vi.advanceTimersByTime(600);
    expect(multiSelectOf(m.sel).active).toBe(false);
  });
});
