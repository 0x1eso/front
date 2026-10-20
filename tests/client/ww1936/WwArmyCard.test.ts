// World War 1936 P2 (spec §15.4, §15.9): the chosen army's card — its
// lines, the greyed buttons and their reasons, two taps to disband, the
// plan's stance and execute button, the previews, its place by a drawer.
import type { LandOrder, WwOrder } from "@openfront/engine-api/Schemas";
import {
  ARMY_EXECUTING,
  idleOrder,
} from "@openfront/engine-api/ww1936/LandTypes";
import { landOrderBlockOf } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

vi.mock("@openfront/engine-lib/ww1936/LandOrderChecks", async (orig) => {
  const real =
    await orig<typeof import("@openfront/engine-lib/ww1936/LandOrderChecks")>();
  return { ...real, landOrderBlockOf: vi.fn(real.landOrderBlockOf) };
});

import {
  landSelectionOf,
  OpenWwArmyEvent,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwArmyCard";
import type { WwArmyCard } from "../../../src/client/hud/ww1936/WwArmyCard";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail, region } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  general,
  landDetail,
  LandOptions,
  mine,
} from "./LandFixture";

const checks = vi.mocked(landOrderBlockOf);

async function mount(o: LandOptions = {}) {
  const g = fakeLandGame({
    ticks: 700,
    wars: [["DEU", "POL"]],
    details: [detail("DEU")],
    armies: [army(1, "DEU", 3, { general: 1 })],
    landDetails: [
      landDetail("DEU", {
        generals: [general(1, { traits: 1 })],
        divisions: [division(1, 1, 3), division(2, 1, 3), division(3, 1, 3)],
      }),
    ],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const controller = new WwLandController(g.game as never, bus, {
    scale: 1,
    screenToWorldCoordinatesFloat: (x, y) => ({ x, y }),
  });
  controller.init();
  const el = document.createElement("ww-army-card") as WwArmyCard;
  el.game = g.game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  bus.emit(new WwSelectArmyEvent(1));
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const click = async (sel: string) => {
    q(sel)!.click();
    await el.updateComplete;
  };
  const btn = (id: string) => `[data-ww-army-btn='${id}']`;
  return { ...g, el, bus, sent, q, click, btn, sel: landSelectionOf(g.game) };
}

describe("<ww-army-card> (spec §15.4)", () => {
  beforeEach(async () => {
    const real = await vi.importActual<
      typeof import("@openfront/engine-lib/ww1936/LandOrderChecks")
    >("@openfront/engine-lib/ww1936/LandOrderChecks");
    checks.mockReset();
    checks.mockImplementation(real.landOrderBlockOf);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the army, its general and its state; no title, finger-sized buttons", async () => {
    const m = await mount();
    const card = m.q("[data-ww-army-card='1']")!;
    expect(card.textContent).toContain("[ww1936.land.army_name_1] n=1");
    expect(m.q("[data-ww-army-divisions]")!.textContent).toBe(
      "[ww1936.land.divisions_of] n=3,max=24",
    );
    expect(m.q("[data-ww-army-general]")!.textContent).toContain(
      "[ww1936.general.rundstedt]",
    );
    expect(m.q("[data-ww-trait='panzer_leader']")).not.toBeNull();
    expect(m.q("[data-ww-army-status]")!.textContent).toContain(
      "[ww1936.land.state_idle]",
    );
    expect(card.className).toContain("max-h-[25vh]");
    // Tablet rules: no hover-only titles; every button at least 36 px.
    expect(m.el.querySelectorAll("[title]")).toHaveLength(0);
    const buttons = [...m.el.querySelectorAll("button")];
    expect(buttons).toHaveLength(11);
    for (const b of buttons) {
      expect(b.className).toMatch(/\b(h-9|size-9)\b/);
    }
    // ✕ lets the army go: the card is gone.
    await m.click("[data-ww-card-close]");
    expect(m.sel.army).toBeNull();
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-army-card]")).toBeNull();
  });

  it("a greyed button says why when pressed", async () => {
    checks.mockImplementation((_w, o: LandOrder) =>
      o.kind === "army_rail" ? "no_rail" : null,
    );
    const m = await mount();
    const rail = m.q(m.btn("rail"))!;
    expect(rail.getAttribute("aria-disabled")).toBe("true");
    await m.click(m.btn("rail"));
    expect(m.q("[data-ww-block='no_rail']")!.textContent).toContain(
      "[ww1936.econ.block.no_rail]",
    );
    expect(m.sel.mode).toBe("none");
    // An open one sets the map's mode (and a second press clears it).
    await m.click(m.btn("move"));
    expect(m.sel.mode).toBe("move");
    expect(m.q("[data-ww-hint='move']")).not.toBeNull();
    await m.click(m.btn("move"));
    expect(m.sel.mode).toBe("none");
  });

  it("splits in half, toggles auto, disbands only on a second tap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount();
    await m.click(m.btn("split"));
    await m.click(m.btn("auto"));
    expect(m.sent).toEqual([
      { kind: "army_split", army: 1, count: 1, template: 0 },
      { kind: "army_auto", army: 1, on: true },
    ]);
    m.sent.length = 0;
    await m.click(m.btn("more"));
    await m.click(m.btn("disband"));
    expect(m.sent).toEqual([]);
    expect(m.q(m.btn("disband"))!.textContent).toContain(
      "[ww1936.land.tap_again]",
    );
    vi.setSystemTime(101_000);
    await m.click(m.btn("disband"));
    expect(m.sent).toEqual([{ kind: "army_disband", army: 1 }]);
    // "General" opens the drawer's generals tab.
    const opened: OpenWwArmyEvent[] = [];
    m.bus.on(OpenWwArmyEvent, (e) => opened.push(e));
    await m.click(m.btn("more"));
    await m.click(m.btn("general"));
    expect(opened.map((e) => e.tab)).toEqual(["generals"]);
  });

  it("plan mode: the stance, then execute on the second press, stop on the next", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount();
    await m.click(m.btn("plan"));
    m.sel.targets = [6];
    await m.click(m.btn("stance_aggressive"));
    await m.click(m.btn("execute"));
    expect(m.sent).toEqual([
      { kind: "army_plan", army: 1, targets: [6], stance: "aggressive" },
    ]);
    vi.setSystemTime(101_000);
    await m.click(m.btn("execute"));
    expect(m.sent[1]).toEqual({ kind: "army_execute", army: 1, on: true });
    // Running: one press stops it.
    m.land.apply(
      {
        armies: [
          army(1, "DEU", 3, {
            general: 1,
            state: ARMY_EXECUTING,
            mine: mine({
              order: { ...idleOrder(), kind: "plan", executing: true },
            }),
          }),
        ],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [],
      },
      701,
    );
    m.el.tick();
    await m.el.updateComplete;
    await m.click(m.btn("execute"));
    expect(m.sent[2]).toEqual({ kind: "army_execute", army: 1, on: false });
  });

  it("previews a pending tap: the move's days, then 'tap again'", async () => {
    const m = await mount();
    m.sel.pending = 4;
    m.sel.version++;
    m.el.tick();
    await m.el.updateComplete;
    const p = m.q("[data-ww-preview='move']")!;
    expect(p.textContent).toContain("→ Munich");
    // Berlin → Munich in January's snow (70% speed): 29 ticks, 3.9 days.
    expect(p.textContent).toContain("[ww1936.land.move_days] days=3.9");
    expect(m.q("[data-ww-tap-again]")).not.toBeNull();
    // An attack preview: the strength ratio and its bar.
    m.sel.pending = 6;
    m.sel.version++;
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-preview='attack'] [data-ww-ratio]")).not.toBeNull();
  });

  it("sits right above the bottom rows, and left of an open drawer", async () => {
    vi.stubGlobal("innerWidth", 1180);
    vi.stubGlobal("innerHeight", 820);
    const rows = document.createElement("div");
    rows.setAttribute("data-bottom-hud-rows", "");
    rows.getBoundingClientRect = () =>
      ({ left: 310, top: 720, width: 560, height: 100 }) as DOMRect;
    document.body.appendChild(rows);
    const m = await mount();
    const card = () => m.q("[data-ww-army-card]")!;
    expect(card().getAttribute("style")).toContain("bottom: 108px");
    expect(card().getAttribute("style")).toContain("left: 50%");
    const drawer = document.createElement("aside");
    drawer.setAttribute("data-ww-drawer", "army");
    drawer.getBoundingClientRect = () =>
      ({ left: 752, top: 40, width: 420, height: 600 }) as DOMRect;
    document.body.appendChild(drawer);
    m.el.tick();
    await m.el.updateComplete;
    expect(card().getAttribute("style")).toContain("right: 436px");
    expect(card().getAttribute("style")).toContain("max-width: 560px");
    // Never into the map's middle half: 820 × ¾ = 615 above the rows' 712.
    expect(card().getAttribute("style")).toContain("max-height: 97px");
  });

  it("merges with the army sharing its region and follows it", async () => {
    const m = await mount({
      regions: [region(3)],
      armies: [army(1, "DEU", 3), army(2, "DEU", 3)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 2, 3)],
        }),
      ],
    });
    await m.click(m.btn("merge"));
    expect(m.sent).toEqual([{ kind: "army_merge", army: 1, into: 2 }]);
    expect(m.sel.army).toBe(2);
  });
});
