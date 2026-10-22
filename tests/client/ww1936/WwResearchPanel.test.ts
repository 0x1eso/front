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

import { OpenWwResearchEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwResearchPanel";
import type { WwResearchPanel } from "../../../src/client/hud/ww1936/WwResearchPanel";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail, fakeEconGame, FakeOptions, summary } from "./EconomyFixture";

async function mount(o: FakeOptions = {}) {
  const { game } = fakeEconGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-research-panel") as WwResearchPanel;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new OpenWwResearchEvent());
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLButtonElement>(sel);
  const click = async (sel: string) => {
    q(sel)!.click();
    await el.updateComplete;
  };
  return { el, bus, sent, q, click };
}

const running = {
  tech: "inf_eq_2" as const,
  progressMilli: 60_000,
  totalMilli: 165_000,
};

describe("<ww-research-panel> (spec §13.4)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("on a short screen the slots open the list, the tabs share the close row", async () => {
    // 800×360, a landscape phone: one fixed row (tabs and ✕), the rest list.
    vi.stubGlobal("innerWidth", 800);
    vi.stubGlobal("innerHeight", 360);
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    const head = m.q("[data-ww-drawer-head]")!;
    expect(head.querySelector("[role='tablist']")).not.toBeNull();
    expect(head.querySelector("[data-ww-slots]")).toBeNull();
    const slots = m.q("[data-ww-slots]")!;
    expect(slots.closest("[data-ww-scroll]")).not.toBeNull();
    // Above the cards, still two taps to cancel.
    expect(
      slots.compareDocumentPosition(m.q("[data-ww-cards]")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(m.q("[data-ww-slot='0']")).not.toBeNull();
    // A tall screen: the slots stay in the head above the tabs.
    document.body.innerHTML = "";
    vi.stubGlobal("innerWidth", 1180);
    vi.stubGlobal("innerHeight", 820);
    const tall = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    expect(
      tall
        .q("[data-ww-drawer-head] [data-ww-slots]")!
        .closest("[data-ww-scroll]"),
    ).toBeNull();
    expect(tall.q("[data-ww-drawer-head] [role='tablist']")).toBeNull();
  });

  it("tapping an available card sends research", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    const card = m.q("[data-ww-tech='support_eq_2']")!;
    expect(card.dataset.state).toBe("available");
    // 1940, four years early: +400%.
    expect(card.textContent).toContain("[ww1936.econ.ahead] n=400");
    expect(card.textContent).toContain("[ww1936.econ.state_available]");
    await m.click("[data-ww-tech='support_eq_2']");
    expect(m.sent).toEqual([{ kind: "research", tech: "support_eq_2" }]);
    // Done, running and waiting cards don't start anything.
    expect(m.q("[data-ww-tech='inf_eq_1']")!.disabled).toBe(true);
    expect(m.q("[data-ww-tech='inf_eq_2']")!.dataset.state).toBe("running");
    expect(m.q("[data-ww-tech='inf_eq_3']")!.dataset.state).toBe("prereq");
    // The slots: one running, two empty.
    expect(m.q("[data-ww-slot='0']")!.textContent).toContain(
      "[ww1936.tech.inf_eq_2]",
    );
    expect(m.q("[data-ww-slot='0'] [data-ww-ahead]")).not.toBeNull();
    expect(m.el.querySelectorAll("[data-ww-slot][data-empty]")).toHaveLength(2);
  });

  it("a full set of slots says so", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slotCount: 1, slots: [running] })],
    });
    await m.click("[data-ww-tech='support_eq_2']");
    expect(m.sent).toEqual([]);
    expect(
      m.q("[data-ww-tech='support_eq_2'] [data-ww-block='no_slot']")!
        .textContent,
    ).toContain("[ww1936.econ.block.no_slot]");
  });

  it("two taps cancel a research", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    await m.click("[data-ww-slot='0']");
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-slot='0']")!.textContent).toContain(
      "[ww1936.econ.cancel_tap]",
    );
    vi.advanceTimersByTime(400);
    await m.click("[data-ww-slot='0']");
    expect(m.sent).toEqual([{ kind: "cancel_research", slot: 0 }]);
  });

  it("the doctrine tab offers no retired tech (P6 plan decision 25)", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { researched: ["mobile_1"] })],
    });
    await m.click("[data-ww-tab='doctrine']");
    expect(m.q("[data-ww-school]")).toBeNull();
    expect(m.q("[data-ww-doctrine-moved]")!.textContent).toContain(
      "ww1936.econ.doctrine_moved",
    );
    expect(m.q("[data-ww-tech='mobile_2']")).toBeNull();
    await m.click("[data-ww-tab='naval']");
    expect(m.q("[data-ww-tech='fleet_in_being_1']")).toBeNull();
    expect(m.q("[data-ww-tech]")).not.toBeNull();
  });

  it("the air cards say they only fill the stockpile", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    await m.click("[data-ww-tab='air']");
    expect(m.q("[data-ww-tech='fighter_2']")!.textContent).toContain(
      "[ww1936.econ.stock_only]",
    );
  });
  it("a capitulated country's drawer says the orders can't go", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      capitulated: ["DEU"],
    });
    expect(m.q("[data-ww-block='dead']")!.textContent).toContain(
      "[ww1936.econ.block.dead]",
    );
    expect(m.q("[data-ww-tech]")).toBeNull();
  });
});
