import type { WwOrder } from "@openfront/engine-api/Schemas";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { EventBus } from "@openfront/shared/EventBus";
import { render } from "lit";
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

vi.mock("../../../src/client/Api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Api")>()),
  getUserMe: vi.fn(async () => null),
}));

import "../../../src/client/hud/layers/PlayerPanel";
import type { PlayerPanel } from "../../../src/client/hud/layers/PlayerPanel";
import "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import type { WwDiplomacyPanel } from "../../../src/client/hud/ww1936/WwDiplomacyPanel";
import {
  OpenWwDiplomacyEvent,
  WwDiplomacyTab,
} from "../../../src/client/hud/ww1936/WwDrawer";
import {
  SendDeclareWarIntentEvent,
  SendWwOrderIntentEvent,
} from "../../../src/client/Transport";
import { ID } from "./EconomyFixture";
import {
  fakePolGame,
  polDetail,
  PolOptions,
  polSummary,
  startFactions,
} from "./PoliticsFixture";

function mount(o: PolOptions = {}) {
  const { game } = fakePolGame(o);
  const bus = new EventBus();
  const sent: WwOrder[] = [];
  bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
  const el = document.createElement("ww-diplomacy-panel") as WwDiplomacyPanel;
  el.game = game as never;
  el.eventBus = bus;
  document.body.appendChild(el);
  el.init();
  const open = async (tab: WwDiplomacyTab) => {
    bus.emit(new OpenWwDiplomacyEvent(tab));
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

/** Germany leads the Axis (Italy) in 1936, at 500 PP. */
const axis = (o: PolOptions = {}): PolOptions => ({
  me: "DEU",
  polSummaries: [
    polSummary("DEU", { faction: 0, ruling: 2 }),
    polSummary("ITA", { faction: 0, ruling: 2 }),
    polSummary("GBR", { faction: 1, ruling: 0 }),
  ],
  polDetails: [polDetail("DEU")],
  global: { factions: startFactions() },
  ...o,
});

describe("<ww-diplomacy-panel> (P3 spec §21.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("factions: mine with its leader and members; expel and leave take two taps; invite lists the unaligned", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = mount(axis());
    await m.open("factions");
    const keys = [...m.el.querySelectorAll("[data-ww-faction]")].map((e) =>
      e.getAttribute("data-ww-faction"),
    );
    expect(keys).toEqual(["axis", "allies", "comintern"]);
    expect(
      m.q("[data-ww-faction='axis'] [data-ww-faction-leader]")!.textContent,
    ).toContain("[ww1936.diplo.faction.leader] country=[ww1936.country.DEU]");
    expect(m.q("[data-ww-faction='allies']")!.textContent).toContain(
      "[ww1936.diplo.faction.ideology] ideology=[ww1936.ideology.democratic]",
    );
    // I lead: no "ask to join" anywhere.
    expect(m.q("[data-ww-act='faction_request']")).toBeNull();
    const kick = "[data-ww-member='ITA'] [data-ww-act='faction_kick']";
    await m.click(kick);
    expect(m.sent).toEqual([]);
    vi.setSystemTime(10_500);
    await m.click(kick);
    expect(m.sent).toEqual([{ kind: "faction_kick", target: ID("ITA") }]);
    await m.click("[data-ww-invite-open]");
    const invite = [
      ...m.el.querySelectorAll<HTMLButtonElement>(
        "[data-ww-invite-list] [data-ww-act='faction_invite']",
      ),
    ];
    expect(invite.length).toBeGreaterThan(0);
    invite[0].click();
    expect(m.sent[1]).toMatchObject({ kind: "faction_invite" });
    expect(m.q("[data-ww-act='faction_dissolve']")).not.toBeNull();
  });

  it("factions: outside one a major may found one or ask to join (its leader receives it)", async () => {
    // Italy outside the Axis, under a democratic government.
    const factions = startFactions();
    factions[0].members = [ID("DEU")];
    const m = mount(
      axis({
        me: "ITA",
        polSummaries: [
          polSummary("ITA", { ruling: 0 }),
          polSummary("GBR", { faction: 1, ruling: 0 }),
          polSummary("DEU", { faction: 0, ruling: 2 }),
        ],
        polDetails: [polDetail("ITA")],
        global: { factions, wtBp: 4_500 },
      }),
    );
    await m.open("factions");
    expect(m.q("[data-ww-no-faction]")!.textContent).toContain(
      "[ww1936.diplo.faction.none]",
    );
    expect(m.q("[data-ww-act='faction_create']")!.textContent).toContain(
      "[ww1936.pol.pp_amount] pp=50",
    );
    // The fascist Axis won't have a democracy (spec §15.3): its reason shows.
    expect(
      m.q("[data-ww-faction='axis'] [data-ww-act-block]")!.textContent,
    ).toContain("[ww1936.econ.block.faction_rule]");
    await m.click("[data-ww-faction='allies'] [data-ww-act='faction_request']");
    expect(m.sent).toEqual([{ kind: "faction_request", target: ID("GBR") }]);
    document.body.innerHTML = "";
    // A minor founds none.
    const minor = mount(
      axis({
        me: "POL",
        polSummaries: [polSummary("POL")],
        polDetails: [polDetail("POL")],
        global: { factions: startFactions(), wtBp: 4_500 },
      }),
    );
    await minor.open("factions");
    expect(minor.q("[data-ww-act='faction_create']")).toBeNull();
  });

  it("wars: my wars, my goals, my justification and who justifies against me", async () => {
    const m = mount(
      axis({
        wars: [["DEU", "POL"]],
        polDetails: [
          polDetail("DEU", {
            warGoals: [{ on: ID("FRA"), type: "claim", untilDay: 200 }],
            justification: {
              on: ID("SUN"),
              type: "conquer",
              progressDays: 40,
              totalDays: 100,
              blocked: true,
            },
          }),
        ],
        global: {
          factions: startFactions(),
          justifying: [[ID("GBR"), ID("DEU"), 30]],
        },
      }),
    );
    await m.open("wars");
    expect(m.q("[data-ww-my-wars]")!.textContent).toContain(
      "[ww1936.country.POL]",
    );
    expect(m.q("[data-ww-goals]")!.textContent).toContain(
      "[ww1936.diplo.wars.goal_line] target=[ww1936.country.FRA],type=[ww1936.wargoal.claim],days=200",
    );
    expect(m.q("[data-ww-justifying]")!.textContent).toContain(
      "[ww1936.diplo.wars.justify_line] target=[ww1936.country.SUN],type=[ww1936.wargoal.conquer],done=40,total=100",
    );
    expect(m.q("[data-ww-justify-blocked]")).not.toBeNull();
    expect(m.q("[data-ww-against]")!.textContent).toContain(
      "[ww1936.diplo.wars.against_line] country=[ww1936.country.GBR],days=30",
    );
  });

  it("treaties: guarantees, pacts and access; ending one takes two taps", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = mount(
      axis({
        ticks: dayStartTick(10, 600),
        global: {
          factions: startFactions(),
          guarantees: [
            [ID("DEU"), ID("POL")],
            [ID("GBR"), ID("DEU")],
          ],
          naps: [
            [ID("DEU"), ID("POL"), 0, true],
            [ID("DEU"), ID("SUN"), 0, false],
          ],
          access: [[ID("POL"), ID("DEU")]],
        },
      }),
    );
    await m.open("treaties");
    expect(m.q("[data-ww-treaties='received']")!.textContent).toContain(
      "[ww1936.country.GBR]",
    );
    const naps = m.q("[data-ww-treaties='nap']")!;
    expect(naps.textContent).toContain("[ww1936.diplo.treaties.nap_start]");
    expect(naps.textContent).toContain(
      "[ww1936.diplo.treaties.nap_break_in] days=170",
    );
    await m.click("[data-ww-end='given']");
    expect(m.sent).toEqual([]);
    vi.setSystemTime(10_500);
    await m.click("[data-ww-end='given']");
    expect(m.sent).toEqual([{ kind: "guarantee_end", target: ID("POL") }]);
    expect(
      m.q("[data-ww-treaties='access_given'] [data-ww-end]"),
    ).not.toBeNull();
  });

  it("world: tension with its thresholds, the sources, the next beat and the news", async () => {
    const m = mount(
      axis({
        global: {
          factions: startFactions(),
          wtBp: 3_400,
          threat: [[ID("DEU"), 1_200]],
          nextBeatDay: 1339,
        },
        news: [
          { id: "news_anschluss", params: { countryTag: "DEU" } },
          { id: "news_munich", params: {} },
        ],
      }),
    );
    await m.open("world");
    expect(m.q("[data-ww-tension]")!.textContent).toBe("34%");
    expect(
      [...m.el.querySelectorAll("[data-ww-tick]")].map((t) =>
        t.getAttribute("data-ww-tick"),
      ),
    ).toEqual(["25", "40", "50", "80"]);
    expect(m.q("[data-ww-threats]")!.textContent).toContain("12%");
    expect(m.q("[data-ww-next]")!.textContent).toContain(
      "[ww1936.diplo.world.next_beat] date=[ww1936.date] year=1939",
    );
    const news = [...m.el.querySelectorAll("[data-ww-news-list] li")].map(
      (li) => li.textContent!.trim(),
    );
    // Newest first.
    expect(news[0]).toContain("[ww1936.news.news_munich]");
    expect(news[1]).toContain("[ww1936.news.news_anschluss]");
    expect(m.el.querySelectorAll("[data-ww-camp]").length).toBeGreaterThan(0);
  });

  it("world: the next beat goes on V-J Day (day 3,532), when the AI stops following history", async () => {
    const at = async (day: number) => {
      const m = mount(
        axis({
          ticks: dayStartTick(day, 600),
          global: { factions: startFactions(), nextBeatDay: 3540 },
        }),
      );
      await m.open("world");
      const next = m.q("[data-ww-next]")?.textContent ?? null;
      m.el.remove();
      return next;
    };
    expect(await at(3531)).toContain("[ww1936.diplo.world.next_beat]");
    expect(await at(3532)).toBeNull();
  });
});

