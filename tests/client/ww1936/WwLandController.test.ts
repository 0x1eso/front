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

import {
  landSelectionOf,
  OpenWwBattleEvent,
  WwLandModeEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwArmyCard";
import type { WwArmyCard } from "../../../src/client/hud/ww1936/WwArmyCard";
import {
  LandTapBus,
  landTookTap,
  WwLandController,
} from "../../../src/client/hud/ww1936/WwLandController";
import {
  ContextMenuEvent,
  MouseDownEvent,
  MouseUpEvent,
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

describe("WwLandController (spec §15.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("select, front, confirm in four taps", async () => {
    const m = setup();
    // The card the second tap presses.
    const card = document.createElement("ww-army-card") as WwArmyCard;
    card.game = m.game as never;
    card.eventBus = m.bus;
    document.body.appendChild(card);
    card.init();
    // 1. The token in Berlin.
    m.tap(...center(3));
    expect(m.sel.army).toBe(1);
    card.tick();
    await card.updateComplete;
    // 2. [Front] on the card.
    m.countTap();
    card
      .querySelector<HTMLButtonElement>("[data-ww-army-btn='front']")!
      .click();
    expect(m.sel.mode).toBe("front");
    // 3. A border region (Berlin touches Warsaw): its preview.
    m.tapRegion(3);
    expect(m.sel.pending).toBe(3);
    expect(m.sent).toEqual([]);
    // 4. The same region: the order.
    m.tapRegion(3);
    expect(m.sent).toEqual([
      { kind: "army_front", army: 1, anchor: 3, enemy: 0 },
    ]);
    expect(m.taps()).toBeLessThanOrEqual(4);
    expect(m.sel).toMatchObject({ army: 1, mode: "none", pending: null });
  });

  it("a second tap on the same region confirms; elsewhere cancels", () => {
    const m = setup();
    m.tap(...center(3));
    // Munich, mine: a move preview, no order yet.
    m.tapRegion(4);
    expect(m.sel.pending).toBe(4);
    // The sea: cancels the preview, keeps the army.
    m.tap(150, 110);
    expect(m.sel.pending).toBeNull();
    expect(m.sel.army).toBe(1);
    m.tapRegion(4);
    // A double tap does not confirm before the preview can be read.
    m.advance(-400);
    m.tapRegion(4);
    expect(m.sent).toEqual([]);
    m.tapRegion(4);
    expect(m.sent).toEqual([{ kind: "army_move", army: 1, region: 4 }]);
    // Warsaw, the enemy's: an attack after the second tap.
    m.tapRegion(6);
    m.tapRegion(6);
    expect(m.sent[1]).toEqual({ kind: "army_attack", army: 1, region: 6 });
    // London, neither mine nor at war: elsewhere. Nothing pending: the
    // army goes.
    m.tapRegion(10);
    expect(m.sel.army).toBeNull();
    // With no army chosen a plain region tap is the map's (radial menu).
    m.tapRegion(4);
    expect(m.sel.pending).toBeNull();
  });

  it("a tap the flow took opens no radial menu; others do", () => {
    const m = setup();
    const opened: ContextMenuEvent[] = [];
    m.bus.on(ContextMenuEvent, (e) => opened.push(e));
    const warshipBus = new LandTapBus(m.bus, m.game);
    // The token: taken; the warship controller's fallback is dropped.
    const [x, y] = center(3);
    m.tap(x, y);
    expect(landTookTap(m.game, x * SCALE, y * SCALE)).toBe(true);
    warshipBus.emit(new ContextMenuEvent(x * SCALE, y * SCALE));
    expect(opened).toEqual([]);
    // The sea with nothing pending lets the army go; then a plain land
    // tap is not taken: the radial menu opens.
    m.tap(150, 110);
    m.tap(20, 90);
    expect(landTookTap(m.game, 20 * SCALE, 90 * SCALE)).toBe(false);
    warshipBus.emit(new ContextMenuEvent(20 * SCALE, 90 * SCALE));
    expect(opened).toHaveLength(1);
  });

  it("tapping a stack cycles armies", () => {
    const m = setup({
      armies: [army(1, "DEU", 3), army(2, "DEU", 3), army(3, "DEU", 3)],
    });
    const seen: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      m.tap(...center(3));
      seen.push(m.sel.army);
    }
    expect(seen).toEqual([1, 2, 3, 1]);
  });

  it("plan targets toggle up to three", () => {
    const m = setup({
      wars: [
        ["DEU", "POL"],
        ["DEU", "SUN"],
      ],
    });
    m.tap(...center(3));
    m.bus.emit(new WwLandModeEvent("plan"));
    for (const r of [6, 7, 8, 9]) m.tapRegion(r);
    expect(m.sel.targets).toEqual([6, 7, 8]);
    m.tapRegion(7);
    expect(m.sel.targets).toEqual([6, 8]);
    // Targets only: the card's execute button sends the plan.
    expect(m.sent).toEqual([]);
    // My own region in plan mode: elsewhere; the draft stays.
    m.tapRegion(4);
    expect(m.sel.mode).toBe("none");
    expect(m.sel.targets).toEqual([6, 8]);
  });

  it("drag is not a tap", () => {
    const m = setup();
    const [x, y] = center(3);
    // Pressed on the token, released 60 px away: the map moved.
    m.bus.emit(new MouseDownEvent(x * SCALE, y * SCALE));
    m.bus.emit(new MouseUpEvent(x * SCALE + 60, y * SCALE));
    expect(m.sel.army).toBeNull();
    // A finger's wobble is still a tap.
    m.bus.emit(new MouseDownEvent(x * SCALE, y * SCALE));
    m.bus.emit(new MouseUpEvent(x * SCALE + 5, y * SCALE));
    expect(m.sel.army).toBe(1);
  });

  it("a battle marker opens its card when no army is chosen", () => {
    const m = setup();
    m.markers.push({ region: 7, x: 105, y: 75 });
    const opened: number[] = [];
    m.bus.on(OpenWwBattleEvent, (e) => opened.push(e.region));
    m.tap(106, 76);
    expect(opened).toEqual([7]);
  });

  it("only my own armies, and only while I play", () => {
    const m = setup({ armies: [army(5, "POL", 6)] });
    m.tap(...center(6));
    expect(m.sel.army).toBeNull();
    const spectator = setup({ me: null });
    spectator.tap(...center(3));
    expect(spectator.sel.army).toBeNull();
  });
});
