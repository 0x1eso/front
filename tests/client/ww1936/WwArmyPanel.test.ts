// World War 1936 P2 (spec §15.5): the army drawer — its four tabs, the
// army rows (choose + camera), the divisions, training (+1/+5, deploy,
// cancel with two taps), the templates list and the generals.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
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
  landSelectionOf,
  OpenWwArmyEvent,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwArmyPanel";
import type { WwArmyPanel } from "../../../src/client/hud/ww1936/WwArmyPanel";
import { WwDrawerEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { GoToPositionEvent } from "../../../src/client/TransformHandler";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail, summary } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  general,
  landDetail,
  LandOptions,
  scenario,
  training,
} from "./LandFixture";

async function mount(
  o: LandOptions = {},
  tab?: "training" | "templates" | "generals",
) {
  const g = fakeLandGame({
    details: [detail("DEU")],
    summaries: [summary("DEU")],
    armies: [army(1, "DEU", 3, { general: 1 }), army(2, "DEU", 4)],
    landDetails: [
      landDetail("DEU", {
        generals: [general(1, { army: 1 })],
        divisions: [
          division(1, 1, 3, { exp: 520 }),
          division(2, 1, 3, { equipPm: 640 }),
          division(3, 2, 4),
        ],
      }),
    ],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  new WwLandController(g.game as never, bus, {
    scale: 1,
    screenToWorldCoordinatesFloat: (x, y) => ({ x, y }),
  }).init();
  const el = document.createElement("ww-army-panel") as WwArmyPanel;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new OpenWwArmyEvent(tab));
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const click = async (sel: string) => {
    q(sel)!.click();
    await el.updateComplete;
  };
  return { ...g, el, bus, sent, q, click, sel: landSelectionOf(g.game) };
}

describe("<ww-army-panel> (spec §15.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("four tabs; one drawer at a time; no title, finger-sized buttons", async () => {
    const m = await mount();
    const drawers: [string, boolean][] = [];
    m.bus.on(WwDrawerEvent, (e) => drawers.push([e.drawer, e.open]));
    expect(m.q("[data-ww-drawer='army']")).not.toBeNull();
    expect(
      [...m.el.querySelectorAll("[data-ww-tab]")].map(
        (t) => (t as HTMLElement).dataset.wwTab,
      ),
    ).toEqual(["armies", "training", "templates", "generals"]);
    for (const tab of ["training", "templates", "generals", "armies"]) {
      await m.click(`[data-ww-tab='${tab}']`);
      expect(m.q(`[data-ww-tab='${tab}']`)!.getAttribute("aria-selected")).toBe(
        "true",
      );
      expect(m.el.querySelectorAll("[title]")).toHaveLength(0);
      for (const b of m.el.querySelectorAll("button")) {
        expect(b.className).toMatch(/\b(h-9|size-9|min-h-9|min-h-11)\b/);
      }
    }
    // Another drawer opening shuts this one.
    m.bus.emit(new WwDrawerEvent("research", true));
    await m.el.updateComplete;
    expect(m.q("[data-ww-drawer]")).toBeNull();
    // The dial's event toggles it: open on a tab, the same tab again shuts.
    m.bus.emit(new OpenWwArmyEvent("training"));
    await m.el.updateComplete;
    expect(drawers[drawers.length - 1]).toEqual(["army", true]);
    m.bus.emit(new OpenWwArmyEvent("training"));
    await m.el.updateComplete;
    expect(drawers[drawers.length - 1]).toEqual(["army", false]);
  });

  it("a row chooses its army and moves the camera; the divisions below", async () => {
    const m = await mount();
    const went: GoToPositionEvent[] = [];
    m.bus.on(GoToPositionEvent, (e) => went.push(e));
    await m.click("[data-ww-army-row='1']");
    expect(m.sel.army).toBe(1);
    const t = scenario.centerTile(3);
    expect(went.map((e) => [e.x, e.y])).toEqual([
      [t % scenario.width, Math.floor(t / scenario.width)],
    ]);
    expect(m.q("[data-ww-army-row='1']")!.textContent).toContain(
      "[ww1936.general.rundstedt]",
    );
    await m.click("[data-ww-show-divisions]");
    const divs = [...m.el.querySelectorAll("[data-ww-division]")];
    expect(divs).toHaveLength(2);
    // Veteran experience; the second division short of equipment.
    expect(m.q("[data-ww-division='1'] [data-ww-exp]")!.dataset.wwExp).toBe(
      "veteran",
    );
    expect(
      m.q("[data-ww-division='2'] [data-ww-short-equipment]"),
    ).not.toBeNull();
    expect(m.q("[data-ww-division='1'] [data-ww-short-equipment]")).toBeNull();
  });

  it("training: +1 and +5, into the chosen army; deploy now; cancel on the second tap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount(
      {
        landDetails: [
          landDetail("DEU", {
            training: [
              training(7, {
                remaining: 2,
                waiting: "equipment",
                trainees: [{ days: 30, need: 120, fillPm: 430 }],
              }),
            ],
          }),
        ],
      },
      "training",
    );
    expect(m.q("[data-ww-manpower-pool]")!.textContent).toContain(
      "[ww1936.land.manpower_pool] n=1.2M",
    );
    expect(m.q("[data-ww-short]")!.textContent).toContain(
      "[ww1936.land.equipment_short]",
    );
    expect(m.q("[data-ww-waiting='equipment']")!.textContent).toContain(
      "[ww1936.land.waiting_equipment] pct=43",
    );
    await m.click("[data-ww-train='1:1']");
    m.bus.emit(new WwSelectArmyEvent(2));
    await m.el.updateComplete;
    expect(m.q("[data-ww-train-target]")!.textContent).toContain(
      "[ww1936.land.train_into] army=[ww1936.land.army_name_2] n=2",
    );
    await m.click("[data-ww-train='1:5']");
    await m.click("[data-ww-deploy='7']");
    expect(m.sent).toEqual([
      { kind: "train", template: 1, count: 1, army: 0, region: 0 },
      { kind: "train", template: 1, count: 5, army: 2, region: 4 },
      { kind: "deploy_now", entry: 7 },
    ]);
    m.sent.length = 0;
    await m.click("[data-ww-cancel='7']");
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-cancel='7']")!.dataset.armed).toBe("true");
    vi.setSystemTime(101_000);
    await m.click("[data-ww-cancel='7']");
    expect(m.sent).toEqual([{ kind: "cancel_train", entry: 7 }]);
  });

  it("templates: the list opens the designer", async () => {
    const m = await mount({}, "templates");
    expect(m.q("[data-ww-template='1']")!.textContent).toContain(
      "[ww1936.tpl.infantry]",
    );
    expect(m.q("[data-ww-template='1']")!.textContent).toContain(
      "[ww1936.battalion.infantry] ×9",
    );
    await m.click("[data-ww-template='1']");
    expect(m.q("ww-template-designer")).not.toBeNull();
    await m.click("[data-ww-designer-back]");
    expect(m.q("ww-template-designer")).toBeNull();
    await m.click("[data-ww-new-template]");
    expect(m.q("ww-template-designer")).not.toBeNull();
  });

  it("generals: who serves when, traits spelled out; a tap gives the chosen army one", async () => {
    const from = dayOfDate("1939-09-01");
    const m = await mount(
      {
        landDetails: [
          landDetail("DEU", {
            generals: [
              general(1, { army: 1, traits: 1 }),
              general(2, { key: "bock", from }),
            ],
          }),
        ],
      },
      "generals",
    );
    expect(m.q("[data-ww-general='2']")!.dataset.serving).toBe("false");
    expect(
      m.q("[data-ww-general='2'] [data-ww-unavailable]")!.textContent,
    ).toContain("[ww1936.land.general_from] year=1939");
    // No army chosen: a tap spells out the traits.
    await m.click("[data-ww-general='1']");
    expect(
      m.q("[data-ww-general='1'] [data-ww-traits]")!.textContent,
    ).toContain("[ww1936.trait_desc.panzer_leader]");
    expect(m.sent).toEqual([]);
    // With the 2nd Army chosen: a tap gives it the general.
    m.bus.emit(new WwSelectArmyEvent(2));
    await m.el.updateComplete;
    expect(m.q("[data-ww-assign-hint]")).not.toBeNull();
    await m.click("[data-ww-general='1']");
    expect(m.sent).toEqual([{ kind: "army_general", army: 2, general: 1 }]);
    // One who can't serve yet is not given.
    await m.click("[data-ww-general='2']");
    expect(m.sent).toHaveLength(1);
    await m.click("[data-ww-appoint]");
    expect(m.sent[1]).toEqual({ kind: "appoint_general" });
  });
});
