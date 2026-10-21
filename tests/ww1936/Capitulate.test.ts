// World War 1936 P5 (plan Task 2, lane W; spec §5.1): what a capitulation
// does to control, the legal owner, the wars and the exile, on ww1936end.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WarLink } from "@openfront/engine-api/ww1936/EndgameTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { capitulate } from "@openfront/engine/ww1936/Capitulation";
import { formExile } from "@openfront/engine/ww1936/endgame/Exile";
import type { WwEndgame } from "@openfront/engine/ww1936/endgame/WwEndgame";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { vi } from "vitest";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

// Lane X decides the exile (formExile); one test gives Poland a host.
vi.mock("@openfront/engine/ww1936/endgame/Exile", async (original) => {
  const real =
    await original<typeof import("@openfront/engine/ww1936/endgame/Exile")>();
  return { ...real, formExile: vi.fn(real.formExile) };
});

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => {
  usePoliticsContent(null);
  vi.mocked(formExile).mockClear();
});

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
    vi.mocked(formExile).mockImplementationOnce((e, loser) => {
      e.exiles.push({
        smallID: loser,
        host: gbr,
        legitBp: 5000,
        sinceDay: ww.day(g.ticks()),
        zeroDays: 0,
        lastDelta: 0,
        faction: -1,
        capital: END.capital.GBR!,
      });
      e.rebuildDerived();
      return true;
    });
    capitulate(g, ww, player(g, "POL"), g.ticks());
    expect(formExile).toHaveBeenCalledWith(eg, pl, deu, g.ticks());
    expect(eg.isExile(pl)).toBe(true);
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
    expect(formExile).toHaveBeenCalled();
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
});
