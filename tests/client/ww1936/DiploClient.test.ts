// World War 1936 diplomacy on the screens (ww161 Design B §6–§7; ww162
// lane L6): the endgame view's new lists, the country panel's rows with
// their reasons, the composer (a deal's columns and map taps, the
// ultimatum's pre-pick), the one answer card's queue and its answers, and
// the war card's separate peace buttons.
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params && Object.keys(params).length > 0
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import type {
  WwDealView,
  WwUltimatumView,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type {
  WwPeaceOfferView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { dealMapTap, dealUiOf } from "../../../src/client/hud/ww1936/DealUi";
import {
  dealChance,
  dealComposer,
  diploCardModel,
  diploRows,
  openDiploAct,
  separatePeaceButtons,
  ultimatumGate,
  ultimatumPrepick,
  type DiploGame,
} from "../../../src/client/hud/ww1936/DiploModel";
import { linePeaceMapSource } from "../../../src/client/hud/ww1936/LinePeaceModel";
import { TWO_TAP_MIN_MS } from "../../../src/client/hud/ww1936/WorldWarModel";
import { wwMapFlowActive } from "../../../src/client/hud/ww1936/WwPanelMode";
import "../../../src/client/hud/ww1936/WwWhitePeaceCard";
import type { WwWhitePeaceCard } from "../../../src/client/hud/ww1936/WwWhitePeaceCard";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID } from "./EconomyFixture";
import { fakePolGame } from "./PoliticsFixture";

/** Day 100 (7.5 ticks a day after the preparation's 600). */
const DAY100 = 600 + 750;
// The mini map's regions (Berlin and Warsaw are capitals).
const [BERLIN, MUNICH, WARSAW, KRAKOW] = [3, 4, 6, 7];
const FASCIST = 2;
const DEMOCRATIC = 0;

function game(
  me: "DEU" | "POL" | "ITA",
  eg: WwEndgameView,
  o: { ruling?: number; ppMilli?: number } = {},
): DiploGame {
  const { game } = fakePolGame({
    me,
    ticks: DAY100,
    politics: { ruling: o.ruling ?? 3, ppMilli: o.ppMilli ?? 500_000 },
  });
  return { ...game, wwEndgame: () => eg } as unknown as DiploGame;
}

/** Germany and Italy against Poland and France, 100 days old. */
function war(): WwWarSummary {
  const m = (tag: "DEU" | "ITA" | "POL" | "FRA") => ({
    id: ID(tag),
    state: "active" as const,
    sharePm: 500,
  });
  return {
    id: 4,
    kind: "normal",
    startDay: 0,
    sides: [
      { leader: ID("DEU"), members: [m("DEU"), m("ITA")] },
      { leader: ID("POL"), members: [m("POL"), m("FRA")] },
    ],
    ended: false,
  };
}

function deal(over: Partial<WwDealView> = {}): WwDealView {
  return {
    id: 9,
    from: ID("DEU"),
    to: ID("POL"),
    give: [{ kind: "nap" }],
    take: [{ kind: "region", region: KRAKOW }],
    sentTick: DAY100 - 100,
    deadlineTick: DAY100 + 200,
    ...over,
  };
}

function ultimatum(over: Partial<WwUltimatumView> = {}): WwUltimatumView {
  return {
    id: 11,
    from: ID("DEU"),
    to: ID("POL"),
    regions: [KRAKOW],
    vpPm: 125,
    sentTick: DAY100 - 50,
    deadlineTick: DAY100 + 250,
    ...over,
  };
}

function peace(id: number): WwPeaceOfferView {
  return {
    id,
    war: 4,
    from: ID("DEU"),
    to: ID("POL"),
    whole: true,
    sentTick: DAY100 - 100,
    deadlineTick: DAY100 + 200,
    sides: [
      { id: ID("DEU"), capPm: 120, scorePm: 640 },
      { id: ID("POL"), capPm: 450, scorePm: 360 },
    ],
    held: [],
    terms: null,
  };
}

describe("the endgame view's diplomacy lists", () => {
  it("keeps each list the engine sends and answers the pair questions", () => {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      deals: [deal()],
      ultimatums: [ultimatum()],
      diploCooldowns: [[ID("POL"), ID("DEU"), 140, 0]],
      dealJudge: [{ from: ID("POL"), to: ID("DEU"), margin: 7 }],
    });
    expect(eg.dealBetween(ID("POL"), ID("DEU"))?.id).toBe(9);
    expect(eg.dealsTo(ID("POL"))).toHaveLength(1);
    expect(eg.ultimatumsTo(ID("DEU"))).toHaveLength(0);
    expect(eg.diploCooldownUntil(ID("POL"), ID("DEU"), "deal_refused")).toBe(
      140,
    );
    expect(eg.diploCooldownUntil(ID("POL"), ID("DEU"), "ultimatum")).toBe(0);
    expect(eg.dealJudgeFor(ID("POL"), ID("DEU"))?.margin).toBe(7);
    // A later update without the list keeps it; an empty one clears it.
    eg.apply({ news: [] });
    expect(eg.deals).toHaveLength(1);
    eg.apply({ news: [], deals: [] });
    expect(eg.dealBetween(ID("POL"), ID("DEU"))).toBeNull();
  });
});

