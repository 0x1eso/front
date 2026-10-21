import type { WwOrder } from "@openfront/engine-api/Schemas";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_FOREVER } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
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

import { DIAL_GLOW_CLASS } from "../../../src/client/hud/domestic/Dial";
import "../../../src/client/hud/ww1936/WwDials";
import type { WwDials } from "../../../src/client/hud/ww1936/WwDials";
import {
  OpenWwIndustryEvent,
  OpenWwPoliticsEvent,
  WwDrawerEvent,
  WwPoliticsTab,
} from "../../../src/client/hud/ww1936/WwDrawer";
import "../../../src/client/hud/ww1936/WwFocusPanel";
import type { WwFocusPanel } from "../../../src/client/hud/ww1936/WwFocusPanel";
import "../../../src/client/hud/ww1936/WwIndustryPanel";
import type { WwIndustryPanel } from "../../../src/client/hud/ww1936/WwIndustryPanel";
import "../../../src/client/hud/ww1936/WwPoliticsPanel";
import type { WwPoliticsPanel } from "../../../src/client/hud/ww1936/WwPoliticsPanel";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { detail, ID, summary } from "./EconomyFixture";
import {
  fakePolGame,
  polDetail,
  PolOptions,
  polSummary,
  statsArray,
} from "./PoliticsFixture";

function mount(o: PolOptions = {}) {
  const { game } = fakePolGame({
    summaries: [summary("DEU")],
    details: [detail("DEU")],
    ...o,
  });
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-politics-panel") as WwPoliticsPanel;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  const open = async (tab: WwPoliticsTab | null = null) => {
    bus.emit(new OpenWwPoliticsEvent(tab));
    el.tick();
    await el.updateComplete;
  };
  const q = <T extends Element = HTMLButtonElement>(sel: string) =>
    el.querySelector<T>(sel);
  const click = async (sel: string) => {
    const b = q(sel);
    if (b === null) throw new Error(`no ${sel}`);
    b.click();
    await el.updateComplete;
  };
  return { el, bus, sent, open, q, click, game };
}

const mine = (d: Parameters<typeof polDetail>[1] = {}, s = {}) => ({
  polSummaries: [polSummary("DEU", s)],
  polDetails: [polDetail("DEU", d)],
});

