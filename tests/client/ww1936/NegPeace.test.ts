// World War 1936: negotiated peace on the screens — the composer under my
// war's row (terms each way, the engine-lib checks, the live chance they
// accept), the map pick mode (taps, the regions it draws, the panel
// stepping aside) and the target card's terms lines.
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
  WwPeaceOfferView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { html, render } from "lit";
import {
  negPeaceComposer,
  negPeaceMapRegions,
  negPeaceMapTap,
  negPeaceUiOf,
  wwPeaceMapSource,
  type NegPeaceGame,
} from "../../../src/client/hud/ww1936/NegPeaceModel";
import { whitePeaceCardModel } from "../../../src/client/hud/ww1936/WhitePeaceModel";
import { negPeaceComposerTemplate } from "../../../src/client/hud/ww1936/WwNegPeaceComposer";
import { wwMapFlowActive } from "../../../src/client/hud/ww1936/WwPanelMode";
import {
  PEACE_FREE,
  PEACE_MINE,
  PEACE_SELECTED,
} from "../../../src/client/render/gl/passes/PeaceMapPass";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID } from "./EconomyFixture";
import { fakePolGame } from "./PoliticsFixture";

/** Day 100 (7.5 ticks a day after the preparation's 600). */
const DAY100 = 600 + 750;
// The mini map's regions.
const [BERLIN, MUNICH, WARSAW, KRAKOW] = [3, 4, 6, 7];

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

function game(me: "DEU" | "POL", eg: WwEndgameView): NegPeaceGame {
  const { game } = fakePolGame({ me, ticks: DAY100 });
  return { ...game, wwEndgame: () => eg } as unknown as NegPeaceGame;
}

/** Poland composing an offer to Germany (the AI's judge facts sent by the engine). */
function polandComposing(judge = { pct: 20, unit: 100, winNeed: 0 }) {
  const eg = new WwEndgameView();
  const w = war();
  eg.apply({
    news: [],
    wars: [w],
    peaceJudge: [{ war: 4, from: ID("POL"), to: ID("DEU"), ...judge }],
  });
  const g = game("POL", eg);
  const ui = negPeaceUiOf(g);
  ui.open(4, ID("DEU"));
  return { eg, w, g, ui };
}

