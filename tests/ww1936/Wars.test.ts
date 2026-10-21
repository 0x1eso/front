// World War 1936 P5 (plan Task 2, lane W; spec §4.4–§4.5): wars ending
// and the war score, on ww1936end.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WarLink } from "@openfront/engine-api/ww1936/EndgameTypes";
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import {
  addWarScore,
  checkWarEnds,
  dailyWarScore,
  noteDamage,
  noteKills,
  warBetween,
  warScoreShare,
} from "@openfront/engine/ww1936/endgame/Wars";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

async function atWar(): Promise<{ g: Game; ww: WorldWar; eg: WwEndgame }> {
  const runner = await wwRunner({}, [], END_MAP);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { g: runner.game, ww, eg: ww.endgame };
}

const player = (g: Game, tag: CountryTag): Player => {
  const p = g.playerBySmallID(endId(tag));
  if (!p.isPlayer()) throw new Error(`no ${tag}`);
  return p;
};

/** `a` goes to war with `b` (a new war, or into one); the pair's war record. */
function war(
  g: Game,
  a: CountryTag,
  b: CountryTag,
  link: WarLink = { kind: "declare" },
) {
  const ww = g.worldWar()!;
  expect(ww.setWar(endId(a), endId(b), g.ticks(), link)).toBe(true);
  return ww.endgame.war(ww.endgame.warOfPair(endId(a), endId(b)))!;
}

const day = (g: Game) => g.worldWar()!.day(g.ticks());

describe("World War 1936 P5: wars end (spec §4.4)", () => {
  it("a war ends when one side has no active member", async () => {
    const { g, eg } = await atWar();
    const w = war(g, "DEU", "POL");
    checkWarEnds(eg, day(g), g.ticks());
    expect(w.ended).toBeNull();
    // Poland is out: the war is over, Germany's side won.
    eg.setMemberState(w.id, endId("POL"), "capitulated");
    checkWarEnds(eg, day(g), g.ticks());
    expect(w.ended).toEqual({ day: day(g), winner: 0 });
    expect(eg.conferences.map((c) => c.warIds)).toEqual([[w.id]]);
    expect(eg.conferences[0].losers).toEqual([endId("POL")]);
    expect(eg.conferences[0].parts.map((p) => p.id)).toEqual([endId("DEU")]);
  });

  it("a member that stopped playing without capitulating is out (lane C)", async () => {
    const { g, eg } = await atWar();
    const w = war(g, "DEU", "LTU");
    // Lithuania is gone (wiped out, no capitulation): its side has nobody.
    eg.setCountryState(endId("LTU"), CS_GONE);
    checkWarEnds(eg, day(g), g.ticks());
    expect(w.ended?.winner).toBe(0);
    expect(eg.member(w, endId("LTU"))!.state).toBe("capitulated");
    expect(eg.conferences[0].losers).toEqual([endId("LTU")]);
  });

  it("a side that only left ends the war without a winner or a conference", async () => {
    const { g, ww, eg } = await atWar();
    const w = war(g, "DEU", "POL");
    ww.endWar(endId("DEU"), endId("POL"));
    checkWarEnds(eg, day(g), g.ticks());
    expect(w.ended).toEqual({ day: day(g), winner: -1 });
    expect(eg.conferences).toEqual([]);
  });

  it("an exile-only losing side passes into the host's war (spec §4.4 Norway)", async () => {
    const { g, ww, eg } = await atWar();
    const [deu, ita, ltu, gbr] = ["DEU", "ITA", "LTU", "GBR"].map((t) =>
      endId(t as CountryTag),
    );
    // 1939: Germany–Poland, Britain on Poland's side.
    const w1 = war(g, "DEU", "POL");
    war(g, "GBR", "DEU", { kind: "into", warId: w1.id });
    // 1940: Germany and Italy against Lithuania ("Norway").
    const w2 = war(g, "DEU", "LTU");
    war(g, "ITA", "LTU", { kind: "into", warId: w2.id });
    // Lithuania went into exile in Britain (lane X: an exile in its host's wars).
    eg.exiles.push({
      smallID: ltu,
      host: gbr,
      legitBp: 5000,
      sinceDay: day(g),
      zeroDays: 0,
      lastDelta: 0,
      faction: -1,
      capital: END.capital.GBR!,
    });
    eg.rebuildDerived();
    eg.setMemberState(w2.id, ltu, "exiled");
    w1.sides[1].members.push({
      id: ltu,
      state: "exiled",
      joinedDay: day(g),
      wsMilli: 0,
    });
    eg.rebuildDerived();
    checkWarEnds(eg, day(g), g.ticks());
    // No conference: the war is over and its pairs fight on in 1939's war.
    expect(w2.ended).toEqual({ day: day(g), winner: -1 });
    expect(eg.conferences).toEqual([]);
    expect(w1.ended).toBeNull();
    expect(eg.warOfPair(deu, ltu)).toBe(w1.id);
    expect(eg.warOfPair(ita, ltu)).toBe(w1.id);
    expect(ww.isAtWar(ita, ltu)).toBe(true);
    // Italy, not in that war yet, joins it opposite the exile.
    expect(eg.sideIndex(w1, ita)).toBe(0);
    expect(eg.member(w1, ita)!.state).toBe("active");
    expect(eg.warsOf(ita)).toContain(w1.id);
  });

  it("two wars ending on one tick with the same loser make one conference", async () => {
    const { g, ww, eg } = await atWar();
    const w1 = war(g, "DEU", "POL");
    const w2 = war(g, "SUN", "POL");
    expect(w1.id).not.toBe(w2.id);
    ww.land.setController(END.region.warsaw, endId("DEU"), g.ticks());
    addWarScore(eg, w1.id, endId("DEU"), 3000);
    addWarScore(eg, w2.id, endId("SUN"), 1000);
    capitulate(g, ww, player(g, "POL"), g.ticks());
    expect(w1.ended?.winner).toBe(0);
    expect(w2.ended?.winner).toBe(0);
    expect(eg.conferences).toHaveLength(1);
    const c = eg.conferences[0];
    expect(c.warIds).toEqual([w1.id, w2.id]);
    expect(c.losers).toEqual([endId("POL")]);
    expect(c.parts.map((p) => [p.id, p.wsMilli])).toEqual([
      [endId("DEU"), 3000],
      [endId("SUN"), 1000],
    ]);
  });
});