describe("the country panel's rows", () => {
  it("at peace: a deal and an ultimatum with Krakow pre-picked (the capital never)", () => {
    const eg = new WwEndgameView();
    const g = game("DEU", eg, { ruling: FASCIST });
    const rows = diploRows(g, ID("DEU"), ID("POL"));
    expect(rows.map((r) => r.id)).toEqual(["deal", "ultimatum"]);
    expect(rows.every((r) => r.block === null)).toBe(true);
    expect(ultimatumPrepick(g, ID("DEU"), ID("POL"))).toEqual([KRAKOW]);
    expect(rows[1].act).toMatchObject({
      kind: "compose",
      mode: "ultimatum",
      regions: [KRAKOW],
    });
  });

  it("names why a row is greyed: a democracy, a pending deal, the refusal wait, political power", () => {
    const eg = new WwEndgameView();
    const dem = diploRows(
      game("DEU", eg, { ruling: DEMOCRATIC }),
      ID("DEU"),
      ID("POL"),
    );
    expect(dem.find((r) => r.id === "ultimatum")?.block).toBe(
      "[ww1936.econ.block.ultimatum_gov]",
    );
    eg.apply({ news: [], deals: [deal()] });
    const pending = diploRows(game("DEU", eg), ID("DEU"), ID("POL"));
    expect(pending[0].block).toBe("[ww1936.econ.block.deal_pending]");
    eg.apply({
      news: [],
      deals: [],
      diploCooldowns: [[ID("DEU"), ID("POL"), 130, 0]],
    });
    expect(diploRows(game("DEU", eg), ID("DEU"), ID("POL"))[0].block).toBe(
      "[ww1936.econ.block.deal_cooldown]",
    );
    eg.apply({ news: [], diploCooldowns: [] });
    expect(
      diploRows(game("DEU", eg, { ppMilli: 5_000 }), ID("DEU"), ID("POL"))[0]
        .block,
    ).toBe("[ww1936.econ.block.no_pp]");
  });

  it("at war: no ultimatum to an enemy; the side leader gets 단독 강화 on an enemy member, a puppet greyed", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war()] });
    const g = game("DEU", eg, { ruling: FASCIST });
    const rows = diploRows(g, ID("DEU"), ID("FRA"));
    expect(rows.map((r) => r.id)).toEqual(["deal", "separate"]);
    expect(rows[1].act).toEqual({ kind: "peace", war: 4, target: ID("FRA") });
    // The enemy leader is the war row's whole-war offer, not a separate one.
    expect(diploRows(g, ID("DEU"), ID("POL")).map((r) => r.id)).toEqual([
      "deal",
    ]);
    // A member of my side never gets the buttons.
    expect(separatePeaceButtons(game("ITA", eg), ID("ITA"), war())).toEqual([]);
    eg.apply({
      news: [],
      subjects: [
        {
          subject: ID("FRA"),
          overlord: ID("POL"),
          level: "puppet",
        } as never,
      ],
    });
    const b = separatePeaceButtons(g, ID("DEU"), war());
    expect(b.map((x) => x.target)).toEqual([ID("FRA")]);
    expect(b[0].block).toBe("[ww1936.econ.block.peace_puppet]");
  });

  it("참전 약속 to a neutral: the deal pre-filled with the promise and the join-war item", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war()] });
    const rows = diploRows(game("POL", eg), ID("POL"), ID("SUN"));
    const p = rows.find((r) => r.id === "promise")!;
    expect(p.act).toMatchObject({
      kind: "compose",
      mode: "deal",
      to: ID("SUN"),
      take: [{ kind: "join_war", war: 4, target: ID("DEU") }],
    });
  });
});

