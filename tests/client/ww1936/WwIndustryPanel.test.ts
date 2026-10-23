import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  RESOURCE_IDS,
  type WwLineData,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
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

import "../../../src/client/hud/layers/PlayerInfoOverlay";
import type { PlayerInfoOverlay } from "../../../src/client/hud/layers/PlayerInfoOverlay";
import "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import type { WwDiplomacyPanel } from "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import {
  OpenWwIndustryEvent,
  OpenWwPoliticsEvent,
  OpenWwResearchEvent,
  WwDrawerEvent,
} from "../../../src/client/hud/ww1936/WwDrawer";
import {
  HOLD_MS,
  WwIndustryPanel,
} from "../../../src/client/hud/ww1936/WwIndustryPanel";
import "../../../src/client/hud/ww1936/WwResearchPanel";
import type { WwResearchPanel } from "../../../src/client/hud/ww1936/WwResearchPanel";
import { ToggleWwDiplomacyEvent } from "../../../src/client/hud/ww1936/WwTopBand";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import {
  detail,
  fakeEconGame,
  FakeOptions,
  ID,
  partners,
  region,
  summary,
  tileOf,
} from "./EconomyFixture";

function mount(o: FakeOptions = {}) {
  const { game, view } = fakeEconGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-industry-panel") as WwIndustryPanel;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  const open = async (
    tab: ConstructorParameters<typeof OpenWwIndustryEvent>[0] = null,
    region: number | null = null,
  ) => {
    bus.emit(new OpenWwIndustryEvent(tab, region));
    el.tick();
    await el.updateComplete;
  };
  const q = <T extends Element = HTMLButtonElement>(sel: string) =>
    el.querySelector<T>(sel);
  const click = async (sel: string) => {
    const b = q(sel);
    if (b === null) throw new Error(`no ${sel}`);
    b.click();
    await el.updateComplete;
  };
  return { el, bus, sent, view, game, open, q, click };
}

const project = {
  region: 3,
  building: "civ" as const,
  count: 1,
  progressMilli: 0,
  costMilli: 10_800_000,
  assignedMilli: 5_250,
  speedPct: 50,
};

function line(id: number, factories: number): WwLineData {
  return {
    id,
    equipment: "infantry_equipment",
    gen: 1,
    factories,
    active: factories,
    effBp: 3_000,
    progressMilli: 0,
    costMilli: 500,
    fill: 1000,
    outputMilli: 2_700,
  };
}

