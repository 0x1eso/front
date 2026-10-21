// World War 1936 P5 (spec §7, plan decision 17, pre-flight §0-3, §0-5): the
// core table and the administered regions.
import { CS_GONE } from "@openfront/engine-api/ww1936/EndgameTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

describe("World War 1936 P5: the core table", () => {
  it("1936 cores come from the scenario and CORES_1936", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    const ww = runner.game.worldWar()!;
    const eg = ww.endgame;
    const [csk, svk] = [endId("CSK"), endId("SVK")];
    for (const r of [15, 20]) {
      expect(eg.coreHolders(r)).toEqual([csk, svk]);
      expect(ww.politics.isCore(r)).toBe(true);
    }
    // Every region of the map is a core of its 1936 owner (scenario `core`).
    for (const r of ww.scenario.landRegions) {
      expect(eg.hasCore(endId(END.owner[r.id]), r.id), `${r.id}`).toBe(
        END.core[r.id],
      );
    }
    expect(eg.coreHolders(14)).toEqual([csk]);
  });

  it("a fourth core pushes out the smallest gone holder", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    const eg = runner.game.worldWar()!.endgame;
    const [deu, ita, csk, svk, hrv] = ["DEU", "ITA", "CSK", "SVK", "HRV"].map(
      (t) => endId(t as "DEU"),
    );
    eg.addCore(deu, 15);
    expect(eg.coreHolders(15)).toEqual([deu, csk, svk]);
    // Full, nobody gone or dormant but SVK: the dormant one goes first.
    eg.addCore(hrv, 15);
    expect(eg.coreHolders(15)).toEqual([deu, csk, hrv]);
    // Full of active and dormant ones: HRV (dormant) goes for ITA.
    eg.addCore(ita, 15);
    expect(eg.coreHolders(15)).toEqual([deu, ita, csk]);
    // All active: no room.
    eg.addCore(svk, 15);
    expect(eg.coreHolders(15)).toEqual([deu, ita, csk]);
    // A gone holder makes room.
    eg.setCountryState(ita, CS_GONE);
    eg.addCore(svk, 15);
    expect(eg.coreHolders(15)).toEqual([deu, csk, svk]);
    eg.removeCore(deu, 15);
    expect(eg.coreHolders(15)).toEqual([csk, svk]);
  });

  it("setLegalOwner with core adds the receiver", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    const ww = runner.game.worldWar()!;
    const deu = endId("DEU");
    ww.politics.setLegalOwner(13, deu);
    expect(ww.endgame.hasCore(deu, 13)).toBe(false);
    expect(ww.politics.isCore(13)).toBe(false);
    ww.politics.setLegalOwner(13, deu, true);
    expect(ww.endgame.hasCore(deu, 13)).toBe(true);
    expect(ww.politics.isCore(13)).toBe(true);
    // The old holder keeps its core (spec §7.2).
    expect(ww.endgame.hasCore(endId("CSK"), 13)).toBe(true);
  });

  it("administered = controller without a core and someone else with one", async () => {
    const runner = await wwRunner({}, [], END_MAP);
    const g = runner.game;
    const ww = g.worldWar()!;
    const eg = ww.endgame;
    const [deu, sun] = [endId("DEU"), endId("SUN")];
    ww.land.setController(15, deu, g.ticks());
    expect(eg.isAdministered(15)).toBe(true);
    expect(eg.administeredOf(deu)).toEqual([15]);
    // Munich is Germany's core: never administered by Germany.
    expect(eg.isAdministered(4)).toBe(false);
    // A region with no core at all: nobody administers it.
    eg.removeCore(deu, 4);
    ww.land.setController(4, sun, g.ticks());
    expect(eg.coreHolders(4)).toEqual([]);
    expect(eg.isAdministered(4)).toBe(false);
    // Back to its core holder: not administered.
    ww.land.setController(15, endId("CSK"), g.ticks());
    expect(eg.isAdministered(15)).toBe(false);
  });
});
