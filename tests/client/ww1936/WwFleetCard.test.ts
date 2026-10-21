// World War 1936 P4 (plan Task 12 Step 6, spec §18.3-1, §18.4): the fleet
// card — a greyed button says why when tapped (the judge's reason), and
// the mission's four taps: [Mission] → chip → region (preview) → again.
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

import { WwFleetSelectedEvent } from "../../../src/client/hud/ww1936/SeaAirSelection";
import "../../../src/client/hud/ww1936/WwFleetCard";
import type { WwFleetCard } from "../../../src/client/hud/ww1936/WwFleetCard";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { REGION, SR, ZONE } from "../../ww1936/seaFixture";
import { fleet, seaGame, SeaOptions, ship } from "./SeaAirFixture";

async function mount(o: SeaOptions = {}) {
  const g = seaGame({
    fleets: [
      fleet({
        id: 7,
        zone: ZONE.west,
        docked: REGION.london,
        state: "docked",
        ships: [ship(1, "bb"), ship(2, "dd")],
      }),
    ],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  let now = 10_000;
  const controller = new WwSeaAirController(g.game as never, bus, () => 4, {
    layout: () => [],
    hit: () => 0,
    now: () => now,
  });
  controller.init();
  const el = document.createElement("ww-fleet-card") as WwFleetCard;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new WwFleetSelectedEvent(7));
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const click = async (sel: string) => {
    q(sel)!.click();
    el.tick();
    await el.updateComplete;
  };
  const tap = async (x: number, y: number, later = 1000) => {
    now += later;
    const took = controller.handleTap(x, y);
    el.tick();
    await el.updateComplete;
    return took;
  };
  return { ...g, el, bus, sent, q, click, tap, controller };
}

describe("<ww-fleet-card> (spec §18.4)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows the fleet; buttons are 36 px; no title", async () => {
    const m = await mount();
    const card = m.q("[data-ww-fleet-card='7']")!;
    expect(card.textContent).toContain("[ww1936.navy.fleet_name] n=1");
    expect(m.q("[data-ww-fleet-count='bb']")!.textContent).toContain("1");
    expect(m.q("[data-ww-fleet-status]")!.textContent).toContain(
      "[ww1936.navy.state_docked]",
    );
    expect(card.querySelector("[title]")).toBeNull();
    for (const b of card.querySelectorAll("[data-ww-fleet-btn]")) {
      expect(b.className).toMatch(/\bh-9\b/);
    }
  });

  it("a greyed button, tapped, says why with the judge's reason", async () => {
    const m = await mount({
      fleets: [
        fleet({
          id: 7,
          zone: ZONE.west,
          state: "battle",
          ships: [ship(1, "bb"), ship(2, "dd")],
        }),
      ],
    });
    const move = m.q("[data-ww-fleet-btn='move']")!;
    expect(move.getAttribute("aria-disabled")).toBe("true");
    await m.click("[data-ww-fleet-btn='move']");
    expect(m.q("[data-ww-block]")!.dataset.wwBlock).toBe("fleet_busy");
    expect(m.q("[data-ww-block]")!.textContent).toContain(
      "[ww1936.econ.block.fleet_busy]",
    );
    expect(m.sent).toEqual([]);
    // One ship can't split: its own words.
    const one = await mount({
      fleets: [fleet({ id: 7, zone: ZONE.west, ships: [ship(1, "dd")] })],
    });
    await one.click("[data-ww-fleet-btn='split']");
    expect(one.q("[data-ww-block]")!.textContent).toContain(
      "[ww1936.navy.block_split_single]",
    );
  });

  it("a mission in four taps: [Mission], the chip, the region, the region again", async () => {
    const m = await mount();
    await m.click("[data-ww-fleet-btn='mission']");
    await m.click("[data-ww-fleet-btn='mission_patrol']");
    // The card folds to its strip while the map is tapped: open it.
    await m.click("[data-ww-card-fold='open']");
    expect(m.q("[data-ww-hint='mission']")).not.toBeNull();
    // The Middle Sea's centre: Central Waters' preview.
    expect(await m.tap(85, 110)).toBe(true);
    expect(m.q("[data-ww-preview='mission']")!.textContent).toContain(
      "Central Waters",
    );
    expect(m.q("[data-ww-preview-km]")!.textContent).toContain("km=300");
    expect(m.sent).toEqual([]);
    // A double tap does not confirm; a second tap later does.
    await m.tap(85, 110, 100);
    expect(m.sent).toEqual([]);
    await m.tap(85, 110);
    expect(m.sent).toEqual([
      { kind: "fleet_mission", fleet: 7, mission: "patrol", sr: SR.central },
    ]);
  });

  it("hold needs no region; a tap off the candidates cancels", async () => {
    const m = await mount();
    await m.click("[data-ww-fleet-btn='mission']");
    await m.click("[data-ww-fleet-btn='mission_hold']");
    expect(m.sent).toEqual([
      { kind: "fleet_mission", fleet: 7, mission: "hold", sr: SR.approaches },
    ]);
    await m.click("[data-ww-fleet-btn='move']");
    // A land tile is no sea zone: the move mode ends.
    await m.tap(65, 17);
    expect(m.controller.draft.mode).toBe("none");
  });
});
