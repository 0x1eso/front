import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ErrorUpdate,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import {
  GameConfig,
  GameStartInfo,
  Intent,
  StampedIntent,
} from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { Game, Player } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { removeLine } from "@openfront/engine/ww1936/economy/Production";
import { cancelResearch } from "@openfront/engine/ww1936/economy/ResearchRun";
import type {
  CountryEconomy,
  WwEconomy,
} from "@openfront/engine/ww1936/economy/WwEconomy";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";

export const MINI = "ww1936mini";
export const HUMAN = "HUMAN001";

export interface WwHuman {
  clientID: string;
  country?: CountryTag;
}

export function wwGameStart(
  config: Partial<GameConfig> = {},
  humans: WwHuman[] = [],
): GameStartInfo {
  return {
    gameID: "WWTEST01",
    lobbyCreatedAt: 0,
    config: {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Private,
      difficulty: Difficulty.Medium,
      nations: "default",
      bots: 0,
      donateGold: true,
      donateTroops: true,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      worldWar1936: true,
      ...config,
    },
    players: humans.map((h, i) => ({
      clientID: h.clientID,
      username: `player${i}`,
      clanTag: null,
      isLobbyCreator: i === 0,
      ...(h.country === undefined ? {} : { country: h.country }),
    })),
  };
}

/** A runner on the test map; `updates` collects every tick's view data. */
export async function wwRunnerCapture(
  config: Partial<GameConfig> = {},
  humans: WwHuman[] = [],
): Promise<{ runner: GameRunner; updates: GameUpdateViewData[] }> {
  const start = wwGameStart(config, humans);
  const updates: GameUpdateViewData[] = [];
  const runner = await createGameRunner(
    start,
    undefined,
    await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    (gu: GameUpdateViewData | ErrorUpdate) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
      updates.push(gu);
    },
  );
  return { runner, updates };
}

export async function wwRunner(
  config: Partial<GameConfig> = {},
  humans: WwHuman[] = [],
): Promise<GameRunner> {
  return (await wwRunnerCapture(config, humans)).runner;
}

/** Runs n ticks; the intents go into the first one. */
export function step(
  runner: GameRunner,
  n = 1,
  intents: StampedIntent[] = [],
): void {
  for (let i = 0; i < n; i++) {
    runner.addTurn({
      turnNumber: runner.game.ticks(),
      intents: i === 0 ? intents : [],
    });
    if (!runner.executeNextTick()) {
      throw new Error(`tick ${runner.game.ticks()} did not run`);
    }
  }
}

/** Runs until game.ticks() reaches `tick`. */
export function stepTo(runner: GameRunner, tick: number): void {
  while (runner.game.ticks() < tick) step(runner);
}

export function stamped(clientID: string, intent: Intent): StampedIntent {
  return { ...intent, clientID } as StampedIntent;
}

export function byTag(game: Game, tag: CountryTag): Player {
  const p = game.worldWar()?.playerOfTag(tag) ?? null;
  if (p === null) throw new Error(`no ${tag} in this game`);
  return p;
}

/**
 * Takes back a country's starting lines and research (WwEconomy.start
 * gives every country the AI's day-0 lines and slots) with the orders a
 * player would give, for a test that measures lines or slots from none.
 */
export function clearStartSetup(econ: WwEconomy, ce: CountryEconomy): void {
  for (const l of [...ce.lines]) removeLine(econ, ce, l.id);
  ce.slots.forEach((s, i) => {
    if (s !== null) cancelResearch(econ, ce, i);
  });
}
