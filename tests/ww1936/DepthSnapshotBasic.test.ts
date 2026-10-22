// World War 1936 P6 (spec §21.6, plan decision 26): the depth state
// survives a snapshot; a snapshot without it is refused.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { setEmbargo } from "@openfront/engine/ww1936/depth/Embargo";
import type { DesignSlot } from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { gameHash, step, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const HUMANS = [{ clientID: "HUMANITA", country: "ITA" as const }];

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

describe("World War 1936 P6: the depth state in a snapshot", () => {
  it("a restored game continues with the same hash", async () => {
    const a = await wwRunner({}, HUMANS, DEEP.map);
    stepTo(a, WW_PREP_TICKS + 2);
    const d = a.game.worldWar()!.depth;
    // Some of the foundation's state of each kind.
    const deu = d.country(DEEP.tag.DEU)!;
    deu.des.tank[0] = {
      def: TEST_TANK as DesignSlot["def"],
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    d.markDesign(DEEP.tag.DEU, "tank", 1);
    deu.doc.masteryMilli[1] = 123_456;
    d.setNetMilli(DEEP.tag.GBR, DEEP.tag.DEU, 250_000);
    setEmbargo(d, DEEP.tag.GBR, DEEP.tag.ITA, true);
    d.markNuked(DEEP.region.berlin, 400);
    d.sea.mines.push([1002, DEEP.tag.ITA, 5_000]);
    d.world.damLevel[DEEP.dam.dam_mohne.index] = 0;
    stepTo(a, 600);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    expect(gameHash(b)).toBe(gameHash(a));
    expect(
      b.game.worldWar()!.depth.designSlot(DEEP.tag.DEU, "tank", 1)?.def,
    ).toEqual(TEST_TANK);
    lockstep(a, b, 300);
  });

  it("a snapshot without depth is refused", async () => {
    const a = await wwRunner({}, [], DEEP.map);
    step(a, 2);
    const ww = a.game.worldWar()!;
    const s = ww.snapshot();
    delete s.depth;
    expect(() => ww.restoreState(s)).toThrow(/without its depth/);
  });
});
