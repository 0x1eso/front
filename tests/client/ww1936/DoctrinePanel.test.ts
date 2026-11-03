import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string) => `[${key}]`,
}));

import { WwDepthOpenEvent } from "../../../src/client/hud/ww1936/DepthEvents";
import "../../../src/client/hud/ww1936/WwDoctrinePanel";
import type { WwDoctrinePanel } from "../../../src/client/hud/ww1936/WwDoctrinePanel";
import "../../../src/client/hud/ww1936/WwTopBand";
import type { WwTopBand } from "../../../src/client/hud/ww1936/WwTopBand";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { doctrineGame, type DoctrineOptions } from "./DoctrineFixture";
import { detail } from "./EconomyFixture";
import { general, landDetail } from "./LandFixture";

async function mountPanel(o: DoctrineOptions, tab: string) {
  const g = doctrineGame({
    details: [detail("DEU")],
    landDetails: [landDetail("DEU")],
    ...o,
  });
  const bus = new EventBus();
  const sent: { kind: string }[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-doctrine-panel") as WwDoctrinePanel;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new WwDepthOpenEvent("doctrine", { tab }));
  await el.updateComplete;
  const click = async (sel: string) => {
    el.querySelector<HTMLElement>(sel)!.click();
    await el.updateComplete;
  };
  return { el, bus, sent, click, g };
}

describe("<ww-doctrine-panel> orders (ww9 design §11)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("dragging a slider sends one thought_set on letting go, with no confirmation", async () => {
    const m = await mountPanel({}, "land");
    const input = m.el.querySelector<HTMLInputElement>(
      "[data-ww-thought-slider='off_def']",
    )!;
    input.value = "-6";
    input.dispatchEvent(new Event("input"));
    await m.el.updateComplete;
    // Only the preview so far.
    expect(m.sent).toHaveLength(0);
    input.dispatchEvent(new Event("change"));
    await m.el.updateComplete;
    expect(m.sent).toEqual([
      { kind: "thought_set", slider: "off_def", pos: -6 },
    ]);
  });

  it("the land tab holds three sliders and no pick buttons, badges or prompts", async () => {
    const m = await mountPanel({}, "land");
    expect(m.el.querySelectorAll("[data-ww-thought]")).toHaveLength(3);
    expect(m.el.querySelector("[data-ww-pick-prompt]")).toBeNull();
    expect(m.el.querySelector("[data-ww-pick]")).toBeNull();
    const air = await mountPanel({}, "air");
    expect(air.el.querySelectorAll("[data-ww-thought]").length).toBeGreaterThan(
      0,
    );
  });

  it("promote needs two taps on a trait and sends once", async () => {
    vi.useFakeTimers();
    const m = await mountPanel(
      {
        landDetails: [
          landDetail("DEU", {
            generals: [general(5, { level: 4, army: 0 })],
          }),
        ],
      },
      "command",
    );
    await m.click("[data-ww-promote='5'] button");
    await m.click("[data-ww-promote-trait='fm_offensive']");
    expect(m.sent).toHaveLength(0);
    vi.advanceTimersByTime(500);
    await m.click("[data-ww-promote-trait='fm_offensive']");
    expect(m.sent).toEqual([
      { kind: "promote_fm", general: 5, trait: "fm_offensive" },
    ]);
    vi.advanceTimersByTime(500);
    await m.click("[data-ww-promote-trait='fm_offensive']").catch(() => {});
    expect(m.sent).toHaveLength(1);
  });
});

describe("the multi bar's marshal list (spec §20.4)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("[Make army group] -> a marshal sends ag_create once", async () => {
    const { multiSelectOf } =
      await import("../../../src/client/hud/ww1936/MultiSelect");
    const { landSelectionOf } =
      await import("../../../src/client/hud/ww1936/LandSelection");
    const g = doctrineGame({
      details: [detail("DEU")],
      landDetails: [
        landDetail("DEU", {
          generals: [{ ...general(7), fm: true, fmTraits: 1 } as never],
        }),
      ],
    });
    const bus = new EventBus();
    const sent: { kind: string }[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = document.createElement("ww-top-band") as WwTopBand;
    el.game = g.game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    multiSelectOf(landSelectionOf(g.game)).start(1);
    el.tick();
    await el.updateComplete;
    el.querySelector<HTMLElement>("[data-ww-multi-create]")!.click();
    await el.updateComplete;
    const fm = el.querySelector<HTMLElement>("[data-ww-multi-fm='7']")!;
    fm.click();
    await el.updateComplete;
    el.tick();
    await el.updateComplete;
    expect(sent).toEqual([{ kind: "ag_create", fm: 7, armies: [1] }]);
    // The bar is gone; nothing more can be sent.
    expect(el.querySelector("[data-ww-multi-fm='7']")).toBeNull();
    expect(multiSelectOf(landSelectionOf(g.game)).active).toBe(false);
  });
});
