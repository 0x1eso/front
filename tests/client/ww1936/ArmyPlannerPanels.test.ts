// ww162 lane L5b (design ww162 §2-3; Design A §3): the army drawer's plan
// view toggle and division commands, the group tab's summed supply line and
// the marshal's lines, and the stock table's [부족순] sort, lit rows and the
// fronts / training split.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  EQUIP_KEY_COUNT,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  NEED_GROUP_COUNT,
  NEED_GROUPS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { html, render } from "lit";
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

import { WwStockLitEvent } from "../../../src/client/hud/ww1936/ArmyHudModel";
import {
  landSelectionOf,
  OpenWwArmyEvent,
  WwSelectArmyEvent,
} from "../../../src/client/hud/ww1936/LandSelection";
import { renderGroupTab } from "../../../src/client/hud/ww1936/WwArmyGroupTab";
import "../../../src/client/hud/ww1936/WwArmyPanel";
import type { WwArmyPanel } from "../../../src/client/hud/ww1936/WwArmyPanel";
import { OpenWwIndustryEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwIndustryPanel";
import type { WwIndustryPanel } from "../../../src/client/hud/ww1936/WwIndustryPanel";
import { WwLandController } from "../../../src/client/hud/ww1936/WwLandController";
import { wwMapFlowActive } from "../../../src/client/hud/ww1936/WwPanelMode";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { doctrineGame } from "./DoctrineFixture";
import { detail, fakeEconGame, ID, summary } from "./EconomyFixture";
import {
  army,
  division,
  fakeLandGame,
  general,
  landDetail,
  mine,
} from "./LandFixture";

const G = (name: string) => NEED_GROUPS.indexOf(name as never);

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("ww162 L5b: the army drawer", () => {
  async function mount() {
    const g = fakeLandGame({
      details: [detail("DEU")],
      summaries: [summary("DEU")],
      armies: [
        army(1, "DEU", 3, { general: 1, mine: mine({ pins: [[2, 6]] }) }),
      ],
      landDetails: [
        landDetail("DEU", {
          generals: [general(1, { army: 1 })],
          divisions: [division(1, 1, 3), division(2, 1, 3)],
        }),
      ],
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
    bus.emit(new OpenWwArmyEvent());
    bus.emit(new WwSelectArmyEvent(1));
    el.tick();
    await el.updateComplete;
    const q = (sel: string) => el.querySelector<HTMLElement>(sel);
    const click = async (sel: string) => {
      q(sel)!.click();
      el.tick();
      await el.updateComplete;
    };
    return { ...g, el, bus, sent, q, click, sel: landSelectionOf(g.game) };
  }

  it("the plan view toggle sits by [모두 자동], 44 px, and flips the view", async () => {
    const m = await mount();
    const toggle = () => m.q("[data-ww-army-auto] [data-ww-plan-view]")!;
    expect(toggle().className).toContain("size-11");
    expect(toggle().getAttribute("aria-label")).toBe(
      "[ww1936.planner.plan_view]",
    );
    expect(toggle().getAttribute("aria-pressed")).toBe("false");
    await m.click("[data-ww-plan-view]");
    expect(m.sel.planView).toBe(true);
    expect(toggle().getAttribute("aria-pressed")).toBe("true");
    await m.click("[data-ww-plan-view]");
    expect(m.sel.planView).toBe(false);
  });

  it("a division row commands that one division; a pinned one shows its pin and [해제]", async () => {
    const m = await mount();
    await m.click("[data-ww-show-divisions]");
    expect(m.q("[data-ww-division-pin='6']")!.textContent).toContain(
      "[ww1936.army_hud.pinned_to]",
    );
    expect(m.q("[data-ww-division='1'] [data-ww-division-pin]")).toBeNull();
    await m.click("[data-ww-division-release='2']");
    expect(m.sent).toEqual([
      { kind: "division_release", army: 1, divisions: [2] },
    ]);
    await m.click("[data-ww-division-command='1']");
    expect(m.sel.army).toBe(1);
    expect(m.sel.draw).toBe("divisions");
    expect(m.sel.divisions).toEqual([1]);
    // The drawer steps aside for the map tap (the dock minimises it while
    // a map flow is on) and stays open underneath.
    expect(wwMapFlowActive(m.game)).toBe(true);
    expect(m.q("[data-ww-drawer='army']")).not.toBeNull();
    // Another command while that flow is on starts no new flow, so the
    // dock would not step the drawer aside: it closes for the map tap.
    await m.click("[data-ww-division-command='2']");
    expect(m.sel.divisions).toEqual([2]);
    expect(m.q("[data-ww-drawer='army']")).toBeNull();
  });
});

describe("ww162 L5b: the group tab", () => {
  it("sums its armies' shortages into one supply line and splits the marshal's offensive line", () => {
    const art = G("artillery");
    const sup = G("support_equipment");
    const g = doctrineGame({
      details: [detail("DEU")],
      armies: [
        army(1, "DEU", 3, { mine: mine({ short: [[art, 100]] }) }),
        army(2, "DEU", 4, {
          divisions: 1,
          strengthPm: 400,
          mine: mine({
            short: [
              [sup, 30],
              [art, 20],
            ],
          }),
        }),
      ],
      landDetails: [
        landDetail("DEU", { generals: [general(9, { fm: true })] }),
      ],
      groups: [
        {
          id: 4,
          owner: ID("DEU"),
          fm: 9,
          armies: [1, 2],
          ends: [3, 4],
          goal: [6, 7],
          spear: false,
          split: false,
        },
      ],
    });
    const sent: WwOrder[] = [];
    const lit: number[][] = [];
    const drawn: [string, number][] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const draw = () =>
      render(
        html`${renderGroupTab({
          game: g.game as never,
          view: g.land,
          me: ID("DEU"),
          day: 0,
          send: (o) => sent.push(o),
          armed: () => false,
          confirmTap: (_k, act) => act(),
          onFront: () => {},
          lit: (groups) => lit.push([...groups]),
          drawLine: (mode, group) => drawn.push([mode, group]),
        })}`,
        host,
      );
    draw();
    const short = host.querySelector<HTMLElement>("[data-ww-group-short='4']")!;
    expect(short.textContent).toContain("name=[ww1936.equip.artillery],n=120");
    expect(short.textContent).toContain("n=30");
    // Strength by divisions: (3 × 100 % + 1 × 40 %) / 4.
    expect(short.textContent).toContain("pct=85");
    short.click();
    expect(lit).toEqual([[art, sup]]);
    const lines = host.querySelector<HTMLElement>("[data-ww-group-lines]")!;
    expect(
      lines.querySelector("[data-ww-line='front']")!.textContent,
    ).toContain("a=Berlin,b=Munich");
    expect(lines.querySelector("[data-ww-line='goal']")!.textContent).toContain(
      "n=2",
    );
    const off = host.querySelector<HTMLElement>("[data-ww-group-split='off']")!;
    expect(off.getAttribute("aria-pressed")).toBe("true");
    off.click();
    expect(sent).toEqual([]);
    host.querySelector<HTMLElement>("[data-ww-group-split='on']")!.click();
    expect(sent).toEqual([
      {
        kind: "group_goal",
        group: 4,
        regions: [6, 7],
        spear: false,
        split: true,
      },
    ]);
    // The marshal's line chips turn on the map's draw modes for the group.
    const chips = [
      ...host.querySelectorAll<HTMLElement>(
        "[data-ww-group-draw='4'] [data-ww-group-draw-mode]",
      ),
    ];
    expect(chips.map((b) => b.dataset.wwGroupDrawMode)).toEqual([
      "front",
      "goal",
      "fallback",
    ]);
    chips[1].click();
    expect(drawn).toEqual([["goal", 4]]);
  });
});

describe("ww162 L5b: the stock table", () => {
  function mount() {
    const stock = new Array<number>(EQUIP_KEY_COUNT).fill(0);
    stock[equipKey("artillery", 1)] = 60;
    const { game, land } = fakeEconGame({
      summaries: [summary("DEU")],
      details: [detail("DEU", { stock })],
    });
    const short = new Array<number>(NEED_GROUP_COUNT).fill(0);
    short[G("artillery")] = 500;
    short[G("support_equipment")] = 80;
    land.apply(
      {
        armies: [
          army(1, "DEU", 3, { mine: mine({ short: [[G("artillery"), 300]] }) }),
        ],
        removedArmies: [],
        battles: [],
        endedBattles: [],
        regions: [],
        countries: [],
        details: [
          landDetail("DEU", {
            equipShort: short,
            // The fielded divisions' part, as the engine sums it.
            fieldShort: short.map((n, g) => (g === G("artillery") ? 300 : 0)),
          }),
        ],
      },
      600,
    );
    const bus = new EventBus();
    const el = document.createElement("ww-industry-panel") as WwIndustryPanel;
    el.game = game as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    const q = (sel: string) => el.querySelector<HTMLElement>(sel);
    const rows = () =>
      [...el.querySelectorAll("[data-ww-stock-row]")].map((r) =>
        r.getAttribute("data-ww-stock-row"),
      );
    const click = async (sel: string) => {
      q(sel)!.click();
      await el.updateComplete;
    };
    return { el, bus, q, rows, click };
  }

  it("[부족순] by default when something is short; [종류순] the type order", async () => {
    const m = mount();
    m.bus.emit(new OpenWwIndustryEvent("production"));
    m.el.tick();
    await m.el.updateComplete;
    expect(
      m.q("[data-ww-stock-sort='short']")!.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(m.rows().slice(0, 2)).toEqual(["artillery", "support_equipment"]);
    await m.click("[data-ww-stock-sort='type']");
    const typed = m.rows();
    expect(typed.indexOf("support_equipment")).toBeLessThan(
      typed.indexOf("artillery"),
    );
  });

  it("the supply line's tap opens the production tab with its rows lit for 2 s; an open row splits its shortage", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const m = mount();
    m.bus.emit(new WwStockLitEvent([G("artillery")]));
    m.el.tick();
    await m.el.updateComplete;
    expect(m.el.shownTab()).toBe("production");
    const lit = m.q("[data-ww-stock-row='artillery']")!;
    expect(lit.hasAttribute("data-ww-stock-lit")).toBe(true);
    expect(lit.className).toContain("outline-amber-400");
    expect(
      m
        .q("[data-ww-stock-row='support_equipment']")!
        .hasAttribute("data-ww-stock-lit"),
    ).toBe(false);
    vi.advanceTimersByTime(2000);
    await m.el.updateComplete;
    expect(m.q("[data-ww-stock-lit]")).toBeNull();
    // The split: 300 with the fielded divisions, the rest in training.
    expect(m.q("[data-ww-stock-split]")).toBeNull();
    await m.click("[data-ww-stock-row='artillery'] button");
    expect(m.q("[data-ww-stock-fronts]")!.textContent).toContain(
      "[ww1936.econ.stock_short_fronts] n=300",
    );
    expect(m.q("[data-ww-stock-training]")!.textContent).toContain("n=200");
  });
});
