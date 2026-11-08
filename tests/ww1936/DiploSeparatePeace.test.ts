// World War 1936 diplomacy D1 (ww161 Design B §1; lane L1): a side
// leader's separate peace with any enemy member — white, negotiated and
// line — its puppets with it, out of its faction, its leader told; "come
// home as my subject" for an exile; a landless exile ended by the line;
// the AI target's loyalty term; the AI side leader's offers; the
// `diplomacy` automation answering for a human; the shared target rule.
// End map (ww1936end) with the end fixture.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DIPLO_COOLDOWN_KINDS,
  DIPLO_NOTICES,
  noticeId,
  WW_SEP_AI_DAYS,
  WW_SEP_LOYAL_PTS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  WW_TRUCE_DAYS,
  WW_WHITE_PEACE_MIN_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  homeTargetBlock,
  peaceTargetBlock,
  targetLeaves,
  type SepPeaceWar,
} from "@openfront/engine-lib/ww1936/SeparatePeaceRules";
import type { Game } from "@openfront/engine/game/Game";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { formExile } from "@openfront/engine/ww1936/endgame/Exile";
import {
  linePeaceOfferView,
  offerLinePeace,
} from "@openfront/engine/ww1936/endgame/LinePeace";
import {
  aiSeparatePeaceDay,
  offerHome,
} from "@openfront/engine/ww1936/endgame/SeparatePeace";
import { makeSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import {
  acceptPct,
  loyaltyPts,
  offerPeace,
  peaceOfferBlock,
  peaceOfferView,
  replyPeace,
  stepPeaceOffers,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
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

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  return { runner, g, ww, eg: ww.endgame };
}

/** War `a` → `b` made WW_WHITE_PEACE_MIN_DAYS old; both with political power. */
function oldWar(g: Game, ww: WorldWar, a: number, b: number): number {
  ww.setWar(a, b, g.ticks(), { kind: "declare" });
  const w = ww.endgame.warOfPair(a, b);
  ww.endgame.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
  for (const x of [a, b]) ww.politics.country(x)!.ppMilli = 100_000;
  return w;
}

/** Germany (with Italy) against Britain (with France and Poland), 90 days old. */
function bigWar(g: Game, ww: WorldWar) {
  const [deu, ita, gbr, fra, pl] = (
    ["DEU", "ITA", "GBR", "FRA", "POL"] as const
  ).map(id);
  const w = oldWar(g, ww, deu, gbr);
  const t = g.ticks();
  for (const x of [fra, pl]) {
    if (!ww.isAtWar(x, deu)) ww.setWar(x, deu, t, { kind: "into", warId: w });
  }
  for (const x of [gbr, fra, pl]) {
    if (!ww.isAtWar(ita, x)) ww.setWar(ita, x, t, { kind: "into", warId: w });
  }
  for (const x of [ita, fra, pl]) ww.politics.country(x)!.ppMilli = 100_000;
  const rec = ww.endgame.war(w)!;
  expect(rec.sides[0].leader).toBe(deu);
  expect(rec.sides[1].leader).toBe(gbr);
  return { w, rec, deu, ita, gbr, fra, pl };
}

function onlyOffer(eg: WwEndgame) {
  expect(eg.peaceOffers).toHaveLength(1);
  return eg.peaceOffers[0];
}

/** Germany against Poland and Lithuania; Poland capitulated into exile (Lithuania now leads). */
function polandInExile(g: Game, ww: WorldWar) {
  const eg = ww.endgame;
  const [deu, pl, ltu] = [id("DEU"), id("POL"), id("LTU")];
  const w = oldWar(g, ww, deu, pl);
  ww.setWar(deu, ltu, g.ticks(), { kind: "into", warId: w });
  takeRegion(g, 6, "DEU");
  takeRegion(g, 7, "DEU");
  ww.addCapitulation(pl, deu, g.ticks());
  expect(formExile(eg, pl, deu, g.ticks())).toBe(true);
  const rec = eg.war(w)!;
  expect(rec.sides[1].leader).toBe(ltu);
  expect(eg.member(rec, pl)!.state).toBe("exiled");
  ww.politics.country(deu)!.ppMilli = 100_000;
  return { w, rec, deu, pl, ltu };
}

describe(
  "World War 1936 diplomacy D1: separate peace",
  { timeout: 60_000 },
  () => {
    it("a side leader's separate peace takes the member out of the war and its faction; its leader is told", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const { w, rec, deu, ita, gbr, fra } = bigWar(g, ww);
      expect(pol.sameFaction(gbr, fra)).toBe(true);
      const day = ww.day(g.ticks());
      // Only my side's leader may pick a member; a member keeps today's way.
      expect(peaceOfferBlock(eg, ita, w, fra, day)).toBe("peace_not_leader");
      expect(peaceOfferBlock(eg, ita, w, gbr, day)).toBeNull();
      expect(peaceOfferBlock(eg, deu, w, ita, day)).toBe("bad_target");
      expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
      const o = onlyOffer(eg);
      expect(o.whole).toBe(true);
      const told = vi.spyOn(eg, "message");
      expect(replyPeace(eg, fra, o.id, true, g.ticks())).toBeNull();
      expect(ww.isAtWar(fra, deu)).toBe(false);
      expect(ww.isAtWar(fra, ita)).toBe(false);
      expect(ww.isAtWar(gbr, deu)).toBe(true);
      expect(rec.ended).toBeNull();
      expect(eg.member(rec, fra)!.state).toBe("left");
      expect(eg.member(rec, deu)!.state).toBe("active");
      expect(pol.factionIdx(fra)).toBe(-1);
      expect(pol.factionIdx(gbr)).toBeGreaterThanOrEqual(0);
      expect(eg.truceUntil(fra, deu)).toBe(day + WW_TRUCE_DAYS);
      expect(eg.truceUntil(fra, ita)).toBe(day + WW_TRUCE_DAYS);
      expect(eg.truceUntil(gbr, deu)).toBe(0);
      expect(told).toHaveBeenCalledWith(
        gbr,
        noticeId(DIPLO_NOTICES.separatePeace),
        expect.objectContaining({
          country: ww.tagOf(deu),
          target: ww.tagOf(fra),
        }),
      );
    });

    it("a puppet is not a target; its overlord's separate peace takes it along", async () => {
      const { g, ww, eg } = await started();
      const { w, rec, deu, gbr, pl } = bigWar(g, ww);
      const aut = id("AUT");
      makeSubject(eg, aut, pl, "puppet", false, g.ticks());
      if (!ww.isAtWar(aut, deu)) {
        ww.setWar(aut, deu, g.ticks(), { kind: "into", warId: w });
      }
      expect(eg.sideIndex(rec, aut)).toBe(1);
      const day = ww.day(g.ticks());
      expect(peaceOfferBlock(eg, deu, w, aut, day)).toBe("peace_puppet");
      expect(offerPeace(eg, deu, w, pl, g.ticks())).toBeNull();
      replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
      expect(ww.isAtWar(pl, deu)).toBe(false);
      expect(ww.isAtWar(aut, deu)).toBe(false);
      expect(eg.member(rec, aut)!.state).toBe("left");
      expect(ww.isAtWar(gbr, deu)).toBe(true);
    });

    it("a line peace with a member settles only that member's land", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const { w, deu, fra, pl } = bigWar(g, ww);
      takeRegion(g, 7, "DEU"); // Krakow
      takeRegion(g, 2, "DEU"); // Lyon
      expect(offerLinePeace(eg, deu, w, pl, g.ticks())).toBeNull();
      const o = onlyOffer(eg);
      expect(o.line).toBe(true);
      expect(o.whole).toBe(true);
      // The card: Krakow alone changes hands.
      expect(linePeaceOfferView(eg, o).gain).toEqual([7]);
      replyPeace(eg, pl, o.id, true, g.ticks());
      expect(pol.legalOwner[7]).toBe(deu);
      expect(ww.land.controller[7]).toBe(deu);
      expect(ww.isAtWar(pl, deu)).toBe(false);
      // France's Lyon is not part of it: still France's, still held.
      expect(pol.legalOwner[2]).toBe(fra);
      expect(ww.land.controller[2]).toBe(deu);
      expect(ww.isAtWar(fra, deu)).toBe(true);
    });

    it("negotiated terms go between the leader and the member", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const { w, deu, pl } = bigWar(g, ww);
      takeRegion(g, 7, "DEU");
      const terms = { give: [], take: [7], pay: 0, demand: 0, free: [] };
      expect(offerPeace(eg, deu, w, pl, g.ticks(), terms)).toBeNull();
      replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
      expect(pol.legalOwner[7]).toBe(deu);
      expect(ww.isAtWar(pl, deu)).toBe(false);
    });

    it("an exile comes home as the proposer's neutral puppet", async () => {
      const { g, ww, eg } = await started();
      const { w, rec, deu, pl, ltu } = polandInExile(g, ww);
      const day = ww.day(g.ticks());
      expect(offerHome(eg, deu, w, ltu, g.ticks())).toBe("home_not_exile");
      expect(offerHome(eg, pl, w, deu, g.ticks())).toBe("home_not_exile");
      expect(peaceOfferBlock(eg, deu, w, pl, day)).toBeNull();
      expect(offerHome(eg, deu, w, pl, g.ticks())).toBeNull();
      const o = onlyOffer(eg);
      expect(o.home).toBe(true);
      expect(o.whole).toBe(true);
      expect(peaceOfferView(eg, o).home).toBe(true);
      const told = vi.spyOn(eg, "message");
      replyPeace(eg, pl, o.id, true, g.ticks());
      expect(ww.land.controller[6]).toBe(pl);
      expect(ww.land.controller[7]).toBe(pl);
      expect(eg.isExile(pl)).toBe(false);
      expect(eg.countryState(pl)).toBe("active");
      expect(eg.member(rec, pl)!.state).toBe("left");
      expect(ww.isAtWar(deu, pl)).toBe(false);
      const sub = eg.subjectOf(pl);
      expect(sub?.overlord).toBe(deu);
      expect(sub?.level).toBe("puppet");
      expect(sub?.neutral).toBe(true);
      // Lithuania fights on.
      expect(ww.isAtWar(deu, ltu)).toBe(true);
      expect(rec.ended).toBeNull();
      expect(told).toHaveBeenCalledWith(
        deu,
        noticeId(DIPLO_NOTICES.homeReturned),
        expect.objectContaining({ country: ww.tagOf(pl) }),
      );
    });

    it("only my side's leader calls an exile home, and only with something to come home to", async () => {
      const { g, ww, eg } = await started();
      const { w, deu, pl } = polandInExile(g, ww);
      const ita = id("ITA");
      ww.setWar(ita, id("LTU"), g.ticks(), { kind: "into", warId: w });
      ww.politics.country(ita)!.ppMilli = 100_000;
      expect(offerHome(eg, ita, w, pl, g.ticks())).toBe("peace_not_leader");
      // Germany gives Poland's land back to its control first: nothing held.
      takeRegion(g, 6, "POL");
      takeRegion(g, 7, "POL");
      expect(offerHome(eg, deu, w, pl, g.ticks())).toBe("bad_target");
      expect(eg.peaceOffers).toEqual([]);
    });

    it("a line peace with an exile that holds nothing ends it; its land stays held", async () => {
      const { g, ww, eg } = await started();
      const pol = ww.politics;
      const { w, rec, deu, pl, ltu } = polandInExile(g, ww);
      expect(offerLinePeace(eg, deu, w, pl, g.ticks())).toBeNull();
      replyPeace(eg, pl, onlyOffer(eg).id, true, g.ticks());
      expect(eg.isExile(pl)).toBe(false);
      expect(eg.countryState(pl)).toBe("gone");
      expect(eg.member(rec, pl)!.state).toBe("capitulated");
      for (const r of [6, 7]) {
        expect(ww.land.controller[r]).toBe(deu);
        expect(pol.legalOwner[r]).toBe(pl);
      }
      expect(ww.isAtWar(deu, ltu)).toBe(true);
    });

    it("the AI target's loyalty: minus while its leader holds and fights, plus once it is beaten", async () => {
      const { g, ww, eg } = await started();
      const { w, rec, deu, gbr, fra } = bigWar(g, ww);
      takeRegion(g, 2, "DEU");
      ww.politics.country(fra)!.wsBp = 0;
      const day = ww.day(g.ticks());
      expect(loyaltyPts(eg, rec, fra)).toBe(-WW_SEP_LOYAL_PTS);
      const loyal = acceptPct(eg, rec, deu, fra, true, day);
      takeRegion(g, 10, "DEU"); // London: Britain past half its line
      expect(loyaltyPts(eg, rec, fra)).toBe(WW_SEP_LOYAL_PTS);
      const beaten = acceptPct(eg, rec, deu, fra, true, day);
      expect(beaten - loyal).toBe(2 * WW_SEP_LOYAL_PTS);
      // Today's offers (to the leader) have no loyalty term.
      expect(loyaltyPts(eg, rec, gbr)).toBe(0);
      expect(w).toBe(rec.id);
    });

    it("a winning AI side leader offers a beaten minor a line peace, once per 60 days, never near its goals", async () => {
      const { g, ww, eg } = await started();
      const { w, rec, deu, pl } = bigWar(g, ww);
      takeRegion(g, 6, "DEU");
      takeRegion(g, 7, "DEU");
      eg.member(rec, deu)!.wsMilli = 10_000;
      const day = ww.day(g.ticks());
      const k = DIPLO_COOLDOWN_KINDS.indexOf("ai_separate");
      // A claim on Krakow: Poland borders the leader's goal.
      const c = ww.politics.country(deu)!;
      c.warGoals.push({
        on: pl,
        type: "claim",
        group: "east_poland",
        untilDay: day + 100,
      });
      aiSeparatePeaceDay(eg, deu, day, g.ticks());
      expect(eg.peaceOffers).toEqual([]);
      // Looked at once: Poland waits 60 days; France (a major) is not looked at.
      expect(eg.diploCooldowns).toEqual([[deu, pl, day + WW_SEP_AI_DAYS, k]]);
      c.warGoals = [];
      aiSeparatePeaceDay(eg, deu, day + 1, g.ticks());
      expect(eg.peaceOffers).toEqual([]);
      aiSeparatePeaceDay(eg, deu, day + WW_SEP_AI_DAYS, g.ticks());
      const o = onlyOffer(eg);
      expect([o.from, o.to, o.war, o.line, o.whole]).toEqual([
        deu,
        pl,
        w,
        true,
        true,
      ]);
    });

    it("an AI side leader ahead on score does nothing when it isn't", async () => {
      const { g, ww, eg } = await started();
      const { rec, deu, gbr } = bigWar(g, ww);
      takeRegion(g, 6, "DEU");
      takeRegion(g, 7, "DEU");
      eg.member(rec, gbr)!.wsMilli = 10_000;
      aiSeparatePeaceDay(eg, deu, ww.day(g.ticks()), g.ticks());
      expect(eg.peaceOffers).toEqual([]);
      expect(eg.diploCooldowns).toEqual([]);
    });

    it("a winning AI side leader calls a weak exile home", async () => {
      const { g, ww, eg } = await started();
      const { rec, deu, pl } = polandInExile(g, ww);
      eg.member(rec, deu)!.wsMilli = 10_000;
      eg.exiles[eg.exileIdx.get(pl)!].legitBp = 1000;
      aiSeparatePeaceDay(eg, deu, ww.day(g.ticks()), g.ticks());
      const o = onlyOffer(eg);
      expect([o.from, o.to, o.home]).toEqual([deu, pl, true]);
    });

    it("with the diplomacy automation on, a human's offers are answered at once", async () => {
      const { g, ww, eg } = await started([
        { clientID: HUMAN, country: "FRA" },
      ]);
      const { w, deu, fra } = bigWar(g, ww);
      expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
      stepPeaceOffers(eg, g.ticks());
      expect(eg.peaceOffers).toHaveLength(1);
      ww.setAuto(fra, "diplomacy", true);
      stepPeaceOffers(eg, g.ticks());
      expect(eg.peaceOffers).toEqual([]);
    });

    it("a snapshot with a home offer pending restores in lockstep", async () => {
      const humans = [{ clientID: HUMAN, country: "POL" as const }];
      const { runner, g, ww, eg } = await started(humans);
      const { w, deu, pl } = polandInExile(g, ww);
      expect(offerHome(eg, deu, w, pl, g.ticks())).toBeNull();
      const o = onlyOffer(eg);
      step(runner);
      const copy = await wwRestore(runner, humans, END_MAP);
      const ceg = copy.game.worldWar()!.endgame;
      expect(ceg.peaceOffers).toEqual(eg.peaceOffers);
      expect(ceg.hash()).toBe(eg.hash());
      for (let i = 0; i < 8; i++) {
        const intents =
          i === 3
            ? [order(HUMAN, { kind: "peace_reply", offer: o.id, accept: true })]
            : [];
        step(runner, 1, intents);
        step(copy, 1, intents);
        expect(gameHash(copy)).toBe(gameHash(runner));
      }
      expect(eg.subjectOf(pl)?.overlord).toBe(deu);
      expect(ceg.snapshot()).toEqual(eg.snapshot());
    });
  },
);

