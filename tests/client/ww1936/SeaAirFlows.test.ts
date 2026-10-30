// World War 1936 P4 (spec §18.3): the map's tap flows — move, merge (two
// taps), port strike (a confirming tap), a landing from the army card — and
// every order the navy and air screens send parses with WwOrderSchema.
import { WwOrder, WwOrderSchema } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import {
  landSelectionOf,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import {
  WwAirLayerEvent,
  WwAirZoneSelectedEvent,
  WwFleetSelectedEvent,
} from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwAirZoneCard";
import type { WwAirZoneCard } from "../../../src/client/hud/ww1936/WwAirZoneCard";
import "../../../src/client/hud/ww1936/WwArmyCard";
import type { WwArmyCard } from "../../../src/client/hud/ww1936/WwArmyCard";
import "../../../src/client/hud/ww1936/WwFleetCard";
import type { WwFleetCard } from "../../../src/client/hud/ww1936/WwFleetCard";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION, SR, ZONE } from "../../ww1936/seaFixture";
import { army, division, landDetail, mine } from "./LandFixture";
import {
  airDetail,
  fleet,
  navyDetail,
  seaGame,
  SeaOptions,
  ship,
  SID,
} from "./SeaAirFixture";

/** Every order any test here sent: all must parse (Review: UI ↔ schema). */
const everySent: WwOrder[] = [];

async function mountFleet(
  o: SeaOptions,
  hits: [number, number, number][] = [],
) {
  const g = seaGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => {
    sent.push(e.order);
    everySent.push(e.order);
  });
  let now = 10_000;
  const controller = new WwSeaAirController(g.game as never, bus, () => 4, {
    layout: () => [],
    hit: (_s, x, y) => hits.find(([hx, hy]) => hx === x && hy === y)?.[2] ?? 0,
    now: () => now,
  });
  controller.init();
  const el = document.createElement("ww-fleet-card") as WwFleetCard;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const redraw = async () => {
    el.tick();
    await el.updateComplete;
  };
  const click = async (sel: string) => {
    q(sel)!.click();
    await redraw();
  };
  const tap = async (x: number, y: number, later = 1000) => {
    now += later;
    const took = controller.handleTap(x, y);
    await redraw();
    return took;
  };
  /** Open the card when it shows as its strip (an order being given). */
  const unfold = async () => {
    if (q("[data-ww-card-fold='open']") !== null) {
      await click("[data-ww-card-fold='open']");
    }
  };
  return { ...g, el, bus, sent, q, click, tap, redraw, unfold, controller };
}

const londonFleet = (id: number, over = {}) =>
  fleet({
    id,
    zone: ZONE.west,
    docked: REGION.london,
    state: "docked",
    ships: [ship(id * 10 + 1, "dd"), ship(id * 10 + 2, "dd")],
    ...over,
  });

