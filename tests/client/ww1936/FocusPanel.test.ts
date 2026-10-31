import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  WW_STAT_KEYS,
  WwFocusCard,
  WwPolDetail,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { FOCUS_ICONS } from "@openfront/engine-lib/ww1936/content/types";
import { EventBus } from "@openfront/shared/EventBus";
import fs from "fs";
import path from "path";
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

import { lineText } from "../../../src/client/hud/ww1936/PoliticsModel";
import { WwDrawerEvent } from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwFocusPanel";
import { WwFocusPanel } from "../../../src/client/hud/ww1936/WwFocusPanel";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { fakeEconGame, FakeOptions, ID } from "./EconomyFixture";

const DEU_TREE = CONTENT.treeFocuses.DEU.map((i) => CONTENT.focuses[i]);

/** Germany's politics detail: every card "needs a prerequisite" unless given. */
function polDetail(
  states: Record<string, number>,
  over: Partial<WwPolDetail> = {},
  failing: Record<string, number[]> = {},
): WwPolDetail {
  const cards: WwFocusCard[] = DEU_TREE.map((f, idx) => ({
    idx,
    state: states[f.id] ?? 4,
    failing: failing[f.id] ?? [],
  }));
  return {
    smallID: ID("DEU"),
    ppGainMilli: 2_000,
    focus: null,
    queued: null,
    cards,
    advisors: [],
    advisorLockUntil: [],
    candidates: [],
    spirits: [],
    decisions: [],
    missions: [],
    justification: null,
    warGoals: [],
    researchBonuses: [],
    statParts: [],
    stats: new Array<number>(WW_STAT_KEYS.length).fill(0),
    stabBaseBp: 5000,
    wsBaseBp: 3000,
    nextElectionDay: -1,
    crisisDays: [],
    pending: [],
    stabLines: [],
    wsLines: [],
    ...over,
  };
}

function withSpeed(pct: number): number[] {
  const s = new Array<number>(WW_STAT_KEYS.length).fill(0);
  s[WW_STAT_KEYS.indexOf("focusSpeedPct")] = pct;
  return s;
}

async function mount(d: WwPolDetail, o: FakeOptions = {}) {
  const { game, pol } = fakeEconGame(o);
  pol.apply(
    {
      countries: [],
      details: [d],
      global: null,
      regions: [],
      news: [],
      cards: [],
    },
    600,
  );
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const drawers: [string, boolean][] = [];
  bus.on(WwDrawerEvent, (e) => drawers.push([e.drawer, e.open]));
  const el = document.createElement("ww-focus-panel") as WwFocusPanel;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  el.open();
  el.tick();
  await el.updateComplete;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);
  const click = async (sel: string) => {
    q(sel)!.click();
    await el.updateComplete;
  };
  const pick = async (id: string) => {
    el.selectFocus(id);
    await el.updateComplete;
  };
  return { el, bus, sent, drawers, q, click, pick };
}

