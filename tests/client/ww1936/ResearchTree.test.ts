import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  TECH_BRANCHES,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
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

import {
  COL_W,
  NODE_H,
  NODE_W,
  recommendNext,
  treeLayout,
} from "../../../src/client/hud/ww1936/ResearchTreeModel";
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

async function mount(o: FakeOptions = {}, bonuses: unknown[] = []) {
  const { game } = fakeEconGame(o);
  const pol = (
    game as never as { wwPolitics: () => { detail: unknown } }
  ).wwPolitics();
  pol.detail = () => ({ researchBonuses: bonuses });
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
  const q = (s: string) => el.querySelector<HTMLElement>(s);
  const click = async (s: string) => {
    q(s)!.click();
    await el.updateComplete;
  };
  return { el, game, sent, q, click };
}

const running = {
  tech: "inf_eq_2" as const,
  progressMilli: 60_000,
  totalMilli: 165_000,
};

describe("research tree", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("layout: x by year, no overlaps, edges inside the tab, every tab fits", () => {
    const d = detail("DEU", { slots: [running, null, null] });
    for (const b of TECH_BRANCHES.filter((b) => b !== "doctrine")) {
      const l = treeLayout(d, b, 1500, []);
      const ids = new Set(l.nodes.map((n) => n.card.id));
      const cells = new Set(l.nodes.map((n) => `${n.col}:${n.row}`));
      expect(cells.size).toBe(l.nodes.length);
      for (const n of l.nodes) {
        expect(n.x).toBe(12 + (n.card.year - 1936) * COL_W);
        expect(n.x + NODE_W).toBeLessThanOrEqual(l.width);
        expect(n.y + NODE_H).toBeLessThanOrEqual(l.height);
      }
      for (const e of l.edges)
        expect(ids.has(e.from) && ids.has(e.to)).toBe(true);
    }
  });

  it("badges and the sheet: ahead, bonus, joint, project, exclusive; sources and percent", async () => {
    const m = await mount(
      {
        summaries: [summary("DEU")],
        details: [
          detail("DEU", {
            slots: [running, null, null],
            sharedResearch: [["support_eq_2", 20]],
          }),
        ],
      },
      [{ branch: "infantry", pct: 50, uses: 1 }],
    );
    const node = m.q("[data-ww-tech='support_eq_2']")!;
    expect(
      node.querySelector("[data-ww-badge='ahead']")!.textContent,
    ).toContain("+400%");
    expect(
      node.querySelector("[data-ww-badge='joint']")!.textContent,
    ).toContain("20%");
    expect(
      m.q("[data-ww-tech='inf_eq_3'] [data-ww-badge='bonus']")!.textContent,
    ).toContain("50%");
    await m.click("[data-ww-tech='inf_eq_3']");
    expect(m.q("[data-ww-src='bonus']")!.textContent).toContain("pct=50");
    expect(m.q("[data-ww-sheet]")!.dataset.width).toBe("320");
    // A project-gated node: everything else is researched.
    const m2 = await mount({
      summaries: [summary("DEU")],
      details: [
        detail("DEU", {
          researched: WW_TECH_IDS.filter((t) => t !== "jet_airframe_2"),
        }),
      ],
    });
    await m2.click("[data-ww-tab='air']");
    expect(m2.q("[data-ww-tech='jet_airframe_2']")!.dataset.look).toBe(
      "project",
    );
  });

  it("a phone: the sheet is 280 px and only opens with a node", async () => {
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
    });
    expect(m.q("[data-ww-sheet]")).toBeNull();
    await m.click("[data-ww-tech='support_eq_2']");
    expect(m.q("[data-ww-sheet]")!.dataset.width).toBe("280");
    // Two zoom steps stay inside 0.6..1.4.
    for (let i = 0; i < 6; i++) await m.click("[data-ww-zoom='out']");
    expect(m.q("[data-ww-tree-scroll]")!.dataset.zoom).toBe("0.6");
  });

  it("two taps start; a second tap on the node deselects; the sheet button starts too", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    await m.click("[data-ww-tech='support_eq_2']");
    await m.click("[data-ww-tech='support_eq_2']");
    expect(m.q("[data-ww-start-pill]")).toBeNull();
    await m.click("[data-ww-tech='support_eq_2']");
    await m.click("[data-ww-sheet-start]");
    expect(m.sent).toEqual([{ kind: "research", tech: "support_eq_2" }]);
  });

  it("with every slot full a double tap on a chip clears it", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slotCount: 1, slots: [running] })],
    });
    await m.click("[data-ww-slot='0']");
    vi.advanceTimersByTime(400);
    await m.click("[data-ww-slot='0']");
    expect(m.sent).toEqual([{ kind: "cancel_research", slot: 0 }]);
    vi.useRealTimers();
  });

  it("lean presets and grants send orders; the grant explains why it is off", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { researchLean: 2 })],
    });
    expect(m.q("[data-ww-lean='navy']")!.getAttribute("aria-pressed")).toBe(
      "true",
    );
    await m.click("[data-ww-lean='air']");
    expect(m.sent).toEqual([{ kind: "research_lean", lean: "air" }]);
    await m.click("[data-ww-grant-btn='infantry']");
    expect(m.sent[1]).toEqual({ kind: "research_grant", branch: "infantry" });
    const held = await mount(
      { summaries: [summary("DEU")], details: [detail("DEU")] },
      [{ branch: "infantry", pct: 50, uses: 1 }],
    );
    expect(
      held.q("[data-ww-grant-btn='infantry']")!.hasAttribute("disabled"),
    ).toBe(true);
    expect(held.q("[data-ww-grant-why]")!.textContent).toContain("bonus_held");
    const poor = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU")],
      politics: { ppMilli: 5000 },
    });
    expect(poor.q("[data-ww-grant-why]")!.textContent).toContain("no_pp");
  });

  it("the next card: a finished research suggests a startable pick, one tap starts it", async () => {
    const m = await mount({
      summaries: [summary("DEU")],
      details: [detail("DEU", { slots: [running, null, null] })],
    });
    const d0 = detail("DEU", {
      slots: [null, null, null],
      researched: [...detail("DEU").researched, "inf_eq_2"],
    });
    (m.game as never as { wwEconomy: () => { apply: (x: unknown) => void } })
      .wwEconomy()
      .apply({ countries: [summary("DEU")], details: [d0], regions: [] });
    m.el.tick();
    await m.el.updateComplete;
    expect(
      recommendNext(d0, { tag: "DEU", day: 1500, smallID: ID("DEU") }),
    ).not.toBeNull();
    const label = m.q("[data-ww-next-start]")!.textContent!;
    await m.click("[data-ww-next-start]");
    expect(m.sent).toHaveLength(1);
    const order = m.sent[0] as { kind: string; tech: string };
    expect(order.kind).toBe("research");
    expect(label).toContain(`[ww1936.tech.${order.tech}]`);
    expect(m.q("[data-ww-next]")).toBeNull();
  });
});