describe("the sea and air tap flows (spec §18.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("move: the zone's preview, then the same zone again", async () => {
    const m = await mountFleet({ fleets: [londonFleet(7)] });
    m.bus.emit(new WwFleetSelectedEvent(7));
    await m.redraw();
    await m.unfold();
    await m.click("[data-ww-fleet-btn='move']");
    expect(m.q("[data-ww-hint='move']")).not.toBeNull();
    // The Middle Sea's centre.
    await m.tap(85, 110);
    await m.unfold();
    expect(m.q("[data-ww-preview='move']")!.textContent).toContain("km=300");
    expect(m.sent).toEqual([]);
    await m.tap(85, 110);
    expect(m.sent).toEqual([
      { kind: "fleet_move", fleet: 7, zone: ZONE.middle },
    ]);
    expect(m.controller.draft.mode).toBe("none");
  });

  it("merge: the partner's token names it, a second tap merges, the card follows", async () => {
    const m = await mountFleet({ fleets: [londonFleet(7), londonFleet(8)] }, [
      [30, 105, 8],
    ]);
    m.bus.emit(new WwFleetSelectedEvent(7));
    await m.redraw();
    await m.unfold();
    // One partner: the card's button takes two taps.
    await m.click("[data-ww-fleet-btn='merge']");
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-fleet-btn='merge']")!.textContent).toContain(
      "[ww1936.land.tap_again]",
    );
    // Over two partners the map is tapped: the token, then again.
    const three = await mountFleet(
      { fleets: [londonFleet(7), londonFleet(8), londonFleet(9)] },
      [[30, 105, 8]],
    );
    three.bus.emit(new WwFleetSelectedEvent(7));
    await three.redraw();
    await three.unfold();
    await three.click("[data-ww-fleet-btn='merge']");
    expect(three.controller.draft.mode).toBe("merge");
    await three.tap(30, 105);
    expect(three.sent).toEqual([]);
    expect(three.controller.draft.pending).toBe(8);
    await three.tap(30, 105);
    expect(three.sent).toEqual([{ kind: "fleet_merge", fleet: 7, into: 8 }]);
    expect(three.controller.selection.fleet).toBe(8);
  });

  it("port strike: the enemy port glows, a tap names it, the next strikes", async () => {
    const carrier = fleet({
      id: 7,
      zone: ZONE.middle,
      missionSr: SR.central,
      mission: "strike",
      ships: [ship(1, "cv"), ship(2, "dd")],
    });
    const m = await mountFleet({ fleets: [carrier], wars: [["GBR", "ITA"]] });
    m.bus.emit(new WwFleetSelectedEvent(7));
    await m.redraw();
    await m.unfold();
    await m.click("[data-ww-fleet-btn='port_strike']");
    const rome = m.game.worldWarScenario().centerTile(REGION.rome);
    const W = m.game.worldWarScenario().width;
    const [rx, ry] = [rome % W, Math.floor(rome / W)];
    await m.tap(rx, ry);
    expect(m.controller.draft.pending).toBe(REGION.rome);
    expect(m.sent).toEqual([]);
    await m.tap(rx, ry);
    expect(m.sent).toEqual([
      { kind: "fleet_port_strike", fleet: 7, port: REGION.rome },
    ]);
  });

  it("a deselecting tap passes through to the map", async () => {
    const m = await mountFleet({ fleets: [londonFleet(7)] });
    m.bus.emit(new WwFleetSelectedEvent(7));
    // A land tile, no mode: the fleet goes and the map gets the tap.
    expect(await m.tap(65, 17)).toBe(false);
    expect(m.controller.selection.fleet).toBe(0);
  });

  it("the fleet card's other orders", async () => {
    const m = await mountFleet({
      fleets: [
        londonFleet(7, {
          ships: [ship(1, "cv"), ship(2, "dd"), ship(3, "dd")],
        }),
      ],
      navy: navyDetail("GBR", {
        admirals: [
          [1, 0],
          [2, 0],
        ],
      }),
    });
    m.bus.emit(new WwFleetSelectedEvent(7));
    await m.redraw();
    await m.unfold();
    await m.click("[data-ww-fleet-btn='return']");
    await m.click("[data-ww-fleet-btn='split']");
    await m.click("[data-ww-fleet-btn='auto']");
    await m.click("[data-ww-fleet-btn='engage']");
    await m.click("[data-ww-fleet-btn='engage_avoid']");
    await m.click("[data-ww-fleet-btn='more']");
    await m.click("[data-ww-fleet-btn='return_at']");
    await m.click("[data-ww-fleet-btn='deck']");
    await m.click("[data-ww-fleet-btn='deck_622']");
    await m.click("[data-ww-fleet-btn='more']");
    await m.click("[data-ww-fleet-btn='admiral']");
    await m.click("[data-ww-fleet-btn='admiral_1']");
    await m.click("[data-ww-fleet-btn='more']");
    await m.click("[data-ww-fleet-btn='base']");
    await m.click(`[data-ww-fleet-btn='base_${REGION.london}']`);
    expect(m.sent.map((o) => o.kind)).toEqual([
      "fleet_return",
      "fleet_split",
      "fleet_auto",
      "fleet_engage",
      "fleet_return_at",
      "carrier_mix",
      "fleet_admiral",
      "fleet_base",
    ]);
  });

  it("a landing: [Invade], a coast (its chips), the coast again; then launch and cancel by two taps", async () => {
    const g = seaGame({
      wars: [["GBR", "ITA"]],
      armies: [army(1, "GBR", REGION.london, { divisions: 2, mine: mine() })],
      landDetails: [
        landDetail("GBR", {
          divisions: [
            division(1, 1, REGION.london),
            division(2, 1, REGION.london),
          ],
        }),
      ],
    });
    const bus = new EventBus();
    const sent: WwOrder[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => {
      sent.push(e.order);
      everySent.push(e.order);
    });
    let now = 10_000;
    const seaAir = new WwSeaAirController(g.game as never, bus, () => 4, {
      layout: () => [],
      hit: () => 0,
      now: () => now,
    });
    seaAir.init();
    const land = new WwLandController(
      g.game as never,
      bus,
      { scale: 4, screenToWorldCoordinatesFloat: (x, y) => ({ x, y }) },
      { layout: () => [], hit: () => null, markers: () => [], seaAir },
    );
    land.init();
    const el = document.createElement("ww-army-card") as WwArmyCard;
    el.game = g.game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    bus.emit(new WwSelectArmyEvent(1));
    const redraw = async () => {
      el.tick();
      await el.updateComplete;
    };
    await redraw();
    const q = (s: string) => el.querySelector<HTMLElement>(s);
    if (q("[data-ww-card-fold='open']") !== null) {
      q("[data-ww-card-fold='open']")!.click();
      await redraw();
    }
    q("[data-ww-army-btn='more']")!.click();
    await redraw();
    q("[data-ww-army-btn='invade']")!.click();
    await redraw();
    expect(seaAir.draft.mode).toBe("invade");
    expect(landSelectionOf(g.game).army).toBe(1);
    const sc = g.game.worldWarScenario();
    const t = sc.centerTile(REGION.rome);
    const [rx, ry] = [t % sc.width, Math.floor(t / sc.width)];
    now += 1000;
    expect(land.tap(rx, ry)).toBe(true);
    await redraw();
    q("[data-ww-card-fold='open']")?.click();
    await redraw();
    // The easy landing card: start port, route lights, losses, days, split.
    const chips = q("[data-ww-preview='invade']")!;
    const text = chips.textContent!.replace(/\s+/g, " ");
    expect(text).toContain("[ww1936.navy.invasion_from] port=London");
    expect(text).toContain("[ww1936.navy.invasion_loss] pct=0");
    expect(text).toContain("[ww1936.navy.invasion_days] n=5");
    expect(text).toContain(
      "[ww1936.navy.invasion_eta] n=6,march=0,prep=5,sea=1",
    );
    expect(text).toContain("[ww1936.navy.invasion_no_split]");
    expect(chips.querySelectorAll("[data-ww-route-chip='green']")).toHaveLength(
      2,
    );
    expect(sent).toEqual([]);
    now += 1000;
    land.tap(rx, ry);
    expect(sent).toEqual([
      { kind: "army_invade", army: 1, target: REGION.rome },
    ]);
    // The engine answers: a landing, ready, its route held.
    g.navy.apply(
      {
        fleets: [],
        removedFleets: [],
        battles: [],
        endedBattles: [],
        seaRegions: [],
        details: [
          navyDetail("GBR", {
            invasions: [
              {
                army: 1,
                target: REGION.rome,
                from: REGION.london,
                state: "ready",
                prepDone: 60,
                prepDays: 60,
                convoys: 0,
                route: [
                  [SR.approaches, 900],
                  [SR.central, 700],
                ],
              },
            ],
          }),
        ],
      },
      701,
    );
    await redraw();
    q("[data-ww-card-fold='open']")?.click();
    await redraw();
    expect(q("[data-ww-invasion='ready']")).not.toBeNull();
    q("[data-ww-army-btn='invade_exec']")!.click();
    await redraw();
    expect(sent).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 400));
    q("[data-ww-army-btn='invade_exec']")!.click();
    await redraw();
    expect(sent[1]).toEqual({ kind: "invasion_execute", army: 1 });
    q("[data-ww-army-btn='more']")!.click();
    await redraw();
    q("[data-ww-army-btn='invade_cancel']")!.click();
    await new Promise((r) => setTimeout(r, 400));
    q("[data-ww-army-btn='invade_cancel']")!.click();
    expect(sent[2]).toEqual({ kind: "invasion_cancel", army: 1 });
    // An easy invasion sails by itself: no [Launch]; its march and what it
    // waits for show on the card.
    const easy = (over: object) =>
      g.navy.apply(
        {
          fleets: [],
          removedFleets: [],
          battles: [],
          endedBattles: [],
          seaRegions: [],
          details: [
            navyDetail("GBR", {
              invasions: [
                {
                  army: 1,
                  target: REGION.rome,
                  from: REGION.london,
                  state: "ready",
                  prepDone: 5,
                  prepDays: 5,
                  convoys: 0,
                  route: [],
                  easy: true,
                  ...over,
                },
              ],
            }),
          ],
        },
        702,
      );
    easy({ wait: "no_convoys" });
    await redraw();
    q("[data-ww-army-btn='back']")?.click();
    await redraw();
    expect(q("[data-ww-army-btn='invade_exec']")).toBeNull();
    expect(q("[data-ww-invasion-wait='no_convoys']")).not.toBeNull();
    easy({ state: "moving", prepDone: 0 });
    await redraw();
    expect(q("[data-ww-invasion='moving']")!.textContent).toContain(
      "[ww1936.navy.invasion_moving] port=London",
    );
  });

  it("the zone card's deploy and recall", async () => {
    const g = seaGame({
      air: airDetail("GBR", {
        stock: [340, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        bases: [{ region: REGION.london, used: 0, cap: 400, damagePm: 0 }],
      }),
      deployments: [
        {
          id: 1,
          owner: SID("GBR"),
          sr: SR.central,
          type: "fighter",
          mission: "air_superiority",
          counts: [120, 0, 0],
          target: 0,
          base: REGION.london,
        },
      ],
    });
    const bus = new EventBus();
    bus.on(SendWwOrderIntentEvent, (e) => everySent.push(e.order));
    const c = new WwSeaAirController(g.game as never, bus);
    c.init();
    const el = document.createElement("ww-air-zone-card") as WwAirZoneCard;
    el.game = g.game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    bus.emit(new WwAirLayerEvent(true));
    bus.emit(new WwAirZoneSelectedEvent(SR.central));
    el.tick();
    await el.updateComplete;
    el.querySelector<HTMLElement>("[data-ww-air-step='fighter:up']")!.click();
    el.querySelector<HTMLElement>("[data-ww-air-recall='fighter']")!.click();
    expect(everySent.slice(-2).map((o) => o.kind)).toEqual([
      "air_deploy",
      "air_recall",
    ]);
  });

  afterAll(() => {
    // Every order the screens sent above is one the wire accepts.
    expect(everySent.length).toBeGreaterThan(10);
    for (const o of everySent)
      expect(() => WwOrderSchema.parse(o)).not.toThrow();
  });
});
