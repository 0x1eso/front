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
import type { WwDials } from "../../../src/client/hud/ww1936/WwDials";
import {
  dockHeightPx,
  WW_DIAL_HOLD_MS,
} from "../../../src/client/hud/ww1936/WwDials";
import {
  OpenWwAirEvent,
  OpenWwIndustryEvent,
  OpenWwNavyEvent,
  OpenWwResearchEvent,
  WwDrawerEvent,
} from "../../../src/client/hud/ww1936/WwDrawer";
import { WwSeaAirController } from "../../../src/client/hud/ww1936/WwSeaAirController";
import "../../../src/client/hud/ww1936/WwTopBand";
import type { WwTopBand } from "../../../src/client/hud/ww1936/WwTopBand";
import { detail, fakeEconGame, FakeOptions, summary } from "./EconomyFixture";
import { fleet, navyDetail, seaGame, SeaOptions, ship } from "./SeaAirFixture";

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
    vi.unstubAllGlobals();
  });

  it("the research dial glows with a free slot", async () => {
    const free = await mountDials({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [slot, null, null] })],
    });
    const r = free.dial("research")!;
    expect(r.className).toContain(DIAL_GLOW_CLASS);
    expect(r.querySelector("[data-dial-badge='free']")!.textContent).toBe("2");
    expect(
      r.querySelector("[data-dial-badge='free']")!.getAttribute("aria-label"),
    ).toBe("[ww1936.econ.free_slots] n=2");
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
      // Three military factories and no line: three idle, whatever the
      // engine's last daily idleMil (0 before day 0).
      summaries: [summary("DEU", { mil: 3, idleMil: 0 })],
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
    expect(
      i.querySelector("[data-dial-badge='idle']")!.getAttribute("aria-label"),
    ).toBe("[ww1936.econ.idle_factories] n=3");
    expect(i.querySelector("[data-ring]")!.getAttribute("data-progress")).toBe(
      "0.25",
    );
    // Every factory on a line: no badge at once, before the engine's next
    // day recounts its own idleMil (still 3 here).
    m.view.apply({
      countries: [summary("DEU", { mil: 3, idleMil: 3 })],
      details: [
        detail("DEU", {
          lines: [
            {
              id: 1,
              equipment: "infantry_equipment",
              gen: 1,
              factories: 3,
              active: 0,
              effBp: 1_000,
              progressMilli: 0,
              costMilli: 500,
              fill: 1000,
              outputMilli: 0,
            },
          ],
        }),
      ],
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
      "👥 1.2M",
    );
    expect(chip.querySelector("[data-ww-shortage]")).not.toBeNull();
    expect(chip.getAttribute("aria-label")).toBe(
      "[ww1936.econ.band_label] civ=9,mil=6,manpower=1.2M · [ww1936.econ.shortage]",
    );
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
  /** The band on a phone `width` px wide, the top-right stack `stack` px wide. */
  async function bandAt(width: number, stack: number, o: FakeOptions = {}) {
    vi.stubGlobal("innerWidth", width);
    const el = document.createElement("div");
    el.setAttribute("data-hud-top-right", "");
    el.getBoundingClientRect = () =>
      ({
        left: width - stack,
        right: width,
        top: 0,
        bottom: 48,
        width: stack,
        height: 48,
      }) as DOMRect;
    document.body.appendChild(el);
    const { game, view } = fakeEconGame({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      ...o,
    });
    const band = document.createElement("ww-top-band") as WwTopBand;
    band.game = game as never;
    band.eventBus = new EventBus();
    document.body.appendChild(band);
    band.tick();
    await band.updateComplete;
    const box = () => band.querySelector<HTMLElement>("[data-ww-band]")!;
    const chip = () => band.querySelector<HTMLElement>("[data-ww-economy]");
    return { band, view, box, chip };
  }

  it("the band never spills onto the timer: it moves, then the chip shrinks", async () => {
    // 740 px, a 225 px stack: centred there'd be 274 px, too little for the
    // chip — so the band sits left of the stack, with the whole chip.
    const wide = await bandAt(740, 225);
    expect(wide.box().getAttribute("style")).toContain("right: 233px");
    // P4: it clips sideways only (the ⛽ chip's hit area reaches below it).
    expect(wide.box().className).toContain("overflow-x-clip");
    expect(wide.chip()!.dataset.wwEconomy).toBe("full");
    expect(wide.chip()!.querySelector("[data-ww-manpower]")).not.toBeNull();
    document.body.innerHTML = "";
    // 600 px: room for the compact chip only (no manpower).
    const narrow = await bandAt(600, 225);
    expect(narrow.chip()!.dataset.wwEconomy).toBe("compact");
    expect(narrow.chip()!.querySelector("[data-ww-manpower]")).toBeNull();
    expect(narrow.chip()!.textContent).toContain("🏭 9 / 6");
    document.body.innerHTML = "";
    // 540 px: no chip (the 🏭 dial still opens the drawer).
    const tiny = await bandAt(540, 225);
    expect(tiny.chip()).toBeNull();
  });

  it("the band measures itself and sheds the chip when its text runs long", async () => {
    const m = await bandAt(740, 225);
    expect(m.chip()!.dataset.wwEconomy).toBe("full");
    // Longer text than the estimate: the band overflows its room.
    Object.defineProperty(m.box(), "scrollWidth", { value: 600 });
    Object.defineProperty(m.box(), "clientWidth", { value: 499 });
    m.band.requestUpdate();
    await m.band.updateComplete;
    await m.band.updateComplete;
    await m.band.updateComplete;
    expect(m.chip()).toBeNull();
  });

  it("the chip and the dials go once my country capitulates", async () => {
    const m = await bandAt(1180, 225, { capitulated: ["DEU"] });
    expect(m.box()).not.toBeNull();
    expect(m.chip()).toBeNull();
    const dials = await mountDials({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      capitulated: ["DEU"],
    });
    expect(dials.el.querySelector("[data-ww-dials]")).toBeNull();
  });
});

