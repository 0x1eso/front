// World War 1936: peace on the current line (현 점령선 평화, owner request
// 2026-10-31) — each side keeps what it holds: the occupied regions pass,
// legal ownership and control, to their occupiers (no core: resistance and
// integration follow), capitals go back, no 12-region or 40% cap; the whole
// war or a separate peace; the AI's judge (the line's value against the
// war's need) and its own offers; the human card; the white peace's shared
// gate; lockstep across a snapshot. End map (ww1936end) with the end
// fixture.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CS_GONE,
  WW_TRUCE_DAYS,
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_COOLDOWN_DAYS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
  WwPeaceTerms,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  AI_LINE_PROPOSE_MIN_PCT,
  linePeaceValue,
} from "@openfront/engine-lib/ww1936/LinePeaceRules";
import {
  negPeaceChance,
  noPeaceTerms,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Game } from "@openfront/engine/game/Game";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { formExile } from "@openfront/engine/ww1936/endgame/Exile";
import {
  aiLinePeaceDay,
  aiWantsLinePeace,
  lineAiAccepts,
  lineJudgeOf,
  linePeaceData,
  linePeaceFacts,
  offerLinePeace,
} from "@openfront/engine/ww1936/endgame/LinePeace";
import {
  aiAcceptPct,
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
// The end map's regions (endFixture's scenario).
const [PARIS, LYON, BERLIN, MUNICH, WARSAW, KRAKOW] = [1, 2, 3, 4, 6, 7];
const [PRAGUE, SLOVAKIA, KOSICE] = [14, 15, 20];

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

/** Through the next day's common step (and every country's turn of it). */
function nextDay(runner: GameRunner): void {
  const ww = runner.game.worldWar()!;
  const day = ww.day(runner.game.ticks());
  stepTo(runner, dayStartTick(day + 1, WW_PREP_TICKS) + 8);
}

/** Accepts among 200 offers like `o` (each its own seeded roll). */
function acceptsOf(eg: WwEndgame, o: PeaceOffer, day: number): number {
  let yes = 0;
  for (let i = 1; i <= 200; i++) {
    if (lineAiAccepts(eg, { ...o, id: 1000 + i }, day)) yes++;
  }
  return yes;
}

/** No division of `owner` stands on `region`. */
function noDivisions(ww: WorldWar, region: number, owner: number): void {
  for (const row of ww.land.rowsIn(region)) {
    expect(ww.land.divisions.owner[row], `division in ${region}`).not.toBe(
      owner,
    );
  }
}

/** Factories of the end map's countries, for an even (or uneven) war. */
function factories(ww: WorldWar, x: number, n: number): void {
  const t = ww.economy.country(x)!.totals;
  t.civ = n;
  t.mil = 0;
}

describe(
  "World War 1936: peace on the current line",
  { timeout: 120_000 },
  () => {
    it("a whole-war line hands each occupied region to its occupier; capitals go back", async () => {
      const { runner, g, ww, eg } = await started();
      const pol = ww.politics;
      const [deu, ita, pl, fra] = [id("DEU"), id("ITA"), id("POL"), id("FRA")];
      const w = oldWar(g, ww, deu, pl);
      ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
      ww.setWar(ita, pl, g.ticks(), { kind: "into", warId: w });
      // Germany holds Krakow and Warsaw (Poland's capital), Lyon and Paris
      // (France's capital); France holds Munich.
      for (const r of [KRAKOW, WARSAW, LYON, PARIS]) takeRegion(g, r, "DEU");
      takeRegion(g, MUNICH, "FRA");
      const tick = g.ticks();
      expect(offerLinePeace(eg, deu, w, pl, tick)).toBeNull();
      const o = onlyOffer(eg);
      expect(o.line).toBe(true);
      expect(o.whole).toBe(true);
      expect(o.terms).toBeUndefined();
      expect(pol.country(deu)!.ppMilli).toBe(
        100_000 - WW_WHITE_PEACE_PP * 1000,
      );
      // The card's line, from Germany's side: the capitals are not in it.
      expect(peaceOfferView(eg, o).line).toEqual({
        gain: [LYON, KRAKOW],
        lose: [MUNICH],
        gainVp: 6,
        loseVp: 4,
      });
      expect(replyPeace(eg, pl, o.id, true, tick)).toBeNull();
      // Each occupied region is its occupier's, by law too.
      for (const [r, x] of [
        [KRAKOW, deu],
        [LYON, deu],
        [MUNICH, fra],
      ]) {
        expect(pol.legalOwner[r], `owner ${r}`).toBe(x);
        expect(ww.land.controller[r], `ctl ${r}`).toBe(x);
      }
      // The capitals go back.
      expect(ww.land.controller[WARSAW]).toBe(pl);
      expect(pol.legalOwner[WARSAW]).toBe(pl);
      expect(ww.land.controller[PARIS]).toBe(fra);
      expect(ww.land.controller[BERLIN]).toBe(deu);
      // No core comes with it (a conference take): the old owner keeps its
      // own, so the region is administered — resistance and integration.
      expect(eg.hasCore(deu, KRAKOW)).toBe(false);
      expect(eg.hasCore(pl, KRAKOW)).toBe(true);
      expect(eg.hasCore(fra, MUNICH)).toBe(false);
      expect(eg.isAdministered(KRAKOW)).toBe(true);
      expect(eg.administeredOf(deu)).toContain(KRAKOW);
      expect(eg.administeredOf(fra)).toContain(MUNICH);
      // The givers' armies go home.
      noDivisions(ww, KRAKOW, pl);
      noDivisions(ww, LYON, fra);
      noDivisions(ww, MUNICH, deu);
      // The whole war ends: every pair, no conference, a truce each way.
      for (const [a, b] of [
        [deu, pl],
        [fra, deu],
        [ita, pl],
      ]) {
        expect(ww.isAtWar(a, b)).toBe(false);
      }
      expect(eg.war(w)!.ended?.winner).toBe(-1);
      const day = ww.day(g.ticks());
      expect(eg.truceUntil(ita, fra)).toBe(day + WW_TRUCE_DAYS);
      const news = pol.takeData()?.news.map((n) => n.id) ?? [];
      expect(news).toContain("news_line_peace");
      expect(news).not.toContain("news_white_peace");
      expect(news).not.toContain("news_neg_peace");
      // Nothing hands it back later.
      nextDay(runner);
      expect(pol.legalOwner[KRAKOW]).toBe(deu);
      expect(ww.land.controller[KRAKOW]).toBe(deu);
      expect(eg.conferences.some((c) => c.losers.includes(pl))).toBe(false);
    });

    it("a separate line: only the proposer and its enemies there trade land; it leaves its faction", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const [deu, ita, gbr, fra] = [id("DEU"), id("ITA"), id("GBR"), id("FRA")];
      const w = oldWar(g, ww, deu, gbr);
      ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
      ww.setWar(ita, gbr, g.ticks(), { kind: "into", warId: w });
      ww.setWar(ita, fra, g.ticks(), { kind: "into", warId: w });
      pol.country(ita)!.ppMilli = 100_000;
      expect(pol.factionIdx(ita)).toBeGreaterThanOrEqual(0);
      // Italy holds Lyon and Paris; France holds Munich (Germany's: not Italy's peace).
      takeRegion(g, LYON, "ITA");
      takeRegion(g, PARIS, "ITA");
      takeRegion(g, MUNICH, "FRA");
      expect(offerLinePeace(eg, ita, w, gbr, g.ticks())).toBeNull();
      const o = onlyOffer(eg);
      expect(o.whole).toBe(false);
      expect(peaceOfferView(eg, o).line).toEqual({
        gain: [LYON],
        lose: [],
        gainVp: 3,
        loseVp: 0,
      });
      replyPeace(eg, gbr, o.id, true, g.ticks());
      expect(pol.legalOwner[LYON]).toBe(ita);
      expect(ww.land.controller[LYON]).toBe(ita);
      expect(ww.land.controller[PARIS]).toBe(fra);
      // Germany's war goes on: Munich stays occupied, still Germany's by law.
      expect(ww.land.controller[MUNICH]).toBe(fra);
      expect(pol.legalOwner[MUNICH]).toBe(deu);
      expect(ww.isAtWar(ita, gbr)).toBe(false);
      expect(ww.isAtWar(ita, fra)).toBe(false);
      expect(ww.isAtWar(deu, gbr)).toBe(true);
      expect(eg.war(w)!.ended).toBeNull();
      expect(pol.factionIdx(ita)).toBe(-1);
      expect(eg.truceUntil(ita, fra)).toBe(ww.day(g.ticks()) + WW_TRUCE_DAYS);
    });

    it("no 12-region or 40% cap: the whole line goes, where a negotiated peace is refused", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      // Poland owns Prague too: 39 victory points; Germany holds Krakow and
      // Prague, 18 of them — 46%, over the negotiated peace's 40%.
      pol.setLegalOwner(PRAGUE, pl);
      takeRegion(g, KRAKOW, "DEU");
      takeRegion(g, PRAGUE, "DEU");
      const terms: WwPeaceTerms = { ...noPeaceTerms(), give: [KRAKOW, PRAGUE] };
      expect(offerPeace(eg, pl, w, deu, g.ticks(), terms)).toBe(
        "peace_too_much",
      );
      expect(offerLinePeace(eg, pl, w, deu, g.ticks())).toBeNull();
      const o = onlyOffer(eg);
      expect(peaceOfferView(eg, o).line?.lose).toEqual([KRAKOW, PRAGUE]);
      replyPeace(eg, deu, o.id, true, g.ticks());
      for (const r of [KRAKOW, PRAGUE]) {
        expect(pol.legalOwner[r], `owner ${r}`).toBe(deu);
        expect(ww.land.controller[r], `ctl ${r}`).toBe(deu);
      }
      expect(ww.land.controller[WARSAW]).toBe(pl);
    });

    it("a capitulated member keeps its capital and plays again; an exile goes home", async () => {
      const { runner, g, ww, eg } = await started();
      const [deu, pl, fra, ltu] = [id("DEU"), id("POL"), id("FRA"), id("LTU")];
      const w = oldWar(g, ww, deu, pl);
      ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
      takeRegion(g, WARSAW, "DEU");
      takeRegion(g, KRAKOW, "DEU");
      // Poland capitulates with no host (the white peace test's way).
      ww.addCapitulation(pl, deu, g.ticks());
      eg.setMemberState(w, pl, "capitulated");
      ww.endWar(deu, pl);
      eg.setCountryState(pl, CS_GONE);
      ww.politics.country(fra)!.ppMilli = 100_000;
      expect(offerLinePeace(eg, fra, w, deu, g.ticks())).toBeNull();
      replyPeace(eg, deu, onlyOffer(eg).id, true, g.ticks());
      // Krakow is Germany's; Warsaw comes back and Poland plays again.
      expect(ww.politics.legalOwner[KRAKOW]).toBe(deu);
      expect(ww.land.controller[WARSAW]).toBe(pl);
      expect(eg.countryState(pl)).toBe("active");
      expect(eg.isActor(pl)).toBe(true);
      nextDay(runner);
      expect(eg.isActor(pl)).toBe(true);
      expect(ww.land.controller[WARSAW]).toBe(pl);

      // An exile: its capital comes back with the line, and it goes home.
      const s = await started();
      const w2 = oldWar(s.g, s.ww, deu, pl);
      s.ww.setWar(deu, ltu, s.g.ticks(), { kind: "into", warId: w2 });
      takeRegion(s.g, WARSAW, "DEU");
      takeRegion(s.g, KRAKOW, "DEU");
      s.ww.addCapitulation(pl, deu, s.g.ticks());
      expect(formExile(s.eg, pl, deu, s.g.ticks())).toBe(true);
      expect(s.eg.war(w2)!.sides[1].leader).toBe(ltu);
      expect(offerLinePeace(s.eg, deu, w2, ltu, s.g.ticks())).toBeNull();
      replyPeace(s.eg, ltu, onlyOffer(s.eg).id, true, s.g.ticks());
      expect(s.ww.politics.legalOwner[KRAKOW]).toBe(deu);
      expect(s.ww.land.controller[WARSAW]).toBe(pl);
      nextDay(s.runner);
      nextDay(s.runner);
      expect(s.eg.isExile(pl)).toBe(false);
      expect(s.eg.countryState(pl)).toBe("active");
    });

    it("an occupation zone keeps the white peace's rule", async () => {
      const { runner, g, ww, eg } = await started();
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      takeRegion(g, KRAKOW, "DEU");
      takeRegion(g, MUNICH, "POL");
      // Krakow is Germany's zone (as Korea's and Taiwan's are a holder's).
      eg.zones.push({ region: KRAKOW, holder: deu, untilDay: -1 });
      offerLinePeace(eg, deu, w, pl, g.ticks());
      expect(peaceOfferView(eg, onlyOffer(eg)).line?.gain).toEqual([]);
      replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
      expect(ww.politics.legalOwner[KRAKOW]).toBe(pl);
      expect(ww.land.controller[KRAKOW]).toBe(deu);
      expect(ww.politics.legalOwner[MUNICH]).toBe(pl);
      nextDay(runner);
      expect(eg.zoneHolder(KRAKOW)).toBe(deu);
    });

    it("the AI takes a line holding land in a stalemate and refuses one when clearly winning", async () => {
      const { g, ww, eg } = await started();
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      const rec = eg.war(w)!;
      const day = ww.day(g.ticks());
      rec.startDay = day - 200;
      eg.fronts = [[w, 1, 0, day - 180]];
      factories(ww, deu, 10);
      factories(ww, pl, 10);
      ww.politics.country(deu)!.wsBp = 3000;
      takeRegion(g, KRAKOW, "DEU");
      const probe = (line: boolean): PeaceOffer => ({
        id: 1,
        war: w,
        from: pl,
        to: deu,
        whole: true,
        sentTick: g.ticks(),
        deadlineTick: g.ticks(),
        ...(line ? { line: true as const } : {}),
      });
      // Germany, war-weary on a stalemated front, holding Krakow: the line
      // is worth more to it than a white peace.
      const white = aiAcceptPct(eg, probe(false), day);
      const j = lineJudgeOf(eg, rec, pl, deu, true, day);
      expect(j.value).toBeGreaterThan(0);
      const chance = negPeaceChance(j.j, j.value);
      expect(chance).toBeGreaterThan(white);
      expect(chance).toBeGreaterThanOrEqual(60);
      // The seeded rolls follow the judge's chance.
      const yes = acceptsOf(eg, probe(true), day);
      expect(Math.abs(yes / 2 - chance)).toBeLessThan(12);
      // Poland gives up Krakow, a fifth of its land's worth: the same judge
      // makes it take Germany's line rarely while it still fights on…
      const back = lineJudgeOf(eg, rec, deu, pl, true, day);
      expect(back.value).toBeLessThan(0);
      const fresh = negPeaceChance(back.j, back.value);
      // …and more often war-weary (it would lose more by fighting on).
      ww.politics.country(pl)!.wsBp = 0;
      const weary = lineJudgeOf(eg, rec, deu, pl, true, day);
      expect(negPeaceChance(weary.j, weary.value)).toBeGreaterThan(fresh);
      // Germany clearly winning (Warsaw taken too, Poland at its surrender
      // line): the line (Krakow only, the capital goes back) never does.
      takeRegion(g, WARSAW, "DEU");
      expect(aiAcceptPct(eg, probe(false), day)).toBe(0);
      expect(acceptsOf(eg, probe(true), day)).toBe(0);
    });

    it("a losing side counts less of what it gives up the nearer it is to its surrender line", async () => {
      const { g, ww, eg } = await started();
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      const rec = eg.war(w)!;
      const day = ww.day(g.ticks());
      takeRegion(g, KRAKOW, "DEU");
      const f = linePeaceFacts(eg);
      const near = lineJudgeOf(eg, rec, deu, pl, true, day, f);
      const flat = linePeaceValue(f, near.moves, (x) => x === pl, 0);
      // Krakow's worth at the control factor, Poland 156‰ to its line.
      expect(flat).toBe(-7);
      expect(near.value).toBeGreaterThan(flat);
      expect(near.value).toBeLessThan(0);
    });

    it("the AI offers a line only on a stalemate it gains from, or losing while the front still moves", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const [deu, ita, pl] = [id("DEU"), id("ITA"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      ww.setWar(ita, pl, g.ticks(), { kind: "into", warId: w });
      const rec = eg.war(w)!;
      const day = ww.day(g.ticks());
      factories(ww, deu, 10);
      factories(ww, ita, 0);
      factories(ww, pl, 10);
      pol.country(pl)!.wsBp = 0;
      takeRegion(g, KRAKOW, "DEU");
      // No stalemate yet: the front moved 30 days ago.
      rec.startDay = day - 200;
      eg.fronts = [[w, 1, 0, day - 30]];
      expect(aiWantsLinePeace(eg, rec, deu, day)).toBe(false);
      // 180 days of it: Germany, ahead, offers the line Poland may take.
      eg.fronts = [[w, 1, 0, day - 180]];
      expect(aiWantsLinePeace(eg, rec, deu, day)).toBe(true);
      const j = lineJudgeOf(eg, rec, deu, pl, true, day);
      expect(negPeaceChance(j.j, j.value)).toBeGreaterThanOrEqual(
        AI_LINE_PROPOSE_MIN_PCT,
      );
      // A member never offers one on a stalemate (Italy holds Krakow instead).
      takeRegion(g, KRAKOW, "ITA");
      expect(aiWantsLinePeace(eg, rec, ita, day)).toBe(false);
      takeRegion(g, KRAKOW, "DEU");
      // Poland still keen on the war would refuse it: no offer.
      pol.country(pl)!.wsBp = 6000;
      expect(aiWantsLinePeace(eg, rec, deu, day)).toBe(false);
      pol.country(pl)!.wsBp = 0;
      // A side three times stronger offers no stalemate line.
      factories(ww, deu, 30);
      expect(aiWantsLinePeace(eg, rec, deu, day)).toBe(false);
      factories(ww, deu, 10);
      // Too young a war: none, however stalemated.
      rec.startDay = day - WW_WHITE_PEACE_MIN_DAYS + 1;
      aiLinePeaceDay(eg, deu, day, g.ticks());
      expect(eg.peaceOffers).toEqual([]);
      rec.startDay = day - 200;
      aiLinePeaceDay(eg, deu, day, g.ticks());
      const o = onlyOffer(eg);
      expect(o).toMatchObject({ from: deu, to: pl, whole: true, line: true });
      expect(pol.country(deu)!.ppMilli).toBe(
        100_000 - WW_WHITE_PEACE_PP * 1000,
      );
      // One offer of any kind pending at a time.
      aiLinePeaceDay(eg, deu, day, g.ticks());
      expect(eg.peaceOffers).toHaveLength(1);
      eg.peaceOffers = [];
      // Clearly winning (Warsaw too): no line, it takes more by fighting on.
      takeRegion(g, WARSAW, "DEU");
      expect(aiWantsLinePeace(eg, rec, deu, day)).toBe(false);
    });

    it("a losing AI offers the line while the front still moves, if the winner may take it", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      const rec = eg.war(w)!;
      const day = ww.day(g.ticks());
      // Poland owns Kosice and Slovakia too (29 victory points); Germany
      // holds 8 of them with Krakow: a quarter of its land — losing.
      pol.setLegalOwner(KOSICE, pl);
      pol.setLegalOwner(SLOVAKIA, pl);
      for (const r of [KRAKOW, KOSICE, SLOVAKIA]) takeRegion(g, r, "DEU");
      eg.fronts = [[w, 3, 0, day - 10]];
      // Germany, war-weary, would take the line: Poland offers it.
      pol.country(deu)!.wsBp = 3000;
      expect(aiWantsLinePeace(eg, rec, pl, day)).toBe(true);
      aiLinePeaceDay(eg, pl, day, g.ticks());
      expect(onlyOffer(eg)).toMatchObject({ from: pl, to: deu, line: true });
      eg.peaceOffers = [];
      // On a stalled front the line is no better than its trend: none.
      eg.fronts = [[w, 3, 0, day - 180]];
      expect(aiWantsLinePeace(eg, rec, pl, day)).toBe(false);
      eg.fronts = [[w, 3, 0, day - 10]];
      // Germany keen on the war needs more than the line gives: none.
      pol.country(deu)!.wsBp = 6000;
      const j = lineJudgeOf(eg, rec, pl, deu, true, day);
      expect(negPeaceChance(j.j, j.value)).toBeLessThan(
        AI_LINE_PROPOSE_MIN_PCT,
      );
      expect(aiWantsLinePeace(eg, rec, pl, day)).toBe(false);
      // Not losing (Kosice and Slovakia back): none either.
      pol.country(deu)!.wsBp = 3000;
      takeRegion(g, KOSICE, "POL");
      takeRegion(g, SLOVAKIA, "POL");
      expect(aiWantsLinePeace(eg, rec, pl, day)).toBe(false);
    });

    it("a human target's card refuses at its deadline; the cooldown is every kind's", async () => {
      const { runner, g, ww, eg } = await started([
        { clientID: HUMAN, country: "FRA" },
      ]);
      const [deu, fra] = [id("DEU"), id("FRA")];
      const w = oldWar(g, ww, deu, fra);
      takeRegion(g, LYON, "DEU");
      const tick = g.ticks();
      expect(offerLinePeace(eg, deu, w, fra, tick)).toBeNull();
      const o = onlyOffer(eg);
      expect(o.deadlineTick).toBe(tick + WW_WHITE_PEACE_CARD_TICKS);
      // The card reads the line.
      expect(peaceOfferView(eg, o).line?.gain).toEqual([LYON]);
      // A second offer of another kind in the same war waits for this one.
      expect(offerPeace(eg, deu, w, fra, tick)).toBe("peace_pending");
      stepTo(runner, o.deadlineTick - 1);
      expect(eg.peaceOffers.map((x) => x.id)).toEqual([o.id]);
      stepTo(runner, o.deadlineTick + 1);
      expect(eg.peaceOffers).toEqual([]);
      expect(ww.isAtWar(deu, fra)).toBe(true);
      expect(ww.politics.legalOwner[LYON]).toBe(fra);
      expect(eg.peaceCooldowns.some((c) => c[0] === deu && c[1] === fra)).toBe(
        true,
      );
      // The refusal holds every kind of offer back for the cooldown.
      expect(offerLinePeace(eg, deu, w, fra, g.ticks())).toBe("peace_cooldown");
      expect(offerPeace(eg, deu, w, fra, g.ticks())).toBe("peace_cooldown");
      expect(eg.peaceCooldowns.find((c) => c[0] === deu)?.[2]).toBe(
        ww.day(o.deadlineTick) + WW_WHITE_PEACE_COOLDOWN_DAYS,
      );
    });

    it("a human offers by ww_order and answers by peace_reply; only its own country", async () => {
      const humans = [
        { clientID: HUMAN, country: "POL" as const },
        { clientID: "HUMAN002", country: "DEU" as const },
      ];
      const { runner, g, ww, eg } = await started(humans);
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      takeRegion(g, KRAKOW, "DEU");
      // The screens' row: Germany's possible line, Krakow its gain.
      const rows = linePeaceData(eg, true)!;
      expect(rows.find((r) => r.from === deu)).toMatchObject({
        war: w,
        to: pl,
        gain: [KRAKOW],
        lose: [],
        gainVp: 3,
        loseVp: 0,
      });
      expect(rows.find((r) => r.from === pl)).toMatchObject({
        to: deu,
        gain: [],
        lose: [KRAKOW],
      });
      // Unchanged the same day: nothing to send.
      expect(linePeaceData(eg, false)).toBeNull();
      // Poland may offer only the other side's leader.
      step(runner, 2, [
        order(HUMAN, { kind: "line_peace_offer", war: w, target: pl }),
      ]);
      expect(eg.peaceOffers).toEqual([]);
      step(runner, 2, [
        order("HUMAN002", { kind: "line_peace_offer", war: w, target: pl }),
      ]);
      const o = onlyOffer(eg);
      expect(o).toMatchObject({ from: deu, to: pl, line: true });
      // The proposer cannot answer its own offer.
      step(runner, 2, [
        order("HUMAN002", { kind: "peace_reply", offer: o.id, accept: true }),
      ]);
      expect(eg.peaceOffers).toHaveLength(1);
      step(runner, 2, [
        order(HUMAN, { kind: "peace_reply", offer: o.id, accept: true }),
      ]);
      expect(eg.peaceOffers).toEqual([]);
      expect(ww.isAtWar(deu, pl)).toBe(false);
      expect(ww.politics.legalOwner[KRAKOW]).toBe(deu);
      expect(eg.war(w)!.ended?.winner).toBe(-1);
    });

    it("a snapshot with a line offer pending restores in lockstep", async () => {
      const humans = [{ clientID: HUMAN, country: "POL" as const }];
      const { runner, g, ww, eg } = await started(humans);
      const [deu, pl] = [id("DEU"), id("POL")];
      const w = oldWar(g, ww, deu, pl);
      takeRegion(g, KRAKOW, "DEU");
      offerLinePeace(eg, deu, w, pl, g.ticks());
      const o = onlyOffer(eg);
      // The line is part of the hash: the same offer without it differs.
      const h = eg.hash();
      eg.peaceOffers = [{ ...o, line: undefined }];
      delete eg.peaceOffers[0].line;
      expect(eg.hash()).not.toBe(h);
      eg.peaceOffers = [o];
      expect(eg.hash()).toBe(h);
      step(runner);
      const copy = await wwRestore(runner, humans, END_MAP);
      const ceg = copy.game.worldWar()!.endgame;
      expect(ceg.peaceOffers).toEqual(eg.peaceOffers);
      expect(ceg.peaceOffers[0].line).toBe(true);
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
      expect(ww.politics.legalOwner[KRAKOW]).toBe(deu);
      expect(copy.game.worldWar()!.politics.legalOwner[KRAKOW]).toBe(deu);
      expect(ceg.snapshot()).toEqual(eg.snapshot());
    });
  },
);
