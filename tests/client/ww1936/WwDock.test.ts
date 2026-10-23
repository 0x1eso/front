import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params ? `[${key}]` : `[${key}]`,
}));

import { handleGamePopState } from "../../../src/client/BackGuard";
import {
  landSelectionOf,
  WwLandModeEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import { multiSelectOf } from "../../../src/client/hud/ww1936/MultiSelect";
import { peaceUiOf } from "../../../src/client/hud/ww1936/PeaceModel";
import "../../../src/client/hud/ww1936/WwDials";
import type { WwDials } from "../../../src/client/hud/ww1936/WwDials";
import "../../../src/client/hud/ww1936/WwIndustryPanel";
import type { WwIndustryPanel } from "../../../src/client/hud/ww1936/WwIndustryPanel";
import { strikeFlowOf } from "../../../src/client/hud/ww1936/WwNukeFlow";
import { wwMapFlowActive } from "../../../src/client/hud/ww1936/WwPanelMode";
import "../../../src/client/hud/ww1936/WwResearchPanel";
import type { WwResearchPanel } from "../../../src/client/hud/ww1936/WwResearchPanel";
import { seaAirOf } from "../../../src/client/hud/ww1936/WwSeaAirController";
import { detail, fakeEconGame, summary } from "./EconomyFixture";

async function mount() {
  const { game } = fakeEconGame({
    summaries: [summary("DEU")],
    details: [detail("DEU")],
  });
  const bus = new EventBus();
  const dials = document.createElement("ww-dials") as WwDials;
  const industry = document.createElement(
    "ww-industry-panel",
  ) as WwIndustryPanel;
  const research = document.createElement(
    "ww-research-panel",
  ) as WwResearchPanel;
  for (const el of [dials, industry, research]) {
    (el as unknown as { game: unknown }).game = game;
    (el as unknown as { eventBus: EventBus }).eventBus = bus;
    document.body.appendChild(el);
    (el as unknown as { init(): void }).init();
  }
  dials.tick();
  await dials.updateComplete;
  const dial = (id: string) =>
    dials.querySelector<HTMLButtonElement>(`[data-ww-dial='${id}']`)!;
  const settle = async () => {
    await Promise.all([
      dials.updateComplete,
      industry.updateComplete,
      research.updateComplete,
    ]);
  };
  const panel = (id: string) =>
    document.querySelector<HTMLElement>(`[data-ww-drawer='${id}']`);
  return { game, bus, dials, industry, research, dial, settle, panel };
}

const esc = () =>
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );

