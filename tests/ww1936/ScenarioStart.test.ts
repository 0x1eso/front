import {
  GameMapSize,
  GameMapType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { fillScenarioOwners } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import {
  restoreGame,
  snapshotGame,
} from "@openfront/engine/snapshot/GameSnapshot";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import { byTag, HUMAN, MINI, step, wwRunner, wwRunnerCapture } from "./util";

/** The mini map's terrain and scenario, freshly loaded. */
async function miniTerrain() {
  return loadTerrainMap(
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
  );
}

describe("World War 1936 start", () => {
  test("every scenario country is a player, in COUNTRY_TAGS order", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    const g = runner.game;
    expect(g.worldWar()!.scenario.countries).toEqual([
      "DEU",
      "ITA",
      "GBR",
      "FRA",
      "SUN",
      "POL",
    ]);
    const players = g.allPlayers();
    expect(players.map((p) => p.smallID())).toEqual([1, 2, 3, 4, 5, 6]);
    expect(players.map((p) => p.name())).toEqual([
      "Germany",
      "Italy",
      "United Kingdom",
      "France",
      "Soviet Union",
      "Poland",
    ]);
    expect(players.map((p) => p.type())).toEqual([
      PlayerType.Nation,
      PlayerType.Nation,
      PlayerType.Nation,
      PlayerType.Nation,
      PlayerType.Nation,
      PlayerType.Human,
    ]);
    expect(g.playerByClientID(HUMAN)!.name()).toBe("Poland");
  });

  test("duplicate and unknown picks fall back to the next free country", async () => {
    const runner = await wwRunner({}, [
      { clientID: "HUMANAAA", country: "DEU" },
      { clientID: "HUMANBBB", country: "DEU" },
      { clientID: "HUMANCCC", country: "USA" },
      { clientID: "HUMANDDD" },
    ]);
    const name = (id: string) => runner.game.playerByClientID(id)!.name();
    expect(name("HUMANAAA")).toBe("Germany");
    expect(name("HUMANBBB")).toBe("United Kingdom");
    expect(name("HUMANCCC")).toBe("Soviet Union");
    expect(name("HUMANDDD")).toBe("France");
  });

  test("every land tile starts with its 1936 owner", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const scenario = g.worldWar()!.scenario;
    const owners = scenario.ownerByRegion();
    let land = 0;
    g.forEachTile((t) => {
      if (!g.isLand(t)) {
        expect(g.ownerID(t)).toBe(0);
        return;
      }
      land++;
      expect(g.ownerID(t)).toBe(owners[scenario.regionAt(t)]);
    });
    expect(g.allPlayers().reduce((n, p) => n + p.numTilesOwned(), 0)).toBe(
      land,
    );
    expect(byTag(g, "GBR").numTilesOwned()).toBe(300);
  });

  test("fillScenarioOwners on a fresh map gives the engine's owners", async () => {
    const runner = await wwRunner();
    const view = await miniTerrain();
    fillScenarioOwners(view.gameMap, view.scenario!);
    runner.game.forEachTile((t) => {
      expect(view.gameMap.ownerID(t)).toBe(runner.game.ownerID(t));
    });
  });

  test("no tile updates on the opening ticks", async () => {
    const { runner, updates } = await wwRunnerCapture();
    step(runner, 3);
    expect(updates.map((u) => u.packedTileUpdates.length)).toEqual([0, 0, 0]);
  });

  test("the spawn phase ends on tick 0; capitals and the 1936 armies", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    for (const p of g.allPlayers()) {
      const tag = ww.tagOf(p.smallID());
      expect(p.spawnTile()).toBe(ww.scenario.capitalTile(tag));
      // P2 spec §6.4, §13.2: the troops are the 1936 divisions' men.
      expect(p.troops()).toBe(ww.land.fieldMen(p.smallID()));
      expect(p.troops()).toBeGreaterThan(0);
    }
    // Germany: 45 infantry divisions of 10,500 men (P1's 480,000 army).
    expect(byTag(g, "DEU").troops()).toBe(472_500);
    // Poland (dev 1): 30% of its 255,000-man army in 9,000-man divisions.
    expect(byTag(g, "POL").troops()).toBe(8 * 9_000);
    step(runner);
    expect(g.inSpawnPhase()).toBe(false);
    expect(ww.prepEndTick()).toBe(WW_PREP_TICKS);
  });

  test("the first WorldWar update tells the preparation end", async () => {
    const { runner, updates } = await wwRunnerCapture();
    step(runner, 3);
    const ww = updates.flatMap((u) => u.updates[GameUpdateType.WorldWar]);
    expect(ww).toHaveLength(1);
    expect(ww[0].data).toEqual({
      prepEndTick: WW_PREP_TICKS,
      wars: [],
      capitulated: [],
      gauges: [],
    });
  });

  test("a snapshot restores the same object graph", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    step(runner, 5);
    const g = runner.game;
    g.worldWar()!.setWar(
      byTag(g, "DEU").smallID(),
      byTag(g, "POL").smallID(),
      g.ticks(),
    );
    step(runner, 2);
    const bytes = snapshotGame(g);
    const terrain = await miniTerrain();
    const restored = restoreGame(bytes, {
      config: (gc) => new EngineConfig(gc, false),
      gameMap: terrain.gameMap,
      miniGameMap: terrain.miniGameMap,
      scenario: terrain.scenario,
    });
    // Each AI country's PlayerInfo is shared by _humans and its Nation.
    expect(diffGraphs(g, restored)).toEqual([]);
    expect(diffSnapshots(bytes, snapshotGame(restored))).toEqual([]);
  });

  test("a World War 1936 snapshot without its state is refused", async () => {
    const runner = await wwRunner();
    step(runner, 2);
    const terrain = await miniTerrain();
    // Vanilla-shaped bytes for a World War 1936 config: drop the key.
    const bytes = snapshotGame(runner.game);
    const g = runner.game as unknown as { _worldWar: unknown };
    const ww = g._worldWar;
    g._worldWar = null;
    const stripped = snapshotGame(runner.game);
    g._worldWar = ww;
    expect(() =>
      restoreGame(stripped, {
        config: (gc) => new EngineConfig(gc, false),
        gameMap: terrain.gameMap,
        miniGameMap: terrain.miniGameMap,
        scenario: terrain.scenario,
      }),
    ).toThrow(/worldWar/);
    expect(bytes.length).toBeGreaterThan(stripped.length);
  });

  test("the static scenario is read-only in its types", async () => {
    const s = (await wwRunner()).game.worldWar()!.scenario;
    // Never called: `npm run typecheck` checks these lines.
    const writes = () => {
      // @ts-expect-error: owners are static scenario data
      s.ownerByRegion()[1] = 0;
      // @ts-expect-error: regions are static scenario data
      s.landRegions[0].vp = 99;
      // @ts-expect-error: tuples inside are read-only too
      s.data.regions[0].vpTile[0] = 1;
      // @ts-expect-error: the region list itself is read-only
      s.data.regions.push(s.data.regions[0]);
    };
    expect(typeof writes).toBe("function");
  });
});
