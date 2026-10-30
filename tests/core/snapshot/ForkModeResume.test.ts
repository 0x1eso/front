// A saved solo game resumed the way the Solo modal resumes one
// (SinglePlayerModal.startSavedGame): the header's config and its one
// human's clientID, a fresh game id, and the worker's view resync. The
// fork's modes must come back whole: their config, the human's own country,
// and every screen's data on the first tick, since the page's view of a
// resumed game starts empty.
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  type GameUpdateViewData,
  type PlayerUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import type { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import type { WwEconomyData } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwLandData } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { msPerTickOf } from "@openfront/engine-lib/ww1936/Pace";
import {
  createGameRunnerFromSnapshot,
  type GameRunner,
} from "@openfront/engine/GameRunner";
import { readSnapshotHeader } from "@openfront/engine/snapshot/GameSnapshot";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { describe, expect, test } from "vitest";
import {
  createScriptedRunner,
  SCRIPTED_HUMANS,
  scriptedGameStart,
  stepScripted,
  TestDataMapLoader,
} from "../../util/ScriptedGame";
import { byTag, HUMAN, MINI, step, stepTo, wwRunner } from "../../ww1936/util";

/** The game start the Solo modal builds from a save's header. */
function resumeStart(bytes: Uint8Array): GameStartInfo {
  const header = readSnapshotHeader(bytes);
  expect(header.gameConfig.gameType).toBe(GameType.Singleplayer);
  expect(header.humans).toHaveLength(1);
  return {
    gameID: "RESUMED01",
    lobbyCreatedAt: 0,
    config: header.gameConfig,
    players: [
      {
        clientID: header.humans[0].clientID,
        username: "loader",
        clanTag: null,
      },
    ],
  };
}

/** Resumes `bytes` and runs its first tick, which carries the resync. */
async function resume(
  bytes: Uint8Array,
  mapName: string,
): Promise<{ runner: GameRunner; first: GameUpdateViewData }> {
  const start = resumeStart(bytes);
  const updates: GameUpdateViewData[] = [];
  const runner = await createGameRunnerFromSnapshot(
    start,
    bytes,
    start.players[0].clientID,
    await loadMapFiles(
      new TestDataMapLoader(mapName),
      start.config.gameMap,
      start.config.gameMapSize,
    ),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
      updates.push(gu);
    },
  );
  runner.game.queueViewResync();
  runner.addTurn({ turnNumber: runner.game.ticks(), intents: [] });
  expect(runner.executeNextTick()).toBe(true);
  return { runner, first: updates[0] };
}

const SOLO_HUMAN = SCRIPTED_HUMANS[0];

describe("a saved solo game resumes whole in the fork's modes", () => {
  test("domestic mode, expanded warfare and the world congress", async () => {
    const config: Partial<GameConfig> = {
      gameType: GameType.Singleplayer,
      domesticMode: true,
      warfareExpansion: true,
      congress: true,
    };
    const start = scriptedGameStart(config);
    start.players = start.players.slice(0, 1);
    const runner = await createScriptedRunner("world", start);
    while (runner.game.ticks() < 900) stepScripted(runner);
    const human = runner.game.playerByClientID(SOLO_HUMAN)!;
    expect(human.isAlive()).toBe(true);

    const bytes = runner.snapshot("DEV");
    expect(readSnapshotHeader(bytes).gameConfig).toMatchObject(config);
    expect(readSnapshotHeader(bytes).humans).toEqual([
      { clientID: SOLO_HUMAN, name: human.name() },
    ]);

    const { runner: resumed, first } = await resume(bytes, "world");
    const me = resumed.game.playerByClientID(SOLO_HUMAN)!;
    expect(me.name()).toBe(human.name());
    expect(me.domestic()).not.toBeNull();
    // The screens' data, sent in full: the human's domestic state rides on
    // its first (full) player update, and the congress on its own.
    const mine = (first.updates[GameUpdateType.Player] as PlayerUpdate[]).find(
      (p) => p.clientID === SOLO_HUMAN,
    );
    expect(mine?.domestic).toBeDefined();
    expect(first.updates[GameUpdateType.Congress]).toHaveLength(1);
    expect(first.updates[GameUpdateType.SpawnPhaseEnd]).toHaveLength(1);
    for (let i = 0; i < 300; i++) stepScripted(resumed);
  }, 120_000);

  test.each([
    { name: "Medium", config: {} },
    {
      name: "Easy, unlimited",
      config: { difficulty: Difficulty.Easy, ww1936Unlimited: true },
    },
  ])(
    "World War 1936 ($name)",
    async ({ config }) => {
      const runner = await wwRunner(
        { gameType: GameType.Singleplayer, ...config },
        [{ clientID: HUMAN, country: "DEU" }],
      );
      stepTo(runner, WW_PREP_TICKS + 300);
      const bytes = runner.snapshot("DEV");
      const header = readSnapshotHeader(bytes);
      expect(header.gameConfig).toMatchObject({
        worldWar1936: true,
        gameMap: GameMapType.World1936,
        gameMapSize: GameMapSize.Normal,
        ...config,
      });
      // The resumed game keeps the saved game's pace (400 ms ticks unlimited).
      expect(msPerTickOf(header.gameConfig)).toBe(
        "ww1936Unlimited" in config ? 400 : 100,
      );

      const { runner: resumed, first } = await resume(bytes, MINI);
      // The human is still Germany, by the clientID its intents carry.
      expect(resumed.game.playerByClientID(HUMAN)?.smallID()).toBe(
        byTag(resumed.game, "DEU").smallID(),
      );
      expect(
        resumed.game
          .worldWar()!
          .isHumanControlled(byTag(resumed.game, "DEU").smallID()),
      ).toBe(true);
      // Every screen's data on the first tick, the land and economy for every
      // region (a running game sends only what changed).
      for (const type of [
        GameUpdateType.WorldWar,
        GameUpdateType.WwEconomy,
        GameUpdateType.WwLand,
        GameUpdateType.WwPolitics,
        GameUpdateType.WwNavy,
        GameUpdateType.WwAir,
        GameUpdateType.WwEndgame,
        GameUpdateType.WwDepth,
      ]) {
        expect(first.updates[type], GameUpdateType[type]).toHaveLength(1);
      }
      const regions = resumed.game.worldWar()!.scenario.landRegions.length;
      const land = first.updates[GameUpdateType.WwLand][0] as unknown as {
        data: WwLandData;
      };
      expect(land.data.regions).toHaveLength(regions);
      const econ = first.updates[GameUpdateType.WwEconomy][0] as unknown as {
        data: WwEconomyData;
      };
      expect(econ.data.regions).toHaveLength(regions);
      step(resumed, 300);
    },
    120_000,
  );
});
