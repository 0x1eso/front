/**
 * Domestic mode balance simulation (spec §12.3).
 *
 * Runs nations-only games with domestic mode on, one per seed, and prints
 * when each nation reached the spec §11.2 milestones, then compares the
 * averages with the targets (times may miss by up to 3 minutes; "strict"
 * allows no slack). Each milestone counts the nations alive when it is due
 * (see MilestoneTarget.aliveAt); one fewer than half of them reach is
 * "rare", one due after the run's end "short". Not part of the test suite:
 * run it by hand after changing Balance.ts.
 *
 * With --congress the games also run the World Congress, and each seed
 * prints its sessions, adoptions, emergencies and sanctions.
 *
 *   npx tsx scripts/domestic-sim.ts [--map world] [--seeds 3] [--minutes 30]
 *                                   [--difficulty Hard] [--congress]
 */
import { ResultData } from "@openfront/engine-api/congress/CongressTypes";
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  WinUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { EngineConfig } from "@openfront/engine/configuration/EngineConfig";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { nationDomesticPlan } from "@openfront/engine/execution/nation/NationPersonality";
import { Game } from "@openfront/engine/game/Game";
import { createGame } from "@openfront/engine/game/GameImpl";
import { createNationsForGame } from "@openfront/engine/game/NationCreation";
import { GameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable, NationRecord, summarize } from "./domestic-sim-report";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_SPAWN_TURNS = 1000;
const TICKS_PER_MINUTE = 600;

interface Options {
  map: GameMapType;
  seeds: number;
  minutes: number;
  difficulty: Difficulty;
  congress: boolean;
}

