// World War 1936 P2 (spec §15.4, §15.9): the chosen army's card — its
// lines, the greyed buttons and their reasons, two taps to disband, the
// plan's stance and execute button, the previews, its place by a drawer.
import type { LandOrder, WwOrder } from "@openfront/engine-api/Schemas";
import {
  ARMY_AUTO,
  ARMY_EXECUTING,
  DIRECT_FAVORABLE,
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
  WwLandModeEvent,
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
    // Phone rules: no hover-only titles; every button at least 40 px.
    expect(m.el.querySelectorAll("[title]")).toHaveLength(0);
    const buttons = [...m.el.querySelectorAll("button")];
    // The action row (4), the stance switch (3), rail, sea, split, merge
    // and more (5), the fold toggle and ✕, and ww81's auto-merge toggle.
    expect(buttons).toHaveLength(15);
    for (const b of buttons) {
      expect(b.className).toMatch(/\b(h-10|h-11|size-10)\b/);
    }
    // The action row: [공격] [방어] [이동] [자동], in that order.
    expect(
      [...m.el.querySelectorAll("[data-ww-action-row] button")].map(
        (b) => (b as HTMLElement).dataset.wwArmyBtn,
      ),
    ).toEqual(["plan", "front", "move", "auto"]);
    expect(
      m.q("[data-ww-action-row] [data-ww-army-btn='plan']")!.textContent,
    ).toContain("[ww1936.land.btn_attack]");
    expect(
      m.q("[data-ww-action-row] [data-ww-army-btn='front']")!.textContent,
    ).toContain("[ww1936.land.btn_defend]");
    // No text smaller than text-xs on the card.
    expect(m.el.innerHTML).not.toMatch(/text-\[1[01]px\]/);
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
    // An open one sets the map's mode: the card folds to its strip, with
    // the hint and [cancel].
    await m.click(m.btn("move"));
    expect(m.sel.mode).toBe("move");
    expect(m.q("[data-ww-army-card]")!.dataset.collapsed).toBe("true");
    expect(m.q("[data-ww-hint='move']")).not.toBeNull();
    await m.click(m.btn("cancel"));
    expect(m.sel.mode).toBe("none");
    expect(m.q("[data-ww-army-card]")!.dataset.collapsed).toBe("false");
  });

  it("a one-division army's split says so in its own words", async () => {
    const m = await mount({
      armies: [army(1, "DEU", 3, { divisions: 1 })],
      landDetails: [landDetail("DEU", { divisions: [division(1, 1, 3)] })],
    });
    await m.click(m.btn("split"));
    expect(m.q("[data-ww-block='split_single']")!.textContent).toContain(
      "[ww1936.land.block_split_single]",
    );
    expect(m.sent).toEqual([]);
  });

  it("folds to a 40 px strip: by default on a short screen, while ordering, by the toggle", async () => {
    vi.stubGlobal("innerHeight", 360);
    const m = await mount();
    const card = () => m.q("[data-ww-army-card]")!;
    expect(card().dataset.collapsed).toBe("true");
    expect(card().className).toContain("bg-gray-900/70");
    expect(m.q("[data-ww-bar='combined']")).not.toBeNull();
    expect(m.q("[data-ww-strip-line]")!.textContent).toContain(
      "[ww1936.land.state_idle]",
    );
    // Its buttons: the toggle and ✕ (no order buttons, no cancel).
    expect(m.q(m.btn("move"))).toBeNull();
    expect(m.q(m.btn("cancel"))).toBeNull();
    await m.click("[data-ww-card-fold='open']");
    expect(card().dataset.collapsed).toBe("false");
    expect(card().className).toContain("bg-gray-900/92");
    // An order mode folds it again; the toggle opens it meanwhile; the
    // end of the order brings back the player's choice (open).
    await m.click(m.btn("front"));
    expect(card().dataset.collapsed).toBe("true");
    await m.click("[data-ww-card-fold='open']");
    expect(card().dataset.collapsed).toBe("false");
    m.bus.emit(new WwLandModeEvent("none"));
    await m.el.updateComplete;
    expect(card().dataset.collapsed).toBe("false");
    // A pending tap's refusal shows on the strip.
    checks.mockImplementation(() => "no_path");
    m.sel.pending = 4;
    m.sel.version++;
    m.el.tick();
    await m.el.updateComplete;
    expect(card().dataset.collapsed).toBe("true");
    expect(
      m.q("[data-ww-strip-line] [data-ww-block='no_path']"),
    ).not.toBeNull();
  });

  it("splits in half, picks an auto level, disbands only on a second tap", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount();
    await m.click(m.btn("split"));
    // [자동] offers off and the two levels; the pressed one is sent.
    await m.click(m.btn("auto"));
    expect(m.q("[data-ww-card-buttons='auto']")).not.toBeNull();
    expect(
      [...m.el.querySelectorAll("[data-ww-card-buttons='auto'] button")].map(
        (b) => (b as HTMLElement).dataset.wwArmyBtn,
      ),
    ).toEqual(["auto_0", "auto_1", "auto_2", "back"]);
    expect(m.q(m.btn("auto_1"))!.textContent).toContain(
      "[ww1936.auto.level_1]",
    );
    expect(m.q(m.btn("auto_2"))!.textContent).toContain(
      "[ww1936.auto.level_2]",
    );
    await m.click(m.btn("auto_1"));
    expect(m.q("[data-ww-card-buttons='main']")).not.toBeNull();
    await m.click(m.btn("auto"));
    await m.click(m.btn("auto_2"));
    await m.click(m.btn("auto"));
    await m.click(m.btn("auto_0"));
    expect(m.sent).toEqual([
      { kind: "army_split", army: 1, count: 1, template: 0 },
      { kind: "army_auto_level", army: 1, level: 1 },
      { kind: "army_auto_level", army: 1, level: 2 },
      { kind: "army_auto_level", army: 1, level: 0 },
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

  /** Feeds the view one update with army 1 (DEU, Berlin) and this `mine`. */
  const feed = (
    m: Awaited<ReturnType<typeof mount>>,
    mineData: ReturnType<typeof mine>,
    over: { state?: number } = {},
    tick = 701,
  ) =>
    m.land.apply(
      {
        armies: [army(1, "DEU", 3, { general: 1, mine: mineData, ...over })],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [],
      },
      tick,
    );

  it("[공격] is the direct attack: no [실행], no stance; the breakdown, the reasons and the settings", async () => {
    const m = await mount();
    await m.click(m.btn("plan"));
    expect(m.sel.mode).toBe("plan");
    expect(m.q(m.btn("execute"))).toBeNull();
    expect(m.q("[data-ww-stance]")).toBeNull();
    // A running direct attack: the engine's counts as chips, biggest group first.
    const order = {
      ...idleOrder(),
      kind: "plan" as const,
      targets: [6],
      executing: true,
      direct: true,
    };
    const direct = {
      flags: DIRECT_FAVORABLE,
      atk: [
        [3, 6, 6],
        [4, 6, 3],
      ] as [number, number, number][],
      hold: 4,
      wait: 5,
      rec: 2,
      walk: 4,
      why: 1,
      ratioPm: 780,
      at: [
        [5, 0, 4],
        [3, 1, 5],
        [4, 2, 2],
        [1, 3, 4],
      ] as [number, number, number][],
    };
    feed(m, mine({ order, direct, odds: [[3, 6, 30]] }), {
      state: ARMY_EXECUTING,
    });
    m.sel.setMode("none");
    m.el.tick();
    await m.el.updateComplete;
    const chip = (k: string) =>
      m.q(`[data-ww-direct-part='${k}']`)!.textContent;
    expect(chip("atk")).toContain("[ww1936.direct.part_atk_where] n=9");
    expect(chip("atk")).toContain("Berlin 6, Munich 3");
    expect(chip("hold")).toContain("n=4");
    expect(chip("wait")).toContain("n=5");
    expect(chip("rec")).toContain("n=2");
    expect(chip("walk")).toContain("n=4");
    // The waiting reason carries the true ratio; the red warning the win chance.
    expect(m.q("[data-ww-direct-why='odds']")!.textContent).toContain(
      "ratio=0.78",
    );
    expect(m.q("[data-ww-direct-warn]")!.textContent).toContain("pct=30");
    await m.click("[data-ww-direct-off]");
    await m.click("[data-ww-direct-toggle='border']");
    await m.click("[data-ww-direct-toggle='advance']");
    await m.click("[data-ww-direct-stop]");
    expect(m.sent).toEqual([
      { kind: "army_direct", army: 1, favorable: false },
      { kind: "army_direct", army: 1, allIn: true },
      { kind: "army_direct", army: 1, advance: true },
      { kind: "army_halt", army: 1 },
    ]);
  });

  it("the stance switch stays for an older (non-direct) plan: 신중 / 보통 / 과감; a change resends the plan's targets", async () => {
    const m = await mount();
    // An idle army: no stances for a human.
    expect(m.q("[data-ww-stance]")).toBeNull();
    const pressed = () =>
      [...m.el.querySelectorAll("[data-ww-stance] button")]
        .filter((b) => b.getAttribute("aria-pressed") === "true")
        .map((b) => (b as HTMLElement).dataset.wwArmyBtn);
    // A plan that runs keeps running with the new stance.
    const plan = {
      ...idleOrder(),
      kind: "plan" as const,
      targets: [6, 7],
      stance: "balanced" as const,
      executing: true,
    };
    feed(m, mine({ order: plan }), { state: ARMY_EXECUTING });
    m.el.tick();
    await m.el.updateComplete;
    expect(
      [...m.el.querySelectorAll("[data-ww-stance] button")].map(
        (b) => (b as HTMLElement).dataset.wwArmyBtn,
      ),
    ).toEqual([
      "stance_careful",
      "stance_balanced",
      "stance_aggressive",
      "stop",
    ]);
    expect(pressed()).toEqual(["stance_balanced"]);
    await m.click(m.btn("stance_aggressive"));
    expect(m.sent).toEqual([
      { kind: "army_plan", army: 1, targets: [6, 7], stance: "aggressive" },
      { kind: "army_execute", army: 1, on: true },
    ]);
  });

  it("a stance the rules refuse sends nothing and shows the reason", async () => {
    const m = await mount();
    feed(
      m,
      mine({
        order: { ...idleOrder(), kind: "plan" as const, targets: [6, 7] },
      }),
      {},
    );
    m.el.tick();
    await m.el.updateComplete;
    checks.mockReturnValue("not_at_war");
    await m.click(m.btn("stance_aggressive"));
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-block='not_at_war']")).not.toBeNull();
  });

  it("[방어]: army_front for the border around the army once; then the zone mode", async () => {
    const m = await mount();
    await m.click(m.btn("front"));
    expect(m.sent).toEqual([
      { kind: "army_front", army: 1, anchor: 3, enemy: 0 },
    ]);
    expect(m.sel.mode).toBe("front");
    // The strip: the zone hint and [구역 자동]; done ends the mode only.
    expect(m.q("[data-ww-hint='front']")!.textContent).toContain(
      "[ww1936.land.hint_defend] n=0",
    );
    await m.click(m.btn("zone_auto"));
    expect(m.sent[1]).toEqual({ kind: "army_zone", army: 1, regions: [] });
    await m.click(m.btn("cancel"));
    expect(m.sel.mode).toBe("none");
    expect(m.sent).toHaveLength(2);
    // Already defending: the explicit zone stays, no new army_front.
    const front = { ...idleOrder(), kind: "front" as const, zone: [3, 4] };
    feed(m, mine({ order: front, front: [3, 4] }));
    m.sent.length = 0;
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-order='front']")!.textContent).toContain(
      "[ww1936.land.order_defend] n=2",
    );
    await m.click(m.btn("front"));
    expect(m.sent).toEqual([]);
    expect(m.sel.mode).toBe("front");
    expect(m.q("[data-ww-hint='front']")!.textContent).toContain("n=2");
    // The unfolded card offers [구역 자동] and [완료]; done ends the mode.
    await m.click("[data-ww-card-fold='open']");
    expect(
      m.q("[data-ww-card-buttons='main'] " + m.btn("zone_auto")),
    ).not.toBeNull();
    await m.click(m.btn("back"));
    expect(m.sel.mode).toBe("none");
    // And [방어] again on the plain card presses the mode off.
    await m.click(m.btn("front"));
    expect(m.sel.mode).toBe("front");
  });

  it("the card names the army's auto level and the country's gaps", async () => {
    const m = await mount({
      armies: [
        army(1, "DEU", 3, {
          state: ARMY_AUTO,
          mine: mine({ auto: true, autoLevel: 1 }),
        }),
      ],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3)],
          gaps: [3, 4],
        }),
      ],
    });
    expect(m.q("[data-ww-auto-level='1']")!.textContent).toContain(
      "[ww1936.auto.level_1]",
    );
    expect(m.q("[data-ww-gaps='2']")!.textContent).toContain(
      "[ww1936.land.gaps] n=2",
    );
    // The action row's [자동] wears the level.
    expect(m.q(m.btn("auto") + " [data-ww-btn-badge]")!.textContent).toBe("1");
    await m.click(m.btn("auto"));
    expect(m.q(m.btn("auto_1"))!.getAttribute("aria-pressed")).toBe("true");
    expect(m.q("[data-ww-auto-hint]")!.textContent).toContain(
      "[ww1936.auto.level_hint_1]",
    );
  });

  it("previews a pending tap: the move's days, then 'tap again'", async () => {
    const m = await mount();
    m.sel.pending = 4;
    m.sel.version++;
    m.el.tick();
    await m.el.updateComplete;
    const p = m.q("[data-ww-preview='move']")!;
    expect(p.textContent).toContain("→ Munich");
    // Berlin → Munich: 16 ticks, 2.1 days, whatever the ground or the weather.
    expect(p.textContent).toContain("[ww1936.land.move_days] days=2.1");
    expect(m.q("[data-ww-tap-again]")).not.toBeNull();
  });

  it("sits right above the bottom rows and the dock, whatever drawer is open", async () => {
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
    // A drawer is a full-screen panel: the card stays centred.
    expect(card().getAttribute("style")).toContain("left: 50%");
    // The dock (44 px) stands on the rows: the card clears it too.
    const dock = document.createElement("nav");
    dock.setAttribute("data-ww-dock", "");
    dock.getBoundingClientRect = () =>
      ({ left: 310, top: 676, width: 560, height: 44 }) as DOMRect;
    document.body.appendChild(dock);
    m.el.tick();
    await m.el.updateComplete;
    expect(card().getAttribute("style")).toContain("bottom: 152px");
  });

  it("merges only where the order checks let it", async () => {
    // Merging into the 2nd Army is refused; into the 3rd it is fine.
    checks.mockImplementation((_w, o: LandOrder) =>
      o.kind === "army_merge" && o.into === 2 ? "army_full" : null,
    );
    const m = await mount({
      armies: [army(1, "DEU", 3), army(2, "DEU", 3), army(3, "DEU", 3)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 2, 3), division(3, 3, 3)],
        }),
      ],
    });
    expect(m.q(m.btn("merge"))!.getAttribute("aria-disabled")).toBe("false");
    await m.click(m.btn("merge"));
    expect(m.sent).toEqual([{ kind: "army_merge", army: 1, into: 3 }]);
    // All refused: greyed, with the first refusal.
    checks.mockImplementation((_w, o: LandOrder) =>
      o.kind === "army_merge" ? "army_full" : null,
    );
    const all = await mount({
      armies: [army(1, "DEU", 3), army(2, "DEU", 3)],
      landDetails: [
        landDetail("DEU", {
          divisions: [division(1, 1, 3), division(2, 2, 3)],
        }),
      ],
    });
    await all.click(all.btn("merge"));
    expect(all.q("[data-ww-block='army_full']")).not.toBeNull();
    expect(all.sent).toEqual([]);
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