describe("<ww-focus-panel> (spec §21.3)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens as one World War drawer among the others", async () => {
    const m = await mount(polDetail({ deu_rhineland: 0 }));
    expect(m.drawers).toEqual([["focus", true]]);
    expect(m.q("aside[data-ww-drawer='focus']")).not.toBeNull();
    // Nothing runs: the first open card is picked, the slot asks for one.
    expect(m.q("[data-ww-focus-idle]")!.textContent).toContain(
      "[ww1936.focusui.idle]",
    );
    expect(m.q("[data-ww-focus-card]")!.dataset.wwFocusCard).toBe(
      "deu_rhineland",
    );
    // Another drawer opening closes this one.
    m.bus.emit(new WwDrawerEvent("industry", true));
    await m.el.updateComplete;
    expect(m.q("aside[data-ww-drawer='focus']")).toBeNull();
    expect(m.drawers[m.drawers.length - 1]).toEqual(["focus", false]);
  });

  it("a running focus shows its days and seconds", async () => {
    // +10% focus speed: 1,100 milli a day; 40,000 left → 37 days, 27.75 → 28 s.
    const m = await mount(
      polDetail(
        { deu_rhineland: 3, deu_four_year_plan: 4 },
        {
          focus: {
            id: "deu_rhineland",
            progressMilli: 30_000,
            daysMilli: 70_000,
          },
          stats: withSpeed(10),
        },
      ),
    );
    const run = m.q("[data-ww-focus-running]")!;
    expect(run.textContent).toContain("[ww1936.focus.deu_rhineland]");
    expect(m.q("[data-ww-focus-left]")!.textContent).toContain(
      "[ww1936.focusui.left] days=37,seconds=28",
    );
    expect(
      run.querySelector("[data-ring]")!.getAttribute("data-progress"),
    ).toBe("0.43");
    // The drawer opens on the running card; a 70-day focus takes 64 days, 48 s.
    expect(m.q("[data-ww-focus-card]")!.dataset.wwFocusCard).toBe(
      "deu_rhineland",
    );
    await m.pick("deu_four_year_plan");
    expect(m.q("[data-ww-focus-duration]")!.textContent).toContain(
      "[ww1936.focusui.duration] base=70,days=64,seconds=48",
    );
  });

  it("start sends focus_start and a busy tree sends focus_queue", async () => {
    const idle = await mount(
      polDetail({
        deu_rhineland: 1,
        deu_four_year_plan: 0,
        deu_rome_berlin: 0,
      }),
    );
    await idle.pick("deu_four_year_plan");
    expect(idle.q("[data-ww-focus-action]")!.dataset.wwFocusAction).toBe(
      "start",
    );
    await idle.click("[data-ww-focus-action='start']");
    expect(idle.sent).toEqual([
      { kind: "focus_start", focus: "deu_four_year_plan" },
    ]);
    // A done card says why it cannot start.
    await idle.pick("deu_rhineland");
    expect(idle.q("[data-ww-block='focus_done']")!.textContent).toContain(
      "[ww1936.econ.block.focus_done]",
    );
    document.body.innerHTML = "";

    const busy = await mount(
      polDetail(
        {
          deu_rhineland: 1,
          deu_four_year_plan: 0,
          deu_rome_berlin: 3,
        },
        {
          focus: {
            id: "deu_rome_berlin",
            progressMilli: 10_000,
            daysMilli: 70_000,
          },
        },
      ),
    );
    await busy.pick("deu_four_year_plan");
    await busy.click("[data-ww-focus-action='queue']");
    // Anti-Comintern needs only the running focus: it can be queued too.
    await busy.pick("deu_anti_comintern");
    await busy.click("[data-ww-focus-action='queue']");
    expect(busy.sent).toEqual([
      { kind: "focus_queue", focus: "deu_four_year_plan" },
      { kind: "focus_queue", focus: "deu_anti_comintern" },
    ]);
    // The Sudeten question waits on a focus not even started.
    await busy.pick("deu_sudeten_question");
    expect(busy.q("[data-ww-focus-action]")).toBeNull();
    expect(busy.q("[data-ww-block='focus_prereq']")).not.toBeNull();
  });

  it("cancel needs two taps", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = await mount(
      polDetail(
        { deu_rhineland: 1, deu_rome_berlin: 3, deu_four_year_plan: 7 },
        {
          focus: {
            id: "deu_rome_berlin",
            progressMilli: 10_000,
            daysMilli: 70_000,
          },
          queued: "deu_four_year_plan",
        },
      ),
    );
    await m.click("[data-ww-focus-running]");
    expect(m.sent).toEqual([]);
    expect(m.q("[data-ww-focus-running]")!.textContent).toContain(
      "[ww1936.focusui.cancel_tap]",
    );
    vi.advanceTimersByTime(400);
    await m.click("[data-ww-focus-running]");
    expect(m.sent).toEqual([{ kind: "focus_cancel" }]);
    // The queued one, likewise: once arms, twice takes it out.
    expect(m.q("[data-ww-focus-queued]")!.textContent).toContain(
      "[ww1936.focusui.queued] focus=[ww1936.focus.deu_four_year_plan]",
    );
    await m.click("[data-ww-focus-queued]");
    expect(m.sent).toHaveLength(1);
    expect(m.q("[data-ww-focus-queued]")!.textContent).toContain(
      "[ww1936.focusui.unqueue_tap]",
    );
    vi.advanceTimersByTime(400);
    await m.click("[data-ww-focus-queued]");
    expect(m.sent[m.sent.length - 1]).toEqual({ kind: "focus_unqueue" });
    // Three seconds later the arming is gone.
    await m.click("[data-ww-focus-running]");
    vi.advanceTimersByTime(3_100);
    await m.el.updateComplete;
    expect(m.q("[data-ww-focus-running]")!.dataset.armed).toBe("false");
  });

  it("blocked cards show their failing conditions", async () => {
    // The war in the east: after June 1940, or once France has fallen.
    const m = await mount(
      polDetail(
        { deu_rhineland: 1, deu_east_war: 5 },
        {},
        { deu_east_war: [1] },
      ),
    );
    await m.pick("deu_east_war");
    expect(m.q("[data-ww-focus-card]")!.dataset.state).toBe("5");
    const rows = [
      ...m.el.querySelectorAll("[data-ww-focus-section='conditions'] li"),
    ];
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain("[ww1936.cond.any]");
    expect(rows[0].querySelector("[data-ok]")).toBeNull();
    expect(rows[1].textContent).toContain("[ww1936.cond.date_ge]");
    expect(rows[1].querySelector("[data-ok]")!.getAttribute("data-ok")).toBe(
      "true",
    );
    // Leaf 1 fails, and names the country it is about.
    expect(rows[2].textContent).toContain(
      "[ww1936.pol.who_prefix] who=[ww1936.country.FRA]",
    );
    expect(rows[2].textContent).toContain("[ww1936.cond.capitulated]");
    expect(rows[2].querySelector("[data-ok]")!.getAttribute("data-ok")).toBe(
      "false",
    );
    expect(m.q("[data-ww-focus-action]")).toBeNull();
    expect(m.q("[data-ww-block='focus_unavailable']")!.textContent).toContain(
      "[ww1936.econ.block.focus_unavailable]",
    );
    // The prerequisites: one of two focuses, neither done.
    const req = m.q("[data-ww-focus-section='requires']")!.textContent!;
    expect(req).toContain("[ww1936.focusui.or]");
    expect(req).toContain("[ww1936.focus.deu_moscow_envoy]");
    expect(req).toContain("[ww1936.focus.deu_polish_alignment]");
  });

  // Rome–Berlin runs; the Austrian question is queued, which shuts out its
  // exclusive partner, the generals' misgivings (pre-flight R21: state 6).
  const busyQueued = () =>
    polDetail(
      {
        deu_rhineland: 1,
        deu_rome_berlin: 3,
        deu_austria_question: 7,
        deu_army_misgivings: 6,
      },
      {
        focus: {
          id: "deu_rome_berlin",
          progressMilli: 10_000,
          daysMilli: 70_000,
        },
        queued: "deu_austria_question",
      },
    );

  it("a card shut out by a queued exclusive says so and cannot start", async () => {
    const m = await mount(busyQueued());
    await m.pick("deu_army_misgivings");
    expect(m.q("[data-ww-focus-card]")!.dataset.state).toBe("6");
    // Neither start nor queue: the engine's reason instead.
    expect(m.q("[data-ww-focus-action]")).toBeNull();
    expect(m.q("[data-ww-block='focus_exclusive']")!.textContent).toContain(
      "[ww1936.econ.block.focus_exclusive]",
    );
    expect(m.q("[data-ww-focus-card]")!.textContent).toContain(
      "[ww1936.focusui.state.exclusive]",
    );
    // The choice that shuts it out is marked taken.
    const ex = m.q("[data-ww-focus-section='excludes'] li")!;
    expect(ex.textContent).toContain("[ww1936.focus.deu_austria_question]");
    expect(ex.querySelector("[data-ok]")!.getAttribute("data-ok")).toBe(
      "false",
    );
    expect(m.sent).toEqual([]);
    document.body.innerHTML = "";
    // Idle, with the partner done: still no start.
    const idle = await mount(
      polDetail({
        deu_rhineland: 1,
        deu_rome_berlin: 1,
        deu_austria_question: 1,
        deu_army_misgivings: 6,
      }),
    );
    await idle.pick("deu_army_misgivings");
    expect(idle.q("[data-ww-focus-action='start']")).toBeNull();
    expect(idle.q("[data-ww-block='focus_exclusive']")).not.toBeNull();
    expect(idle.sent).toEqual([]);
  });

  it("a queued card takes two taps to unqueue", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = await mount(busyQueued());
    await m.pick("deu_austria_question");
    expect(m.q("[data-ww-focus-card]")!.dataset.state).toBe("7");
    const sel = "[data-ww-focus-card] [data-ww-focus-action='unqueue']";
    expect(m.q(sel)!.textContent).toContain("[ww1936.focusui.unqueue]");
    await m.click(sel);
    expect(m.sent).toEqual([]);
    expect(m.q(sel)!.dataset.armed).toBe("true");
    expect(m.q(sel)!.textContent).toContain("[ww1936.focusui.unqueue_tap]");
    // A second tap too soon (a double tap) does not confirm.
    vi.advanceTimersByTime(100);
    await m.click(sel);
    expect(m.sent).toEqual([]);
    vi.advanceTimersByTime(300);
    await m.click(sel);
    expect(m.sent).toEqual([{ kind: "focus_unqueue" }]);
  });

  it("on a phone with both slots the chips fold behind ▾", async () => {
    // 844 × 390, a landscape phone.
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    const m = await mount(busyQueued());
    expect(m.q("aside")!.dataset.compact).toBe("true");
    expect(m.q("[data-ww-focus-chip]")).toBeNull();
    const menu = "[data-ww-focus-chip-menu]";
    expect(m.q(menu)!.textContent).toContain("[ww1936.focusui.chip.all]");
    expect(m.q(menu)!.getAttribute("aria-expanded")).toBe("false");
    await m.click(menu);
    expect(m.q(menu)!.getAttribute("aria-expanded")).toBe("true");
    const list = m.q("[data-ww-focus-chip-list]")!;
    expect(list.querySelectorAll("[data-ww-focus-chip]")).toHaveLength(7);
    await m.click("[data-ww-focus-chip-list] [data-ww-focus-chip='industry']");
    expect(m.q("[data-ww-focus-chip-list]")).toBeNull();
    expect(m.q(menu)!.textContent).toContain("[ww1936.focusui.chip.industry]");
    document.body.innerHTML = "";
    // Only the running slot: the chips stay in the row.
    const one = await mount(
      polDetail(
        { deu_rhineland: 1, deu_rome_berlin: 3 },
        {
          focus: {
            id: "deu_rome_berlin",
            progressMilli: 10_000,
            daysMilli: 70_000,
          },
        },
      ),
    );
    expect(one.q("[data-ww-focus-chip-menu]")).toBeNull();
    expect(one.el.querySelectorAll("[data-ww-focus-chip]")).toHaveLength(7);
    // A tablet with both slots: the chips have their own row.
    document.body.innerHTML = "";
    vi.stubGlobal("innerWidth", 1180);
    vi.stubGlobal("innerHeight", 820);
    const tall = await mount(busyQueued());
    expect(tall.q("[data-ww-focus-chip-menu]")).toBeNull();
    expect(tall.el.querySelectorAll("[data-ww-focus-chip]")).toHaveLength(7);
  });

  it("landscape: the detail is a right sheet that closes; portrait: a collapsed bottom row", async () => {
    vi.stubGlobal("innerWidth", 844);
    vi.stubGlobal("innerHeight", 390);
    const m = await mount(busyQueued());
    await m.pick("deu_rome_berlin");
    const sheet = m.q("[data-ww-focus-detail]")!;
    expect(sheet.dataset.sheet).toBe("right");
    expect(sheet.className).toContain("w-[280px]");
    expect(m.q("[data-ww-focus-body]")!.className).toContain("flex-row");
    expect(sheet.querySelector("[data-ww-focus-action]")).not.toBeNull();
    await m.click("[data-ww-focus-detail-close]");
    expect(m.q("[data-ww-focus-detail]")).toBeNull();
    expect(m.q("canvas[data-ww-focus-canvas]")).not.toBeNull();
    document.body.innerHTML = "";
    vi.stubGlobal("innerWidth", 390);
    vi.stubGlobal("innerHeight", 844);
    const p = await mount(busyQueued());
    await p.pick("deu_rome_berlin");
    expect(p.q("[data-ww-focus-detail]")!.dataset.open).toBe("false");
    expect(p.q("[data-ww-focus-section]")).toBeNull();
    await p.click("[data-ww-focus-card]");
    expect(p.q("[data-ww-focus-detail]")!.dataset.open).toBe("true");
    expect(p.q("[data-ww-focus-detail]")!.className).toContain("max-h-[45%]");
  });

  it("explain lines turn codes into names", () => {
    expect(
      lineText({
        key: "ww1936.fx.build",
        params: {
          building: "civ",
          count: 2,
          where: "best:2:rhineland",
          who: "@self",
        },
        depth: 0,
        leaf: -1,
      }),
    ).toBe(
      "[ww1936.fx.build] days=0,free=0,core=0,suspend=0,postponeDays=0,recruitablePct=0,amount=0,goal=none,units=none,to=none,name=none,branch=none,tech=none,general=none,group=none,building=[ww1936.building.civ],count=2,where=[ww1936.pol.pick.best_of] n=2,group=[ww1936.pol.group.rhineland]",
    );
    const t = lineText({
      key: "ww1936.fx.war_goal",
      params: { on: "@owner:sudetenland", type: "claim", who: "@self" },
      depth: 0,
      leaf: -1,
    });
    expect(t).toContain(
      "on=[ww1936.pol.sel.owner_of] group=[ww1936.pol.group.sudetenland]",
    );
    expect(t).toContain("type=[ww1936.wargoal.claim]");
    expect(
      lineText({
        key: "ww1936.cond.focus_done",
        params: { id: "deu_rhineland", who: "@leader:@self" },
        depth: 0,
        leaf: 0,
      }),
    ).toMatch(
      /^\[ww1936\.pol\.who_prefix\] who=\[ww1936\.pol\.sel\.leader_of\] who=\[ww1936\.pol\.sel\.self\]\[ww1936\.cond\.focus_done\].*id=\[ww1936\.focus\.deu_rhineland\]/,
    );
  });
});

describe("focus icons (spec §21.3)", () => {
  const DIR = path.join(__dirname, "../../../resources/images/ww1936/focus");

  it("every icon is a small white 24 × 24 silhouette", () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg"));
    expect(files.sort()).toEqual(FOCUS_ICONS.map((i) => `${i}.svg`).sort());
    expect(files).toHaveLength(40);
    for (const f of files) {
      const svg = fs.readFileSync(path.join(DIR, f), "utf8");
      expect(svg.length, f).toBeLessThanOrEqual(4096);
      expect(svg, f).not.toMatch(
        /<script|on[a-z]+=|href=|<image|<foreignObject/i,
      );
      expect(svg, f).toContain('viewBox="0 0 24 24"');
      expect(svg, f).toContain('fill="#fff"');
      // One colour: no other fill or stroke, no gradient.
      for (const m of svg.matchAll(/(fill|stroke|stop-color)="([^"]*)"/g)) {
        expect(m[2], `${f} ${m[1]}`).toBe("#fff");
      }
      expect(svg, f).not.toMatch(/style=|Gradient/);
    }
  });
});
