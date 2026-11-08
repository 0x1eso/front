// ww162 lane L5b (design ww162 §1.5, §2; Design A §3): the army card's line
// chips and second rows, the [사단] list, the planning bar, the supply line,
// and the pure helpers behind them.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { idleOrder, NEED_GROUPS } from "@openfront/engine-api/ww1936/LandTypes";
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
  divisionGroups,
  groupShort,
  planMaxPct,
  shortSplit,
  sortStock,
  stockSortsShort,
  supplyLine,
  togglePick,
  WwStockLitEvent,
} from "../../../src/client/hud/ww1936/ArmyHudModel";
import type { StockTableRow } from "../../../src/client/hud/ww1936/EconomyModel";
import {
  landSelectionOf,
  type PlannerAction,
  WwPlannerEvent,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import "../../../src/client/hud/ww1936/WwArmyCard";
import {
  cardPlace,
  type WwArmyCard,
} from "../../../src/client/hud/ww1936/WwArmyCard";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  landDetail,
  LandOptions,
  mine,
} from "./LandFixture";

const G = (name: string) => NEED_GROUPS.indexOf(name as never);

async function mount(o: LandOptions = {}) {
  const g = fakeLandGame({
    ticks: 700,
    wars: [["DEU", "POL"]],
    details: [detail("DEU")],
    armies: [army(1, "DEU", 3)],
    landDetails: [
      landDetail("DEU", {
        divisions: [division(1, 1, 3), division(2, 1, 3), division(3, 1, 4)],
      }),
    ],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  const asked: PlannerAction[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  bus.on(WwPlannerEvent, (e) => asked.push(e.action));
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
    el.tick();
    await el.updateComplete;
  };
  const btn = (id: string) => `[data-ww-army-btn='${id}']`;
  return {
    ...g,
    el,
    bus,
    sent,
    asked,
    q,
    click,
    btn,
    sel: landSelectionOf(g.game),
  };
}

/** Feeds army 1 (DEU, Berlin) with this `mine`. */
async function feed(
  m: Awaited<ReturnType<typeof mount>>,
  mineData: ReturnType<typeof mine>,
  tick = 701,
) {
  m.land.apply(
    {
      armies: [army(1, "DEU", 3, { mine: mineData })],
      removedArmies: [],
      battles: [],
      endedBattles: [],
      regions: [],
      countries: [],
      details: [],
    },
    tick,
  );
  m.el.tick();
  await m.el.updateComplete;
}

describe("ww162 L5b: the army card's battle planner", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("a chip turns its line mode on and off; the card shows the mode's hint and second row", async () => {
    const m = await mount();
    await m.click(m.btn("draw_front"));
    expect(m.sel.draw).toBe("front");
    const card = m.q("[data-ww-army-card='1']")!;
    expect(card.dataset.wwDraw).toBe("front");
    expect(card.dataset.collapsed).toBe("false");
    expect(card.className).toContain("max-h-[25vh]");
    expect(m.q(m.btn("draw_front"))!.getAttribute("aria-pressed")).toBe("true");
    expect(m.q("[data-ww-hint='draw_front']")!.textContent).toContain(
      "[ww1936.planner.hint_front]",
    );
    // [되돌리기] waits for a sent line; [지우기] asks the controller.
    expect(m.q(m.btn("planner_undo"))!.getAttribute("aria-disabled")).toBe(
      "true",
    );
    await m.click(m.btn("planner_undo"));
    expect(m.asked).toEqual([]);
    await m.click(m.btn("planner_clear"));
    expect(m.asked).toEqual([{ kind: "clear" }]);
    // Every button keeps the phone's 40 px.
    for (const b of m.el.querySelectorAll("button")) {
      expect(b.className).toMatch(/\b(h-10|h-11|size-10)\b/);
    }
    // The same chip again leaves the mode: the plain card is back.
    await m.click(m.btn("draw_front"));
    expect(m.sel.draw).toBe("none");
    expect(m.q("[data-ww-draw]")).toBeNull();
    expect(m.q("[data-ww-draw-chips]")).not.toBeNull();
  });

  it("folds to the strip in a line mode, whose ✓ leaves the mode", async () => {
    const m = await mount();
    await m.click(m.btn("draw_fallback"));
    await m.click("[data-ww-card-fold='fold']");
    expect(m.q("[data-ww-army-card]")!.dataset.collapsed).toBe("true");
    expect(m.q("[data-ww-strip-line]")!.textContent).toContain(
      "[ww1936.planner.hint_fallback]",
    );
    await m.click(m.btn("cancel"));
    expect(m.sel.draw).toBe("none");
    expect(m.q("[data-ww-army-card]")!.dataset.collapsed).toBe("false");
  });

  it("a chip the rules refuse says why and leaves the mode off", async () => {
    // At peace: no front to hold, no enemy to reach.
    const m = await mount({ wars: [] });
    expect(m.q(m.btn("draw_goal"))!.getAttribute("aria-disabled")).toBe("true");
    await m.click(m.btn("draw_goal"));
    expect(m.sel.draw).toBe("none");
    expect(m.q("[data-ww-block='not_at_war']")).not.toBeNull();
  });

  it("[공세선]: broad or spearhead, the stance, [실행] only with a line, [정지] while it runs", async () => {
    const m = await mount();
    await m.click(m.btn("draw_goal"));
    expect(m.q(m.btn("goal_broad"))!.getAttribute("aria-pressed")).toBe("true");
    await m.click(m.btn("goal_spear"));
    await m.click(m.btn("goal_stance_aggressive"));
    expect(m.sel.spear).toBe(true);
    expect(m.sel.stance).toBe("aggressive");
    expect(m.q(m.btn("goal_spear"))!.getAttribute("aria-pressed")).toBe("true");
    expect(
      m.q(m.btn("goal_stance_aggressive"))!.getAttribute("aria-pressed"),
    ).toBe("true");
    // No line yet: [실행] says why and asks nothing.
    m.asked.length = 0;
    await m.click(m.btn("planner_execute"));
    expect(m.asked).toEqual([]);
    expect(m.q("[data-ww-block='no_target']")).not.toBeNull();
    // With a line: [실행] runs it (army_execute).
    await feed(
      m,
      mine({ order: { ...idleOrder(), kind: "plan", goal: [6, 7] } }),
    );
    await m.click(m.btn("planner_execute"));
    expect(m.asked).toEqual([{ kind: "execute", on: true }]);
    expect(m.sent).toContainEqual({ kind: "army_execute", army: 1, on: true });
    await feed(
      m,
      mine({
        order: { ...idleOrder(), kind: "plan", goal: [6, 7], executing: true },
      }),
      702,
    );
    expect(m.q(m.btn("planner_execute"))).toBeNull();
    await m.click(m.btn("planner_halt"));
    expect(m.sent).toContainEqual({ kind: "army_execute", army: 1, on: false });
  });

  it("[후퇴선]: [추천], [자동 후퇴] as the order says, [지금 후퇴] on two taps and only with a line", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const m = await mount();
    await m.click(m.btn("draw_fallback"));
    await m.click(m.btn("planner_suggest"));
    expect(m.asked).toEqual([{ kind: "suggest" }]);
    expect(m.q(m.btn("planner_fb_auto"))!.textContent).toContain("☑");
    await m.click(m.btn("planner_fall_back"));
    expect(m.q("[data-ww-block='no_fallback']")!.textContent).toContain(
      "[ww1936.army_hud.block_no_fallback]",
    );
    await feed(
      m,
      mine({
        order: {
          ...idleOrder(),
          kind: "front",
          fallback: [1, 2],
          fbManual: true,
        },
      }),
    );
    expect(m.q(m.btn("planner_fb_auto"))!.textContent).toContain("☐");
    m.asked.length = 0;
    await m.click(m.btn("planner_fb_auto"));
    expect(m.asked).toEqual([{ kind: "fb_auto", on: true }]);
    expect(m.q(m.btn("planner_fb_auto"))!.textContent).toContain("☑");
    m.asked.length = 0;
    await m.click(m.btn("planner_fall_back"));
    expect(m.asked).toEqual([]);
    expect(m.q(m.btn("planner_fall_back"))!.textContent).toContain(
      "[ww1936.land.tap_again]",
    );
    vi.setSystemTime(101_000);
    await m.click(m.btn("planner_fall_back"));
    expect(m.asked).toEqual([{ kind: "fall_back_now" }]);
    expect(m.sent).toContainEqual({ kind: "army_fall_back", army: 1 });
  });

  it("[사단]: the divisions by region, checks and region headers, pins with [해제], [모두 해제], [군 전체]", async () => {
    const m = await mount();
    await feed(m, mine({ pins: [[3, 6]] }));
    await m.click(m.btn("draw_divisions"));
    const groups = [...m.el.querySelectorAll("[data-ww-division-group]")].map(
      (e) => (e as HTMLElement).dataset.wwDivisionGroup,
    );
    expect(groups).toEqual(["3", "4"]);
    expect(m.q("[data-ww-division-region='3']")!.textContent).toContain(
      "[ww1936.planner.region_divisions] region=Berlin,n=2",
    );
    // A region header checks its divisions; a check toggles one.
    await m.click("[data-ww-division-region='3']");
    expect(m.sel.divisions).toEqual([1, 2]);
    expect(
      m.q("[data-ww-division-region='3']")!.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(m.q("[data-ww-hint='draw_divisions']")!.textContent).toContain(
      "[ww1936.army_hud.picked] n=2",
    );
    await m.click("[data-ww-division-pick='3']");
    await m.click("[data-ww-division-pick='1']");
    expect(m.sel.divisions).toEqual([2, 3]);
    // The header of a fully checked region unchecks it.
    await m.click("[data-ww-division-region='4']");
    expect(m.sel.divisions).toEqual([2]);
    // The pinned one shows where it is pinned, and [해제].
    expect(m.q("[data-ww-division-pin='6']")!.textContent).toContain(
      "[ww1936.army_hud.pinned_to]",
    );
    m.asked.length = 0;
    await m.click(m.btn("planner_release_3"));
    await m.click(m.btn("planner_release_all"));
    expect(m.asked).toEqual([
      { kind: "release", divisions: [3] },
      { kind: "release", divisions: [] },
    ]);
    expect(m.sent).toEqual([
      { kind: "division_release", army: 1, divisions: [3] },
      { kind: "division_release", army: 1, divisions: [] },
    ]);
    // A waiting map tap shows its target and "tap again".
    m.sel.pending = 4;
    m.sel.version++;
    m.el.tick();
    await m.el.updateComplete;
    expect(m.q("[data-ww-preview='division_move']")!.textContent).toContain(
      "Munich",
    );
    // [군 전체]: the whole army again, the mode ends.
    await m.click(m.btn("planner_whole_army"));
    expect(m.sel.draw).toBe("none");
    expect(m.sel.divisions).toEqual([]);
  });

  it("the planning bar shows on every front, the lines and pins on the order line", async () => {
    const m = await mount();
    expect(m.q("[data-ww-planning]")).toBeNull();
    await feed(
      m,
      mine({
        planBp: 1500,
        order: {
          ...idleOrder(),
          kind: "front",
          ends: [3, 4],
          fallback: [1, 2, 5],
        },
        pins: [[2, 4]],
      }),
    );
    const bar = m.q("[data-ww-planning]")!;
    expect(bar.dataset.wwPlanning).toBe("15");
    expect(
      bar.querySelector("[role='meter']")!.getAttribute("aria-valuemax"),
    ).toBe("30");
    expect(m.q("[data-ww-readiness]")!.textContent).toContain("pct=15");
    expect(m.q("[data-ww-line='front']")!.textContent).toContain(
      "a=Berlin,b=Munich",
    );
    expect(m.q("[data-ww-line='fallback']")!.textContent).toContain("n=3");
    expect(m.q("[data-ww-pins='1']")).not.toBeNull();
    // A broad offensive line names its size instead of the old targets.
    await feed(
      m,
      mine({
        order: { ...idleOrder(), kind: "plan", goal: [6, 7], executing: true },
      }),
      702,
    );
    expect(m.q("[data-ww-order='plan']")).toBeNull();
    expect(m.q("[data-ww-line='goal']")!.textContent).toContain(
      "[ww1936.army_hud.line_goal_running] n=2",
    );
    expect(m.q("[data-ww-planning]")!.dataset.wwPlanning).toBe("0");
  });

  it("the supply line names the two shortest groups and the days; a tap lights them in the stock table", async () => {
    const art = G("artillery");
    const sup = G("support_equipment");
    const m = await mount();
    expect(m.q("[data-ww-army-short]")).toBeNull();
    const lit: WwStockLitEvent[] = [];
    m.bus.on(WwStockLitEvent, (e) => lit.push(e));
    await feed(
      m,
      mine({
        short: [
          [art, 140],
          [sup, 60],
        ],
      }),
    );
    const row = m.q("[data-ww-army-short]")!;
    expect(row.textContent).toContain(
      "[ww1936.army_hud.supply_strength] pct=100",
    );
    expect(row.textContent).toContain("name=[ww1936.equip.artillery],n=140");
    // The test country makes neither: no production, in amber.
    expect(m.q("[data-ww-short-days='none']")!.textContent).toContain(
      "[ww1936.army_hud.supply_no_output]",
    );
    expect(m.q("[data-ww-short-days='none']")!.className).toContain(
      "text-amber-300",
    );
    await m.click("[data-ww-army-short]");
    expect(lit.map((e) => [...e.groups])).toEqual([[art, sup]]);
  });
});

/** A stock row with just what the helpers read. */
function stockRow(
  id: string,
  short: number | null,
  status: StockTableRow["status"] = { kind: "enough", days: 0, tone: "ok" },
): StockTableRow {
  return {
    id,
    equipment: "artillery",
    name: id,
    stock: 0,
    short,
    perDay: 0,
    status,
    parts: [],
  };
}

describe("ww162 L5b: the HUD's helpers", () => {
  it("supplyLine: the longest days of the two, 0 from stock, null with no production", () => {
    const art = G("artillery");
    const inf = G("infantry_equipment");
    const days = (n: number) =>
      ({ kind: "days", days: n, tone: "warn" }) as const;
    const rows = [
      stockRow("artillery", 140, days(18)),
      stockRow("infantry_equipment", 60, days(4)),
    ];
    expect(supplyLine(undefined, rows)).toBeNull();
    expect(supplyLine([[art, 0]], rows)).toBeNull();
    expect(
      supplyLine(
        [
          [art, 140],
          [inf, 60],
        ],
        rows,
      ),
    ).toEqual({
      short: [
        [art, 140],
        [inf, 60],
      ],
      days: 18,
    });
    const stocked = [
      stockRow("artillery", 140, { kind: "from_stock", days: 0, tone: "ok" }),
    ];
    expect(supplyLine([[art, 5]], stocked)!.days).toBe(0);
    const none = [
      stockRow("artillery", 140, { kind: "no_line", days: 0, tone: "bad" }),
    ];
    expect(supplyLine([[art, 5]], none)!.days).toBeNull();
    // A group the table has no row for counts as made nowhere.
    expect(supplyLine([[inf, 5]], stocked)!.days).toBeNull();
  });

  it("groupShort sums the armies' gaps per group and keeps the two biggest", () => {
    const a = (short: [number, number][]) =>
      army(1, "DEU", 3, { mine: mine({ short }) });
    expect(
      groupShort([
        a([
          [2, 50],
          [1, 10],
        ]),
        a([
          [1, 45],
          [0, 30],
        ]),
        army(2, "DEU", 3),
      ]),
    ).toEqual([
      [1, 55],
      [2, 50],
    ]);
    expect(groupShort([])).toEqual([]);
  });

  it("togglePick adds a set or drops it when all are picked; divisionGroups groups by region", () => {
    expect(togglePick([5], [1, 2])).toEqual([1, 2, 5]);
    expect(togglePick([1, 2, 5], [1, 2])).toEqual([5]);
    expect(togglePick([1], [1, 2])).toEqual([1, 2]);
    const g = divisionGroups(
      [
        division(9, 1, 4),
        division(2, 1, 4),
        division(3, 2, 3),
        division(1, 1, 3),
      ],
      1,
    );
    expect(g.map((x) => [x.region, x.divisions.map((d) => d.id)])).toEqual([
      [3, [1]],
      [4, [2, 9]],
    ]);
  });

  it("the planning cap is 30 % plus the stat; the stock sorts by shortage or by type", () => {
    expect(planMaxPct(0)).toBe(30);
    expect(planMaxPct(1000)).toBe(40);
    const rows = [
      stockRow("artillery", 10),
      stockRow("infantry_equipment", 0),
      stockRow("support_equipment", 90),
      stockRow("fighter", null),
    ];
    expect(stockSortsShort(rows)).toBe(true);
    expect(stockSortsShort([stockRow("artillery", 0)])).toBe(false);
    const ids = (r: StockTableRow[]) => r.map((x) => x.id);
    const typed = ids(sortStock(rows, false));
    expect(typed).toEqual(
      [...typed].sort(
        (a, b) =>
          NEED_GROUPS.indexOf(a as never) - NEED_GROUPS.indexOf(b as never),
      ),
    );
    expect(ids(sortStock(rows, true)).slice(0, 2)).toEqual([
      "support_equipment",
      "artillery",
    ]);
  });

  it("shortSplit: the fielded divisions' part per group (capped at the total) and the rest for training", () => {
    const field = [0, 0, 0, 65, 0];
    expect(shortSplit(field, 3, 100)).toEqual({ fronts: 65, training: 35 });
    expect(shortSplit(field, 3, 50)).toEqual({ fronts: 50, training: 0 });
    expect(shortSplit(field, 4, 20)).toEqual({ fronts: 0, training: 20 });
    expect(shortSplit(undefined, 3, 20)).toEqual({ fronts: 0, training: 20 });
  });
});

describe("ww162 integration: the card keeps clear of the panel's back chip", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("a stepped-aside panel's chip above the dock lifts the card", () => {
    const at = (attr: string, top: number) => {
      const el = document.createElement("div");
      el.setAttribute(attr, "");
      el.getBoundingClientRect = () =>
        ({ top, width: 100, height: 40 }) as DOMRect;
      document.body.appendChild(el);
    };
    const h = window.innerHeight;
    at("data-ww-dock", h - 60);
    const below = cardPlace().bottom;
    at("data-ww-panel-chip", h - 100);
    expect(cardPlace().bottom).toBe(below + 40);
  });
});
