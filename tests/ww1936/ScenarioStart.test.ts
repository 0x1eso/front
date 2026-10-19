import {
  GameMapSize,
  GameMapType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { fillScenarioOwners } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { byTag, HUMAN, MINI, step, wwRunner, wwRunnerCapture } from "./util";

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

  test("the view fills the same owners as the engine", async () => {
    const runner = await wwRunner();
    const view = await loadTerrainMap(
      await loadMapFiles(
        new TestDataMapLoader(MINI),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
    );
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

  test("the spawn phase ends on tick 0; capitals and half troops", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    for (const p of g.allPlayers()) {
      expect(p.spawnTile()).toBe(
        ww.scenario.capitalTile(ww.tagOf(p.smallID())),
      );
      expect(p.troops()).toBe(Math.floor((g.config().maxTroops(p) * 50) / 100));
    }
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
    });
  });
});
