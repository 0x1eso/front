// World War 1936: white peace (owner-approved plan, 2026-10-30) — offers,
// the whole war or a separate peace, the AI's answer, the human card, the
// truce, the cooldown, and lockstep across a snapshot. End map
// (ww1936end) with the end fixture.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_TRUCE_DAYS,
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_COOLDOWN_DAYS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Game, Player } from "@openfront/engine/game/Game";
import { declareWarBlock } from "@openfront/engine/ww1936/Diplomacy";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { formExile } from "@openfront/engine/ww1936/endgame/Exile";
import { makeSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import {
  AI_PEACE_MAX_PCT,
  aiAcceptPct,
  aiAccepts,
  aiPeaceDay,
  aiWantsPeace,
  offerPeace,
  peaceOfferBlock,
  peaceOfferView,
  replyPeace,
  stepPeaceOffers,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
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

const asPlayer = (g: Game, smallID: number): Player => {
  const p = g.playerBySmallID(smallID);
  if (!p.isPlayer()) throw new Error(`no player ${smallID}`);
  return p;
};

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

/** Through the next day's common step (and every country's turn of it). */
function nextDay(runner: GameRunner): void {
  const ww = runner.game.worldWar()!;
  const day = ww.day(runner.game.ticks());
  stepTo(runner, dayStartTick(day + 1, WW_PREP_TICKS) + 8);
}

function onlyOffer(eg: WwEndgame) {
  expect(eg.peaceOffers).toHaveLength(1);
  return eg.peaceOffers[0];
}

describe("World War 1936: white peace", { timeout: 60_000 }, () => {
  it("a side leader's white peace ends every pair of the war, with no conference", async () => {
    const { g, ww, eg } = await started();
    const [deu, ita, pl, fra] = [id("DEU"), id("ITA"), id("POL"), id("FRA")];
    const w = oldWar(g, ww, deu, pl);
    ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
    ww.setWar(ita, pl, g.ticks(), { kind: "into", warId: w });
    expect(eg.warOfPair(fra, deu)).toBe(w);
    expect(eg.warOfPair(ita, pl)).toBe(w);
    takeRegion(g, 7, "DEU");
    expect(ww.land.controller[7]).toBe(deu);
    const confs = eg.conferences.length;
    const day = ww.day(g.ticks());
    expect(offerPeace(eg, deu, w, pl, g.ticks())).toBeNull();
    const o = onlyOffer(eg);
    expect(o.whole).toBe(true);
    // The political power goes when the offer is sent.
    expect(ww.politics.country(deu)!.ppMilli).toBe(
      100_000 - WW_WHITE_PEACE_PP * 1000,
    );
    expect(replyPeace(eg, pl, o.id, true, g.ticks())).toBeNull();
    expect(eg.peaceOffers).toEqual([]);
    for (const [a, b] of [
      [deu, pl],
      [fra, deu],
      [ita, pl],
    ]) {
      expect(ww.isAtWar(a, b)).toBe(false);
    }
    const rec = eg.war(w)!;
    expect(rec.ended).toEqual({ day, winner: -1 });
    expect(eg.conferences.length).toBe(confs);
    // P3 end_war: the occupied Krakow goes back to Poland.
    expect(ww.land.controller[7]).toBe(pl);
    // A truce for every cross pair.
    for (const [a, b] of [
      [deu, pl],
      [deu, fra],
      [ita, pl],
      [ita, fra],
    ]) {
      expect(eg.truceUntil(a, b)).toBe(day + WW_TRUCE_DAYS);
    }
    expect(eg.truceUntil(deu, ita)).toBe(0);
    // Everyone hears of it.
    expect(
      ww.politics.takeData()?.news.some((n) => n.id === "news_white_peace"),
    ).toBe(true);
  });

  it("an ordinary member's separate peace takes only it out of the war and out of its faction", async () => {
    const { g, ww, eg } = await started();
    const pol = ww.politics;
    const [deu, ita, gbr, fra] = [id("DEU"), id("ITA"), id("GBR"), id("FRA")];
    expect(pol.sameFaction(deu, ita)).toBe(true);
    const w = oldWar(g, ww, deu, gbr);
    ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
    ww.setWar(ita, gbr, g.ticks(), { kind: "into", warId: w });
    ww.setWar(ita, fra, g.ticks(), { kind: "into", warId: w });
    pol.country(ita)!.ppMilli = 100_000;
    const rec = eg.war(w)!;
    expect(rec.sides[0].leader).toBe(deu);
    expect(rec.sides[1].leader).toBe(gbr);
    // Italy is no leader: a separate peace, offered to Britain.
    expect(peaceOfferBlock(eg, ita, w, fra, ww.day(g.ticks()))).toBe(
      "bad_target",
    );
    expect(offerPeace(eg, ita, w, gbr, g.ticks())).toBeNull();
    const o = onlyOffer(eg);
    expect(o.whole).toBe(false);
    replyPeace(eg, gbr, o.id, true, g.ticks());
    expect(ww.isAtWar(ita, gbr)).toBe(false);
    expect(ww.isAtWar(ita, fra)).toBe(false);
    expect(ww.isAtWar(deu, gbr)).toBe(true);
    expect(ww.isAtWar(deu, fra)).toBe(true);
    expect(rec.ended).toBeNull();
    expect(eg.member(rec, ita)!.state).toBe("left");
    expect(eg.member(rec, deu)!.state).toBe("active");
    expect(pol.factionIdx(ita)).toBe(-1);
    expect(pol.factionIdx(deu)).toBeGreaterThanOrEqual(0);
    const day = ww.day(g.ticks());
    expect(eg.truceUntil(ita, gbr)).toBe(day + WW_TRUCE_DAYS);
    expect(eg.truceUntil(ita, fra)).toBe(day + WW_TRUCE_DAYS);
    expect(eg.truceUntil(deu, gbr)).toBe(0);
  });

  it("a puppet offers nothing; its overlord's separate peace takes it along", async () => {
    const { g, ww, eg } = await started();
    const [deu, ita, aut, gbr] = [id("DEU"), id("ITA"), id("AUT"), id("GBR")];
    const w = oldWar(g, ww, deu, gbr);
    ww.setWar(ita, gbr, g.ticks(), { kind: "into", warId: w });
    makeSubject(eg, aut, ita, "puppet", false, g.ticks());
    if (!ww.isAtWar(aut, gbr)) {
      ww.setWar(aut, gbr, g.ticks(), { kind: "into", warId: w });
    }
    ww.politics.country(aut)!.ppMilli = 100_000;
    ww.politics.country(ita)!.ppMilli = 100_000;
    const day = ww.day(g.ticks());
    expect(peaceOfferBlock(eg, aut, w, gbr, day)).toBe("subject_restricted");
    expect(offerPeace(eg, ita, w, gbr, g.ticks())).toBeNull();
    replyPeace(eg, gbr, onlyOffer(eg).id, true, g.ticks());
    expect(ww.isAtWar(ita, gbr)).toBe(false);
    expect(ww.isAtWar(aut, gbr)).toBe(false);
    expect(ww.isAtWar(deu, gbr)).toBe(true);
  });

  it("the truce refuses a new declaration for a year", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    offerPeace(eg, deu, w, pl, g.ticks());
    replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
    const day = ww.day(g.ticks());
    const at = (d: number) => dayStartTick(d, WW_PREP_TICKS);
    const [D, P] = [asPlayer(g, deu), asPlayer(g, pl)];
    expect(declareWarBlock(g, ww, D, P, g.ticks())).toBe("truce_active");
    expect(declareWarBlock(g, ww, P, D, g.ticks(), true)).toBe("truce_active");
    expect(declareWarBlock(g, ww, D, P, at(day + WW_TRUCE_DAYS - 1))).toBe(
      "truce_active",
    );
    expect(declareWarBlock(g, ww, D, P, at(day + WW_TRUCE_DAYS))).not.toBe(
      "truce_active",
    );
  });

  it("a refusal keeps the proposer from the same target for 60 days", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    const day = ww.day(g.ticks());
    offerPeace(eg, deu, w, pl, g.ticks());
    expect(peaceOfferBlock(eg, deu, w, pl, day)).toBe("peace_pending");
    replyPeace(eg, pl, onlyOffer(eg).id, false, g.ticks());
    expect(ww.isAtWar(deu, pl)).toBe(true);
    expect(eg.peaceCooldowns).toEqual([
      [deu, pl, day + WW_WHITE_PEACE_COOLDOWN_DAYS],
    ]);
    expect(peaceOfferBlock(eg, deu, w, pl, day)).toBe("peace_cooldown");
    expect(
      peaceOfferBlock(eg, deu, w, pl, day + WW_WHITE_PEACE_COOLDOWN_DAYS - 1),
    ).toBe("peace_cooldown");
    expect(
      peaceOfferBlock(eg, deu, w, pl, day + WW_WHITE_PEACE_COOLDOWN_DAYS),
    ).toBeNull();
    // Poland may still offer Germany.
    expect(peaceOfferBlock(eg, pl, w, deu, day)).toBeNull();
  });

  it("refuses a war under 90 days, without the political power, and civil or independence wars", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl, fra, gbr, ltu, est] = (
      ["DEU", "POL", "FRA", "GBR", "LTU", "EST"] as const
    ).map(id);
    const w = oldWar(g, ww, deu, pl);
    const day = ww.day(g.ticks());
    eg.war(w)!.startDay = day - WW_WHITE_PEACE_MIN_DAYS + 1;
    expect(peaceOfferBlock(eg, deu, w, pl, day)).toBe("peace_too_early");
    expect(offerPeace(eg, deu, w, pl, g.ticks())).toBe("peace_too_early");
    expect(peaceOfferBlock(eg, deu, w, pl, day + 1)).toBeNull();
    eg.war(w)!.startDay = day - WW_WHITE_PEACE_MIN_DAYS;
    ww.politics.country(deu)!.ppMilli = WW_WHITE_PEACE_PP * 1000 - 1;
    expect(offerPeace(eg, deu, w, pl, g.ticks())).toBe("no_pp");
    expect(eg.peaceOffers).toEqual([]);
    ww.politics.country(deu)!.ppMilli = WW_WHITE_PEACE_PP * 1000;
    expect(offerPeace(eg, deu, w, pl, g.ticks())).toBeNull();
    expect(ww.politics.country(deu)!.ppMilli).toBe(0);
    for (const [a, b, kind] of [
      [fra, gbr, "civil"],
      [ltu, est, "independence"],
    ] as const) {
      ww.setWar(a, b, g.ticks(), { kind: "declare", war: kind });
      const cw = eg.warOfPair(a, b);
      expect(eg.war(cw)!.kind).toBe(kind);
      eg.war(cw)!.startDay = day - 400;
      ww.politics.country(a)!.ppMilli = 100_000;
      expect(peaceOfferBlock(eg, a, cw, b, day)).toBe("peace_war_kind");
    }
  });

  it("the AI refuses when its side is clearly winning and may accept when losing", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    const day = ww.day(g.ticks());
    // Germany holds all of Poland: Poland's offer is refused outright.
    takeRegion(g, 6, "DEU");
    takeRegion(g, 7, "DEU");
    offerPeace(eg, pl, w, deu, g.ticks());
    const o = onlyOffer(eg);
    expect(aiAcceptPct(eg, o, day)).toBe(0);
    expect(aiAccepts(eg, o, day)).toBe(false);
    stepPeaceOffers(eg, g.ticks());
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, pl)).toBe(true);
    expect(eg.peaceCooldowns).toEqual([
      [pl, deu, day + WW_WHITE_PEACE_COOLDOWN_DAYS],
    ]);
    // Now Poland holds Berlin and Germany's war support is gone: Germany,
    // losing, takes it at the highest chance — a seeded roll per offer.
    takeRegion(g, 6, "POL");
    takeRegion(g, 7, "POL");
    takeRegion(g, 3, "POL");
    ww.politics.country(deu)!.wsBp = 0;
    const probe = { ...o, id: 1, from: pl, to: deu };
    expect(aiAcceptPct(eg, probe, day)).toBe(AI_PEACE_MAX_PCT);
    let yes = 0;
    for (let i = 1; i <= 200; i++) {
      if (aiAccepts(eg, { ...probe, id: i }, day)) yes++;
    }
    expect(yes).toBeGreaterThan(140);
    expect(yes).toBeLessThan(200);
    // Germany offers instead (no cooldown on that pair): Poland, winning, refuses.
    offerPeace(eg, deu, w, pl, g.ticks());
    expect(aiAcceptPct(eg, onlyOffer(eg), day)).toBe(0);
  });

  it("the AI answers on the next tick as its roll says", async () => {
    const { runner, g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    takeRegion(g, 3, "POL");
    ww.politics.country(deu)!.wsBp = 0;
    offerPeace(eg, pl, w, deu, g.ticks());
    const o = onlyOffer(eg);
    const yes = aiAccepts(eg, o, ww.day(g.ticks()));
    step(runner);
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, pl)).toBe(!yes);
  });

  it("the AI offers only after 90 days, on a long stalemate or when losing badly", async () => {
    const { g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    const day = ww.day(g.ticks());
    const rec = eg.war(w)!;
    // A front unchanged since the war began, 90 days ago: no stalemate yet.
    eg.fronts = [[w, 0, 0, rec.startDay]];
    expect(aiWantsPeace(eg, rec, deu, day)).toBe(false);
    // 180 days of it, neither side ahead.
    rec.startDay = day - 200;
    eg.fronts = [[w, 0, 0, day - 180]];
    expect(aiWantsPeace(eg, rec, deu, day)).toBe(true);
    // Too young a war: no offer however stalemated.
    rec.startDay = day - WW_WHITE_PEACE_MIN_DAYS + 1;
    aiPeaceDay(eg, deu, day, g.ticks());
    expect(eg.peaceOffers).toEqual([]);
    rec.startDay = day - 200;
    aiPeaceDay(eg, deu, day, g.ticks());
    expect(onlyOffer(eg).from).toBe(deu);
    expect(onlyOffer(eg).to).toBe(pl);
    eg.peaceOffers = [];
    // Germany holding Krakow is ahead: no stalemate offer from it…
    takeRegion(g, 7, "DEU");
    takeRegion(g, 6, "DEU");
    expect(aiWantsPeace(eg, rec, deu, day)).toBe(false);
    // …and Poland, losing all of it, would be refused outright: none either.
    expect(aiWantsPeace(eg, rec, pl, day)).toBe(false);
  });

  it("a human target's card refuses at its deadline", async () => {
    const { runner, g, ww, eg } = await started([
      { clientID: HUMAN, country: "FRA" },
    ]);
    const [deu, fra] = [id("DEU"), id("FRA")];
    expect(eg.isHumanControlled(fra)).toBe(true);
    const w = oldWar(g, ww, deu, fra);
    const tick = g.ticks();
    offerPeace(eg, deu, w, fra, tick);
    const o = onlyOffer(eg);
    expect(o.deadlineTick).toBe(tick + WW_WHITE_PEACE_CARD_TICKS);
    // The card's data: both sides, the deadline.
    const v = peaceOfferView(eg, o);
    expect(v.sides.map((s) => s.id)).toEqual([deu, fra]);
    stepTo(runner, o.deadlineTick - 1);
    expect(eg.peaceOffers.map((x) => x.id)).toEqual([o.id]);
    expect(ww.isAtWar(deu, fra)).toBe(true);
    stepTo(runner, o.deadlineTick + 1);
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, fra)).toBe(true);
    expect(eg.peaceCooldowns.some((c) => c[0] === deu && c[1] === fra)).toBe(
      true,
    );
  });

  it("a human answers by ww_order; only the target's own country may", async () => {
    const humans = [
      { clientID: HUMAN, country: "FRA" as const },
      { clientID: "HUMAN002", country: "DEU" as const },
    ];
    const { runner, g, ww, eg } = await started(humans);
    const [deu, fra] = [id("DEU"), id("FRA")];
    const w = oldWar(g, ww, deu, fra);
    step(runner, 2, [
      order("HUMAN002", { kind: "peace_offer", war: w, target: fra }),
    ]);
    const o = onlyOffer(eg);
    expect(o.from).toBe(deu);
    // The proposer cannot answer its own offer.
    step(runner, 2, [
      order("HUMAN002", { kind: "peace_reply", offer: o.id, accept: true }),
    ]);
    expect(eg.peaceOffers).toHaveLength(1);
    step(runner, 2, [
      order(HUMAN, { kind: "peace_reply", offer: o.id, accept: true }),
    ]);
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, fra)).toBe(false);
    expect(eg.war(w)!.ended?.winner).toBe(-1);
  });

  it("an exile whose land comes back with the peace returns home", async () => {
    const { runner, g, ww, eg } = await started();
    const [deu, pl, ltu] = [id("DEU"), id("POL"), id("LTU")];
    const w = oldWar(g, ww, deu, pl);
    ww.setWar(deu, ltu, g.ticks(), { kind: "into", warId: w });
    takeRegion(g, 6, "DEU");
    takeRegion(g, 7, "DEU");
    ww.addCapitulation(pl, deu, g.ticks());
    expect(formExile(eg, pl, deu, g.ticks())).toBe(true);
    const rec = eg.war(w)!;
    // The exiled Poland leads its side no more: Lithuania answers for it.
    expect(rec.sides[1].leader).toBe(ltu);
    ww.politics.country(deu)!.ppMilli = 100_000;
    expect(offerPeace(eg, deu, w, ltu, g.ticks())).toBeNull();
    replyPeace(eg, ltu, onlyOffer(eg).id, true, g.ticks());
    expect(ww.land.controller[6]).toBe(pl);
    expect(ww.land.controller[7]).toBe(pl);
    nextDay(runner);
    nextDay(runner);
    expect(eg.isExile(pl)).toBe(false);
    expect(eg.countryState(pl)).toBe("active");
    expect(ww.isAtWar(deu, pl)).toBe(false);
  });

  it("an occupation zone stays where it is", async () => {
    const { runner, g, ww, eg } = await started();
    const [deu, pl] = [id("DEU"), id("POL")];
    const w = oldWar(g, ww, deu, pl);
    takeRegion(g, 6, "DEU");
    takeRegion(g, 7, "DEU");
    // Krakow is Germany's zone (as Korea's and Taiwan's are a holder's).
    eg.zones.push({ region: 7, holder: deu, untilDay: -1 });
    offerPeace(eg, deu, w, pl, g.ticks());
    replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
    expect(ww.land.controller[6]).toBe(pl);
    expect(ww.land.controller[7]).toBe(deu);
    nextDay(runner);
    expect(ww.land.controller[7]).toBe(deu);
    expect(eg.zoneHolder(7)).toBe(deu);
  });

  it("a snapshot with an offer pending restores in lockstep", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { runner, g, ww, eg } = await started(humans);
    const [deu, fra] = [id("DEU"), id("FRA")];
    const w = oldWar(g, ww, deu, fra);
    offerPeace(eg, deu, w, fra, g.ticks());
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
    expect(eg.peaceOffers).toEqual([]);
    expect(ceg.truces).toEqual(eg.truces);
    expect(ceg.snapshot()).toEqual(eg.snapshot());
    expect(ww.isAtWar(deu, fra)).toBe(false);
  });
});
