// World War 1936 P5 (spec §7.3, §20.4): the occupation rows the screens
// read carry the days compliance has stayed high, so the occupation tab
// greys "Integrate" as the engine would refuse it.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { END, endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

describe("World War 1936 P5: the occupation view", () => {
  it("an occupation row carries the days compliance stayed high", async () => {
    const a = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      END_MAP,
    );
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const eg = ww.endgame;
    const warsaw = Number(
      Object.keys(END.owner).find(
        (r) => END.owner[Number(r)] === "POL" && END.core[Number(r)],
      ),
    );
    ww.land.setController(warsaw, endId("DEU"), a.game.ticks());
    expect(eg.isAdministered(warsaw)).toBe(true);
    eg.compBp[warsaw] = 9_200;
    eg.compHigh[warsaw] = 42;
    const row = eg.takeData()!.occupation!.find((o) => o.region === warsaw);
    expect(row?.controller).toBe(endId("DEU"));
    expect(row?.compBp).toBe(9_200);
    expect(row?.compHighDays).toBe(42);
  }, 60_000);

  it("a region no longer occupied goes out as gone, so the screens drop its row", async () => {
    const a = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      END_MAP,
    );
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const eg = ww.endgame;
    const warsaw = END.region.warsaw;
    eg.takeData();
    ww.land.setController(warsaw, endId("DEU"), a.game.ticks());
    const first = eg.takeData()!;
    expect(first.occupation!.map((o) => o.region)).toContain(warsaw);
    expect(first.occupationGone).toBeUndefined();
    // Poland holds it again: no row, and the region listed as gone.
    ww.land.setController(warsaw, endId("POL"), a.game.ticks());
    expect(eg.isAdministered(warsaw)).toBe(false);
    const next = eg.takeData()!;
    expect(next.occupation!.map((o) => o.region)).not.toContain(warsaw);
    expect(next.occupationGone).toContain(warsaw);
  }, 60_000);
});