describe("World War 1936 diplomacy D1: the target rule (engine-lib)", () => {
  // Side 0: 1 leads, 2 a member; side 1: 3 leads, 4 a member, 5 a puppet, 6 in exile, 7 left.
  const w: SepPeaceWar = {
    sides: [
      {
        leader: 1,
        members: [
          { id: 1, state: "active" },
          { id: 2, state: "active" },
        ],
      },
      {
        leader: 3,
        members: [
          { id: 3, state: "active" },
          { id: 4, state: "active" },
          { id: 5, state: "active" },
          { id: 6, state: "exiled" },
          { id: 7, state: "left" },
        ],
      },
    ],
  };
  const puppet = (x: number) => x === 5;

  it("the other leader for anyone; another member from my leader only; no puppet", () => {
    expect(peaceTargetBlock(w, 2, 3, puppet)).toBeNull();
    expect(peaceTargetBlock(w, 1, 3, puppet)).toBeNull();
    expect(peaceTargetBlock(w, 1, 4, puppet)).toBeNull();
    expect(peaceTargetBlock(w, 1, 6, puppet)).toBeNull();
    expect(peaceTargetBlock(w, 2, 4, puppet)).toBe("peace_not_leader");
    expect(peaceTargetBlock(w, 1, 5, puppet)).toBe("peace_puppet");
    expect(peaceTargetBlock(w, 1, 7, puppet)).toBe("bad_target");
    expect(peaceTargetBlock(w, 1, 2, puppet)).toBe("bad_target");
    expect(peaceTargetBlock(w, 9, 3, puppet)).toBe("not_at_war");
  });

  it("who leaves: the target only on my leader's offer to a member", () => {
    expect(targetLeaves(w, 1, 4, true)).toBe(true);
    expect(targetLeaves(w, 1, 3, true)).toBe(false);
    expect(targetLeaves(w, 2, 3, false)).toBe(false);
    expect(targetLeaves(w, 1, 2, true)).toBe(false);
  });

  it("come home: an exile, no leader, from my leader", () => {
    expect(homeTargetBlock(w, 1, 6, puppet)).toBeNull();
    expect(homeTargetBlock(w, 1, 4, puppet)).toBe("home_not_exile");
    expect(homeTargetBlock(w, 2, 6, puppet)).toBe("peace_not_leader");
    const led: SepPeaceWar = {
      sides: [w.sides[0], { leader: 6, members: [{ id: 6, state: "exiled" }] }],
    };
    expect(homeTargetBlock(led, 1, 6, puppet)).toBe("bad_target");
  });
});