describe("the composer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("a deal: map taps fill my and their column, the capital refused; the order and the chance", () => {
    const eg = new WwEndgameView();
    const g = game("POL", eg);
    openDiploAct(g, { kind: "compose", mode: "deal", to: ID("DEU") });
    const ui = dealUiOf(g);
    expect(wwMapFlowActive(g)).toBe(true);
    expect(linePeaceMapSource(g).key()).toMatch(/^deal:/);
    expect(dealComposer(g)!.block).toBe("[ww1936.econ.block.deal_empty]");
    expect(dealMapTap(g, KRAKOW)).toBe(true);
    expect(dealMapTap(g, MUNICH)).toBe(true);
    expect(dealMapTap(g, BERLIN)).toBe(true);
    expect(ui.note).toBe("[ww1936.econ.block.deal_bad_item]");
    expect(dealMapTap(g, WARSAW)).toBe(true);
    expect(ui.give).toEqual([{ kind: "region", region: KRAKOW }]);
    expect(ui.take).toEqual([{ kind: "region", region: MUNICH }]);
    ui.add("give", { kind: "nap" });
    const v = dealComposer(g)!;
    expect(v.block).toBeNull();
    expect(v.give.map((c) => c.text)).toEqual([
      "[ww1936.deal.item.region] region=Krakow",
      "[ww1936.deal.item.nap]",
    ]);
    expect(v.order).toEqual({
      kind: "deal_offer",
      to: ID("DEU"),
      give: [{ kind: "region", region: KRAKOW }, { kind: "nap" }],
      take: [{ kind: "region", region: MUNICH }],
    });
    expect(v.chancePct).not.toBeNull();
    // A second non-aggression pact is refused in the "+ 추가" list.
    ui.toggleAdding("take");
    expect(dealComposer(g)!.kinds.find((k) => k.kind === "nap")?.block).toBe(
      "[ww1936.deal.twice]",
    );
    ui.close();
    expect(dealMapTap(g, KRAKOW)).toBe(false);
  });

  it("an ultimatum: within six regions and 15% of the victory points, else the reason", () => {
    const eg = new WwEndgameView();
    const g = game("DEU", eg, { ruling: FASCIST });
    const row = diploRows(g, ID("DEU"), ID("POL")).find(
      (r) => r.id === "ultimatum",
    )!;
    openDiploAct(g, row.act);
    let v = dealComposer(g)!;
    expect(v.block).toBeNull();
    expect(v.order).toEqual({
      kind: "ultimatum",
      target: ID("POL"),
      regions: [KRAKOW],
    });
    // Warsaw is the capital: the tap is refused.
    dealMapTap(g, WARSAW);
    expect(dealUiOf(g).regions).toEqual([KRAKOW]);
    expect(dealUiOf(g).note).toBe("[ww1936.econ.block.ultimatum_bad_regions]");
    dealMapTap(g, KRAKOW);
    v = dealComposer(g)!;
    expect(v.order).toBeNull();
    expect(v.block).toBe("[ww1936.econ.block.ultimatum_bad_regions]");
    dealUiOf(g).close();
  });

  it("the composer sheet sends after two taps and closes", async () => {
    const eg = new WwEndgameView();
    const g = game("POL", eg);
    const bus = new EventBus();
    const sent: unknown[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = document.createElement(
      "ww-white-peace-card",
    ) as WwWhitePeaceCard;
    el.game = g as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    openDiploAct(g, {
      kind: "compose",
      mode: "deal",
      to: ID("DEU"),
      give: [{ kind: "access" }],
    });
    el.tick();
    await el.updateComplete;
    const send = () =>
      document.querySelector<HTMLButtonElement>('[data-ww-act="deal_send"]')!;
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    send().click();
    await el.updateComplete;
    expect(sent).toEqual([]);
    now += TWO_TAP_MIN_MS + 1;
    send().click();
    await el.updateComplete;
    expect(sent).toEqual([
      {
        kind: "deal_offer",
        to: ID("DEU"),
        give: [{ kind: "access" }],
        take: [],
      },
    ]);
    expect(dealUiOf(g).mode).toBeNull();
    expect(document.querySelector("[data-ww-deal]")).toBeNull();
  });
});

