// World War 1936: white peace on the screens — the offer button of my war
// in the diplomacy drawer (scope, the brief's refusal reasons, waiting for
// the answer) and a human target's card (its countdown, two taps to send).
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
  WwPeaceOfferView,
  WwWarSummary,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  whitePeaceButton,
  whitePeaceCardModel,
  type WhitePeaceGame,
} from "../../../src/client/hud/ww1936/WhitePeaceModel";
import { TWO_TAP_MIN_MS } from "../../../src/client/hud/ww1936/WorldWarModel";
import "../../../src/client/hud/ww1936/WwWhitePeaceCard";
import type { WwWhitePeaceCard } from "../../../src/client/hud/ww1936/WwWhitePeaceCard";
import { SendWwOrderIntentEvent } from "../../../src/client/Transport";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";
import { ID } from "./EconomyFixture";
import { fakePolGame } from "./PoliticsFixture";

/** Day 100 (7.5 ticks a day after the preparation's 600). */
const DAY100 = 600 + 750;

/** Germany and Italy against Poland and France, begun on `startDay`. */
function war(startDay: number, kind: WwWarSummary["kind"] = "normal") {
  const m = (tag: "DEU" | "ITA" | "POL" | "FRA") => ({
    id: ID(tag),
    state: "active" as const,
    sharePm: 500,
  });
  return {
    id: 4,
    kind,
    startDay,
    sides: [
      { leader: ID("DEU"), members: [m("DEU"), m("ITA")] },
      { leader: ID("POL"), members: [m("POL"), m("FRA")] },
    ],
    ended: false,
  } satisfies WwWarSummary;
}

function game(
  me: "DEU" | "ITA" | "POL",
  eg: WwEndgameView,
  o: { ticks?: number; ppMilli?: number } = {},
): WhitePeaceGame {
  const { game } = fakePolGame({
    me,
    ticks: o.ticks ?? DAY100,
    politics: { ppMilli: o.ppMilli ?? 500_000 },
  });
  return { ...game, wwEndgame: () => eg } as unknown as WhitePeaceGame;
}

function offer(deadlineTick: number): WwPeaceOfferView {
  return {
    id: 7,
    war: 4,
    from: ID("DEU"),
    to: ID("POL"),
    whole: true,
    sentTick: deadlineTick - 300,
    deadlineTick,
    sides: [
      { id: ID("DEU"), capPm: 120, scorePm: 640 },
      { id: ID("POL"), capPm: 450, scorePm: 360 },
    ],
    held: [[ID("DEU"), ID("POL"), 350]],
  };
}

describe("the white peace button", () => {
  it("the side leader offers the whole war, a member a separate peace, to the other leader", () => {
    const eg = new WwEndgameView();
    const w = war(0);
    eg.apply({ news: [], wars: [w] });
    const lead = whitePeaceButton(game("DEU", eg), ID("DEU"), w)!;
    expect(lead).toMatchObject({
      whole: true,
      target: ID("POL"),
      block: null,
      pending: false,
      scope: "[ww1936.wpeace.scope_whole]",
      order: { kind: "peace_offer", war: 4, target: ID("POL") },
    });
    const member = whitePeaceButton(game("ITA", eg), ID("ITA"), w)!;
    expect(member.whole).toBe(false);
    expect(member.scope).toBe("[ww1936.wpeace.scope_separate]");
    expect(member.target).toBe(ID("POL"));
  });

  it("names why it is greyed: too early, the cooldown, political power, the war's kind", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war(20)] });
    const at = (o: Parameters<typeof game>[2] = {}, w = war(20)) =>
      whitePeaceButton(game("DEU", eg, o), ID("DEU"), w)!;
    expect(at().blockId).toBe("too_early");
    expect(at().block).toBe("[ww1936.wpeace.block.too_early] days=10,pp=25");
    expect(at({}, war(10)).blockId).toBeNull();
    eg.apply({ news: [], peaceCooldowns: [[ID("DEU"), ID("POL"), 130]] });
    expect(at({}, war(10)).block).toBe(
      "[ww1936.wpeace.block.cooldown] days=30,pp=25",
    );
    eg.apply({ news: [], peaceCooldowns: [] });
    expect(at({ ppMilli: 24_999 }, war(10)).blockId).toBe("no_pp");
    expect(at({}, war(10, "civil")).blockId).toBe("war_kind");
    expect(at({}, war(10, "independence")).blockId).toBe("war_kind");
  });

  it("waits for the answer while my offer stands", () => {
    const eg = new WwEndgameView();
    const w = war(0);
    eg.apply({ news: [], wars: [w], peaceOffers: [offer(DAY100 + 300)] });
    expect(whitePeaceButton(game("DEU", eg), ID("DEU"), w)!.pending).toBe(true);
    expect(whitePeaceButton(game("ITA", eg), ID("ITA"), w)!.pending).toBe(
      false,
    );
  });
});

describe("<ww-white-peace-card>", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("shows the offer to my country with its time, sides and occupation", () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war(0)], peaceOffers: [offer(DAY100 + 200)] });
    expect(whitePeaceCardModel(game("DEU", eg))).toBeNull();
    const c = whitePeaceCardModel(game("POL", eg))!;
    expect(c.id).toBe(7);
    expect(c.secondsLeft).toBe(20);
    expect(c.fraction).toBeCloseTo(2 / 3);
    expect(c.sides).toHaveLength(2);
    expect(c.sides[1].line).toContain("cap=45");
    expect(c.held).toHaveLength(1);
    expect(c.held[0]).toContain("pct=35");
    expect(c.scope).toContain("ww1936.wpeace.card_whole");
  });

  it("two taps on Accept send peace_reply", async () => {
    const eg = new WwEndgameView();
    eg.apply({ news: [], wars: [war(0)], peaceOffers: [offer(DAY100 + 200)] });
    const bus = new EventBus();
    const sent: unknown[] = [];
    bus.on(SendWwOrderIntentEvent, (e) => sent.push(e.order));
    const el = document.createElement(
      "ww-white-peace-card",
    ) as WwWhitePeaceCard;
    el.game = game("POL", eg) as never;
    el.eventBus = bus;
    document.body.appendChild(el);
    el.init();
    el.tick();
    await el.updateComplete;
    const layer = el.cardLayer()!;
    const accept = () =>
      layer.querySelector<HTMLButtonElement>(
        '[data-ww-wpeace-answer="accept"]',
      )!;
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    accept().click();
    await el.updateComplete;
    expect(sent).toEqual([]);
    expect(accept().dataset.armed).toBe("true");
    now += TWO_TAP_MIN_MS + 1;
    accept().click();
    await el.updateComplete;
    expect(sent).toEqual([{ kind: "peace_reply", offer: 7, accept: true }]);
    expect(accept().disabled).toBe(true);
  });
});