describe("the negotiated peace composer", () => {
  it("with no terms it is a white peace", () => {
    const { w, g } = polandComposing();
    const v = negPeaceComposer(g, ID("POL"), w)!;
    expect(v.white).toBe("[ww1936.npeace.white]");
    expect(v.block).toBeNull();
    expect(v.order).toEqual({ kind: "peace_offer", war: 4, target: ID("DEU") });
    // Another war's row has no composer.
    expect(negPeaceComposer(g, ID("POL"), { ...w, id: 5 })).toBeNull();
  });

  it("map taps add my regions to what I give and theirs to what I demand, refusing a capital", () => {
    const { w, g, ui } = polandComposing();
    ui.openMap();
    expect(wwMapFlowActive(g)).toBe(true);
    expect(negPeaceMapTap(g, KRAKOW)).toBe(true);
    expect(negPeaceMapTap(g, MUNICH)).toBe(true);
    expect(negPeaceMapTap(g, WARSAW)).toBe(true);
    expect(ui.note).toBe("[ww1936.econ.block.peace_capital]");
    expect(negPeaceMapTap(g, BERLIN)).toBe(true);
    expect(ui.give).toEqual([KRAKOW]);
    expect(ui.take).toEqual([MUNICH]);
    // The map: Poland's and Germany's land, the picked ones marked.
    const regions = negPeaceMapRegions(g);
    const at = (r: number) => regions.find((x) => x.region === r)!.state;
    expect(at(KRAKOW)).toBe(PEACE_MINE);
    expect(at(MUNICH)).toBe(PEACE_MINE);
    expect(at(WARSAW)).toBe(PEACE_FREE);
    expect(at(BERLIN)).toBe(PEACE_FREE | PEACE_SELECTED);
    expect(regions.some((x) => x.region === 1)).toBe(false);
    expect(wwPeaceMapSource(g).key()).toMatch(/^neg:/);
    // A second tap takes it out again.
    negPeaceMapTap(g, KRAKOW);
    expect(ui.give).toEqual([]);
    negPeaceMapTap(g, KRAKOW);
    ui.closeMap();
    expect(wwMapFlowActive(g)).toBe(false);
    expect(negPeaceMapTap(g, KRAKOW)).toBe(false);
    const v = negPeaceComposer(g, ID("POL"), w)!;
    expect(v.give.map((r) => r.region)).toEqual([KRAKOW]);
    expect(v.take.map((r) => r.region)).toEqual([MUNICH]);
    expect(v.white).toBeNull();
    expect(v.vpLines).toHaveLength(2);
    expect(v.vpLines[0]).toContain("pct=12");
    expect(v.order).toEqual({
      kind: "peace_offer",
      war: 4,
      target: ID("DEU"),
      terms: { give: [KRAKOW], take: [MUNICH], pay: 0, demand: 0, free: [] },
    });
  });

  it("reparations go one way only", () => {
    const { w, g, ui } = polandComposing();
    ui.setPay(2);
    ui.setDemand(1);
    expect([ui.pay, ui.demand]).toEqual([0, 1]);
    ui.setPay(3);
    expect([ui.pay, ui.demand]).toEqual([3, 0]);
    const v = negPeaceComposer(g, ID("POL"), w)!;
    expect(v.payLines).toHaveLength(4);
    expect(v.payLines[3]).toContain("pct=30");
  });

  it("the hint is the engine-lib judge on my terms; a human target decides alone", () => {
    const { eg, w, g, ui } = polandComposing({
      pct: 20,
      unit: 100,
      winNeed: 0,
    });
    // A white peace: 20%.
    expect(negPeaceComposer(g, ID("POL"), w)!.hintLevel).toBe("low");
    // Krakow (base 14) at 0.1 a percent: +140%.
    ui.openMap();
    negPeaceMapTap(g, KRAKOW);
    const v = negPeaceComposer(g, ID("POL"), w)!;
    expect(v.hintLevel).toBe("high");
    expect(v.hint).toBe(
      "[ww1936.npeace.chance] level=[ww1936.npeace.chance_high]",
    );
    // Germany played by a human: no guess.
    eg.apply({ news: [], controllers: [["HUMAN002", ID("DEU")]] });
    const h = negPeaceComposer(g, ID("POL"), w)!;
    expect(h.hintLevel).toBeNull();
    expect(h.hint).toBe("[ww1936.npeace.chance_human]");
  });

  it("renders its buttons and hands their taps over", () => {
    const { w, g, ui } = polandComposing();
    ui.setDemand(1);
    const v = negPeaceComposer(g, ID("POL"), w)!;
    const calls: string[] = [];
    const host = document.createElement("div");
    render(
      html`${negPeaceComposerTemplate(v, {
        armed: false,
        pick: () => calls.push("pick"),
        remove: (r) => calls.push(`remove:${r}`),
        pay: (lv) => calls.push(`pay:${lv}`),
        demand: (lv) => calls.push(`demand:${lv}`),
        free: (id) => calls.push(`free:${id}`),
        send: () => calls.push("send"),
        cancel: () => calls.push("cancel"),
      })}`,
      host,
    );
    const q = (sel: string) => host.querySelector<HTMLButtonElement>(sel)!;
    expect(q('[data-ww-npeace-level="demand:1"]').dataset.on).toBe("true");
    q('[data-ww-npeace-level="pay:2"]').click();
    q('[data-ww-act="npeace_pick"]').click();
    q('[data-ww-act="peace_offer"]').click();
    q('[data-ww-act="npeace_cancel"]').click();
    expect(calls).toEqual(["pay:2", "pick", "send", "cancel"]);
    expect(host.querySelector("[data-ww-npeace-hint]")).not.toBeNull();
  });
});

describe("the target's card with terms", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("lists the terms under a 'peace with terms' title", () => {
    const eg = new WwEndgameView();
    const o: WwPeaceOfferView = {
      id: 7,
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
      terms: {
        give: [],
        take: [KRAKOW],
        pay: 0,
        demand: 2,
        free: [],
        payK: 0,
        demandK: 3,
      },
    };
    eg.apply({ news: [], wars: [war()], peaceOffers: [o] });
    const c = whitePeaceCardModel(game("POL", eg))!;
    expect(c.title).toContain("ww1936.wpeace.card_title_terms");
    expect(c.terms).toHaveLength(2);
    expect(c.terms[0]).toContain("ww1936.wpeace.card_cedes");
    expect(c.terms[1]).toContain("ww1936.wpeace.card_pays");
    expect(c.terms[1]).toContain("pct=20");
    expect(c.terms[1]).toContain("k=3");
    expect(c.terms[1]).toContain("days=365");
    // A white peace lists none.
    eg.apply({ news: [], peaceOffers: [{ ...o, terms: null }] });
    const white = whitePeaceCardModel(game("POL", eg))!;
    expect(white.terms).toEqual([]);
    expect(white.title).toContain("ww1936.wpeace.card_title]");
  });
});