describe("the dock and the full-screen panels", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("a dock button opens its panel full-screen; the same button closes it", async () => {
    const m = await mount();
    expect(m.panel("industry")).toBeNull();
    m.dial("industry").click();
    await m.settle();
    const aside = m.panel("industry")!;
    expect(aside.getAttribute("style")).toContain("inset:0");
    expect(aside.querySelector("[data-ww-drawer-close]")).not.toBeNull();
    expect(m.dial("industry").getAttribute("aria-pressed")).toBe("true");
    m.dial("industry").click();
    await m.settle();
    expect(m.panel("industry")).toBeNull();
    expect(m.dial("industry").getAttribute("aria-pressed")).toBe("false");
  });

  it("the close button closes it", async () => {
    const m = await mount();
    m.dial("research").click();
    await m.settle();
    m.panel("research")!
      .querySelector<HTMLButtonElement>("[data-ww-drawer-close]")!
      .click();
    await m.settle();
    expect(m.panel("research")).toBeNull();
  });

  it("only one panel is open at a time", async () => {
    const m = await mount();
    m.dial("industry").click();
    await m.settle();
    m.dial("research").click();
    await m.settle();
    expect(m.panel("industry")).toBeNull();
    expect(m.panel("research")).not.toBeNull();
    expect(
      document.querySelectorAll("[data-ww-drawer]:not([data-ww-dial])").length,
    ).toBe(1);
  });

  it("Esc closes the open panel", async () => {
    const m = await mount();
    m.dial("industry").click();
    await m.settle();
    esc();
    await m.settle();
    expect(m.panel("industry")).toBeNull();
    // Nothing open: Esc is left to the map.
    const ev = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    const seen = vi.fn();
    window.addEventListener("keydown", seen);
    window.dispatchEvent(ev);
    expect(seen).toHaveBeenCalled();
    window.removeEventListener("keydown", seen);
  });

  it("the browser's Back closes it before it asks to leave", async () => {
    const m = await mount();
    m.dial("industry").click();
    await m.settle();
    history.pushState(null, "", location.href);
    const { armBackGuard, disarmBackGuard } =
      await import("../../../src/client/BackGuard");
    armBackGuard({ url: location.href, leave: () => {}, confirmUnload: false });
    handleGamePopState();
    await m.settle();
    expect(m.panel("industry")).toBeNull();
    disarmBackGuard();
  });

  it("a land order mode minimises the panel; the dock stays; the flow's end restores it", async () => {
    const m = await mount();
    m.dial("industry").click();
    await m.settle();
    const sel = landSelectionOf(m.game);
    sel.setMode("move");
    m.bus.emit(new WwLandModeEvent("move"));
    await m.settle();
    expect(m.panel("industry")!.getAttribute("style")).toContain(
      "display:none",
    );
    expect(m.dials.querySelector("[data-ww-dock]")).not.toBeNull();
    expect(m.dials.querySelector("[data-ww-panel-chip]")).not.toBeNull();
    sel.setMode("none");
    m.bus.emit(new WwLandModeEvent("none"));
    await m.settle();
    expect(m.panel("industry")!.getAttribute("style")).toContain("inset:0");
    expect(m.dials.querySelector("[data-ww-panel-chip]")).toBeNull();
  });

  it("the chip brings the panel back while the flow runs", async () => {
    const m = await mount();
    m.dial("research").click();
    await m.settle();
    strikeFlowOf(m.game).step = "target";
    m.dials.tick();
    await m.settle();
    expect(m.panel("research")!.getAttribute("style")).toContain(
      "display:none",
    );
    m.dials.querySelector<HTMLButtonElement>("[data-ww-panel-chip]")!.click();
    await m.settle();
    expect(m.panel("research")!.getAttribute("style")).toContain("inset:0");
    expect(m.dials.querySelector("[data-ww-panel-chip]")).toBeNull();
  });

  it("every map flow counts: orders, fronts, sea-air taps, strikes, the peace map", async () => {
    const m = await mount();
    const g = m.game;
    expect(wwMapFlowActive(g)).toBe(false);
    const land = landSelectionOf(g);
    for (const mode of [
      "move",
      "attack",
      "front",
      "plan",
      "rail",
      "sea",
      "paradrop",
    ] as const) {
      land.setMode(mode);
      expect(wwMapFlowActive(g)).toBe(true);
    }
    land.setMode("none");
    const multi = multiSelectOf(land);
    multi.start(1);
    expect(wwMapFlowActive(g)).toBe(true);
    multi.cancel();
    multi.startFront(2);
    expect(wwMapFlowActive(g)).toBe(true);
    multi.cancel();
    const draft = seaAirOf(g).draft;
    for (const mode of [
      "mission",
      "move",
      "port_strike",
      "merge",
      "invade",
    ] as const) {
      draft.mode = mode;
      expect(wwMapFlowActive(g)).toBe(true);
    }
    draft.mode = "none";
    const strike = strikeFlowOf(g);
    for (const step of ["target", "preview", "ready", "setup"] as const) {
      strike.step = step;
      expect(wwMapFlowActive(g)).toBe(true);
    }
    strike.step = "idle";
    peaceUiOf(g).map = true;
    expect(wwMapFlowActive(g)).toBe(true);
    peaceUiOf(g).map = false;
    expect(wwMapFlowActive(g)).toBe(false);
  });

  it("a flow already on when a panel opens does not hide it", async () => {
    const m = await mount();
    landSelectionOf(m.game).setMode("move");
    m.dials.tick();
    m.dial("industry").click();
    await m.settle();
    m.dials.tick();
    expect(m.panel("industry")!.getAttribute("style")).toContain("inset:0");
  });

  it("closing a minimised panel clears the chip", async () => {
    const m = await mount();
    m.dial("industry").click();
    await m.settle();
    peaceUiOf(m.game).map = true;
    m.dials.tick();
    await m.settle();
    expect(m.dials.querySelector("[data-ww-panel-chip]")).not.toBeNull();
    m.dial("industry").click();
    await m.settle();
    expect(m.panel("industry")).toBeNull();
    expect(m.dials.querySelector("[data-ww-panel-chip]")).toBeNull();
  });
});
