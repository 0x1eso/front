// World War 1936 P5 (plan Task 2, lane W; spec §5.1): what a capitulation
// does to control, the legal owner, the wars and the exile, on ww1936end.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WarLink } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

// Lane X's real formExile decides the exile (batch 21: the mock that gave
// Poland a host is gone; an enemy of the victor on its own land hosts).
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

const R = END.region;

describe("World War 1936 P5: capitulation (spec §5.1)", () => {
  it("capitulation moves control but keeps the legal owner", async () => {
    const { g, ww, eg } = await atWar();
    const [deu, pl] = [endId("DEU"), endId("POL")];
    war(g, "DEU", "POL");
    ww.land.setController(R.warsaw, deu, g.ticks());
    capitulate(g, ww, player(g, "POL"), g.ticks());
    // Krakow (still Polish-held) went to the victor, its point tile now.
    expect(ww.land.controller[R.krakow]).toBe(deu);
    const krakow = ww.scenario.region(R.krakow)!;
    expect(g.ownerID(ww.scenario.vpTile(krakow))).toBe(deu);
    // The legal owner is still Poland until the conference decides.
    expect(ww.politics.legalOwner[R.warsaw]).toBe(pl);
    expect(ww.politics.legalOwner[R.krakow]).toBe(pl);
    expect(eg.countryState(pl)).toBe("gone");
    expect(eg.isActor(pl)).toBe(false);
  });

  it("a capitulated country with a host becomes an exile and stays at war", async () => {
    const { g, ww, eg } = await atWar();
    const [deu, pl, gbr] = [endId("DEU"), endId("POL"), endId("GBR")];
    const w = war(g, "DEU", "POL");
    war(g, "GBR", "DEU", { kind: "into", warId: w.id });
    ww.land.setController(R.warsaw, deu, g.ticks());
    capitulate(g, ww, player(g, "POL"), g.ticks());
    // Britain, Germany's enemy on its side of the war, hosts it.
    expect(eg.isExile(pl)).toBe(true);
    expect(eg.exileHost(pl)).toBe(gbr);
    expect(eg.member(w, pl)!.state).toBe("exiled");
    // Its pairs stay: still at war with Germany; the war goes on.
    expect(ww.isAtWar(pl, deu)).toBe(true);
    expect(w.ended).toBeNull();
    expect(eg.conferences).toEqual([]);
    expect(eg.isActor(pl)).toBe(true);
    // Control still moved (the legal owner stays).
    expect(ww.land.controller[R.krakow]).toBe(deu);
    expect(ww.politics.legalOwner[R.krakow]).toBe(pl);
    expect(eg.endgameNews).toContainEqual({
      id: "news_exiled",
      params: { tag: "POL", tagTag: "POL", hostTag: "GBR", hostTagTag: "GBR" },
    });
  });

  it("without a host the country leaves its wars", async () => {
    const { g, ww, eg } = await atWar();
    const [deu, pl, sun] = [endId("DEU"), endId("POL"), endId("SUN")];
    const w1 = war(g, "DEU", "POL");
    const w2 = war(g, "SUN", "POL");
    ww.land.setController(R.warsaw, deu, g.ticks());
    capitulate(g, ww, player(g, "POL"), g.ticks());
    // Nobody fights Germany: no host.
    expect(eg.isExile(pl)).toBe(false);
    expect(ww.isAtWar(pl, deu)).toBe(false);
    expect(ww.isAtWar(pl, sun)).toBe(false);
    for (const w of [w1, w2]) {
      expect(eg.member(w, pl)!.state).toBe("capitulated");
      // The winners did not "leave": they won (spec §6.6).
      expect(w.sides[0].members.map((m) => m.state)).toEqual(["active"]);
      expect(w.ended?.winner).toBe(0);
    }
    expect(eg.conferences.map((c) => c.losers)).toEqual([[pl]]);
  });

  it("what the loser occupied goes back to a legal owner still at war with it", async () => {
    const { g, ww } = await atWar();
    const [deu, pl, fra, aut] = ["DEU", "POL", "FRA", "AUT"].map((t) =>
      endId(t as CountryTag),
    );
    war(g, "DEU", "POL");
    war(g, "DEU", "FRA");
    // Germany holds Warsaw (Poland: at war with it) and Vienna (Austria: at
    // peace); France holds Berlin, so France is the victor.
    ww.land.setController(R.warsaw, deu, g.ticks());
    ww.land.setController(R.vienna, deu, g.ticks());
    ww.land.setController(R.berlin, fra, g.ticks());
    capitulate(g, ww, player(g, "DEU"), g.ticks());
    expect(ww.land.controller[R.warsaw]).toBe(pl);
    expect(ww.land.controller[R.vienna]).toBe(fra);
    expect(ww.land.controller[R.munich]).toBe(fra);
    expect(ww.politics.legalOwner[R.warsaw]).toBe(pl);
    expect(ww.politics.legalOwner[R.vienna]).toBe(aut);
    expect(ww.politics.legalOwner[R.munich]).toBe(deu);
  });

  it("a winner kept for an end that did not come leaves, so the war can still end", async () => {
    const { g, ww, eg } = await atWar();
    const [deu, pl, ltu, fra] = ["DEU", "POL", "LTU", "FRA"].map((t) =>
      endId(t as CountryTag),
    );
    // Germany–Poland; Lithuania joins against Poland only, France against Germany.
    const w = war(g, "DEU", "POL");
    war(g, "LTU", "POL", { kind: "into", warId: w.id });
    war(g, "FRA", "DEU", { kind: "into", warId: w.id });
    // Nobody holds Poland's land, so there is no victor and no host (with
    // Germany the victor, France — its enemy — would host Poland in exile).
    capitulate(g, ww, player(g, "POL"), g.ticks());
    expect(eg.isExile(pl)).toBe(false);
    // The war goes on (France): Lithuania, paired with nobody now, has left.
    expect(w.ended).toBeNull();
    expect(eg.member(w, ltu)!.state).toBe("left");
    expect(eg.member(w, deu)!.state).toBe("active");
    // Germany falls to France: the war ends and its conference opens.
    ww.land.setController(R.berlin, fra, g.ticks());
    capitulate(g, ww, player(g, "DEU"), g.ticks());
    expect(w.ended?.winner).toBe(1);
    const c = eg.conferences.find((x) => x.warIds.includes(w.id))!;
    // Poland capitulated on the winning side: neither loser nor participant.
    expect(c.losers).toEqual([deu]);
    expect(c.parts.map((p) => p.id)).toEqual([fra]);
    expect(eg.member(w, pl)!.state).toBe("capitulated");
  });

  it("a civil war's party keeps its land for that war's winner, not a foreign victor", async () => {
    const { g, ww, eg } = await atWar();
    const [deu, ltu, pl] = [endId("DEU"), endId("LTU"), endId("POL")];
    // Poland rose against Lithuania's government (a civil war); Germany
    // fights Lithuania too and holds Kaunas, so Germany is P0's victor.
    const cw = war(g, "POL", "LTU", { kind: "declare", war: "civil" });
    war(g, "DEU", "LTU");
    ww.land.setController(R.kaunas, deu, g.ticks());
    capitulate(g, ww, player(g, "LTU"), g.ticks());
    // A civil war's party looks for no host (spec §5.1-3).
    expect(eg.isExile(ltu)).toBe(false);
    // The civil war ended on Poland's side (lane C's endCivilWar hands the
    // land on); Memel did not go to Germany first.
    expect(cw.ended?.winner).toBe(0);
    expect(eg.member(cw, pl)!.state).toBe("active");
    expect(ww.land.controller[R.memel]).not.toBe(deu);
    expect(ww.politics.legalOwner[R.memel]).not.toBe(deu);
    expect(ltu).toBeGreaterThan(0);
  });
});
