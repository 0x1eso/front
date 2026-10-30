// World War 1936: negotiated peace (owner request "7번", 2026-10-30) — a
// peace offer with terms: regions ceded with their legal ownership,
// reparations for a year, subjects set free; the limits (capital, 40% of
// the victory points); the AI's judge (value against need) and its own
// terms; the human card; the whole war and a separate peace; lockstep
// across a snapshot. End map (ww1936end) with the end fixture.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_NEG_REPARATIONS_DAYS,
  WW_TRUCE_DAYS,
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
  WwPeaceTerms,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  AI_NEG_AIM_PCT,
  negPeaceChance,
  negPeaceRepK,
  noPeaceTerms,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Game } from "@openfront/engine/game/Game";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import {
  aiPeaceTerms,
  offerValue,
  peaceJudgeOf,
} from "@openfront/engine/ww1936/endgame/NegPeace";
import { makeSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import {
  aiAccepts,
  aiPeaceDay,
  aiWantsPeace,
  offerPeace,
  peaceOfferView,
  replyPeace,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import type {
  PeaceOffer,
  WwEndgame,
} from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  gameHash,
  HUMAN,
  order,
  step,
  stepTo,
  takeRegion,
  WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const id = (t: CountryTag) => endId(t);
const terms = (t: Partial<WwPeaceTerms>): WwPeaceTerms => ({
  ...noPeaceTerms(),
  ...t,
});
// The end map's regions (endFixture's scenario).
const [LYON, BERLIN, MUNICH, WARSAW, KRAKOW, PRAGUE] = [2, 3, 4, 6, 7, 14];
const [SUDETEN, KOSICE] = [13, 20];

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  return { runner, g, ww, eg: ww.endgame };
}

/** War `a` → `b` (a new record) made WW_WHITE_PEACE_MIN_DAYS old; both with political power. */
function oldWar(g: Game, ww: WorldWar, a: number, b: number): number {
  ww.setWar(a, b, g.ticks(), { kind: "declare" });
  const w = ww.endgame.warOfPair(a, b);
  ww.endgame.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
  for (const x of [a, b]) ww.politics.country(x)!.ppMilli = 100_000;
  return w;
}

function onlyOffer(eg: WwEndgame): PeaceOffer {
  expect(eg.peaceOffers).toHaveLength(1);
  return eg.peaceOffers[0];
}

/** Through day `day`'s common step (and every country's turn of it). */
function toDay(runner: GameRunner, day: number): void {
  stepTo(runner, dayStartTick(day, WW_PREP_TICKS) + 8);
}

/** Accepts among 200 offers like `o` (each its own seeded roll). */
function acceptsOf(eg: WwEndgame, o: PeaceOffer, day: number): number {
  let yes = 0;
  for (let i = 1; i <= 200; i++) {
    if (aiAccepts(eg, { ...o, id: 1000 + i }, day)) yes++;
  }
  return yes;
}

describe("World War 1936: negotiated peace", { timeout: 120_000 }, () => {
  it("ceded regions change their legal owner and control; everything else goes back", async () => {
    const { g, ww, eg } = await started();
    const pol = ww.politics;
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    takeRegion(g, KRAKOW, "DEU");
    takeRegion(g, WARSAW, "DEU");
    takeRegion(g, MUNICH, "POL");
    // Poland gives Germany Krakow (Germany holds it already); Germany
    // gives Poland Munich (Poland holds it). Warsaw is no term: it goes back.
    const t = terms({ give: [KRAKOW], take: [MUNICH] });
    expect(offerPeace(eg, pl, w, deu, g.ticks(), t)).toBeNull();
    const o = onlyOffer(eg);
    expect(o.terms).toEqual(t);
    expect(pol.country(pl)!.ppMilli).toBe(100_000 - WW_WHITE_PEACE_PP * 1000);
    expect(replyPeace(eg, deu, o.id, true, g.ticks())).toBeNull();
    expect(ww.isAtWar(deu, pl)).toBe(false);
    expect(pol.legalOwner[KRAKOW]).toBe(deu);
    expect(ww.land.controller[KRAKOW]).toBe(deu);
    expect(pol.legalOwner[MUNICH]).toBe(pl);
    expect(ww.land.controller[MUNICH]).toBe(pl);
    // Status quo ante for the rest.
    expect(ww.land.controller[WARSAW]).toBe(pl);
    expect(pol.legalOwner[WARSAW]).toBe(pl);
    // No core comes with a cession (as a conference take): the old owner
    // keeps its own, so resistance and integration go on there.
    expect(eg.hasCore(deu, KRAKOW)).toBe(false);
    expect(eg.hasCore(pl, KRAKOW)).toBe(true);
    // The armies go home: none of the giver's divisions stay on a ceded region.
    for (const [r, giver] of [
      [KRAKOW, pl],
      [MUNICH, deu],
    ]) {
      for (const row of ww.land.rowsIn(r)) {
        expect(ww.land.divisions.owner[row]).not.toBe(giver);
      }
    }
    expect(eg.war(w)!.ended?.winner).toBe(-1);
    const news = pol.takeData()?.news.map((n) => n.id) ?? [];
    expect(news).toContain("news_neg_peace");
    expect(news).not.toContain("news_white_peace");
  });

  it("reparations run for 365 days, then stop", async () => {
    const { runner, g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    ww.economy.country(pl)!.totals.civ = 20;
    // Germany demands 30% of Poland's factories.
    expect(
      offerPeace(eg, deu, w, pl, g.ticks(), terms({ demand: 3 })),
    ).toBeNull();
    const day = ww.day(g.ticks());
    replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
    const k = negPeaceRepK(20, 3);
    expect(k).toBe(6);
    expect(eg.reparations).toEqual([
      { from: pl, to: deu, k, untilDay: day + WW_NEG_REPARATIONS_DAYS },
    ]);
    expect(eg.econAdjust(pl).civOut).toBe(k);
    expect(eg.econAdjust(deu).civIn).toBe(k);
    // The view of the offer read the factories a day too.
    toDay(runner, day + WW_NEG_REPARATIONS_DAYS - 1);
    expect(eg.reparations).toHaveLength(1);
    toDay(runner, day + WW_NEG_REPARATIONS_DAYS);
    expect(eg.reparations).toEqual([]);
    expect(eg.econAdjust(pl).civOut).toBe(0);
  });

  it("refuses the capital, more than 40% of the victory points and terms the giver can't give", async () => {
    const { g, ww, eg } = await started();
    const pol = ww.politics;
    const [deu, pl, aut] = [id("DEU"), id("POL"), id("AUT")];
    const w = oldWar(g, ww, deu, pl);
    const offer = (from: number, to: number, t: Partial<WwPeaceTerms>) =>
      offerPeace(eg, from, w, to, g.ticks(), terms(t));
    expect(offer(pl, deu, { give: [WARSAW] })).toBe("peace_capital");
    expect(offer(pl, deu, { take: [BERLIN] })).toBe("peace_capital");
    // Not the giver's land.
    expect(offer(pl, deu, { give: [MUNICH] })).toBe("peace_bad_terms");
    expect(offer(pl, deu, { take: [KRAKOW] })).toBe("peace_bad_terms");
    // Each way once, no region twice, a level 0..3 one way only.
    expect(offer(pl, deu, { give: [KRAKOW, KRAKOW] })).toBe("peace_bad_terms");
    expect(offer(pl, deu, { pay: 1, demand: 1 })).toBe("peace_bad_terms");
    expect(offer(pl, deu, { pay: 4 })).toBe("peace_bad_terms");
    // Only a subject of one of the two is set free.
    expect(offer(pl, deu, { free: [aut] })).toBe("peace_bad_terms");
    // Poland owns Prague too: 39 victory points, 40% is 15.6.
    pol.setLegalOwner(PRAGUE, pl);
    expect(offer(pl, deu, { give: [KRAKOW, PRAGUE] })).toBe("peace_too_much");
    expect(eg.peaceOffers).toEqual([]);
    // Nothing was paid for a refused offer.
    expect(pol.country(pl)!.ppMilli).toBe(100_000);
    expect(offer(pl, deu, { give: [PRAGUE] })).toBeNull();
    expect(onlyOffer(eg).terms?.give).toEqual([PRAGUE]);
  });

  it("a subject set free is independent after the peace", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl, aut] = [id("DEU"), id("POL"), id("AUT")];
    const w = oldWar(g, ww, deu, pl);
    makeSubject(eg, aut, deu, "puppet", false, g.ticks());
    expect(eg.subjectOf(aut)?.overlord).toBe(deu);
    expect(
      offerPeace(eg, pl, w, deu, g.ticks(), terms({ free: [aut] })),
    ).toBeNull();
    replyPeace(eg, deu, onlyOffer(eg).id, true, g.ticks());
    expect(eg.subjectOf(aut)).toBeNull();
  });

  it("the AI weighs the terms' value against what the war says it needs", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    const rec = eg.war(w)!;
    const day = ww.day(g.ticks());
    const probe = (from: number, to: number, t: WwPeaceTerms): PeaceOffer => ({
      id: 1,
      war: w,
      from,
      to,
      whole: true,
      sentTick: g.ticks(),
      deadlineTick: g.ticks(),
      terms: t,
    });
    // An even war (nothing held, full war support): a white peace is a long
    // shot; Poland giving Krakow and 30% reparations buys a better chance.
    const white = probe(pl, deu, noPeaceTerms());
    const bought = probe(pl, deu, terms({ give: [KRAKOW], pay: 3 }));
    const j = peaceJudgeOf(eg, rec, pl, deu, true, day);
    const vBought = offerValue(eg, rec, bought);
    expect(vBought).toBeGreaterThan(0);
    const cWhite = negPeaceChance(j, 0);
    const cBought = negPeaceChance(j, vBought);
    expect(cBought).toBeGreaterThan(cWhite);
    // The seeded rolls follow the judge's chance.
    expect(Math.abs(acceptsOf(eg, white, day) / 2 - cWhite)).toBeLessThan(12);
    expect(Math.abs(acceptsOf(eg, bought, day) / 2 - cBought)).toBeLessThan(12);
    // Germany clearly winning (it holds all of Poland) needs a lot: the
    // most Poland may give is refused at every roll.
    takeRegion(g, WARSAW, "DEU");
    takeRegion(g, KRAKOW, "DEU");
    expect(acceptsOf(eg, white, day)).toBe(0);
    expect(acceptsOf(eg, bought, day)).toBe(0);
    // Germany losing (Poland holds Berlin and Munich, its war support
    // gone) takes peace even giving something up — less often the more
    // it gives.
    for (const r of [WARSAW, KRAKOW, BERLIN, MUNICH]) takeRegion(g, r, "POL");
    ww.politics.country(deu)!.wsBp = 0;
    const whiteYes = acceptsOf(eg, white, day);
    // 10% of its factories for a year; Munich (a third of its land's worth here).
    const giveSome = probe(pl, deu, terms({ demand: 1 }));
    const giveMore = probe(pl, deu, terms({ take: [MUNICH] }));
    expect(offerValue(eg, rec, giveSome)).toBeLessThan(0);
    expect(offerValue(eg, rec, giveMore)).toBeLessThan(
      offerValue(eg, rec, giveSome),
    );
    const someYes = acceptsOf(eg, giveSome, day);
    const moreYes = acceptsOf(eg, giveMore, day);
    expect(whiteYes).toBeGreaterThan(140);
    expect(someYes).toBeGreaterThan(0);
    expect(someYes).toBeLessThan(whiteYes);
    expect(moreYes).toBeLessThan(someYes);
  });

  it("the AI's own offer: the losing side gives what the other side holds", async () => {
    const { g, ww, eg } = await started();
    const [deu, csk] = [id("DEU"), id("CSK")];
    const w = oldWar(g, ww, deu, csk);
    const rec = eg.war(w)!;
    const day = ww.day(g.ticks());
    // Czechoslovakia losing badly: Germany holds the Sudetenland and
    // Kosice (over a quarter of its points), its war support is gone.
    // Germany, a little war-weary, would take a white peace now and then.
    takeRegion(g, SUDETEN, "DEU");
    takeRegion(g, KOSICE, "DEU");
    ww.politics.country(csk)!.wsBp = 0;
    ww.politics.country(deu)!.wsBp = 2000;
    expect(aiWantsPeace(eg, rec, csk, day)).toBe(true);
    const give = aiPeaceTerms(eg, rec, csk, deu, day);
    expect(give).not.toBeNull();
    expect(give!.take).toEqual([]);
    expect(give!.demand).toBe(0);
    expect(give!.give.length).toBeGreaterThan(0);
    // It gives only land Germany holds already.
    for (const r of give!.give) expect([SUDETEN, KOSICE]).toContain(r);
    // …which raises Germany's chance of taking it to the aim.
    const j = peaceJudgeOf(eg, rec, csk, deu, true, day);
    const o: PeaceOffer = {
      id: 1,
      war: w,
      from: csk,
      to: deu,
      whole: true,
      sentTick: 0,
      deadlineTick: 0,
      terms: give!,
    };
    expect(negPeaceChance(j, 0)).toBeLessThan(AI_NEG_AIM_PCT);
    expect(negPeaceChance(j, offerValue(eg, rec, o))).toBeGreaterThanOrEqual(
      AI_NEG_AIM_PCT,
    );
    // Its day sends it, with the political power paid.
    aiPeaceDay(eg, csk, day, g.ticks());
    expect(onlyOffer(eg).terms).toEqual(give);
    expect(ww.politics.country(csk)!.ppMilli).toBe(
      100_000 - WW_WHITE_PEACE_PP * 1000,
    );
    // Not losing, it gives nothing: a white peace.
    eg.peaceOffers = [];
    for (const r of [SUDETEN, KOSICE]) takeRegion(g, r, "CSK");
    ww.politics.country(csk)!.wsBp = 6000;
    expect(aiPeaceTerms(eg, rec, csk, deu, day)).toBeNull();
  });

  it("a whole-war offer with terms ends every pair and settles the terms", async () => {
    const { g, ww, eg } = await started();
    const pol = ww.politics;
    const [deu, ita, pl, fra] = [id("DEU"), id("ITA"), id("POL"), id("FRA")];
    const w = oldWar(g, ww, deu, pl);
    ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
    ww.setWar(ita, pl, g.ticks(), { kind: "into", warId: w });
    takeRegion(g, KRAKOW, "DEU");
    // Germany, leading its side, demands Krakow of Poland, leading the other.
    expect(
      offerPeace(eg, deu, w, pl, g.ticks(), terms({ take: [KRAKOW] })),
    ).toBeNull();
    const o = onlyOffer(eg);
    expect(o.whole).toBe(true);
    const v = peaceOfferView(eg, o);
    expect(v.terms).toEqual({
      ...terms({ take: [KRAKOW] }),
      payK: 0,
      demandK: 0,
    });
    replyPeace(eg, pl, o.id, true, g.ticks());
    for (const [a, b] of [
      [deu, pl],
      [fra, deu],
      [ita, pl],
    ]) {
      expect(ww.isAtWar(a, b)).toBe(false);
    }
    expect(eg.war(w)!.ended?.winner).toBe(-1);
    expect(pol.legalOwner[KRAKOW]).toBe(deu);
    expect(ww.land.controller[KRAKOW]).toBe(deu);
    const day = ww.day(g.ticks());
    expect(eg.truceUntil(ita, fra)).toBe(day + WW_TRUCE_DAYS);
  });

  it("a separate peace with terms: only the proposer leaves, and it pays", async () => {
    const { g, ww, eg } = await started();
    const pol = ww.politics;
    const [deu, ita, gbr, fra] = [id("DEU"), id("ITA"), id("GBR"), id("FRA")];
    const w = oldWar(g, ww, deu, gbr);
    ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
    ww.setWar(ita, gbr, g.ticks(), { kind: "into", warId: w });
    ww.setWar(ita, fra, g.ticks(), { kind: "into", warId: w });
    pol.country(ita)!.ppMilli = 100_000;
    ww.economy.country(ita)!.totals.civ = 10;
    expect(
      offerPeace(eg, ita, w, gbr, g.ticks(), terms({ pay: 2 })),
    ).toBeNull();
    const o = onlyOffer(eg);
    expect(o.whole).toBe(false);
    replyPeace(eg, gbr, o.id, true, g.ticks());
    expect(ww.isAtWar(ita, gbr)).toBe(false);
    expect(ww.isAtWar(ita, fra)).toBe(false);
    expect(ww.isAtWar(deu, gbr)).toBe(true);
    expect(eg.war(w)!.ended).toBeNull();
    expect(pol.factionIdx(ita)).toBe(-1);
    const day = ww.day(g.ticks());
    expect(eg.reparations).toEqual([
      {
        from: ita,
        to: gbr,
        k: negPeaceRepK(10, 2),
        untilDay: day + WW_NEG_REPARATIONS_DAYS,
      },
    ]);
  });

  it("a human target's card with terms refuses at its deadline", async () => {
    const { runner, g, ww, eg } = await started([
      { clientID: HUMAN, country: "FRA" },
    ]);
    const [deu, fra] = [id("DEU"), id("FRA")];
    const w = oldWar(g, ww, deu, fra);
    const tick = g.ticks();
    offerPeace(eg, deu, w, fra, tick, terms({ take: [LYON], demand: 1 }));
    const o = onlyOffer(eg);
    expect(o.deadlineTick).toBe(tick + WW_WHITE_PEACE_CARD_TICKS);
    // The card reads the terms.
    expect(peaceOfferView(eg, o).terms?.take).toEqual([LYON]);
    stepTo(runner, o.deadlineTick - 1);
    expect(eg.peaceOffers.map((x) => x.id)).toEqual([o.id]);
    stepTo(runner, o.deadlineTick + 1);
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, fra)).toBe(true);
    expect(ww.politics.legalOwner[LYON]).toBe(fra);
    expect(eg.reparations).toEqual([]);
    expect(eg.peaceCooldowns.some((c) => c[0] === deu && c[1] === fra)).toBe(
      true,
    );
  });

  it("a human sends terms by ww_order; the engine checks them", async () => {
    const humans = [
      { clientID: HUMAN, country: "POL" as const },
      { clientID: "HUMAN002", country: "DEU" as const },
    ];
    const { runner, g, ww, eg } = await started(humans);
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    // Germany can't give Poland's Krakow: refused, nothing pending.
    step(runner, 2, [
      order("HUMAN002", {
        kind: "peace_offer",
        war: w,
        target: pl,
        terms: terms({ give: [KRAKOW] }),
      }),
    ]);
    expect(eg.peaceOffers).toEqual([]);
    step(runner, 2, [
      order("HUMAN002", {
        kind: "peace_offer",
        war: w,
        target: pl,
        terms: terms({ give: [MUNICH], pay: 1 }),
      }),
    ]);
    const o = onlyOffer(eg);
    expect(o.terms).toEqual(terms({ give: [MUNICH], pay: 1 }));
    step(runner, 2, [
      order(HUMAN, { kind: "peace_reply", offer: o.id, accept: true }),
    ]);
    expect(ww.isAtWar(deu, pl)).toBe(false);
    expect(ww.politics.legalOwner[MUNICH]).toBe(pl);
    expect(eg.reparations.map((x) => [x.from, x.to])).toEqual([[deu, pl]]);
  });

  it("a snapshot with an offer with terms pending, and with reparations running, restores in lockstep", async () => {
    const humans = [{ clientID: HUMAN, country: "POL" as const }];
    const { runner, g, ww, eg } = await started(humans);
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    ww.economy.country(pl)!.totals.civ = 20;
    offerPeace(eg, deu, w, pl, g.ticks(), terms({ take: [KRAKOW], demand: 2 }));
    const o = onlyOffer(eg);
    step(runner);
    const copy = await wwRestore(runner, humans, END_MAP);
    const ceg = copy.game.worldWar()!.endgame;
    expect(ceg.peaceOffers).toEqual(eg.peaceOffers);
    expect(ceg.hash()).toBe(eg.hash());
    for (let i = 0; i < 12; i++) {
      const intents =
        i === 5
          ? [order(HUMAN, { kind: "peace_reply", offer: o.id, accept: true })]
          : [];
      step(runner, 1, intents);
      step(copy, 1, intents);
      expect(gameHash(copy)).toBe(gameHash(runner));
    }
    expect(eg.reparations).toHaveLength(1);
    expect(ww.politics.legalOwner[KRAKOW]).toBe(deu);
    // A second copy while the reparations run: still in lockstep.
    const again = await wwRestore(runner, humans, END_MAP);
    const aeg = again.game.worldWar()!.endgame;
    expect(aeg.reparations).toEqual(eg.reparations);
    for (let i = 0; i < 20; i++) {
      step(runner);
      step(again);
      expect(gameHash(again)).toBe(gameHash(runner));
    }
    expect(aeg.snapshot()).toEqual(eg.snapshot());
  });
});
