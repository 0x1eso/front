// World War 1936 P5 (spec §21.5, plan decision 25): the endgame's state
// survives a snapshot; a restored game goes on tick for tick.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  transferArmyTo,
  transferDivisionsTo,
} from "@openfront/engine/ww1936/land/PoliticsBridge";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { END, endId } from "./endFixture";
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

  it("divisions that change hands go on tick for tick after a restore", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    // The stats caches hold the old owner's numbers first.
    step(a, 20);
    const land = a.game.worldWar()!.land;
    expect(land.rowsOf(endId("POL")).length).toBeGreaterThan(2);
    const [first] = land.armiesOf(endId("POL")).sort((x, y) => x.id - y.id);
    const ids = [...first.divisions].sort((x, y) => x - y).slice(0, 2);
    expect(first.divisions.length).toBeGreaterThan(2);
    // Two divisions to one country, the rest of the army to another.
    expect(transferDivisionsTo(land, ids, endId("CSK"))).not.toBeNull();
    expect(transferArmyTo(land, first, endId("GBR"))).not.toBeNull();
    const rows = ids.map((id) => land.divisions.rowOf(id));
    for (const r of rows) expect(land.divisions.owner[r]).toBe(endId("CSK"));
    // The by-owner row lists (warm before the transfer) moved with them.
    expect(land.rowsOf(endId("POL"))).toEqual([]);
    expect(land.rowsOf(endId("CSK"))).toEqual(expect.arrayContaining(rows));
    step(a, 30);
    const b = await wwRestore(a, HUMANS, END_MAP);
    lockstep(a, b, 60);
  }, 60_000);

  it("the first update after a restore sends the cores, occupation and aid", async () => {
    const a = await wwRunner({}, HUMANS, END_MAP);
    stepTo(a, WW_PREP_TICKS + 2);
    const ww = a.game.worldWar()!;
    const pl = endId("POL");
    const warsaw = Number(
      Object.keys(END.owner).find(
        (r) => END.owner[Number(r)] === "POL" && END.core[Number(r)],
      ),
    );
    // A core of Germany's and a Polish core region Germany holds.
    ww.endgame.addCore(endId("DEU"), 13);
    ww.land.setController(warsaw, endId("DEU"), a.game.ticks());
    expect(ww.endgame.isAdministered(warsaw)).toBe(true);
    step(a, 2);
    const b = await wwRestore(a, HUMANS, END_MAP);
    const d = b.game.worldWar()!.endgame.takeData()!;
    expect(d.coreChanges).toEqual(
      expect.arrayContaining([
        { region: 13, holders: ww.endgame.coreHolders(13) },
        { region: warsaw, holders: [pl] },
      ]),
    );
    expect(d.occupation!.map((o) => o.region)).toEqual([warsaw]);
    expect(d.aid!.map((x) => x.smallID)).toEqual([pl]);
    // Later updates send only the changes again.
    expect(b.game.worldWar()!.endgame.takeData()?.coreChanges).toBeUndefined();
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
