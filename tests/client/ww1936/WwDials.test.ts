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

import { DIAL_GLOW_CLASS } from "../../../src/client/hud/domestic/Dial";
import { EventsDisplay } from "../../../src/client/hud/layers/EventsDisplay";
import "../../../src/client/hud/ww1936/WwDials";
import type { WwDials } from "../../../src/client/hud/ww1936/WwDials";
import {
  OpenWwIndustryEvent,
  OpenWwResearchEvent,
  WwDrawerEvent,
} from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwTopBand";
import type { WwTopBand } from "../../../src/client/hud/ww1936/WwTopBand";
import { detail, fakeEconGame, FakeOptions, summary } from "./EconomyFixture";

async function mountDials(o: FakeOptions = {}) {
  const { game, view } = fakeEconGame(o);
  const bus = new EventBus();
  const el = document.createElement("ww-dials") as WwDials;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  el.tick();
  await el.updateComplete;
  const dial = (id: string) =>
    el.querySelector<HTMLButtonElement>(`[data-ww-dial='${id}']`);
  return { el, bus, view, dial };
}

const slot = {
  tech: "inf_eq_2" as const,
  progressMilli: 82_500,
  totalMilli: 165_000,
};

describe("<ww-dials> and the band's economy chip (spec §13.1, §13.2)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("the research dial glows with a free slot", async () => {
    const free = await mountDials({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [slot, null, null] })],
    });
    const r = free.dial("research")!;
    expect(r.className).toContain(DIAL_GLOW_CLASS);
    expect(r.querySelector("[data-dial-badge='free']")!.textContent).toBe("2");
    expect(r.querySelector("[data-ring]")!.getAttribute("data-progress")).toBe(
      "0.50",
    );
    document.body.innerHTML = "";
    const full = await mountDials({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slotCount: 1, slots: [slot] })],
    });
    expect(full.dial("research")!.className).not.toContain(DIAL_GLOW_CLASS);
    expect(
      full.dial("research")!.querySelector("[data-dial-badge]"),
    ).toBeNull();
  });

  it("the industry badge shows idle factories", async () => {
    const m = await mountDials({
      summaries: [summary("DEU", { idleMil: 3 })],
      details: [
        detail("DEU", {
          queue: [
            {
              region: 3,
              building: "civ",
              count: 1,
              progressMilli: 2_700_000,
              costMilli: 10_800_000,
              assignedMilli: 5_250,
              speedPct: 50,
            },
          ],
        }),
      ],
    });
    const i = m.dial("industry")!;
    expect(i.querySelector("[data-dial-badge='idle']")!.textContent).toBe("3");
    expect(i.querySelector("[data-ring]")!.getAttribute("data-progress")).toBe(
      "0.25",
    );
    // Every factory on a line: no badge, once the next day's data comes.
    m.view.apply({
      countries: [summary("DEU", { idleMil: 0 })],
      details: [],
      regions: [],
    });
    m.el.tick();
    await m.el.updateComplete;
    expect(i.querySelector("[data-dial-badge]")).toBeNull();
  });

  it("the dials open their drawers and outline the open one", async () => {
    const m = await mountDials({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    const seen: unknown[] = [];
    m.bus.on(OpenWwIndustryEvent, (e) => seen.push(e));
    m.bus.on(OpenWwResearchEvent, (e) => seen.push(e));
    m.dial("industry")!.click();
    m.dial("research")!.click();
    expect(seen[0]).toBeInstanceOf(OpenWwIndustryEvent);
    expect((seen[0] as OpenWwIndustryEvent).tab).toBeNull();
    expect(seen[1]).toBeInstanceOf(OpenWwResearchEvent);
    m.bus.emit(new WwDrawerEvent("research", true));
    await m.el.updateComplete;
    expect(m.dial("research")!.getAttribute("aria-pressed")).toBe("true");
    // The diplomacy drawer opening closes research.
    m.bus.emit(new WwDrawerEvent("diplomacy", true));
    m.bus.emit(new WwDrawerEvent("research", false));
    await m.el.updateComplete;
    expect(m.dial("research")!.getAttribute("aria-pressed")).toBe("false");
  });

  it("a spectator sees no dials and no economy chip", async () => {
    const m = await mountDials({
      me: null,
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    expect(m.el.querySelector("[data-ww-dials]")).toBeNull();
    const { game } = fakeEconGame({ me: null, summaries: [summary("DEU")] });
    const band = document.createElement("ww-top-band") as WwTopBand;
    band.game = game as never;
    document.body.appendChild(band);
    band.tick();
    await band.updateComplete;
    expect(band.querySelector("[data-ww-band]")).not.toBeNull();
    expect(band.querySelector("[data-ww-economy]")).toBeNull();
  });

  it("the band shows factories and manpower, and opens construction", async () => {
    const { game, view } = fakeEconGame({
      summaries: [summary("DEU", { shortage: true })],
      details: [detail("DEU")],
    });
    const band = document.createElement("ww-top-band") as WwTopBand;
    const emitted: unknown[] = [];
    band.game = game as never;
    band.eventBus = { emit: (e: unknown) => emitted.push(e) } as never;
    document.body.appendChild(band);
    band.tick();
    await band.updateComplete;
    const chip = band.querySelector<HTMLButtonElement>("[data-ww-economy]")!;
    expect(chip.querySelector("[data-ww-factories]")!.textContent).toBe(
      "🏭 9 / 6",
    );
    expect(chip.querySelector("[data-ww-manpower]")!.textContent).toBe(
      "👥 119K",
    );
    expect(chip.querySelector("[data-ww-shortage]")).not.toBeNull();
    chip.click();
    expect(emitted[0]).toBeInstanceOf(OpenWwIndustryEvent);
    expect((emitted[0] as OpenWwIndustryEvent).tab).toBe("construction");
    // It redraws only when its numbers change.
    const update = vi.spyOn(band, "requestUpdate");
    band.tick();
    expect(update).not.toHaveBeenCalled();
    view.apply({
      countries: [summary("DEU", { civ: 10, shortage: false })],
      details: [],
      regions: [],
    });
    band.tick();
    expect(update).toHaveBeenCalled();
    await band.updateComplete;
    expect(band.querySelector("[data-ww-factories]")!.textContent).toBe(
      "🏭 10 / 6",
    );
    expect(band.querySelector("[data-ww-shortage]")).toBeNull();
  });

  it("economy notices name the tech and the resource", () => {
    const events = new EventsDisplay();
    const params = (
      events as unknown as {
        resolveParams(e: unknown): Record<string, string | number>;
      }
    ).resolveParams({
      message: "events_display.ww1936_trade_closed",
      params: { sellerTag: "ITA", resource: "steel" },
    });
    expect(params).toMatchObject({
      seller: "[ww1936.country.ITA]",
      resource: "[ww1936.res.steel]",
    });
    expect(
      (
        events as unknown as {
          resolveParams(e: unknown): Record<string, string | number>;
        }
      ).resolveParams({
        message: "events_display.ww1936_research_done",
        params: { tech: "tools_1" },
      }).tech,
    ).toBe("[ww1936.tech.tools_1]");
  });
});
