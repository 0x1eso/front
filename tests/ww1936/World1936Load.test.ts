import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { fillScenarioOwners } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";

const maps = new NodeGameMapLoader(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../resources/maps",
  ),
);

describe("starting on the world1936 map (spec §5.3)", () => {
  test("decoding the regions and filling every owner is quick", async () => {
    const files = await loadMapFiles(
      maps,
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const t0 = performance.now();
    const data = await loadTerrainMap(files);
    const t1 = performance.now();
    fillScenarioOwners(data.gameMap, data.scenario!);
    const t2 = performance.now();
    console.log(
      `world1936: terrain+regions ${(t1 - t0).toFixed(0)} ms, owners ${(t2 - t1).toFixed(0)} ms`,
    );
    // Target on a desktop: 300 ms for the fill. The bound leaves room for CI.
    expect(t2 - t1).toBeLessThan(1500);
    let unowned = 0;
    data.gameMap.forEachTile((t) => {
      if (
        data.gameMap.isLand(t) &&
        !data.gameMap.isImpassable(t) &&
        data.gameMap.ownerID(t) === 0
      ) {
        unowned++;
      }
    });
    expect(unowned).toBe(0);
    // The P2 rebuild kept 24 islands (P4 spec §3.2): 209 land tiles more
    // than version 2's 2,457,383 (cmd/ww1936build prints the count).
    expect(data.gameMap.numLandTiles()).toBe(2_457_592);
  }, 60_000);
});
