// ww103: an AI side holding a beaten country doesn't give it back. A white or
// negotiated peace revives what a hard push took (Germany fell from 100 regions
// to 46 in a full game), so that side offers and takes the line only. A human's
// offers stay open to him, and an AI side with nobody beaten deals as before.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CS_GONE,
  WW_WHITE_PEACE_MIN_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game } from "@openfront/engine/game/Game";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import {
  aiLinePeaceDay,
  lineAiAccepts,
} from "@openfront/engine/ww1936/endgame/LinePeace";
import { peaceJudgeData } from "@openfront/engine/ww1936/endgame/NegPeace";
import {
  aiAcceptPct,
  aiAccepts,
  aiPeaceDay,
  aiWantsPeace,
  holdsBeaten,
  offerPeace,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import type { PeaceOffer } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, HUMAN, stepTo, takeRegion, WwHuman, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const id = (t: CountryTag) => endId(t);
const [MUNICH, WARSAW, KRAKOW, PRAGUE, KOSICE] = [4, 6, 7, 14, 20];

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  return { g, ww, eg: ww.endgame };
}

function oldWar(g: Game, ww: WorldWar, a: number, b: number): number {
  ww.setWar(a, b, g.ticks(), { kind: "declare" });
  const w = ww.endgame.warOfPair(a, b);
  ww.endgame.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
  for (const x of [a, b]) ww.politics.country(x)!.ppMilli = 100_000;
  return w;
}

/** Germany beats Poland, France still fighting at Poland's side. */
function poland(g: Game, ww: WorldWar): number {
  const [deu, pl, fra] = [id("DEU"), id("POL"), id("FRA")];
  const eg = ww.endgame;
  const w = oldWar(g, ww, deu, pl);
  ww.setWar(fra, deu, g.ticks(), { kind: "into", warId: w });
  // Poland is small beside France, so the war stays even; one region stays
  // Poland's under the line, the other goes.
  ww.politics.setLegalOwner(WARSAW, fra);
  ww.politics.setLegalOwner(PRAGUE, fra);
  ww.politics.setLegalOwner(KOSICE, pl);
  takeRegion(g, WARSAW, "FRA");
  takeRegion(g, PRAGUE, "FRA");
  takeRegion(g, KRAKOW, "DEU");
  takeRegion(g, KOSICE, "DEU");
  ww.addCapitulation(pl, deu, g.ticks());
  eg.setMemberState(w, pl, "capitulated");
  ww.endWar(deu, pl);
  eg.setCountryState(pl, CS_GONE);
  ww.politics.country(fra)!.ppMilli = 100_000;
  return w;
}

describe(
  "an AI side keeps a beaten country down (ww103)",
  { timeout: 120_000 },
  () => {
    it("a white offer to it is refused at every roll; a line can pass", async () => {
      const { g, ww, eg } = await started();
      const [deu, fra] = [id("DEU"), id("FRA")];
      const w = poland(g, ww);
      const rec = eg.war(w)!;
      expect(holdsBeaten(eg, [deu], [id("POL")])).toBe(true);
      const day = ww.day(g.ticks());
      expect(offerPeace(eg, fra, w, deu, g.ticks())).toBeNull();
      const o = eg.peaceOffers[0];
      // Tired of the war it would say yes often: the old rule.
      ww.politics.country(deu)!.wsBp = 0;
      expect(aiAcceptPct(eg, o, day)).toBeGreaterThan(0);
      const yes = (fn: (x: PeaceOffer) => boolean) => {
        let n = 0;
        for (let i = 1; i <= 200; i++) if (fn({ ...o, id: 1000 + i })) n++;
        return n;
      };
      expect(yes((x) => aiAccepts(eg, x, day))).toBe(0);
      expect(
        yes((x) => lineAiAccepts(eg, { ...x, line: true }, day)),
      ).toBeGreaterThan(0);
      expect(rec.ended).toBeNull();
    });

    it("nobody beaten: the AI's answer is the old one", async () => {
      const { g, ww, eg } = await started();
      const [deu, fra] = [id("DEU"), id("FRA")];
      const w = oldWar(g, ww, deu, fra);
      takeRegion(g, KRAKOW, "DEU");
      expect(holdsBeaten(eg, [deu], [id("POL"), fra])).toBe(false);
      ww.politics.country(deu)!.wsBp = 0;
      expect(offerPeace(eg, fra, w, deu, g.ticks())).toBeNull();
      const day = ww.day(g.ticks());
      const o = eg.peaceOffers[0];
      let n = 0;
      for (let i = 1; i <= 200; i++) {
        if (aiAccepts(eg, { ...o, id: 1000 + i }, day)) n++;
      }
      expect(n).toBeGreaterThan(0);
    });

    it("holding one, it offers the line, not the peace that revives it", async () => {
      const { g, ww, eg } = await started();
      const [deu, fra] = [id("DEU"), id("FRA")];
      const w = poland(g, ww);
      const rec = eg.war(w)!;
      const day = ww.day(g.ticks());
      // Tired of a stalled, even war, it wants out; France holds Munich.
      takeRegion(g, MUNICH, "FRA");
      for (const x of [deu, fra]) ww.politics.country(x)!.wsBp = 0;
      eg.fronts = [[w, 0, 0, day - 180]];
      for (const x of [deu, fra]) ww.economy.country(x)!.totals.civ = 10;
      expect(aiWantsPeace(eg, rec, deu, day)).toBe(true);
      aiPeaceDay(eg, deu, day, g.ticks());
      expect(eg.peaceOffers).toEqual([]);
      aiLinePeaceDay(eg, deu, day, g.ticks());
      expect(eg.peaceOffers).toHaveLength(1);
      expect(eg.peaceOffers[0]).toMatchObject({
        from: deu,
        to: fra,
        line: true,
      });
    });

    it("the composer shows a human that the AI won't take it", async () => {
      const { g, ww, eg } = await started([
        { clientID: HUMAN, country: "FRA" },
      ]);
      const [deu, fra] = [id("DEU"), id("FRA")];
      const w = poland(g, ww);
      eg.lastCommonDay = ww.day(g.ticks());
      const row = peaceJudgeData(eg, true)!.find(
        (r) => r.war === w && r.from === fra,
      )!;
      expect(row).toMatchObject({ to: deu, pct: 0, reason: "winning" });
    });
  },
);
