// World War 1936 P4 (plan Task 12 Step 6, spec §18.3-4, §18.6): the air
// zone card — dragging a slider sends nothing; letting it go sends ONE
// air_deploy with that value; a refused value says why.
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

import { AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  landSelectionOf,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import {
  WwAirLayerEvent,
  WwAirZoneSelectedEvent,
} from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwAirZoneCard";
import type { WwAirZoneCard } from "../../../src/client/hud/ww1936/WwAirZoneCard";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION, SR } from "../../ww1936/seaFixture";
import { army, division, landDetail, mine } from "./LandFixture";
import { airDetail, sea, seaGame, SeaOptions, SID } from "./SeaAirFixture";

async function mount(o: SeaOptions = {}) {
  const g = seaGame({
    air: airDetail("GBR", {
      stock: [340, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      deployed: [120, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      bases: [{ region: REGION.london, used: 120, cap: 400, damagePm: 0 }],
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
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const controller = new WwSeaAirController(g.game as never, bus, () => 4, {
    layout: () => [],
    hit: () => 0,
  });
  controller.init();
  const el = document.createElement("ww-air-zone-card") as WwAirZoneCard;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new WwAirLayerEvent(true));
  bus.emit(new WwAirZoneSelectedEvent(SR.central));
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const slider = () => q("[data-ww-air-slider='fighter']") as HTMLInputElement;
  const drag = async (value: number) => {
    slider().value = String(value);
    slider().dispatchEvent(new Event("input"));
    await el.updateComplete;
  };
  const release = async (value: number) => {
    slider().value = String(value);
    slider().dispatchEvent(new Event("change"));
    await el.updateComplete;
  };
  return { ...g, el, bus, sent, q, slider, drag, release, controller };
}

describe("<ww-air-zone-card> (spec §18.6)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("a row: the mission chips the zone allows, the slider 0 .. deployed + idle", async () => {
    const m = await mount();
    expect(m.q("[data-ww-air-zone-card]")!.textContent).toContain(
      "Central Waters",
    );
    const chips = [...m.el.querySelectorAll("[data-ww-air-mission]")].map(
      (b) => (b as HTMLElement).dataset.wwAirMission,
    );
    expect(chips).toEqual(["fighter:air_superiority", "fighter:interception"]);
    expect(m.slider().max).toBe("460");
    expect(m.slider().value).toBe("120");
    expect(m.q("[data-ww-air-count='fighter']")!.textContent).toContain(
      "n=120,free=340",
    );
  });

  it("the night toggle reads W2's flag from the view and sends the switch", async () => {
    const strat = AIR_TYPES.indexOf("strat_bomber");
    const stock = new Array<number>(10).fill(0);
    const deployed = new Array<number>(10).fill(0);
    stock[0] = 340;
    deployed[0] = 120;
    stock[strat] = 60;
    deployed[strat] = 40;
    const dep = (night: boolean) => ({
      id: 2,
      owner: SID("GBR"),
      sr: SR.central,
      type: "strat_bomber" as const,
      mission: "strategic_bombing" as const,
      counts: [40, 0, 0],
      target: 0,
      base: REGION.london,
      ...(night ? { night: true } : {}),
    });
    for (const night of [false, true]) {
      const m = await mount({
        air: airDetail("GBR", {
          stock,
          deployed,
          bases: [{ region: REGION.london, used: 160, cap: 400, damagePm: 0 }],
        }),
        deployments: [dep(night)],
      });
      const btn = m.q("[data-ww-air-night='strat_bomber']")!;
      expect(btn.getAttribute("aria-pressed")).toBe(String(night));
      btn.click();
      await m.el.updateComplete;
      expect(m.sent).toEqual([
        { kind: "air_night", deployment: 2, on: !night },
      ]);
      // Nothing changes on the client: the next view update shows it.
      expect(btn.getAttribute("aria-pressed")).toBe(String(night));
      document.body.innerHTML = "";
    }
  });

  it("dragging sends nothing; letting go sends the one value", async () => {
    const m = await mount();
    await m.drag(150);
    await m.drag(220);
    await m.drag(260);
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-air-count='fighter']")!.textContent).toContain(
      "n=260",
    );
    await m.release(260);
    expect(m.sent).toEqual([
      {
        kind: "air_deploy",
        sr: SR.central,
        type: "fighter",
        mission: "air_superiority",
        count: 260,
      },
    ]);
    // The sent value shows until the engine answers.
    expect(m.slider().value).toBe("260");
  });

  it("−/+ move it by ten, one order a tap", async () => {
    const m = await mount();
    m.q("[data-ww-air-step='fighter:up']")!.click();
    await m.el.updateComplete;
    expect(m.sent).toEqual([
      {
        kind: "air_deploy",
        sr: SR.central,
        type: "fighter",
        mission: "air_superiority",
        count: 130,
      },
    ]);
  });

  it("a refused value says why (airDeployBlock) and sends nothing", async () => {
    // No base in range and nothing deployed there yet.
    const m = await mount({
      deployments: [],
      air: airDetail("GBR", { stock: [340, 0, 0, 0, 0, 0, 0, 0, 0, 0] }),
      regions: [],
      details: undefined,
    });
    // London's base is level 2: take it away (bombed out).
    m.economy.apply({
      countries: [],
      details: [],
      regions: [
        {
          ...m.economy.region(REGION.london),
          airBase: 0,
        },
      ],
    });
    m.el.tick();
    await m.el.updateComplete;
    await m.release(50);
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-block]")!.dataset.wwBlock).toBe("no_air_base");
  });
});

describe("the air layer only colours (spec §18.11)", () => {
  it("with the layer on, my army token is still tapped first; a region tap picks the zone", async () => {
    const g = seaGame({
      armies: [army(1, "GBR", REGION.london, { mine: mine() })],
      landDetails: [
        landDetail("GBR", { divisions: [division(1, 1, REGION.london)] }),
      ],
    });
    const bus = new EventBus();
    const seaAir = new WwSeaAirController(g.game as never, bus, () => 4, {
      layout: () => [],
      hit: () => 0,
    });
    seaAir.init();
    const t = sea.centerTile(REGION.london);
    const [lx, ly] = [t % sea.width, Math.floor(t / sea.width)];
    const land = new WwLandController(
      g.game as never,
      bus,
      { scale: 4, screenToWorldCoordinatesFloat: (x, y) => ({ x, y }) },
      {
        layout: () => [
          { army: 1, region: REGION.london, x: lx, y: ly } as never,
        ],
        hit: (slots, x, y) =>
          Math.abs(x - lx) + Math.abs(y - ly) < 2 ? 1 : null,
        markers: () => [],
        seaAir,
      },
    );
    land.init();
    bus.emit(new WwAirLayerEvent(true));
    expect(land.tap(lx, ly)).toBe(true);
    expect(landSelectionOf(g.game).army).toBe(1);
    expect(seaAir.selection.sr).toBe(0);
    // Let go of the army: a region tap now chooses the air zone.
    bus.emit(new WwSelectArmyEvent(null));
    expect(land.tap(65, 85)).toBe(true);
    expect(seaAir.selection.sr).toBe(SR.westLand);
  });
});