describe("<ww-industry-panel> (spec §13.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("the add-line button sends add_line", async () => {
    const m = mount({
      // Four military factories, no line yet: all four are idle, before
      // the engine's first day too (its idleMil is still 0 then).
      summaries: [summary("DEU", { mil: 4, idleMil: 0 })],
      details: [detail("DEU")],
    });
    await m.open("production");
    expect(m.q("[data-ww-mil]")!.textContent).toContain("idle=4");
    await m.click("[data-ww-new-line]");
    // Researched: artillery I; not artillery II or anti-tank guns.
    expect(m.q("[data-ww-pick='add:artillery:2']")!.disabled).toBe(true);
    expect(m.q("[data-ww-pick='add:anti_tank:1']")!.disabled).toBe(true);
    await m.click("[data-ww-pick='add:artillery:1']");
    expect(m.sent).toEqual([
      { kind: "add_line", equipment: "artillery", gen: 1, factories: 4 },
    ]);
    // Twenty lines: no more.
    const full = mount({
      summaries: [summary("DEU")],
      details: [
        detail("DEU", {
          lines: Array.from({ length: 20 }, (_, i) => line(i + 1, 0)),
        }),
      ],
    });
    await full.open("production");
    expect(full.q("[data-ww-new-line]")!.disabled).toBe(true);
    expect(full.q("[data-ww-block='lines_full']")!.textContent).toContain(
      "ww1936.econ.block.lines_full",
    );
  });

  it("two taps cancel a project, one does not", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { queue: [project, { ...project, region: 4 }] })],
    });
    await m.open("construction");
    const cancel = "[data-ww-cancel-build='0']";
    await m.click(cancel);
    expect(m.sent).toEqual([]);
    expect(m.q(cancel)!.textContent).toContain("ww1936.econ.cancel_tap");
    // Too late: the first tap has expired, this one arms again.
    vi.advanceTimersByTime(3_100);
    await m.click(cancel);
    expect(m.sent).toEqual([]);
    vi.advanceTimersByTime(400);
    await m.click(cancel);
    expect(m.sent).toEqual([{ kind: "cancel_build", index: 0 }]);
    // ▲▼ move it at once; the first can't go up.
    expect(
      m.q("[data-ww-project='0'] [data-ww-move-build='up']")!.disabled,
    ).toBe(true);
    await m.click("[data-ww-project='0'] [data-ww-move-build='down']");
    expect(m.sent[1]).toEqual({ kind: "move_build", index: 0, to: 1 });
    expect(m.q("[data-ww-free-civs]")!.textContent).toContain(
      "[ww1936.econ.free_civs] n=5.3",
    );
  });

  it("the manpower tab counts men: in the field, in training, lost today", async () => {
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      troops: 472_500,
      // P2 spec §13.2: the land war's country summary.
      land: [
        {
          smallID: ID("DEU"),
          divisions: 45,
          fieldMen: 472_500,
          trainingMen: 21_000,
          casualtiesToday: 3_200,
          battles: 0,
          encircledArmies: 0,
        },
      ],
    });
    await m.open("manpower");
    const values = [
      ...m.el.querySelectorAll<HTMLElement>("[data-ww-manpower] dd"),
    ].map((dd) => dd.textContent!.trim());
    // Recruitable 1,675,000, manpower 1,195,000, army 472,500, then the
    // field and training — real men (spec §13.1) — and today's casualties.
    expect(values).toEqual(["1.7M", "1.2M", "472K", "472K", "21.0K"]);
    expect(m.q("[data-ww-casualties]")!.textContent!.trim()).toBe(
      "[ww1936.pol.manpower.casualties] n=3.2K",
    );
    // P3 (controller ruling R16): the conscription law, read-only; a tap
    // opens the politics drawer's law tab.
    const law = m.q("[data-ww-conscription]")!;
    expect(law.textContent).toContain(
      "[ww1936.pol.manpower.law] law=[ww1936.law.conscription.limited]",
    );
    const opened: OpenWwPoliticsEvent[] = [];
    m.bus.on(OpenWwPoliticsEvent, (e) => opened.push(e));
    law.click();
    expect(opened.map((e) => e.tab)).toEqual(["laws"]);
    expect(m.q("[data-ww-law]")).toBeNull();
    // P1's draft and troop cap lines are gone (P2 plan decision 12).
    expect(m.q("[data-ww-draft]")).toBeNull();
    expect(m.el.textContent).not.toContain("troop_cap");
  });

  it("build here picks the region; the best one is picked otherwise", async () => {
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      regions: [region(6, { controller: ID("DEU") })],
    });
    await m.open("construction");
    // Berlin first: two free slots, infrastructure 5.
    expect(m.q("[data-ww-candidate='3']")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
    await m.click("[data-ww-add-build]");
    expect(m.sent).toEqual([
      { kind: "build", region: 3, building: "civ", count: 1 },
    ]);
    // Warsaw is occupied: no factory there, but infrastructure.
    await m.open(null, 6);
    expect(m.el.isOpen()).toBe(true);
    expect(m.q("[data-ww-add-build]")!.disabled).toBe(true);
    expect(m.q("[data-ww-block='occupied']")).not.toBeNull();
    await m.click("[data-ww-building='infra']");
    expect(m.q("[data-ww-add-build]")!.disabled).toBe(false);
    await m.click("[data-ww-step='build:up']");
    await m.click("[data-ww-add-build]");
    expect(m.sent[1]).toEqual({
      kind: "build",
      region: 6,
      building: "infra",
      count: 2,
    });
    // The region card's "Build here" asks for exactly that.
    const overlay = document.createElement(
      "player-info-overlay",
    ) as PlayerInfoOverlay;
    overlay.game = m.game as never;
    overlay.eventBus = m.bus;
    const opened: OpenWwIndustryEvent[] = [];
    m.bus.on(OpenWwIndustryEvent, (e) => opened.push(e));
    const box = document.createElement("div");
    document.body.appendChild(box);
    render(
      (
        overlay as unknown as { renderRegionEconomy(t: number): unknown }
      ).renderRegionEconomy(tileOf(6)),
      box,
    );
    expect(box.textContent).toContain("[ww1936.econ.occupied_note]");
    expect(box.textContent).toContain(
      "[ww1936.econ.region_buildings] civ=3,mil=1,dock=0,slots=6",
    );
    box.querySelector<HTMLButtonElement>("[data-ww-build-here]")!.click();
    expect(opened.map((e) => [e.tab, e.region])).toEqual([["construction", 6]]);
  });

  it("another building type keeps a picked region that takes it, else the best", async () => {
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      regions: [region(6, { controller: ID("DEU") })],
    });
    const picked = () =>
      m.q("[data-ww-picked]")!.getAttribute("data-ww-picked");
    // "Build here" on Munich: a civilian factory there.
    await m.open(null, 4);
    expect(picked()).toBe("4");
    // Munich has a free slot for a military factory too: it stays.
    await m.click("[data-ww-building='mil']");
    expect(picked()).toBe("4");
    expect(m.q("[data-ww-add-build]")!.disabled).toBe(false);
    // Its infrastructure is full: back to the best candidate (Warsaw),
    // not a blocked Add on Munich.
    await m.click("[data-ww-building='infra']");
    expect(picked()).toBe("6");
    expect(m.q("[data-ww-block]")).toBeNull();
    await m.click("[data-ww-add-build]");
    expect(m.sent).toEqual([
      { kind: "build", region: 6, building: "infra", count: 1 },
    ]);
    // No region takes infrastructure at all (Berlin and Munich are full):
    // the pick stays and says why, rather than an empty form.
    const full = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    await full.open(null, 4);
    await full.click("[data-ww-building='infra']");
    expect(full.q("[data-ww-picked]")!.getAttribute("data-ww-picked")).toBe(
      "4",
    );
    expect(full.q("[data-ww-block='infra_max']")).not.toBeNull();
  });

  it("holding + adds five, a tap one", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { lines: [line(1, 2)] })],
    });
    await m.open("production");
    const plus = m.q("[data-ww-step='line-1:up']")!;
    plus.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(HOLD_MS);
    plus.dispatchEvent(new Event("pointerup"));
    // The click that ends the hold adds nothing more.
    plus.click();
    expect(m.sent).toEqual([
      { kind: "set_line_factories", line: 1, factories: 7 },
    ]);
    await m.el.updateComplete;
    // Before the engine answers, the next tap counts from 7.
    m.q("[data-ww-step='line-1:up']")!.click();
    expect(m.sent[1]).toEqual({
      kind: "set_line_factories",
      line: 1,
      factories: 8,
    });
  });

  it("a resource row lists who can sell it, and opens a deal", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = mount({
      summaries: [
        summary("DEU", { civ: 9 }),
        summary("ITA", { exportRoom: [0, 0, 0, 0, 16, 0] }),
        summary("GBR", { exportRoom: [0, 0, 0, 0, 40, 0] }),
      ],
      details: [
        detail("DEU", {
          // The engine's judgement: Italy (faction) and the Soviet Union;
          // not Britain (no route).
          ...partners("ITA", "SUN"),
          buying: [
            {
              id: 7,
              buyer: ID("DEU"),
              seller: ID("SUN"),
              resource: "oil",
              civs: 1,
              units: 8,
            },
          ],
        }),
      ],
    });
    await m.open("trade");
    // jsdom has no scrollIntoView: the sellers' list asks for it once open
    // (it opens under the six rows, below the fold on a phone).
    const scrolled: string[] = [];
    const had = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollIntoView",
    );
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.getAttribute("data-ww-buy") ?? "?");
    };
    await m.click("[data-ww-resource='steel'] button");
    await m.el.updateComplete;
    await Promise.resolve();
    expect(scrolled).toEqual(["steel"]);
    // Italy (faction); not Britain (no route) — listed with the reason.
    expect(m.q(`[data-ww-offer='${ID("ITA")}']`)).not.toBeNull();
    expect(m.q(`[data-ww-offer='${ID("GBR")}']`)).toBeNull();
    const gbr = m.q(`[data-ww-not-partner='${ID("GBR")}']`)!;
    expect(gbr.dataset.reason).toBe("route");
    expect(gbr.textContent).toContain("[ww1936.econ.not_partner_route]");
    expect(gbr.textContent).toContain("[ww1936.econ.export_room] n=40");
    expect(gbr.querySelector("button")).toBeNull();
    await m.click(`[data-ww-step='buy-${ID("ITA")}:up']`);
    // Two factories' worth is all Italy has.
    expect(m.q(`[data-ww-step='buy-${ID("ITA")}:up']`)!.disabled).toBe(true);
    await m.click(`[data-ww-open-trade='${ID("ITA")}']`);
    expect(m.sent).toEqual([
      {
        kind: "open_trade",
        seller: `P${ID("ITA")}`,
        resource: "steel",
        civs: 2,
      },
    ]);
    // My deal closes on a second tap.
    await m.click("[data-ww-close-trade='7']");
    expect(m.sent).toHaveLength(1);
    vi.advanceTimersByTime(400);
    await m.click("[data-ww-close-trade='7']");
    expect(m.sent[1]).toEqual({ kind: "close_trade", trade: 7 });
    // Chromium: nobody.
    await m.click("[data-ww-resource='chromium'] button");
    expect(m.q("[data-ww-no-sellers]")).not.toBeNull();
    if (had === undefined) {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    } else {
      Object.defineProperty(Element.prototype, "scrollIntoView", had);
    }
  });

  it("a seller's embargo or a war says why it won't sell", async () => {
    const m = mount({
      summaries: [
        summary("DEU"),
        summary("FRA", { exportRoom: [0, 0, 0, 0, 24, 0] }),
        summary("POL", { exportRoom: [0, 0, 0, 0, 16, 0] }),
      ],
      // France has an embargo on us (the engine left it out); Poland was a
      // partner on the last detail, and we are at war with it since.
      details: [detail("DEU", partners("POL"))],
      embargoes: [["FRA", "DEU"]],
      wars: [["DEU", "POL"]],
    });
    await m.open("trade");
    await m.click("[data-ww-resource='steel'] button");
    expect(m.q("[data-ww-offer]")).toBeNull();
    expect(m.q("[data-ww-no-sellers]")).not.toBeNull();
    const reasons = [
      ...m.el.querySelectorAll<HTMLElement>("[data-ww-not-partner]"),
    ].map((li) => [Number(li.dataset.wwNotPartner), li.dataset.reason]);
    expect(reasons).toEqual([
      [ID("FRA"), "embargo"],
      [ID("POL"), "war"],
    ]);
  });

  it("only one World War drawer is open at a time", async () => {
    const m = mount({ summaries: [summary("DEU")], details: [detail("DEU")] });
    const research = document.createElement(
      "ww-research-panel",
    ) as WwResearchPanel;
    research.game = m.game as never;
    research.eventBus = m.bus;
    document.body.appendChild(research);
    research.init();
    const diplomacy = document.createElement(
      "ww-diplomacy-panel",
    ) as WwDiplomacyPanel;
    diplomacy.game = m.game as never;
    diplomacy.eventBus = m.bus;
    document.body.appendChild(diplomacy);
    diplomacy.init();
    const open = () =>
      [m.el.isOpen(), research.isOpen(), diplomacy.isOpen()] as const;
    await m.open("construction");
    expect(open()).toEqual([true, false, false]);
    m.bus.emit(new ToggleWwDiplomacyEvent());
    expect(open()).toEqual([false, false, true]);
    m.bus.emit(new OpenWwResearchEvent());
    expect(open()).toEqual([false, true, false]);
    m.bus.emit(new OpenWwIndustryEvent());
    expect(open()).toEqual([true, false, false]);
    // The same tab again closes it; another tab switches.
    m.bus.emit(new OpenWwIndustryEvent("production"));
    expect(open()).toEqual([true, false, false]);
    expect(m.el.shownTab()).toBe("production");
    m.bus.emit(new OpenWwIndustryEvent("production"));
    expect(open()).toEqual([false, false, false]);
  });

  it("is a full-screen panel: one top bar with the title, the tabs and the close button", async () => {
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    const m = mount({ summaries: [summary("DEU")], details: [detail("DEU")] });
    await m.open("construction");
    const aside = m.q<HTMLElement>("[data-ww-drawer='industry']")!;
    const style = aside.getAttribute("style")!;
    expect(style).toContain("inset:0");
    // Room for the dock at the foot (it stands over the panel).
    expect(style).toContain("var(--ww-dock-h");
    // The list scrolls inside; the top bar stays.
    expect(m.q("[data-ww-scroll]")!.className).toContain("overflow-y-auto");
    expect(m.q("[role='tablist']")!.closest("[data-ww-scroll]")).toBeNull();
    expect(m.el.querySelector("[title]")).toBeNull();
    // Every tab is at least 36 px both ways, even a short name ("Air").
    for (const tab of m.el.querySelectorAll("[role='tab']")) {
      expect(tab.className).toMatch(/\bh-9\b/);
      expect(tab.className).toMatch(/\bmin-w-9\b/);
    }
    const head = m.q("[data-ww-drawer-head]")!;
    expect(head.querySelector("h3")!.textContent).toContain(
      "[ww1936.econ.industry]",
    );
    expect(head.querySelector("[role='tablist']")).not.toBeNull();
    expect(head.querySelector("[data-ww-drawer-close]")).not.toBeNull();
  });

  it("the hover card ignores the pointer over an open drawer", async () => {
    const m = mount({ summaries: [summary("DEU")], details: [detail("DEU")] });
    await m.open("construction");
    const overlay = document.createElement(
      "player-info-overlay",
    ) as PlayerInfoOverlay;
    overlay.game = m.game as never;
    const button = m.q("[data-ww-add-build]")!;
    const at = vi.fn((_x: number, _y: number): Element | null => button);
    // jsdom has no layout: say what lies under the pointer.
    const doc = document as unknown as { elementFromPoint?: unknown };
    const original = doc.elementFromPoint;
    doc.elementFromPoint = at;
    try {
      const o = overlay as unknown as {
        maybeShow(x: number, y: number): void;
        onMouseEvent(e: { x: number; y: number }): void;
      };
      const show = vi.spyOn(o, "maybeShow").mockImplementation(() => {});
      o.onMouseEvent({ x: 600, y: 100 });
      expect(at).toHaveBeenCalledWith(600, 100);
      expect(show).not.toHaveBeenCalled();
      // Over the map, it shows as before.
      at.mockReturnValue(document.body);
      (overlay as unknown as { lastMouseUpdate: number }).lastMouseUpdate = 0;
      o.onMouseEvent({ x: 100, y: 100 });
      expect(show).toHaveBeenCalledWith(100, 100);
    } finally {
      doc.elementFromPoint = original;
    }
  });

  it("construction: pick and Add first, then the regions, then the queue", async () => {
    // Germany holds every region (the others have capitulated): many
    // candidates.
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) =>
      region(id, { controller: ID("DEU") }),
    );
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { queue: [project] })],
      regions: all,
      capitulated: ["FRA", "ITA", "POL", "SUN", "GBR"],
    });
    await m.open("construction");
    const picked = m.q("[data-ww-picked]")!;
    const list = m.q("[data-ww-candidates]")!;
    const queue = m.q("[data-ww-queue]")!;
    const follows = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(picked, list)).toBe(true);
    expect(follows(list, queue)).toBe(true);
    expect(picked.querySelector("[data-ww-add-build]")).not.toBeNull();
    // Only the drawer's list scrolls.
    expect(list.className).not.toContain("overflow");
    // The best four, then the rest on request.
    expect(m.el.querySelectorAll("[data-ww-candidate]")).toHaveLength(4);
    const more = m.q("[data-ww-more-regions]")!;
    expect(more.textContent).toContain("[ww1936.econ.more_regions] n=");
    await m.click("[data-ww-more-regions]");
    expect(m.el.querySelectorAll("[data-ww-candidate]").length).toBeGreaterThan(
      4,
    );
    expect(m.q("[data-ww-more-regions]")).toBeNull();
  });

  it("a capitulated country's drawer says the orders can't go", async () => {
    const m = mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      capitulated: ["DEU"],
    });
    await m.open("construction");
    expect(m.q("[data-ww-drawer='industry']")).not.toBeNull();
    expect(m.q("[data-ww-block='dead']")!.textContent).toContain(
      "[ww1936.econ.block.dead]",
    );
    expect(m.q("[role='tablist']")).toBeNull();
    expect(m.q("[data-ww-add-build]")).toBeNull();
  });

  it("icon-only buttons have names; a deficit has a real minus", async () => {
    const m = mount({
      summaries: [summary("DEU")],
      details: [
        detail("DEU", {
          queue: [project, { ...project, region: 4 }],
          // Five rifle factories need 5 steel; 2 are made, 2 given.
          lines: [line(1, 5)],
          resources: RESOURCE_IDS.map((r) => ({
            produced: r === "steel" ? 2 : 0,
            exported: 0,
            imported: 0,
            used: r === "steel" ? 2 : 0,
          })),
          buying: [
            {
              id: 9,
              buyer: ID("DEU"),
              seller: ID("ITA"),
              resource: "oil",
              civs: 1,
              units: 8,
            },
          ],
        }),
      ],
    });
    const label = (sel: string) => m.q(sel)!.getAttribute("aria-label");
    await m.open("construction");
    expect(label("[data-ww-project='0'] [data-ww-move-build='down']")).toBe(
      "[ww1936.econ.move_down]",
    );
    expect(label("[data-ww-project='1'] [data-ww-move-build='up']")).toBe(
      "[ww1936.econ.move_up]",
    );
    expect(label("[data-ww-cancel-build='0']")).toBe(
      "[ww1936.econ.cancel_project]",
    );
    expect(label("[data-ww-step='build:up']")).toBe("[ww1936.econ.more]");
    expect(label("[data-ww-step='build:down']")).toBe("[ww1936.econ.fewer]");
    // Paying one factory, receiving none: "−1".
    expect(m.q("[data-ww-free-civs]")!.textContent).toContain(
      "[ww1936.econ.trade_civs] n=\u22121",
    );
    await m.open("production");
    expect(label("[data-ww-remove-line='1']")).toBe(
      "[ww1936.econ.remove_line]",
    );
    await m.open("trade");
    expect(label("[data-ww-close-trade='9']")).toBe("[ww1936.econ.close_deal]");
    expect(
      m.q("[data-ww-resource='steel'] [data-ww-balance]")!.textContent!.trim(),
    ).toBe("\u22123");
  });

  it("the hover card keeps to the left half while a drawer is open", async () => {
    const m = mount({ summaries: [summary("DEU")], details: [detail("DEU")] });
    const overlay = document.createElement(
      "player-info-overlay",
    ) as PlayerInfoOverlay;
    overlay.game = m.game as never;
    overlay.eventBus = m.bus;
    document.body.appendChild(overlay);
    overlay.init();
    await overlay.updateComplete;
    const box = () =>
      overlay.querySelector<HTMLElement>("[data-info-card-left]")!;
    expect(box().dataset.infoCardLeft).toBe("false");
    await m.open("construction");
    await overlay.updateComplete;
    expect(box().dataset.infoCardLeft).toBe("true");
    expect(box().getAttribute("style")).toContain("calc(50vw - 8px)");
    expect(box().className).not.toContain("left-1/2");
    m.bus.emit(new WwDrawerEvent("industry", false));
    await overlay.updateComplete;
    expect(box().dataset.infoCardLeft).toBe("false");
  });

  it("a spectator gets no drawer", async () => {
    const m = mount({
      me: null,
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    await m.open("construction");
    expect(m.q("[data-ww-drawer]")).toBeNull();
  });
});
