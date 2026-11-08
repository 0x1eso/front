// World War 1936 P4 (plan Task 12 Step 6, spec §18.3-4, §18.6): the air
// zone card — the zone, my wings over it, the strike buttons' reasons.
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
  return { ...g, el, bus, sent, q, controller };
}

describe("<ww-air-zone-card> (spec §18.6)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("the zone's name, and my wings over it (none flying here)", async () => {
    const m = await mount();
    expect(m.q("[data-ww-air-zone-card]")!.textContent).toContain(
      "Central Waters",
    );
    expect(m.q("[data-ww-zone-rows]")!.textContent).toContain(
      "[ww1936.wing.zone_none]",
    );
    expect(m.sent).toEqual([]);
  });

  it("final review C (M1): a greyed ☢ button says why when tapped (no hover title)", async () => {
    const m = await mount();
    m.bus.emit(new WwAirZoneSelectedEvent(SR.westLand));
    m.el.tick();
    await m.el.updateComplete;
    const start = m.q("[data-ww-nuke-start]")!;
    expect(start.getAttribute("aria-disabled")).toBe("true");
    expect(start.hasAttribute("title")).toBe(false);
    expect(m.q("[data-ww-nuke-why]")).toBeNull();
    start.click();
    await m.el.updateComplete;
    const why = m.q("[data-ww-nuke-why]")!;
    expect(why.textContent).toContain("🔒");
    expect(why.textContent!.trim().length).toBeGreaterThan(2);
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
