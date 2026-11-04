// ww63: the screens of the historical catalogue. The designer is off unless
// the game config says otherwise; a major picks from its catalogue.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
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

import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import { render } from "lit";
import { depthNoticeParams } from "../../../src/client/hud/ww1936/DepthMiscModel";
import {
  designButton,
  designsButton,
} from "../../../src/client/hud/ww1936/DesignButton";
import { designDisplayName } from "../../../src/client/hud/ww1936/DesignName";
import {
  lineItemName,
  stockTable,
} from "../../../src/client/hud/ww1936/EconomyModel";
import { histTankGroups } from "../../../src/client/hud/ww1936/HistPicker";
import { effectLines } from "../../../src/client/hud/ww1936/TechEffectLines";
import { OpenWwIndustryEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwIndustryPanel";
import type { WwIndustryPanel } from "../../../src/client/hud/ww1936/WwIndustryPanel";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { designerGame, saved } from "./DesignerFixture";
import { detail, fakeEconGame, ID, summary } from "./EconomyFixture";

const histDef = (kind: "tank" | "plane", id: string, base: string) =>
  ({
    kind,
    base,
    modules: kind === "tank" ? ["", "", "", "", "", ""] : ["", "", "", ""],
    armorLevel: 0,
    engineLevel: 0,
    name: id,
    hist: id,
  }) as never;

function mountDeu(
  researched: string[],
  designs: ReturnType<typeof saved>[],
  designer = false,
) {
  const { game } = fakeEconGame({
    designer,
    summaries: [summary("DEU", { mil: 4, idleMil: 4 })],
    details: [detail("DEU", { researched: researched as never })],
  });
  const depth = new WwDepthView();
  depth.apply({
    fx: [],
    news: [],
    details: [{ smallID: ID("DEU"), designs, projects: { done: 0 } } as never],
    market: {
      listings: [],
      deals: [],
      embargoes: [],
      pendingLicences: [],
      licences: [],
    },
  });
  (game as { wwDepth?: unknown }).wwDepth = () => depth;
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-industry-panel") as WwIndustryPanel;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  return { el, bus, sent, game };
}

async function openPicker(m: ReturnType<typeof mountDeu>) {
  m.bus.emit(new OpenWwIndustryEvent("production", null));
  m.el.tick();
  await m.el.updateComplete;
  m.el.querySelector<HTMLButtonElement>("[data-ww-new-line]")!.click();
  await m.el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("the production picker of the catalogue (designer off)", () => {
  const designs = [
    saved(histDef("tank", "deu_pz1_b", "light_2"), 1),
    saved(histDef("tank", "deu_pz3_e", "medium_1"), 4),
  ];
  const researched = ["inf_eq_1", "light_tank_1", "medium_tank_1"];

  it("lists the unlocked entries by name with a stats line and sends the slot", async () => {
    const m = mountDeu(researched, designs);
    await openPicker(m);
    const row = m.el.querySelector("[data-ww-hist='deu_pz3_e']")!;
    expect(row.textContent).toContain("[ww1936.hist.deu_pz3_e]");
    expect(row.textContent).toContain("[ww1936.hist_pick.tank]");
    expect(row.textContent).toMatch(
      /armor=\d+,pierce=\d+,speed=[\d.]+,cost=[\d.]+,rel=\d+/,
    );
    // The generic tank buttons give way to the catalogue.
    expect(m.el.querySelector("[data-ww-pick='add:medium_tank:1']")).toBeNull();
    (row as HTMLButtonElement).click();
    expect(m.sent).toEqual([
      { kind: "add_line", equipment: "tank_design", gen: 4, factories: 4 },
    ]);
    // The 40 px rule and a scrolling list.
    expect(row.className).toContain("min-h-10");
    expect(m.el.querySelector("[data-ww-picker]")!.className).toContain(
      "overflow-y-auto",
    );
  });

  it("a locked entry is not a button; it waits folded with the tech it needs", async () => {
    const m = mountDeu(researched, designs);
    await openPicker(m);
    // Panzer III J needs medium tank II: no row, not pickable.
    expect(m.el.querySelector("[data-ww-hist='deu_pz3_j']")).toBeNull();
    expect(m.el.querySelector("[data-ww-hist-lock]")).toBeNull();
    m.el
      .querySelector<HTMLButtonElement>("[data-ww-hist-locked-toggle]")!
      .click();
    await m.el.updateComplete;
    const lock = m.el.querySelector("[data-ww-hist-lock='deu_pz3_j']")!;
    expect(lock.tagName).not.toBe("BUTTON");
    expect(lock.textContent).toContain("[ww1936.tech.medium_tank_2]");
  });

  it("with the designer on the picker is the old one", async () => {
    const m = mountDeu(researched, [], true);
    await openPicker(m);
    expect(m.el.querySelector("[data-ww-hist]")).toBeNull();
    expect(
      m.el.querySelector("[data-ww-pick='add:medium_tank:1']"),
    ).not.toBeNull();
  });
});

describe("the designer is hidden when off", () => {
  it("the design buttons render nothing off, a button on", () => {
    const bus = new EventBus();
    const off = designerGame({ designer: false });
    const on = designerGame({ designer: true });
    const host = document.createElement("div");
    render(designButton(bus, "tank", off as never), host);
    expect(host.querySelector("[data-ww-designer]")).toBeNull();
    render(designsButton(bus, off as never), host);
    expect(host.querySelector("[data-ww-designs]")).toBeNull();
    render(designButton(bus, "tank", on as never), host);
    expect(host.querySelector("[data-ww-designer]")).not.toBeNull();
    render(designsButton(bus, on as never), host);
    expect(host.querySelector("[data-ww-designs]")).not.toBeNull();
  });

  async function drawer(designer: boolean) {
    const { WwDepthOpenEvent } =
      await import("../../../src/client/hud/ww1936/DepthEvents");
    await import("../../../src/client/hud/ww1936/WwDesigner");
    const bus = new EventBus();
    const el = document.createElement("ww-designer") as HTMLElement & {
      game: unknown;
      eventBus: unknown;
      updateComplete: Promise<boolean>;
      init(): void;
    };
    el.game = designerGame({ designer });
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    bus.emit(new WwDepthOpenEvent("designer", { kind: "tank" }));
    await el.updateComplete;
    bus.emit(new WwDepthOpenEvent("designs"));
    await el.updateComplete;
    return el;
  }

  it("off: no kind tabs, no list tab, the library opens; on: all of them", async () => {
    const off = await drawer(false);
    expect(off.querySelector("[data-ww-design-kind]")).toBeNull();
    expect(off.querySelector("[data-ww-design-tab-list]")).toBeNull();
    expect(off.querySelector("[data-ww-design-tab-library]")).not.toBeNull();
    expect(off.querySelector("[data-ww-library]")).not.toBeNull();
    document.body.innerHTML = "";
    const on = await drawer(true);
    expect(on.querySelector("[data-ww-design-kind]")).not.toBeNull();
    expect(on.querySelector("[data-ww-design-tab-list]")).not.toBeNull();
  });
});

describe("catalogue names", () => {
  it("a catalogue slot's def.name (its id) shows translated, everywhere the name is resolved", () => {
    const def = histDef("tank", "deu_tiger1_e", "heavy_1");
    expect(designDisplayName(def)).toBe("[ww1936.hist.deu_tiger1_e]");
    expect(
      depthNoticeParams("events_display.ww1936_licence_granted", {
        design: "usa_m4a1_sherman",
      }).design,
    ).toBe("[ww1936.hist.usa_m4a1_sherman]");
    expect(
      depthNoticeParams("events_display.ww1936_design_saved", {
        name: "deu_pz4_h",
        kind: "tank",
        slot: 7,
      }).name,
    ).toBe("[ww1936.hist.deu_pz4_h]");
  });

  it("production lines and the stock table name catalogue slots and a major's static keys", () => {
    const designs = [saved(histDef("tank", "deu_pz3_e", "medium_1"), 4)];
    expect(lineItemName("tank_design", 4, designs, "DEU")).toBe(
      "[ww1936.hist.deu_pz3_e]",
    );
    // Germany's light tank I is the Panzer I; a minor keeps the generic name.
    expect(lineItemName("light_tank", 1, [], "DEU")).toBe(
      "[ww1936.hist.deu_pz1_b]",
    );
    expect(lineItemName("light_tank", 1, [], null)).not.toContain("hist");
    const d = detail("DEU");
    d.stock[equipKey("tank_design", 4)] = 5;
    const rows = stockTable(d, null, designs, "DEU");
    const parts = rows.flatMap((r) => r.parts.map((p) => p.name));
    expect(parts).toContain("[ww1936.hist.deu_pz3_e]");
  });
});

describe("tech effect text", () => {
  it("lists what the tech unlocks for my country; the module lines go with the designer", () => {
    const off = effectLines("medium_tank_3", {
      designer: false,
      country: "DEU",
    });
    expect(off.join("|")).toContain("[ww1936.techfx.hist_unlocks]");
    expect(off.join("|")).toContain("[ww1936.hist.deu_panther_a]");
    expect(off.join("|")).not.toContain("tank_chassis");
    expect(off.join("|")).not.toContain("tank_modules");
    // A minor lists no entries.
    expect(
      effectLines("medium_tank_3", { designer: false, country: "POL" }).join(
        "|",
      ),
    ).not.toContain("hist_unlocks");
    // Designer on (and the old default): the chassis line, no catalogue line.
    const on = effectLines("medium_tank_3", { designer: true, country: "DEU" });
    expect(on.join("|")).not.toContain("hist_unlocks");
    expect(effectLines("medium_tank_3").join("|")).toBe(on.join("|"));
  });
});

describe("the tank picker", () => {
  it("a gift before its techs is listed as locked, not as a line to make", () => {
    const own = histOwn("DEU", "tank");
    const i = own.findIndex((e) => e.id === "deu_tiger1_e");
    const row = (origin: string) =>
      ({
        kind: "tank",
        slot: i + 1,
        origin,
        obsolete: false,
        def: { hist: "deu_tiger1_e" },
      }) as never;
    const tiger = (designs: never[]) =>
      histTankGroups("DEU", designs, new Set())
        .flatMap((g) => g.items)
        .find((it) => it.id === "deu_tiger1_e")!;
    expect(tiger([row("received")]).lack.length).toBeGreaterThan(0);
    expect(tiger([row("own")]).lack).toEqual([]);
  });
});