describe("the one answer card", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("queues peace offers, deals and ultimatums by id, oldest first", () => {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      wars: [war()],
      peaceOffers: [peace(12)],
      deals: [deal()],
      ultimatums: [ultimatum()],
    });
    const g = game("POL", eg);
    const c = diploCardModel(g)!;
    expect(c.kind).toBe("deal");
    expect(c.more).toBe(2);
    if (c.kind !== "deal") throw new Error("deal");
    expect(c.gives).toEqual(["[ww1936.deal.item.nap]"]);
    expect(c.wants).toEqual(["[ww1936.deal.item.region] region=Krakow"]);
    expect(c.counter).toEqual({
      give: [{ kind: "region", region: KRAKOW }],
      take: [{ kind: "nap" }],
    });
    eg.apply({ news: [], deals: [] });
    const u = diploCardModel(g)!;
    expect(u.kind).toBe("ultimatum");
    if (u.kind !== "ultimatum") throw new Error("ultimatum");
    expect(u.regions).toContain("pct=12");
    eg.apply({ news: [], ultimatums: [] });
    expect(diploCardModel(g)?.kind).toBe("peace");
    expect(diploCardModel(game("DEU", eg))).toBeNull();
  });

  it("a come-home offer to my exile says so", () => {
    const eg = new WwEndgameView();
    eg.apply({
      news: [],
      wars: [war()],
      peaceOffers: [{ ...peace(12), home: true }],
    });
    const c = diploCardModel(game("POL", eg))!;
    if (c.kind !== "peace") throw new Error("peace");
    expect(c.home).toBe(true);
    expect(c.peace.title).toContain("ww1936.deal.card_home");
  });

  it("two taps answer a deal with deal_reply; 역제안 refuses and opens the swapped composer", async () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], deals: [deal()] });
    const g = game("POL", eg);
    const bus = new EventBus();
    const sent: unknown[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = document.createElement(
      "ww-white-peace-card",
    ) as WwWhitePeaceCard;
    el.game = g as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const layer = el.cardLayer()!;
    expect(layer.querySelector("[data-ww-deal-card]")).not.toBeNull();
    const counter = () =>
      layer.querySelector<HTMLButtonElement>(
        '[data-ww-wpeace-answer="counter"]',
      )!;
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    counter().click();
    await el.updateComplete;
    now += TWO_TAP_MIN_MS + 1;
    counter().click();
    await el.updateComplete;
    expect(sent).toEqual([{ kind: "deal_reply", offer: 9, accept: false }]);
    const ui = dealUiOf(g);
    expect(ui.mode).toBe("deal");
    expect(ui.to).toBe(ID("DEU"));
    expect(ui.give).toEqual([{ kind: "region", region: KRAKOW }]);
    expect(ui.take).toEqual([{ kind: "nap" }]);
    ui.close();
  });
});

