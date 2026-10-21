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

import {
  WwAirLayerEvent,
  WwAirZoneSelectedEvent,
} from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwAirZoneCard";
import type { WwAirZoneCard } from "../../../src/client/hud/ww1936/WwAirZoneCard";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION, SR } from "../../ww1936/seaFixture";
import { airDetail, seaGame, SeaOptions, SID } from "./SeaAirFixture";

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
