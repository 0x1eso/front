import type { WwOrder } from "@openfront/engine-api/Schemas";
import { wwAutoBit } from "@openfront/engine-api/ww1936/WorldWarTypes";
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
import {
  detail,
  fakeEconGame,
  FakeOptions,
  ID,
  summary,
} from "./EconomyFixture";

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

  it("the slots open the list; the tabs share the top bar with the close button", async () => {
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
    expect(
      slots.compareDocumentPosition(m.q("[data-ww-cards]")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(m.q("[data-ww-slot='0']")).not.toBeNull();
  });

  it("a tech with saved progress shows it on its card", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [
        detail("DEU", {
          slots: [running, null, null],
          savedResearch: [
            {
              tech: "support_eq_2",
              progressMilli: 35_000,
              totalMilli: 100_000,
            },
          ],
        }),
      ],
    });
    const saved = m.q("[data-ww-tech='support_eq_2'] [data-ww-saved]")!;
    expect(saved.textContent).toContain("[ww1936.econ.saved_progress] n=35");
    expect(m.q("[data-ww-tech='inf_eq_3'] [data-ww-saved]")).toBeNull();
    // Still startable: a tap sends research as before.
    await m.click("[data-ww-tech='support_eq_2']");
    expect(m.sent).toEqual([{ kind: "research", tech: "support_eq_2" }]);
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

  // Live report 2026-10-30 ("연구 칸 비었는데 연구 안하는데?"): an empty
  // slot waits for the player's pick unless auto research is on.
  it("empty slots ask the player to pick, unless auto research is on", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    const prompt = m.q("[data-ww-pick-prompt]")!;
    expect(prompt.textContent).toContain("[ww1936.econ.pick_prompt] n=2");
    // Between the slots and the cards.
    expect(
      m.q("[data-ww-slots]")!.compareDocumentPosition(prompt) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      prompt.compareDocumentPosition(m.q("[data-ww-cards]")!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Auto research on: the AI fills them, no prompt.
    const data = m.el.game.worldWarData() as { auto?: unknown };
    data.auto = [{ smallID: ID("DEU"), mask: wwAutoBit("research") }];
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-pick-prompt]")).toBeNull();
    // Another domain on: research is still the player's.
    data.auto = [{ smallID: ID("DEU"), mask: wwAutoBit("production") }];
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-pick-prompt]")).not.toBeNull();
  });

  it("no prompt while every slot is busy", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slotCount: 1, slots: [running] })],
    });
    expect(m.q("[data-ww-pick-prompt]")).toBeNull();
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