describe("<ww-dials> P4: ⚓ and ✈ (spec §18.1)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function mountSea(o: SeaOptions = {}) {
    const g = seaGame(o);
    const bus = new EventBus();
    const controller = new WwSeaAirController(g.game as never, bus);
    controller.init();
    const el = document.createElement("ww-dials") as WwDials;
    el.game = g.game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const dial = (id: string) =>
      el.querySelector<HTMLButtonElement>(`[data-ww-dial='${id}']`);
    return { ...g, el, bus, dial, controller };
  }

  it("the dock is one slim row that scrolls sideways, 40 px on a landscape phone", async () => {
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    const m = await mountSea({
      armies: [],
      landDetails: [],
    });
    const row = m.el.querySelector<HTMLElement>("[data-ww-dock]")!;
    expect(row.className).toContain("overflow-x-auto");
    expect(row.className).toContain("whitespace-nowrap");
    expect(row.className).not.toContain("flex-wrap");
    expect(row.style.height).toBe(`${dockHeightPx(true)}px`);
    expect(document.documentElement.style.getPropertyValue("--ww-dock-h")).toBe(
      "40px",
    );
    const ids = [...row.querySelectorAll("[data-ww-dial]")].map(
      (b) => (b as HTMLElement).dataset.wwDial,
    );
    expect(ids).toEqual([
      "industry",
      "research",
      "army",
      "focus",
      "politics",
      "diplomacy",
      "navy",
      "air",
    ]);
    for (const b of row.querySelectorAll("[data-ww-dial]")) {
      // An icon with a short label; a tap target of at least 36 px.
      expect(b.className).toContain("min-w-11");
      expect(b.className).toContain("h-full");
      expect(b.textContent).toContain("[ww1936.dock.");
    }
  });

  it("⚓: the first naval line's ring, fleets in battle in red; a tap opens the drawer", async () => {
    const m = await mountSea({
      fleets: [
        fleet({ id: 7, state: "battle", ships: [ship(1, "dd")] }),
        fleet({ id: 8, ships: [ship(2, "dd")] }),
      ],
      navy: navyDetail("GBR", {
        lines: [
          {
            id: 1,
            cls: "dd",
            gen: 1,
            docks: 2,
            activeDocks: 2,
            progressMilli: 300_000,
            costMilli: 1_200_000,
            left: 1,
            port: 10,
            nextName: 0,
            outputMilli: 5_000,
            fill: 1000,
          },
        ],
      }),
    });
    const navy = m.dial("navy")!;
    expect(
      navy.querySelector("[data-ring]")!.getAttribute("data-progress"),
    ).toBe("0.25");
    const badge = navy.querySelector<HTMLElement>("[data-dial-badge]")!;
    expect(badge.dataset.dialBadge).toBe("battle");
    expect(badge.textContent).toBe("1");
    const opened: unknown[] = [];
    m.bus.on(OpenWwNavyEvent, (e) => opened.push(e));
    navy.click();
    expect(opened).toHaveLength(1);
  });

  it("✈: a tap switches the air layer, a long press opens the air drawer", async () => {
    vi.useFakeTimers();
    const m = await mountSea();
    const air = m.dial("air")!;
    air.click();
    expect(m.controller.selection.layer).toBe("air");
    m.el.tick();
    await m.el.updateComplete;
    expect(m.dial("air")!.getAttribute("aria-pressed")).toBe("true");
    const opened: unknown[] = [];
    m.bus.on(OpenWwAirEvent, (e) => opened.push(e));
    m.dial("air")!.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(WW_DIAL_HOLD_MS + 10);
    m.dial("air")!.dispatchEvent(new Event("pointerup"));
    m.dial("air")!.click();
    expect(opened).toHaveLength(1);
    // The long press didn't switch the layer back off.
    expect(m.controller.selection.layer).toBe("air");
  });
});
