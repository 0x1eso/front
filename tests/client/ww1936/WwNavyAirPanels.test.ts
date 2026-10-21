// World War 1936 P4 (spec §18.5, §18.7): the navy and air drawers render
// their four tabs from the views and send orders the wire accepts.
import { WwOrder, WwOrderSchema } from "@openfront/engine-api/Schemas";
import { lineCostMilli } from "@openfront/engine-lib/ww1936/NavalLineRules";
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

import {
  WwAirZoneSelectedEvent,
  WwFleetSelectedEvent,
} from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwAirPanel";
import type { WwAirPanel } from "../../../src/client/hud/ww1936/WwAirPanel";
import {
  OpenWwAirEvent,
  OpenWwIndustryEvent,
  OpenWwNavyEvent,
} from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwNavyPanel";
import type { WwNavyPanel } from "../../../src/client/hud/ww1936/WwNavyPanel";
import { GoToPositionEvent } from "../../../src/client/TransformHandler";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION, SR, ZONE } from "../../ww1936/seaFixture";
import {
  airDetail,
  fleet,
  navyDetail,
  seaGame,
  SeaOptions,
  ship,
  SID,
} from "./SeaAirFixture";

async function mount<T extends HTMLElement & { init(): void; tick(): void }>(
  tag: string,
  o: SeaOptions,
) {
  const g = seaGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement(tag) as T & {
    game: unknown;
    eventBus: EventBus;
    updateComplete: Promise<boolean>;
  };
  el.game = g.game;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const qa = (sel: string) => [...el.querySelectorAll<HTMLElement>(sel)];
  const settle = async () => {
    el.tick();
    await el.updateComplete;
    // The shipyards element renders a beat later.
    await new Promise((r) => setTimeout(r, 0));
  };
  const click = async (sel: string) => {
    q(sel)!.click();
    await settle();
  };
  return { ...g, el, bus, sent, q, qa, settle, click };
}

const navyData = () =>
  navyDetail("GBR", {
    lines: [
      {
        id: 1,
        cls: "dd",
        gen: 1,
        docks: 4,
        activeDocks: 4,
        progressMilli: 100_000,
        costMilli: lineCostMilli({ cls: 0, gen: 1, progress: 0 }),
        left: 3,
        port: REGION.london,
        nextName: 0,
        outputMilli: 10_000,
        fill: 1000,
      },
    ],
    docks: 6,
    docksLent: 1,
    docksIdle: 1,
    convoys: 35,
    convoysByUse: [5, 6, 10],
    routes: [
      {
        id: 3,
        use: "trade",
        owner: SID("GBR"),
        ref: SID("FRA"),
        zones: [ZONE.west, ZONE.middle],
        km: 300,
        srs: [SR.approaches, SR.central],
        need: 10,
        got: 8,
      },
    ],
    admirals: [
      [1, 7],
      [2, 0],
    ],
    navyXpMilli: 4_000,
    convoyLoss30: Array.from({ length: 30 }, (_, i) => (i === 29 ? 2000 : 0)),
  });