describe("World War 1936 P5: the war score (spec §4.5)", () => {
  it("war score: a day of occupation adds the region's points", async () => {
    const { g, ww, eg } = await atWar();
    const w = war(g, "DEU", "POL");
    const [deu, pl] = [endId("DEU"), endId("POL")];
    ww.land.setController(END.region.warsaw, deu, g.ticks());
    dailyWarScore(eg, day(g));
    expect(eg.member(w, deu)!.wsMilli).toBe(END.vp[END.region.warsaw] * 1000);
    // Its own land held by itself gives nothing; a second day adds again.
    expect(eg.member(w, pl)!.wsMilli).toBe(0);
    dailyWarScore(eg, day(g) + 1);
    expect(eg.member(w, deu)!.wsMilli).toBe(
      2 * END.vp[END.region.warsaw] * 1000,
    );
  });

  it("damage adds one point per 1,000 casualties to the smallest shared war", async () => {
    const { g, eg } = await atWar();
    const [deu, pl] = [endId("DEU"), endId("POL")];
    const w1 = war(g, "DEU", "POL");
    // A second war with both in it, on opposite sides (Italy–Soviet Union).
    const w2 = war(g, "ITA", "SUN");
    war(g, "DEU", "SUN", { kind: "into", warId: w2.id });
    war(g, "POL", "ITA", { kind: "into", warId: w2.id });
    expect(eg.sideIndex(w2, deu)).not.toBe(eg.sideIndex(w2, pl));
    expect(warBetween(eg, deu, pl)!.id).toBe(w1.id);
    noteDamage(eg, deu, pl, 2500);
    expect(eg.member(w1, deu)!.wsMilli).toBe(2500);
    expect(eg.member(w2, deu)!.wsMilli).toBe(0);
    // Kills: a ship by its supremacy weight ×10 points, a convoy ×2, a plane ×0.5.
    noteKills(eg, pl, deu, "ship", 3);
    noteKills(eg, pl, deu, "convoy", 2);
    noteKills(eg, pl, deu, "plane", 4);
    expect(eg.member(w1, pl)!.wsMilli).toBe(30_000 + 4_000 + 2_000);
    // Shares within a side (‰).
    expect(warScoreShare(eg, deu, pl)).toBe(1000);
    expect(warScoreShare(eg, endId("FRA"), pl)).toBe(0);
  });
});
