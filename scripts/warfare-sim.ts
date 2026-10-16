/**
 * Expanded warfare balance check (spec §14b, "수치 검증").
 *
 * Plays nations-only games on the world map with warfareExpansion off and
 * on, the same seeds both ways, and prints who won (and whether the winner
 * started in Asia), how long the game took, how much land the Asia-start
 * nations held at the end, and how often each warfare unit was built. It
 * only reports: tune packages/engine-lib/src/warfare/Warfare.ts by hand.
 * Not part of the test suite.
 *
 *   npx tsx scripts/warfare-sim.ts [--seeds 3] [--minutes 30]
 *                                  [--difficulty Hard] [--domestic]
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { Game } from "@openfront/engine/game/Game";
import { createGame } from "@openfront/engine/game/GameImpl";
import { createNationsForGame } from "@openfront/engine/game/NationCreation";
import { GameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable } from "./domestic-sim-report";
import {
  ASIA_NATIONS,
  RunRecord,
  summarizeRuns,
  WARFARE_SIM_TYPES,
} from "./warfare-sim-report";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_SPAWN_TURNS = 1000;
const TICKS_PER_MINUTE = 600;

interface Options {
  seeds: number;
  minutes: number;
  difficulty: Difficulty;
  domestic: boolean;
}

function resolveDifficulty(name: string): Difficulty {
  const found = Object.values(Difficulty).find(
    (d) => d.toLowerCase() === name.toLowerCase(),
  );
  if (found === undefined) throw new Error(`unknown difficulty "${name}"`);
  return found;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    seeds: 3,
    minutes: 30,
    difficulty: Difficulty.Hard,
    domestic: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--seeds":
        opts.seeds = parseInt(next(), 10);
        break;
      case "--minutes":
        opts.minutes = parseInt(next(), 10);
        break;
      case "--difficulty":
        opts.difficulty = resolveDifficulty(next());
        break;
      case "--domestic":
        opts.domestic = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function asiaLandShare(game: Game): number {
  let tiles = 0;
  for (const p of game.players()) {
    if (p.type() === PlayerType.Nation && ASIA_NATIONS.has(p.name())) {
      tiles += p.numTilesOwned();
    }
  }
  return tiles / game.totalLandTiles();
}

async function runGame(
  opts: Options,
  seed: number,
  warfare: boolean,
): Promise<RunRecord> {
  const gameConfig: GameConfig = {
    gameMap: GameMapType.World,
    gameMapSize: GameMapSize.Normal,
    gameMode: GameMode.FFA,
    gameType: GameType.Public,
    difficulty: opts.difficulty,
    nations: "default",
    donateGold: false,
    donateTroops: false,
    bots: 0,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    randomSpawn: false,
    ...(opts.domestic ? { domesticMode: true } : {}),
    ...(warfare ? { warfareExpansion: true } : {}),
  };
  const gameStart: GameStartInfo = {
    gameID: `warfare-sim-${seed}`,
    lobbyCreatedAt: 0,
    config: gameConfig,
    players: [],
  };
  const terrain = await loadTerrainMap(
    await loadMapFiles(
      new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
      gameConfig.gameMap,
      gameConfig.gameMapSize,
    ),
  );
  const nations = createNationsForGame(
    gameStart,
    terrain.nations,
    terrain.additionalNations,
    0,
    new PseudoRandom(simpleHash(gameStart.gameID)),
  );
  const game = createGame(
    [],
    nations,
    terrain.gameMap,
    terrain.miniGameMap,
    new EngineConfig(gameConfig, false),
    terrain.teamGameSpawnAreas,
  );
  const result: { error: string | null } = { error: null };
  const runner = new GameRunner(
    game,
    new Executor(game, gameStart.gameID, undefined),
    (gu) => {
      if ("errMsg" in gu) result.error = `${gu.errMsg}\n${gu.stack ?? ""}`;
    },
  );
  runner.init();

  let turn = 0;
  const step = (): void => {
    runner.addTurn({ turnNumber: turn++, intents: [] });
    if (!runner.executeNextTick() || result.error !== null) {
      throw new Error(`game errored at tick ${game.ticks()}:\n${result.error}`);
    }
  };
  while (game.inSpawnPhase()) {
    if (turn >= MAX_SPAWN_TURNS) throw new Error("spawn phase did not end");
    step();
  }
  const start = game.ticks();
  while (
    game.ticks() - start < opts.minutes * TICKS_PER_MINUTE &&
    game.getWinner() === null
  ) {
    step();
  }

  const built: Record<string, number> = {};
  for (const type of WARFARE_SIM_TYPES) {
    built[type] = game
      .allPlayers()
      .reduce((n, p) => n + p.unitsConstructed(type), 0);
  }
  const winner = game.getWinner();
  return {
    seed,
    warfare,
    winner:
      winner === null || typeof winner === "string" ? null : winner.name(),
    minutes: (game.ticks() - start) / TICKS_PER_MINUTE,
    asiaLand: asiaLandShare(game),
    built,
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.debug = () => {}; // silence per-tick debug logging
  const runs: RunRecord[] = [];
  for (let seed = 1; seed <= opts.seeds; seed++) {
    for (const warfare of [false, true]) {
      console.log(
        `\n=== seed ${seed}/${opts.seeds}: world, ${opts.difficulty}, warfare ${warfare ? "on" : "off"}${opts.domestic ? ", domestic" : ""}, ${opts.minutes} min ===`,
      );
      const run = await runGame(opts, seed, warfare);
      runs.push(run);
      const asian = run.winner !== null && ASIA_NATIONS.has(run.winner);
      console.log(
        `winner: ${run.winner ?? "none"}${asian ? " (Asia)" : ""} at ${run.minutes.toFixed(1)} min; Asia-start land ${(run.asiaLand * 100).toFixed(1)}%`,
      );
      console.log(
        WARFARE_SIM_TYPES.map((t) => `${t}: ${run.built[t]}`).join(", "),
      );
    }
  }
  console.log(`\n=== warfare off vs on, ${opts.seeds} seed(s) ===`);
  console.log(
    formatTable(
      ["measure", "off", "on"],
      summarizeRuns(runs).map((r) => [r.label, r.off, r.on]),
    ),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