describe("<ww-navy-panel> (spec §18.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("fleets: my fleets; a row chooses one and the camera goes", async () => {
    const m = await mount<WwNavyPanel>("ww-navy-panel", {
      fleets: [
        fleet({
          id: 7,
          docked: REGION.london,
          state: "docked",
          ships: [ship(1, "bb")],
        }),
        fleet({
          id: 9,
          owner: SID("ITA"),
          ships: [],
          counts: [1, 0, 0, 0, 0, 0, 0],
        }),
      ],
      navy: navyData(),
    });
    const chosen: number[] = [];
    const moved: unknown[] = [];
    m.bus.on(WwFleetSelectedEvent, (e) => chosen.push(e.fleet));
    m.bus.on(GoToPositionEvent, (e) => moved.push(e));
    m.bus.emit(new OpenWwNavyEvent("fleets"));
    await m.settle();
    expect(
      m.qa("[data-ww-fleet-row]").map((r) => r.dataset.wwFleetRow),
    ).toEqual(["7"]);
    await m.click("[data-ww-fleet-row='7']");
    expect(chosen).toEqual([7]);
    expect(moved).toHaveLength(1);
  });

  it("shipyards: the dockyards line and a line card's −/+, ▲▼ and two-tap removal", async () => {
    const m = await mount<WwNavyPanel>("ww-navy-panel", { navy: navyData() });
    m.bus.emit(new OpenWwNavyEvent("shipyards"));
    await m.settle();
    expect(m.q("[data-ww-docks]")!.textContent).toContain("n=6,r=1,i=1");
    expect(m.q("[data-ww-naval-line='1']")).not.toBeNull();
    await m.click("[data-ww-step='docks-1:up']");
    await m.click("[data-ww-step='count-1:down']");
    await m.click("[data-ww-remove-naval-line='1']");
    expect(m.sent.map((o) => o.kind)).toEqual([
      "naval_line_docks",
      "naval_line_count",
    ]);
    await new Promise((r) => setTimeout(r, 400));
    await m.click("[data-ww-remove-naval-line='1']");
    expect(m.sent[m.sent.length - 1]).toEqual({
      kind: "naval_line_remove",
      line: 1,
    });
    // A new line: class, generation, port, dockyards, ships.
    await m.click("[data-ww-new-naval-line]");
    await m.click("[data-ww-pick='cls:cl']");
    await m.click(`[data-ww-pick='port:${REGION.london}']`);
    await m.click("[data-ww-step='new-docks:up']");
    await m.click("[data-ww-start-naval-line]");
    expect(m.sent[m.sent.length - 1]).toEqual({
      kind: "naval_line_add",
      cls: "cl",
      gen: 1,
      docks: 2,
      count: 1,
      port: REGION.london,
    });
    for (const o of m.sent) expect(() => WwOrderSchema.parse(o)).not.toThrow();
  });

  it("convoys: their uses, a route, the losses; the shortcut opens a convoy line", async () => {
    const m = await mount<WwNavyPanel>("ww-navy-panel", { navy: navyData() });
    m.bus.emit(new OpenWwNavyEvent("convoys"));
    await m.settle();
    expect(m.q("[data-ww-convoys-line]")!.textContent).toContain(
      "used=21,all=35,t=10,s=6,v=5,i=14",
    );
    expect(m.q("[data-ww-route='3']")!.textContent).toContain("pct=80");
    expect(m.q("[data-ww-loss-bars]")).not.toBeNull();
    await m.click("[data-ww-build-convoys]");
    expect(m.el.shownTab()).toBe("shipyards");
    await m.settle();
    expect(
      m.q("[data-ww-pick='cls:convoy']")!.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("admirals: the roster; appointing needs navy experience", async () => {
    const m = await mount<WwNavyPanel>("ww-navy-panel", {
      fleets: [fleet({ id: 7, ships: [ship(1, "dd")] })],
      navy: navyData(),
    });
    m.bus.emit(new OpenWwNavyEvent("admirals"));
    await m.settle();
    expect(m.qa("[data-ww-admiral]")).toHaveLength(2);
    expect(m.q("[data-ww-admiral='1']")!.textContent).toContain(
      "[ww1936.navy.admiral_commands]",
    );
    expect(m.q("[data-ww-block='no_xp']")).not.toBeNull();
    await m.click("[data-ww-appoint-admiral]");
    expect(m.sent).toEqual([]);
  });
});

describe("<ww-air-panel> (spec §18.7)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const air = () =>
    seaGame({
      air: airDetail("GBR", {
        stock: [340, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        deployed: [120, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        decks: [0, 0, 0, 0, 0, 0, 0, 24, 0, 0],
        bases: [{ region: REGION.london, used: 120, cap: 400, damagePm: 100 }],
        tally30: [44, 19, 1200, 300, 2, 9],
      }),
    });

  it("zones: a row opens its zone with the air layer", async () => {
    const m = await mount<WwAirPanel>("ww-air-panel", {
      air: air().air.detail!,
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
    const zones: number[] = [];
    m.bus.on(WwAirZoneSelectedEvent, (e) => zones.push(e.sr));
    m.bus.emit(new OpenWwAirEvent("zones"));
    await m.settle();
    await m.click(`[data-ww-zone-row='${SR.central}']`);
    expect(zones).toEqual([SR.central]);
  });

  it("planes, bases (build more), record", async () => {
    const m = await mount<WwAirPanel>("ww-air-panel", {
      air: air().air.detail!,
      fleets: [fleet({ id: 7, ships: [ship(1, "cv")] })],
    });
    m.bus.emit(new OpenWwAirEvent("planes"));
    await m.settle();
    expect(
      m.qa("[data-ww-plane-type]").map((r) => r.dataset.wwPlaneType),
    ).toEqual(["fighter", "cv_fighter"]);
    await m.click("[data-ww-pick='deck:7:622']");
    expect(m.sent).toEqual([{ kind: "carrier_mix", fleet: 7, mix: [6, 2, 2] }]);
    m.bus.emit(new OpenWwAirEvent("bases"));
    await m.settle();
    const opened: OpenWwIndustryEvent[] = [];
    m.bus.on(OpenWwIndustryEvent, (e) => opened.push(e));
    await m.click(`[data-ww-build-air-base='${REGION.london}']`);
    expect(opened[0].region).toBe(REGION.london);
    expect(opened[0].building).toBe("air_base");
    m.bus.emit(new OpenWwAirEvent("record"));
    await m.settle();
    expect(m.q("[data-ww-air-record]")!.textContent).toContain("n=44");
    for (const o of m.sent) expect(() => WwOrderSchema.parse(o)).not.toThrow();
  });
});
