// World War 1936 P5 (spec §21.5, plan decision 25): the endgame's state
// survives a snapshot; a restored game goes on tick for tick.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, gameHash, step, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const HUMANS = [{ clientID: "HUMANPOL", country: "POL" as const }];

function lockstep(a: GameRunner, b: GameRunner, ticks: number): void {
  expect(diffGraphs(a.game, b.game)).toEqual([]);
  for (let i = 0; i < ticks; i++) {
    step(a);
    step(b);
    if (gameHash(a) !== gameHash(b)) {
      throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
    }
  }
  expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual([]);
  expect(diffGraphs(a.game, b.game)).toEqual([]);
}

describe("World War 1936 P5: the endgame in a snapshot", () => {
  it("100 ticks, a snapshot, 100 more: the same as without", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const eg = ww.endgame;
    // Some of every kind of endgame state.
    ww.setWar(endId("DEU"), endId("CSK"), a.game.ticks(), { kind: "declare" });
    ww.setWar(endId("ITA"), endId("CSK"), a.game.ticks(), {
      kind: "into",
      warId: 0,
    });
    eg.addCore(endId("DEU"), 13);
    eg.setControl("HUMANPOL", endId("AUT"));
    eg.resBp[15] = 1200;
    eg.compBp[15] = 300;
    eg.occSince[15] = 3;
    eg.zones.push({ region: 7, holder: endId("SUN"), untilDay: 999 });
    eg.dmz.push([4, endId("DEU")]);
    eg.nameKey[endId("CW1")] = "ww1936.cw_name.communist";
    eg.nameArg[endId("CW1")] = "CSK";
    ww.land.setController(15, endId("DEU"), a.game.ticks());
    step(a, 100);
    const b = await wwRestore(a, HUMANS, END_MAP);
    expect(b.game.worldWar()!.endgame.wars).toHaveLength(1);
    expect(b.game.worldWar()!.endgame.isAdministered(15)).toBe(
      eg.isAdministered(15),
    );
    expect(b.game.worldWar()!.endgame.controlledBy("HUMANPOL")).toBe(
      endId("AUT"),
    );
    lockstep(a, b, 100);
  }, 60_000);

  it("a snapshot without the endgame state is refused", async () => {
    const a = await wwRunner({}, [], END_MAP);
    step(a, 2);
    const ww = a.game.worldWar()!;
    const s = ww.snapshot();
    delete s.endgame;
    expect(() => ww.restoreState(s)).toThrow(/P5 endgame/);
  });
});
