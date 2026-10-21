/**
 * World War 1936 determinism check (P2 Task 12, P3 Task 17): the long run
 * of tests/ww1936/WorldLockstep.test.ts. On the real world1936 map, all
 * AI, one game plays to `--until`; at every moment of tests/ww1936/
 * lockstep.ts (mid-battle, retreats, spreads, capitulations and their
 * transfers, peaceful transfers, delayed events and AI choices,
 * justifications, faction changes, training, paradrops) and every
 * `--periodic` ticks (a restore of the last restored copy) a copy is
 * restored from the snapshot and runs `--window` ticks beside it: the game
 * hash every tick, the World War state every `--ww` ticks, the snapshot
 * bytes and object graphs at both ends. Then the played turns are replayed
 * from turn 0 on a fresh game, which must give the same hash every tick.
 *
 *   npx tsx scripts/ww1936/det-sim.ts [--seed WWDET001] [--until 20000]
 *       [--historical on|off|both] [--window 1000] [--ww 25]
 *       [--periodic 1500] [--human DEU] [--no-graphs] [--no-replay]
 *
 * --human: that country is a human's, played by lockstep.ts's
 * scriptedHuman (focuses, event cards, the 1939 war on Poland); the replay
 * then sends its turns through the binary turn message and JSON first.
 *
 * Exits 1 at the first difference, with the copy, the tick and the paths.
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo, Turn } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  createGameWireContext,
  decodeServerMessage,
  encodeServerMessage,
} from "@openfront/shared/ZbinWire";
import {
  replay,
  runLockstep,
  scriptedHuman,
  worldFiles,
  worldMoments,
} from "../../tests/ww1936/lockstep";

interface Opts {
  seed: string;
  until: number;
  historical: boolean[];
  window: number;
  ww: number;
  periodic: number;
  graphs: boolean;
  replay: boolean;
  human: CountryTag | null;
}

function parse(argv: string[]): Opts {
  const o: Opts = {
    seed: "WWDET001",
    until: 20_000,
    historical: [true],
    window: 1000,
    ww: 25,
    periodic: 1500,
    graphs: true,
    replay: true,
    human: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    switch (argv[i]) {
      case "--seed":
        o.seed = next();
        break;
      case "--until":
        o.until = Number(next());
        break;
      case "--historical": {
        const v = next();
        o.historical = v === "both" ? [true, false] : [v !== "off"];
        break;
      }
      case "--window":
        o.window = Number(next());
        break;
      case "--ww":
        o.ww = Number(next());
        break;
      case "--periodic":
        o.periodic = Number(next());
        break;
      case "--human":
        o.human = next() as CountryTag;
        break;
      case "--no-graphs":
        o.graphs = false;
        break;
      case "--no-replay":
        o.replay = false;
        break;
      default:
        throw new Error(`unknown option ${argv[i]}`);
    }
  }
  return o;
}

const HUMAN_ID = "HUMAN001";

function startInfo(
  seed: string,
  historical: boolean,
  human: CountryTag | null,
): GameStartInfo {
  return {
    gameID: seed,
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
      historicalAi: historical,
    },
    players:
      human === null
        ? []
        : [
            {
              clientID: HUMAN_ID,
              username: "player0",
              clanTag: null,
              isLobbyCreator: true,
              country: human,
            },
          ],
  };
}

async function main(): Promise<void> {
  const o = parse(process.argv.slice(2));
  const files = await worldFiles();
  for (const historical of o.historical) {
    const start = startInfo(o.seed, historical, o.human);
    const t0 = performance.now();
    console.log(
      `== ${o.seed}, historical ${historical ? "on" : "off"}, to tick ${o.until}`,
    );
    const rep = await runLockstep({
      start,
      files,
      until: o.until,
      window: o.window,
      wwEvery: o.ww,
      graphs: o.graphs,
      periodic: o.periodic,
      moments: worldMoments(),
      intents: o.human === null ? undefined : scriptedHuman(o.human, HUMAN_ID),
      log: (l) => console.log(l),
    });
    console.log(
      `${rep.restores.length} restores, all equal (${((performance.now() - t0) / 1000).toFixed(0)} s)`,
    );
    if (rep.missed.length > 0) {
      console.log(`moments that never came: ${rep.missed.join("; ")}`);
    }
    const last = rep.hashes[rep.hashes.length - 1];
    console.log(`final hash ${last}`);
    if (o.replay) {
      // As the server relays the turns (binary) and archives them (JSON).
      const ctx = createGameWireContext(start.players);
      const turns = rep.turns.map((turn) => {
        const m = decodeServerMessage(
          encodeServerMessage({ type: "turn", turn }, ctx),
          ctx,
        );
        if (m.type !== "turn") throw new Error("not a turn");
        return JSON.parse(JSON.stringify(m.turn)) as Turn;
      });
      const orders = turns.reduce((n, t) => n + t.intents.length, 0);
      const again = await replay(start, files, turns);
      const i = again.findIndex((h, k) => h !== rep.hashes[k]);
      if (i >= 0) {
        throw new Error(`the replay diverged at tick ${i + 1}`);
      }
      console.log(
        `replay from turn 0 (${orders} intents): the same hash on all ${again.length} ticks`,
      );
    }
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