describe("the player panel's diplomacy (P3 spec §21.5)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  function panel(o: PolOptions) {
    const { game, pol } = fakePolGame(o);
    const p = document.createElement("player-panel") as PlayerPanel;
    p.g = game as never;
    p.eventBus = new EventBus();
    const sent: unknown[] = [];
    p.eventBus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const declared: unknown[] = [];
    p.eventBus.on(SendDeclareWarIntentEvent, (e) => declared.push(e.target));
    const priv = p as unknown as {
      renderWwActions(other: unknown): unknown;
      requestUpdate(): void;
    };
    const div = document.createElement("div");
    document.body.appendChild(div);
    const draw = () =>
      render(
        priv.renderWwActions(game.playerBySmallID(ID("POL"))) as never,
        div,
      );
    draw();
    const act = (id: string) =>
      div.querySelector<HTMLButtonElement>(`[data-ww-act='${id}']`);
    return { p, div, draw, act, sent, declared, pol };
  }

  it("the action list: the country's line, a goal picker, requests, and blocks with one reason", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = panel({
      me: "DEU",
      polSummaries: [
        polSummary("DEU", { ruling: 2, ppMilli: 500_000 }),
        polSummary("POL", { ruling: 3, stabBp: 6_100, wsBp: 3_300 }),
      ],
      polDetails: [polDetail("DEU")],
      global: { wtBp: 1_000 },
    });
    expect(m.div.querySelector("[data-ww-info]")!.textContent).toContain(
      "[ww1936.diplo.info] ideology=[ww1936.ideology.neutral],leader=[ww1936.pol.none],stab=61,ws=33",
    );
    expect(m.div.querySelector("[data-ww-relations]")!.textContent).toContain(
      "[ww1936.diplo.relations] n=-10",
    );
    // A fascist government justifies at any tension: the goal picker.
    m.act("justify")!.click();
    m.draw();
    const conquer = m.div.querySelector<HTMLButtonElement>(
      "[data-ww-justify='conquer']",
    )!;
    expect(conquer.textContent).toContain(
      "[ww1936.diplo.act.justify_cost] type=[ww1936.wargoal.conquer],pp=50,days=100",
    );
    conquer.click();
    expect(m.sent).toEqual([
      { kind: "justify", target: ID("POL"), goal: "conquer", group: "" },
    ]);
    // A request goes in one tap; it says so once my PP shows it was spent
    // (the engine refuses silently).
    m.act("nap_offer")!.click();
    m.draw();
    expect(m.sent[1]).toEqual({ kind: "nap_offer", target: ID("POL") });
    expect(m.div.querySelector("[data-ww-sent]")).toBeNull();
    m.pol.apply(
      {
        countries: [polSummary("DEU", { ruling: 2, ppMilli: 475_000 })],
        details: [],
        global: null,
        regions: [],
        news: [],
        cards: [],
      },
      700,
    );
    m.draw();
    expect(m.div.querySelector("[data-ww-sent]")!.textContent).toContain(
      "[ww1936.diplo.act.sent]",
    );
    // Declaring war without a goal: the penalty is in the label; two taps.
    expect(m.act("declare")!.textContent).toContain(
      "[ww1936.diplo.act.declare_no_goal] tension=8",
    );
    m.act("declare")!.click();
    m.draw();
    vi.setSystemTime(10_500);
    m.act("declare")!.click();
    expect(m.declared).toHaveLength(1);
  });

  it("a pact blocks the war: breaking it (two taps) sits beside the reason", () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
    vi.setSystemTime(10_000);
    const m = panel({
      me: "DEU",
      polSummaries: [polSummary("DEU", { ruling: 2 }), polSummary("POL")],
      polDetails: [polDetail("DEU")],
      global: { naps: [[ID("DEU"), ID("POL"), 0, true]] },
    });
    const declare = m.act("declare")!;
    expect(declare.disabled).toBe(true);
    const box = declare.parentElement!.parentElement!;
    expect(box.textContent).toContain("[ww1936.declare.block.nap]");
    const brk = box.querySelector<HTMLButtonElement>(
      "[data-ww-act='nap_break']",
    )!;
    expect(brk.textContent).toContain("[ww1936.pol.pp_amount] pp=50");
    brk.click();
    expect(m.sent).toEqual([]);
    vi.setSystemTime(10_500);
    m.draw();
    m.act("nap_break")!.click();
    expect(m.sent).toEqual([{ kind: "nap_break", target: ID("POL") }]);
  });

  it("a democracy without a goal sees why it can't declare", () => {
    const m = panel({
      me: "DEU",
      polSummaries: [polSummary("DEU", { ruling: 0 }), polSummary("POL")],
      polDetails: [polDetail("DEU")],
    });
    const declare = m.act("declare")!;
    expect(declare.disabled).toBe(true);
    expect(
      declare.parentElement!.querySelector("[data-ww-act-block]")!.textContent,
    ).toContain("[ww1936.declare.block.democracy_no_goal]");
  });
});