describe("the integration seams: one valuation, the engine's gates", () => {
  it("the chance bar values the deal with DiploRules and the engine's row", () => {
    const eg = new WwEndgameView();
    const g = game("POL", eg);
    const nap = { kind: "nap" as const };
    // A gift (nothing asked back, no pact): certain; a pact binds both, so
    // it is weighed against the margin.
    expect(
      dealChance(g, ID("POL"), ID("DEU"), [{ kind: "access" }], []).pct,
    ).toBe(100);
    expect(dealChance(g, ID("POL"), ID("DEU"), [nap], []).pct).toBe(50);
    // The row prices the pact: liked, the margin cleared; disliked, never.
    eg.apply({
      news: [],
      dealJudge: [{ from: ID("POL"), to: ID("DEU"), margin: 5, nap: 20 }],
    });
    expect(
      dealChance(g, ID("POL"), ID("DEU"), [nap], [{ kind: "access" }]).pct,
    ).toBe(100);
    eg.apply({
      news: [],
      dealJudge: [{ from: ID("POL"), to: ID("DEU"), margin: 5, nap: -20 }],
    });
    expect(
      dealChance(g, ID("POL"), ID("DEU"), [nap], [{ kind: "access" }]).pct,
    ).toBe(0);
    // Joining my war: a veto unless the row names the war.
    const join = { kind: "join_war" as const, war: 4, target: ID("ITA") };
    eg.apply({
      news: [],
      dealJudge: [
        { from: ID("POL"), to: ID("DEU"), margin: 0, nap: 20, joinWars: [] },
      ],
    });
    expect(dealChance(g, ID("POL"), ID("DEU"), [nap], [join]).pct).toBe(0);
    eg.apply({
      news: [],
      dealJudge: [
        { from: ID("POL"), to: ID("DEU"), margin: 0, nap: 20, joinWars: [4] },
      ],
    });
    expect(dealChance(g, ID("POL"), ID("DEU"), [nap], [join]).pct).toBe(100);
  });

  it("the ultimatum row: not to my overlord or subject, not to or from an exile", () => {
    const eg = new WwEndgameView();
    const g = game("DEU", eg, { ruling: FASCIST });
    const ult = () =>
      diploRows(g, ID("DEU"), ID("POL")).find((r) => r.id === "ultimatum")
        ?.block;
    expect(ult()).toBeNull();
    eg.apply({
      news: [],
      subjects: [
        { subject: ID("POL"), overlord: ID("DEU"), level: "puppet" } as never,
      ],
    });
    expect(ult()).toBe("[ww1936.econ.block.ultimatum_relation]");
    eg.apply({
      news: [],
      subjects: [],
      exiles: [{ smallID: ID("POL"), host: ID("FRA") } as never],
    });
    expect(ultimatumGate(g, ID("DEU"), ID("POL"))).toBe("bad_target");
    eg.apply({
      news: [],
      exiles: [{ smallID: ID("DEU"), host: ID("ITA") } as never],
    });
    expect(ultimatumGate(g, ID("DEU"), ID("POL"))).toBe("dead");
  });

  it("a join-war item in the + list is greyed by the government's tension gate (PromiseRules)", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war()] });
    const g = game("POL", eg);
    openDiploAct(g, { kind: "compose", mode: "deal", to: ID("SUN") });
    dealUiOf(g).toggleAdding("take");
    // SUN's government in the fixture is not fascist or communist and world tension is low.
    const k = dealComposer(g)!.kinds.find((x) => x.kind === "join_war")!;
    expect(k.block).toBe("[ww1936.econ.block.tension_gate]");
    dealUiOf(g).close();
  });
});
