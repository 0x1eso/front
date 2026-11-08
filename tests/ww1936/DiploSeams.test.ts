// World War 1936 diplomacy (ww162 integration): the seams the lanes left
// between them. A separate peace records itself, so a change of the target
// side's leader lapses the offer instead of turning it; a peace offer
// waits behind a deal card with its clock stopped (the one card); the
// screens' chance rows judge every enemy member a side leader may offer a
// separate peace, and price joining a war as the engine does; the
// collaboration region rule is one function (engine-lib CollabRules).
// End map (ww1936end) with the end fixture.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  WW_DEAL_CARD_TICKS,
  WW_PROMISE_WS_PCT,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_MIN_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  type CollabRegionFacts,
  collabRegionOk,
} from "@openfront/engine-lib/ww1936/CollabRules";
import { WW_DEAL_VETO } from "@openfront/engine-lib/ww1936/DiploRules";
import {
  WW_PROMISE_ALLY_PTS,
  WW_PROMISE_JOIN_PTS,
} from "@openfront/engine-lib/ww1936/PromiseRules";
import type { Game } from "@openfront/engine/game/Game";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import {
  dealItemValue,
  dealJudgeData,
  offerDeal,
} from "@openfront/engine/ww1936/endgame/Deals";
import { linePeaceData } from "@openfront/engine/ww1936/endgame/LinePeace";
import { peaceJudgeData } from "@openfront/engine/ww1936/endgame/NegPeace";
import { joinSideStrong } from "@openfront/engine/ww1936/endgame/Promises";
import {
  offerPeace,
  stepPeaceOffers,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  gameHash,
  HUMAN,
  step,
  stepTo,
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

/** Germany (with Italy) against Britain (with France and Poland), old enough for peace. */
function bigWar(g: Game, ww: WorldWar) {
  const [deu, ita, gbr, fra, pl] = (
    ["DEU", "ITA", "GBR", "FRA", "POL"] as const
  ).map(id);
  ww.setWar(deu, gbr, g.ticks(), { kind: "declare" });
  const w = ww.endgame.warOfPair(deu, gbr);
  const rec = ww.endgame.war(w)!;
  rec.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
  const t = g.ticks();
  for (const x of [fra, pl]) {
    if (!ww.isAtWar(x, deu)) ww.setWar(x, deu, t, { kind: "into", warId: w });
  }
  for (const x of [gbr, fra, pl]) {
    if (!ww.isAtWar(ita, x)) ww.setWar(ita, x, t, { kind: "into", warId: w });
  }
  for (const x of [deu, ita, gbr, fra, pl]) {
    ww.politics.country(x)!.ppMilli = 100_000;
  }
  expect(rec.sides[0].leader).toBe(deu);
  expect(rec.sides[1].leader).toBe(gbr);
  return { w, rec, deu, ita, gbr, fra, pl };
}

describe("World War 1936 diplomacy: the integration seams", () => {
  test("a separate peace is recorded as sent; a change of the target side's leader lapses it, either way", async () => {
    const { runner, g, ww, eg } = await started();
    const { w, rec, deu, gbr, fra } = bigWar(g, ww);
    expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
    expect(eg.peaceOffers[0].sep).toBe(true);
    // The snapshot and the hash carry it.
    const copy = await wwRestore(runner, [], END_MAP);
    const ceg = copy.game.worldWar()!.endgame;
    expect(ceg.peaceOffers).toEqual(eg.peaceOffers);
    expect(ceg.hash()).toBe(eg.hash());
    expect(gameHash(copy)).toBe(gameHash(runner));
    // France now leads its side: the offer would be the whole war. It lapses.
    rec.sides[1].leader = fra;
    stepPeaceOffers(eg, g.ticks());
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, gbr)).toBe(true);
    expect(ww.isAtWar(deu, fra)).toBe(true);
    // A whole-war offer to the leader, whose lead then passes on: it lapses
    // too, rather than taking the old leader alone out.
    eg.peaceCooldowns = [];
    ww.politics.country(deu)!.ppMilli = 100_000;
    expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
    expect(eg.peaceOffers[0].sep).toBeUndefined();
    rec.sides[1].leader = gbr;
    stepPeaceOffers(eg, g.ticks());
    expect(eg.peaceOffers).toEqual([]);
    expect(ww.isAtWar(deu, fra)).toBe(true);
  });

  test("a peace offer waits behind a deal card with its clock stopped, then gets its full window", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { runner, g, ww, eg } = await started(humans);
    const [fra, est] = [id("FRA"), id("EST")];
    ww.politics.country(est)!.ppMilli = 100_000;
    expect(
      offerDeal(
        eg,
        est,
        {
          kind: "deal_offer",
          to: fra,
          give: [{ kind: "access" }],
          take: [{ kind: "nap" }],
        },
        g.ticks(),
      ),
    ).toBeNull();
    const deal = eg.deals[0];
    expect(deal.deadlineTick).toBe(g.ticks() + WW_DEAL_CARD_TICKS);
    const { w, deu } = bigWar(g, ww);
    expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
    const o = eg.peaceOffers[0];
    expect(o.deadlineTick).toBe(-1);
    step(runner, 20);
    expect(eg.peaceOffers[0]?.deadlineTick).toBe(-1);
    // The deal runs out (refused); the peace offer is in front now.
    stepTo(runner, deal.deadlineTick + 2);
    expect(eg.deals).toEqual([]);
    const left = eg.peaceOffers[0].deadlineTick - g.ticks();
    expect(left).toBeGreaterThan(WW_WHITE_PEACE_CARD_TICKS - 4);
    expect(left).toBeLessThanOrEqual(WW_WHITE_PEACE_CARD_TICKS);
  });

  test("a human side leader's chance rows judge every enemy member it may offer a separate peace", async () => {
    const humans = [{ clientID: HUMAN, country: "DEU" as const }];
    const { g, ww, eg } = await started(humans);
    const { w, deu, gbr, fra, pl } = bigWar(g, ww);
    const judge = peaceJudgeData(eg, true)!.filter(
      (r) => r.war === w && r.from === deu,
    );
    // The leader first (the screens' default row), then the members.
    expect(judge[0].to).toBe(gbr);
    expect(judge.map((r) => r.to).sort((a, b) => a - b)).toEqual(
      [gbr, fra, pl].sort((a, b) => a - b),
    );
    const line = linePeaceData(eg, true)!.filter(
      (r) => r.war === w && r.from === deu,
    );
    expect(line[0].to).toBe(gbr);
    expect(line.map((r) => r.to).sort((a, b) => a - b)).toEqual(
      [gbr, fra, pl].sort((a, b) => a - b),
    );
  });

  test("the deal rows price a human joining a war, and an AI joining the human's, as the engine values them", async () => {
    const humans = [{ clientID: HUMAN, country: "FRA" as const }];
    const { g, ww, eg } = await started(humans);
    const { w, deu, fra } = bigWar(g, ww);
    const rows = dealJudgeData(eg, true)!.filter((r) => r.from === fra);
    expect(rows.length).toBeGreaterThan(5);
    const army = ww.land.rowsOf(fra).length > 0;
    for (const r of rows) {
      expect(r.join).toBe(army ? WW_PROMISE_ALLY_PTS : 0);
      const ws = ww.politics.country(r.to)?.wsBp ?? 0;
      const ok = ws >= WW_PROMISE_WS_PCT * 100 && joinSideStrong(eg, w, fra);
      expect(r.joinWars).toEqual(ok ? [w] : []);
      // The engine's own value of that join_war item agrees with the row.
      expect(
        dealItemValue(
          eg,
          r.to,
          fra,
          { kind: "join_war", war: w, target: deu },
          r.to,
        ),
      ).toBe(ok ? -WW_PROMISE_JOIN_PTS : WW_DEAL_VETO);
    }
  });

  test("the collaboration region rule: the target's land I hold, not my core or claim, not at stake", () => {
    const facts = (
      over: Partial<CollabRegionFacts> = {},
    ): CollabRegionFacts => ({
      legalOwner: () => 2,
      controller: () => 1,
      hasCore: () => false,
      claims: () => false,
      inOpenStake: () => false,
      ...over,
    });
    expect(collabRegionOk(facts(), 1, 2, 9)).toBe(true);
    expect(collabRegionOk(facts({ legalOwner: () => 3 }), 1, 2, 9)).toBe(false);
    expect(collabRegionOk(facts({ controller: () => 3 }), 1, 2, 9)).toBe(false);
    expect(collabRegionOk(facts({ hasCore: (i) => i === 1 }), 1, 2, 9)).toBe(
      false,
    );
    expect(collabRegionOk(facts({ claims: (i) => i === 1 }), 1, 2, 9)).toBe(
      false,
    );
    expect(collabRegionOk(facts({ inOpenStake: () => true }), 1, 2, 9)).toBe(
      false,
    );
  });
});
