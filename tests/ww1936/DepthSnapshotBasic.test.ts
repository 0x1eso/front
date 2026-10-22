// World War 1936 P6 (spec §21.6, plan decision 26): the depth state
// survives a snapshot; a snapshot without it is refused.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { setEmbargo } from "@openfront/engine/ww1936/depth/Embargo";
import type { DesignSlot } from "@openfront/engine/ww1936/depth/WwDepth";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
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
    // Pre-flight §0-8: the four values made on one day and read on a later
    // one are state (review E5).
    d.lastPriorityGot.set(DEEP.tag.DEU, [0, 0, 0, 0, 0, 0, 2, 1]);
    d.sea.reconBySide.push([1, DEEP.sr.central, 12]);
    d.resistBoost.push([DEEP.region.warsaw, 5]);
    d.world.regionStatus.push([DEEP.region.paris, 900, 80, 10, 95]);
    d.reindexSparse();
    step(a, 600);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    expect(gameHash(b)).toBe(gameHash(a));
    expect(
      b.game.worldWar()!.depth.designSlot(DEEP.tag.DEU, "tank", 1)?.def,
    ).toEqual(TEST_TANK);
    lockstep(a, b, 300);
  });

  it("a stats mark from inside the land tick never crosses into a snapshot (review E1)", async () => {
    const a = await wwRunner({}, HUMANS, DEEP.map);
    stepTo(a, WW_PREP_TICKS + 2);
    // A landmark region changing hands mid-tick (after depth.clock).
    const ww = a.game.worldWar()!;
    const land = ww.land;
    const tick = land.tick.bind(land);
    let done = false;
    land.tick = (t: number) => {
      tick(t);
      if (!done) {
        done = true;
        land.setController(DEEP.region.paris, DEEP.tag.DEU, t);
      }
    };
    const marks = vi.spyOn(ww.depth, "markStats");
    step(a, 1);
    land.tick = tick;
    expect(marks).toHaveBeenCalledWith(DEEP.tag.DEU);
    marks.mockRestore();
    expect(
      (ww.depth as unknown as { depthDirtyStats: Set<number> }).depthDirtyStats
        .size,
    ).toBe(0);
    const b = await wwRestore(a, HUMANS, DEEP.map);
    expect(gameHash(b)).toBe(gameHash(a));
    lockstep(a, b, 120);
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