describe("<ww-politics-panel> (P3 spec §21.4)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("government: the leader, the government, the pie and the two bars", async () => {
    const m = mount(
      mine(
        { stabLines: [{ key: "ww1936.pol.line.stab_party", bp: 200 }] },
        { ruling: 2, leader: "title:leader_fascist", stabBp: 4_200 },
      ),
    );
    await m.open("government");
    expect(m.q("[data-ww-drawer='politics']")).not.toBeNull();
    expect(m.q("[data-ww-leader]")!.textContent).toBe(
      "[ww1936.title.leader_fascist]",
    );
    expect(m.q("[data-ww-government]")!.textContent).toBe(
      "[ww1936.gov.DEU.fascist]",
    );
    expect(m.el.querySelectorAll("[data-ww-ideology]")).toHaveLength(4);
    const stab = m.q<HTMLElement>("[data-ww-bar='stability']")!;
    expect(stab.textContent).toContain("42%");
    expect(stab.innerHTML).toContain("text-orange-300");
    expect(stab.querySelector("[data-ww-line]")!.textContent).toContain(
      "[ww1936.pol.line.stab_party]",
    );
    expect(m.q("[data-ww-surrender]")!.textContent).toContain(
      "[ww1936.pol.gov.surrender] pct=80",
    );
  });

  it("advisors: an empty seat lists its candidates; hire takes one tap, dismiss two", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = mount(
      mine({
        candidates: ["title:administrator", "title:chief_offense"],
        advisors: [
          "title:fiscal_hawk",
          null,
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      }),
    );
    await m.open("advisors");
    expect(m.el.querySelectorAll("[data-ww-seat]")).toHaveLength(8);
    await m.click("[data-ww-seat='1'] [data-ww-seat-pick]");
    const hire = m.q("[data-ww-hire='title:administrator']")!;
    expect(hire.textContent).toContain("[ww1936.pol.adv.cost] pp=150");
    await m.click("[data-ww-hire='title:administrator']");
    expect(m.sent).toEqual([
      { kind: "advisor_hire", slot: 1, advisor: "title:administrator" },
    ]);
    await m.click("[data-ww-fire='0']");
    expect(m.sent).toHaveLength(1);
    expect(m.q("[data-ww-fire='0']")!.textContent!.trim()).toBe(
      "[ww1936.pol.tap_again]",
    );
    vi.setSystemTime(10_500);
    await m.click("[data-ww-fire='0']");
    expect(m.sent[1]).toEqual({ kind: "advisor_fire", slot: 0 });
  });

  it("laws: cost and the missing threshold; an open step is one tap", async () => {
    const m = mount({
      details: [
        detail("DEU", {
          laws: {
            economy: "civilian",
            trade: "export_focus",
            conscription: "limited",
          },
          lawCooldownUntil: { economy: 0, trade: 20, conscription: 0 },
        }),
      ],
    });
    await m.open("laws");
    const partial = m.q("[data-ww-law='partial_mobilization']")!;
    expect(partial.disabled).toBe(true);
    expect(partial.dataset.state).toBe("locked");
    expect(partial.textContent).toContain("[ww1936.pol.law.cost] pp=100");
    // P3 spec §7.2: 20% war support (the fixture's) is under the 30% step.
    const line = partial.querySelector<HTMLElement>("[data-ww-law-line]")!;
    expect(line.dataset.ok).toBe("false");
    expect(line.textContent).toContain(
      "[ww1936.pol.law.need_ws] need=30,now=20",
    );
    expect(m.q("[data-ww-law='civilian']")!.dataset.state).toBe("current");
    expect(m.q("[data-ww-law='civilian']")!.textContent).toContain(
      "[ww1936.pol.law.in_force]",
    );
    // The trade law changed lately: the wait shows by the ladder.
    expect(
      m.q("[data-ww-law-kind='trade'] [data-ww-law-wait]")!.textContent,
    ).toContain("[ww1936.pol.law.wait] days=20");
    expect(m.q("[data-ww-law='free_trade']")!.disabled).toBe(true);
    await m.click("[data-ww-law='early_mobilization']");
    expect(m.sent).toEqual([
      { kind: "set_law", law: "economy", value: "early_mobilization" },
    ]);
  });

  it("laws: a change that would close deals takes two taps (P1)", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const m = mount({
      details: [
        detail("DEU", {
          laws: {
            economy: "partial_mobilization",
            trade: "export_focus",
            conscription: "limited",
          },
          resources: RESOURCE_IDS.map((r) => ({
            produced: r === "steel" ? 40 : 0,
            exported: 0,
            imported: 0,
            used: 0,
          })),
          selling: [
            {
              id: 3,
              buyer: ID("ITA"),
              seller: ID("DEU"),
              resource: "steel",
              civs: 2,
            },
          ],
        }),
      ],
    });
    await m.open("laws");
    await m.click("[data-ww-law='limited_exports']");
    expect(m.sent).toEqual([]);
    expect(
      m.q("[data-ww-law='limited_exports'] [data-ww-law-closes]")!.textContent,
    ).toContain("[ww1936.econ.law_closes_deals]");
    vi.advanceTimersByTime(400);
    await m.click("[data-ww-law='limited_exports']");
    expect(m.sent).toEqual([
      { kind: "set_law", law: "trade", value: "limited_exports" },
    ]);
  });

  it("spirits: name, effects and days left", async () => {
    const m = mount(
      mine({
        spirits: [
          { id: "usa_isolation", untilDay: WW_FOREVER },
          { id: "gen_war_bonds_spirit", untilDay: 90 },
        ],
      }),
    );
    await m.open("spirits");
    const iso = m.q("[data-ww-spirit='usa_isolation']")!;
    expect(iso.textContent).toContain("[ww1936.spirit.usa_isolation]");
    expect(iso.textContent).toContain("[ww1936.stat.warSupportBp] value=-1500");
    expect(iso.textContent).toContain("[ww1936.pol.spirit.permanent]");
    expect(
      m.q("[data-ww-spirit='gen_war_bonds_spirit']")!.textContent,
    ).toContain("[ww1936.pol.spirit.left] days=90");
  });

  it("decisions: take one, a targeted one lists the countries, a mission cancels with two taps", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = mount({
      ticks: dayStartTick(10, 600),
      ...mine(
        {
          decisions: [
            {
              id: "gen_rally",
              target: 0,
              state: 0,
              costPp: 50,
              cooldownUntil: 0,
              failing: [],
            },
            {
              id: "gen_party_support_dem",
              target: ID("FRA"),
              state: 0,
              costPp: 50,
              cooldownUntil: 0,
              failing: [],
            },
            {
              id: "gen_party_support_dem",
              target: ID("POL"),
              state: 3,
              costPp: 50,
              cooldownUntil: 50,
              failing: [],
            },
          ],
          missions: [
            { id: "gen_coup_dem", target: ID("POL"), startDay: 0, endDay: 90 },
          ],
        },
        { ruling: 0 },
      ),
    });
    await m.open("decisions");
    const rally = m.q("[data-ww-decision='gen_rally']")!;
    expect(rally.textContent).toContain("[ww1936.pol.decision.cost] pp=50");
    await m.click("[data-ww-take='gen_rally']");
    expect(m.sent).toEqual([
      { kind: "decision_take", decision: "gen_rally", target: 0 },
    ]);
    const party = m.q("[data-ww-decision='gen_party_support_dem']")!;
    expect(party.querySelectorAll("[data-ww-decision-target]")).toHaveLength(2);
    expect(
      party.querySelector(`[data-ww-decision-target='${ID("POL")}']`)!
        .textContent,
    ).toContain("[ww1936.pol.decision.cooldown] days=40");
    await m.click(`[data-ww-take-target='${ID("FRA")}']`);
    expect(m.sent[1]).toEqual({
      kind: "decision_take",
      decision: "gen_party_support_dem",
      target: ID("FRA"),
    });
    const mission = m.q("[data-ww-mission='gen_coup_dem']")!;
    expect(mission.textContent).toContain(
      "[ww1936.pol.decision.mission] days=80",
    );
    await m.click("[data-ww-mission-cancel]");
    vi.setSystemTime(10_500);
    await m.click("[data-ww-mission-cancel]");
    expect(m.sent[2]).toEqual({
      kind: "decision_cancel",
      decision: "gen_coup_dem",
      target: ID("POL"),
    });
  });

  it("a filled seat may be replaced; a coup takes two taps", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = mount(
      mine(
        {
          candidates: ["title:administrator"],
          advisors: [
            "title:fiscal_hawk",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ],
          decisions: [
            {
              id: "gen_coup_dem",
              target: ID("POL"),
              state: 0,
              costPp: 150,
              cooldownUntil: 0,
              failing: [],
            },
          ],
        },
        { ruling: 0 },
      ),
    );
    await m.open("advisors");
    await m.click("[data-ww-seat='0'] [data-ww-seat-pick]");
    const hire = m.q("[data-ww-hire='title:administrator']")!;
    expect(hire.textContent).toContain("[ww1936.pol.adv.replace]");
    await m.click("[data-ww-hire='title:administrator']");
    expect(m.sent).toEqual([
      { kind: "advisor_hire", slot: 0, advisor: "title:administrator" },
    ]);
    await m.open("decisions");
    const coup = m.q("[data-ww-decision='gen_coup_dem']")!;
    expect(coup.textContent).toContain(
      "[ww1936.equip.infantry_equipment] 1,000",
    );
    await m.click(`[data-ww-take-target='${ID("POL")}']`);
    expect(m.sent).toHaveLength(1);
    expect(m.q(`[data-ww-take-target='${ID("POL")}']`)!.textContent).toContain(
      "[ww1936.pol.tap_again]",
    );
    vi.setSystemTime(10_500);
    await m.click(`[data-ww-take-target='${ID("POL")}']`);
    expect(m.sent[1]).toEqual({
      kind: "decision_take",
      decision: "gen_coup_dem",
      target: ID("POL"),
    });
  });

  it("the 🎯 dial opens the focus drawer (Task 7's panel)", async () => {
    const m = mount(mine({}, {}));
    const focus = document.createElement("ww-focus-panel") as WwFocusPanel;
    focus.game = m.game as never;
    focus.eventBus = m.bus;
    document.body.appendChild(focus);
    focus.init();
    const dials = document.createElement("ww-dials") as WwDials;
    dials.game = m.game as never;
    dials.eventBus = m.bus;
    document.body.appendChild(dials);
    dials.init();
    dials.tick();
    await dials.updateComplete;
    const dial = dials.querySelector<HTMLButtonElement>(
      "[data-ww-dial='focus']",
    )!;
    expect(dial.className).toContain(DIAL_GLOW_CLASS);
    dial.click();
    focus.tick();
    await focus.updateComplete;
    expect(focus.querySelector("[data-ww-drawer='focus']")).not.toBeNull();
    await dials.updateComplete;
    expect(dial.getAttribute("aria-pressed")).toBe("true");
  });

  it("one drawer at a time, and the industry drawer's tab opens the laws", async () => {
    const m = mount(mine({}, { ppMilli: 200_000 }));
    const industry = document.createElement(
      "ww-industry-panel",
    ) as WwIndustryPanel;
    industry.game = m.game as never;
    industry.eventBus = m.bus;
    document.body.appendChild(industry);
    industry.init();
    await m.open("government");
    expect(m.el.isOpen()).toBe(true);
    m.bus.emit(new OpenWwIndustryEvent("manpower"));
    await m.el.updateComplete;
    expect(m.el.isOpen()).toBe(false);
    m.bus.emit(new OpenWwPoliticsEvent("laws"));
    await m.el.updateComplete;
    expect(m.el.shownTab()).toBe("laws");
    expect(industry.isOpen()).toBe(false);
    const shown: string[] = [];
    m.bus.on(WwDrawerEvent, (e) => shown.push(`${e.drawer}:${e.open}`));
    m.bus.emit(new OpenWwPoliticsEvent("laws"));
    expect(shown).toEqual(["politics:false"]);
  });

  it("stats and the explain lines read every source", async () => {
    const m = mount(
      mine({
        statParts: [statsArray({ ppGainPct: 5 })],
      }),
    );
    await m.open("government");
    expect(m.q("[data-ww-pp-sources]")!.textContent).toContain(
      "[ww1936.pol.source.tech]",
    );
  });
});