function resolveMap(name: string): GameMapType {
  const key = Object.keys(GameMapType).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  if (key === undefined) throw new Error(`unknown map "${name}"`);
  return GameMapType[key as keyof typeof GameMapType];
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
    map: GameMapType.World,
    seeds: 3,
    minutes: 30,
    difficulty: Difficulty.Hard,
    congress: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--map":
        opts.map = resolveMap(next());
        break;
      case "--seeds":
        opts.seeds = parseInt(next(), 10);
        break;
      case "--minutes":
        opts.minutes = parseInt(next(), 10);
        break;
      case "--difficulty":
        opts.difficulty = resolveDifficulty(next());
        break;
      case "--congress":
        opts.congress = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

function newRecord(personality: string): NationRecord {
  return {
    personality,
    firstNuke: null,
    tier1: null,
    tier2: null,
    projectStart: null,
    projectDone: null,
    techs: 0,
    laws: 0,
    death: null,
  };
}

/** Records each nation's milestones as of now (called once per second). */
function sample(game: Game, records: Map<number, NationRecord>): void {
  const minute = game.elapsedGameSeconds() / 60;
  for (const p of game.allPlayers()) {
    if (p.type() !== PlayerType.Nation) continue;
    const d = p.domestic();
    if (d === null) continue;
    let r = records.get(p.smallID());
    if (r === undefined) {
      r = newRecord(nationDomesticPlan(p.id()).personality);
      records.set(p.smallID(), r);
    }
    if (!p.isAlive()) {
      r.death ??= minute;
      continue;
    }
    const nukes =
      p.unitsConstructed(UnitType.AtomBomb) +
      p.unitsConstructed(UnitType.HydrogenBomb) +
      p.unitsConstructed(UnitType.MIRV);
    if (r.firstNuke === null && nukes > 0) r.firstNuke = minute;
    const tier = d.governmentTier();
    if (r.tier1 === null && tier >= 1) r.tier1 = minute;
    if (r.tier2 === null && tier >= 2) r.tier2 = minute;
    const project = d.victoryProject();
    if (r.projectStart === null && project !== null) r.projectStart = minute;
    if (r.projectDone === null && project?.ticksLeft === 0) {
      r.projectDone = minute;
    }
    r.techs = d.researchedTechs().size;
    r.laws = d.proclaimedLaws().size;
  }
}

/** Every congress result as it is tallied (the history keeps only the last 8). */
function sampleCongress(game: Game, seen: Map<string, ResultData>): void {
  for (const r of game.congress()?.history() ?? []) {
    const key = `${r.sessionId}:${r.resolution}:${r.targets.join(",")}:${r.param ?? ""}`;
    if (!seen.has(key)) seen.set(key, r);
  }
}

interface CongressSummary {
  sessions: number;
  adopted: number;
  tied: number;
  emergenciesConvened: number;
  emergenciesDeclared: number;
  sanctionsAdopted: number;
  sanctionsTotal: number;
}

function summarizeCongress(results: readonly ResultData[]): CongressSummary {
  const regular = results.filter((r) => r.kind === "regular");
  const emergency = results.filter((r) => r.kind === "emergency");
  const sanctions = regular.filter((r) => r.resolution === "sanction");
  return {
    sessions: new Set(regular.map((r) => r.sessionId)).size,
    adopted: regular.filter((r) => r.adopted !== null).length,
    tied: regular.filter((r) => r.adopted === null).length,
    emergenciesConvened: emergency.length,
    emergenciesDeclared: emergency.filter((r) => r.adopted === "A").length,
    sanctionsAdopted: sanctions.filter((r) => r.adopted === "A").length,
    sanctionsTotal: sanctions.length,
  };
}

async function runSeed(
  opts: Options,
  seed: number,
): Promise<{ records: NationRecord[]; win: string; congress: ResultData[] }> {
  const gameConfig: GameConfig = {
    gameMap: opts.map,
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
    domesticMode: true,
    ...(opts.congress ? { congress: true } : {}),
  };
  const gameStart: GameStartInfo = {
    gameID: `domestic-sim-${seed}`,
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

  const result: { win: WinUpdate | null; error: string | null } = {
    win: null,
    error: null,
  };
  const runner = new GameRunner(
    game,
    new Executor(game, gameStart.gameID, undefined),
    (gu) => {
      if ("errMsg" in gu) {
        result.error = `${gu.errMsg}\n${gu.stack ?? ""}`;
        return;
      }
      result.win ??= gu.updates[GameUpdateType.Win][0] ?? null;
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

  const records = new Map<number, NationRecord>();
  const congress = new Map<string, ResultData>();
  let win = "none";
  for (let i = 0; i < opts.minutes * TICKS_PER_MINUTE; i++) {
    step();
    if (game.ticks() % 10 === 0) {
      sample(game, records);
      sampleCongress(game, congress);
    }
    if (result.win !== null && win === "none") {
      const minute = (game.elapsedGameSeconds() / 60).toFixed(1);
      win = `${result.win.reason ?? "?"} at ${minute} min`;
    }
  }
  return {
    records: [...records.values()],
    win,
    congress: [...congress.values()],
  };
}

function fmt(v: number | null): string {
  return v === null ? "-" : v.toFixed(1);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.debug = () => {}; // silence per-tick debug logging
  const all: NationRecord[] = [];
  const congressTotal: CongressSummary[] = [];
  for (let seed = 1; seed <= opts.seeds; seed++) {
    console.log(
      `\n=== seed ${seed}/${opts.seeds}: ${opts.map}, ${opts.difficulty}, ${opts.minutes} min ===`,
    );
    const { records, win, congress } = await runSeed(opts, seed);
    all.push(...records);
    console.log(`winner: ${win}`);
    console.log(
      formatTable(
        [
          "personality",
          "nuke",
          "tier1",
          "tier2",
          "start",
          "done",
          "techs",
          "laws",
          "died",
        ],
        records.map((r) => [
          r.personality,
          fmt(r.firstNuke),
          fmt(r.tier1),
          fmt(r.tier2),
          fmt(r.projectStart),
          fmt(r.projectDone),
          String(r.techs),
          String(r.laws),
          fmt(r.death),
        ]),
      ),
    );
    if (opts.congress) {
      const c = summarizeCongress(congress);
      congressTotal.push(c);
      console.log(
        formatTable(
          [
            "sessions",
            "adopted",
            "tied",
            "emergencies",
            "declared",
            "sanctions A",
          ],
          [
            [
              String(c.sessions),
              String(c.adopted),
              String(c.tied),
              String(c.emergenciesConvened),
              String(c.emergenciesDeclared),
              `${c.sanctionsAdopted}/${c.sanctionsTotal}`,
            ],
          ],
        ),
      );
    }
  }

  console.log(`\n=== targets (spec §11.2), ${all.length} nations ===`);
  console.log(
    formatTable(
      ["milestone", "measured", "reached", "target", "verdict", "strict"],
      summarize(all, opts.minutes).map((row) => [
        row.label,
        fmt(row.measured),
        `${row.reached}/${row.total}`,
        `${row.target[0]}-${row.target[1]}`,
        row.verdict,
        row.strict,
      ]),
    ),
  );

  if (opts.congress && congressTotal.length > 0) {
    const sum = (f: (c: CongressSummary) => number) =>
      congressTotal.reduce((acc, c) => acc + f(c), 0);
    const perGame = sum((c) => c.emergenciesConvened) / congressTotal.length;
    const sanctionsTotal = sum((c) => c.sanctionsTotal);
    const sanctionRate =
      sanctionsTotal === 0
        ? null
        : sum((c) => c.sanctionsAdopted) / sanctionsTotal;
    console.log(`\n=== congress targets, ${congressTotal.length} games ===`);
    console.log(
      formatTable(
        ["measure", "measured", "target", "verdict"],
        [
          [
            "emergencies per game",
            perGame.toFixed(1),
            "0-2",
            perGame <= 2 ? "ok" : "miss",
          ],
          [
            "sanction adoption",
            sanctionRate === null ? "-" : `${(sanctionRate * 100).toFixed(0)}%`,
            ">=50%",
            sanctionRate !== null && sanctionRate >= 0.5 ? "ok" : "miss",
          ],
        ],
      ),
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
