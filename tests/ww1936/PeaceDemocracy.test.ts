// ww106: an AI democracy goes to war to win. At the table it wants what any
// winner wants and frees only its own side's countries; a democracy that is
// winning fights on, whoever leads its side, and won't sign away a friend's
// occupied land while it can still win. A human democracy is left alone.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  CS_GONE,
  DEMAND_KINDS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_STALEMATE_DAYS,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_DEM, IDEO_FAS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game } from "@openfront/engine/game/Game";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import {
  aiWantsLinePeace,
  lineAiAccepts,
} from "@openfront/engine/ww1936/endgame/LinePeace";
import { peaceJudgeData } from "@openfront/engine/ww1936/endgame/NegPeace";
import { aiDemands } from "@openfront/engine/ww1936/endgame/PeaceAi";
import { addWarScore } from "@openfront/engine/ww1936/endgame/Wars";
import {
  aiAccepts,
  aiWantsPeace,
  democracyFightsOn,
  offerPeace,
} from "@openfront/engine/ww1936/endgame/WhitePeace";
import type {
  Conference,
  PeaceOffer,
  WwEndgame,
} from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import {
  END_MAP,
  stepTo,
  takeRegion,
  withoutAssignment,
  WwHuman,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const R = END.region;
const id = (t: CountryTag) => endId(t);
const [MUNICH, KRAKOW] = [4, 7];

async function started(humans: WwHuman[] = []) {
  const runner = await wwRunner({}, humans, END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const g = runner.game;
  const ww = g.worldWar()!;
  for (const t of ["FRA", "GBR", "POL"] as CountryTag[]) {
    ww.politics.country(id(t))!.ruling = IDEO_DEM;
  }
  ww.politics.country(id("DEU"))!.ruling = IDEO_FAS;
  return { g, ww, eg: ww.endgame };
}

/** `winner` beats Czechoslovakia alone: Slovakia's core is in the stake, it was on nobody's side. */
function beatCsk(g: Game, ww: WorldWar, winner: CountryTag): Conference {
  const eg = ww.endgame;
  const w = id(winner);
  ww.setWar(w, id("CSK"), g.ticks(), { kind: "declare" });
  addWarScore(eg, eg.warOfPair(w, id("CSK")), w, 1000);
  ww.land.setController(R.prague, w, g.ticks());
  const p = g.playerBySmallID(id("CSK"));
  if (!p.isPlayer()) throw new Error("no CSK");
  const before = eg.conferences.length;
  capitulate(g, ww, p, g.ticks());
  const c = eg.conferences[before];
  withoutAssignment(eg, c);
  c.parts.find((x) => x.id === w)!.pts = 5000;
  return c;
}

const kinds = (eg: WwEndgame, c: Conference, who: number) =>
  aiDemands(eg, c.id, who).map((d) => DEMAND_KINDS[d.kind]);
const frees = (k: string) => k === "release" || k === "liberate";

/** A war of Germany against `first` and, on its side, `rest`; old enough for offers. */
function warOn(
  g: Game,
  ww: WorldWar,
  first: CountryTag,
  rest: CountryTag[] = [],
) {
  const eg = ww.endgame;
  const deu = id("DEU");
  ww.setWar(deu, id(first), g.ticks(), { kind: "declare" });
  const w = eg.warOfPair(deu, id(first));
  for (const t of rest) {
    ww.setWar(id(t), deu, g.ticks(), { kind: "into", warId: w });
  }
  eg.war(w)!.startDay = ww.day(g.ticks()) - WW_WHITE_PEACE_MIN_DAYS;
  ww.politics.country(deu)!.ppMilli = 100_000;
  return w;
}

/** Factories by tag, the rest none; the front last moved `stale` days ago. */
function board(
  ww: WorldWar,
  w: number,
  g: Game,
  fac: Partial<Record<CountryTag, number>>,
  stale: number,
) {
  const eg = ww.endgame;
  const by = new Map(
    Object.entries(fac).map(([t, n]) => [id(t as CountryTag), n]),
  );
  eg.factoriesOf = (x: number) => by.get(x) ?? 0;
  const day = ww.day(g.ticks());
  eg.fronts = [[w, 0, 0, day - stale]];
  return day;
}

/** How many of 200 rolls say yes. */
function yes(o: PeaceOffer, fn: (x: PeaceOffer) => boolean): number {
  let n = 0;
  for (let i = 1; i <= 200; i++) if (fn({ ...o, id: 1000 + i })) n++;
  return n;
}

describe("ww106: an AI democracy at the table", { timeout: 120_000 }, () => {
  it("frees no enemy's part", async () => {
    const t = await started();
    const c = beatCsk(t.g, t.ww, "FRA");
    expect(kinds(t.eg, c, id("FRA")).some(frees)).toBe(false);
  });

  it("frees a country of its side, by the history table's row as well", async () => {
    const t = await started();
    const fra = id("FRA");
    const svk = id("SVK");
    const c = beatCsk(t.g, t.ww, "FRA");
    // Slovakia fought at France's side, and is gone.
    const war = t.eg.war(c.warIds[0])!;
    t.eg.setCountryState(svk, CS_GONE);
    war.sides[t.eg.sideIndex(war, fra) as 0 | 1].members.push({
      ...war.sides[t.eg.sideIndex(war, fra) as 0 | 1].members[0],
      id: svk,
      state: "left",
    });
    expect(kinds(t.eg, c, fra)).toContain("liberate");
  });

  it("a history row doesn't make it free an enemy's land", async () => {
    usePoliticsContent(
      endgameFixture({
        peace: [
          {
            loser: "CSK",
            lines: [
              {
                by: { tag: "FRA" },
                demands: [{ kind: "liberate", tag: "SVK" }],
              },
            ],
          },
        ],
      }),
    );
    const t = await started();
    const c = beatCsk(t.g, t.ww, "FRA");
    expect(kinds(t.eg, c, id("FRA")).some(frees)).toBe(false);
  });

  it("spends its points on land as any winner: takes at full value", async () => {
    const t = await started();
    const fra = id("FRA");
    const c = beatCsk(t.g, t.ww, "FRA");
    const land = aiDemands(t.eg, c.id, fra).flatMap((d) =>
      DEMAND_KINDS[d.kind] === "take_group" ? d.regions : [],
    );
    const annexed = kinds(t.eg, c, fra).includes("annex_rest");
    expect(land.length > 0 || annexed).toBe(true);
  });

  it("a human democracy's card is what it was: it may still free anyone", async () => {
    const t = await started([{ clientID: "HFRA", country: "FRA" }]);
    t.ww.politics.country(id("FRA"))!.ruling = IDEO_DEM;
    const c = beatCsk(t.g, t.ww, "FRA");
    expect(kinds(t.eg, c, id("FRA"))).toContain("liberate");
  });
});

describe(
  "ww106: a democracy that is winning fights on",
  { timeout: 120_000 },
  () => {
    it("a whole-war offer is refused at every roll, whoever leads its side", async () => {
      const { g, ww, eg } = await started();
      const [deu, sun] = [id("DEU"), id("SUN")];
      const w = warOn(g, ww, "SUN", ["FRA"]);
      expect(
        eg.war(w)!.sides[eg.sideIndex(eg.war(w)!, sun) as 0 | 1].leader,
      ).toBe(sun);
      takeRegion(g, MUNICH, "SUN");
      const day = board(ww, w, g, { SUN: 600, FRA: 100, DEU: 100 }, 10);
      expect(
        democracyFightsOn(
          eg,
          eg.war(w)!,
          eg.sideIndex(eg.war(w)!, sun) as 0 | 1,
          day,
        ),
      ).toBe(true);
      expect(offerPeace(eg, deu, w, sun, g.ticks())).toBeNull();
      const o = eg.peaceOffers[0];
      ww.politics.country(sun)!.wsBp = 0;
      expect(yes(o, (x) => aiAccepts(eg, x, day))).toBe(0);
      expect(yes(o, (x) => lineAiAccepts(eg, { ...x, line: true }, day))).toBe(
        0,
      );
      // Without a democracy in the fight the leader's judge answers as before.
      ww.politics.country(id("FRA"))!.ruling = IDEO_FAS;
      expect(
        yes(o, (x) => lineAiAccepts(eg, { ...x, line: true }, day)),
      ).toBeGreaterThan(0);
    });

    it("it neither asks for peace nor offers the line while it wins", async () => {
      const { g, ww, eg } = await started();
      const fra = id("FRA");
      const w = warOn(g, ww, "FRA");
      const rec = eg.war(w)!;
      // Weary and stalled it would offer: the old rule.
      ww.politics.country(fra)!.wsBp = 0;
      let day = board(
        ww,
        w,
        g,
        { FRA: 200, DEU: 100 },
        WW_WHITE_PEACE_STALEMATE_DAYS,
      );
      expect(aiWantsPeace(eg, rec, fra, day)).toBe(true);
      day = board(ww, w, g, { FRA: 200, DEU: 100 }, 10);
      expect(aiWantsPeace(eg, rec, fra, day)).toBe(false);
      expect(aiWantsLinePeace(eg, rec, fra, day)).toBe(false);
    });

    it("on a stalled front the old judge is back, unless a friend's land would go", async () => {
      const { g, ww, eg } = await started();
      const [deu, fra] = [id("DEU"), id("FRA")];
      const w = warOn(g, ww, "FRA", ["POL"]);
      const day = board(
        ww,
        w,
        g,
        { FRA: 250, POL: 10, DEU: 100 },
        WW_WHITE_PEACE_STALEMATE_DAYS,
      );
      ww.politics.country(fra)!.wsBp = 0;
      expect(offerPeace(eg, deu, w, fra, g.ticks())).toBeNull();
      const o = eg.peaceOffers[0];
      // Weariness stays: a white peace can pass.
      expect(yes(o, (x) => aiAccepts(eg, x, day))).toBeGreaterThan(0);
      // Germany holds a Polish region: the line would give it away, whatever
      // it brings.
      takeRegion(g, KRAKOW, "DEU");
      takeRegion(g, MUNICH, "FRA");
      expect(yes(o, (x) => lineAiAccepts(eg, { ...x, line: true }, day))).toBe(
        0,
      );
      // Weaker than Germany it can't win it back: the old judge.
      board(
        ww,
        w,
        g,
        { FRA: 50, POL: 10, DEU: 100 },
        WW_WHITE_PEACE_STALEMATE_DAYS,
      );
      expect(
        yes(o, (x) => lineAiAccepts(eg, { ...x, line: true }, day)),
      ).toBeGreaterThan(0);
    });

    it("the composer shows a winning democracy's no", async () => {
      const human: WwHuman[] = [{ clientID: "HDEU", country: "DEU" }];
      const { g, ww, eg } = await started(human);
      const w = warOn(g, ww, "FRA");
      takeRegion(g, MUNICH, "FRA");
      board(ww, w, g, { FRA: 200, DEU: 100 }, 10);
      eg.lastCommonDay = ww.day(g.ticks());
      const row = peaceJudgeData(eg, true)!.find((r) => r.war === w)!;
      expect(row.pct).toBe(0);
      expect(row.reason).toBe("winning");
    });
  },
);
