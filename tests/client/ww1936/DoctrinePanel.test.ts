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
    landDetails: [landDetail("DEU", { armyXpMilli: 150_000 })],
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

describe("<ww-doctrine-panel> orders (spec §20.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("the first pick is one tap and sends once", async () => {
    const m = await mountPanel({}, "land");
    await m.click("[data-ww-gd='gd_mobile']");
    await m.click("[data-ww-pick='gd0']");
    expect(m.sent).toEqual([
      { kind: "doctrine_pick", domain: "land", id: "gd_mobile" },
    ]);
  });

  it("a switch needs two taps: arm, send once, a third tap arms again", async () => {
    vi.useFakeTimers();
    const m = await mountPanel(
      { detail: { doctrine: { gd: [0, -1, -1] } } },
      "land",
    );
    await m.click("[data-ww-gd='gd_firepower']");
    await m.click("[data-ww-pick='gd1']");
    expect(m.sent).toHaveLength(0);
    // A hurried second tap is no confirmation.
    vi.advanceTimersByTime(50);
    await m.click("[data-ww-pick='gd1']");
    expect(m.sent).toHaveLength(0);
    vi.advanceTimersByTime(500);
    await m.click("[data-ww-pick='gd1']");
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]).toMatchObject({
      kind: "doctrine_pick",
      id: "gd_firepower",
    });
    vi.advanceTimersByTime(500);
    await m.click("[data-ww-pick='gd1']");
    expect(m.sent).toHaveLength(1);
  });

  it("promote needs two taps on a trait and sends once", async () => {
    vi.useFakeTimers();
    const m = await mountPanel(
      {
        landDetails: [
          landDetail("DEU", {
            generals: [general(5, { level: 4, army: 0 })],
            armyXpMilli: 0,
          }),
        ],
        detail: { command: { cpMilli: 50_000 } },
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
