/**
 * World War 1936 client perf fixture: records one all-AI game on the real
 * world1936 map — every tick's GameUpdateViewData, as the worker posts it —
 * into a gzip file of length-prefixed v8-serialized frames. WwClientPerf
 * replays it into a real GameView, so the client side is timed without the
 * engine (or its garbage) in the same process, and two builds of the
 * client replay the very same game.
 *
 * The screens' data a human gets (its intel row, its details, its air
 * deployments) goes only to a human's country, so one country is played
 * by a human client (WW_PERF_HUMAN, Germany by default) with every
 * automation on and its armies on auto, who declares war on Poland on
 * 1939-09-01; every other country is an AI.
 *
 *   npx tsx tests/perf/client/WwRecord.ts --out <file.gz>
 *       [--seed WWPERF01] [--until 1940-06-30] [--human DEU] [--target POL]
 */
import "./Shims";

import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import type {
  GameStartInfo,
  StampedIntent,
  WwOrder,
} from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_AUTO_DOMAINS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import v8 from "v8";
import zlib from "zlib";
import { NodeGameMapLoader } from "../fullgame/NodeGameMapLoader";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** The human client of the recording (WwClientPerf plays its country). */
export const PERF_HUMAN = "HUMAN001";

export function wwPerfStart(
  seed: string,
  human: string = "DEU",
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
      historicalAi: true,
    },
    players: [
      {
        clientID: PERF_HUMAN,
        username: "perf",
        clanTag: null,
        isLobbyCreator: true,
        country: human as CountryTag,
      },
    ],
  };
}

function order(o: WwOrder): StampedIntent {
  return { type: "ww_order", order: o, clientID: PERF_HUMAN } as StampedIntent;
}

export function wwMapLoader(): NodeGameMapLoader {
  return new NodeGameMapLoader(path.join(ROOT, "resources/maps"));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const arg = (name: string, dflt: string) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
  };
  const out = arg("--out", "");
  if (out === "") throw new Error("--out <file.gz> is required");
  const seed = arg("--seed", "WWPERF01");
  const until = arg("--until", "1940-06-30");
  const human = arg("--human", "DEU");
  const target = arg("--target", "POL");
  console.debug = () => {};

  // The tick's view data, as the worker would post it.
  const last: { gu: GameUpdateViewData | null } = { gu: null };
  const runner = await createGameRunner(
    wwPerfStart(seed, human),
    undefined,
    await loadMapFiles(
      wwMapLoader(),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    (g) => {
      if ("errMsg" in g) throw new Error(g.errMsg);
      last.gu = g;
    },
  );
  const ww = runner.game.worldWar()!;
  const endTick = dayStartTick(dayOfDate(until) + 1, ww.prepEndTick());
  const warTick = dayStartTick(dayOfDate("1939-09-01"), ww.prepEndTick());
  const g = runner.game;
  const tagId = (tag: string) =>
    g.allPlayers().find((p) => ww.tagOf(p.smallID()) === tag)!;
  const gz = zlib.createGzip({ level: 1 });
  const file = fs.createWriteStream(out);
  gz.pipe(file);
  const head = Buffer.alloc(4);
  let frames = 0;
  let bytes = 0;
  const t0 = performance.now();
  while (runner.game.ticks() < endTick) {
    const t0tick = runner.game.ticks();
    const intents: StampedIntent[] = [];
    if (t0tick === 5) {
      for (const domain of WW_AUTO_DOMAINS) {
        intents.push(order({ kind: "auto_set", domain, on: true }));
      }
    }
    // Armies trained since get auto too (every 15 days).
    if (t0tick % 112 === 6) {
      intents.push(order({ kind: "army_auto_all", on: true }));
    }
    if (t0tick === warTick) {
      // The 1936 pact would refuse it (tests/ww1936/util.ts dropPact).
      const a = tagId(human).smallID();
      const b = tagId(target).smallID();
      const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
      ww.politics.naps = ww.politics.naps.filter(
        (n) => !(n.a === lo && n.b === hi),
      );
      intents.push({
        type: "declare_war",
        target: tagId(target).id(),
        clientID: PERF_HUMAN,
      } as StampedIntent);
    }
    runner.addTurn({ turnNumber: t0tick, intents });
    last.gu = null;
    if (!runner.executeNextTick()) throw new Error("tick did not run");
    const gu = last.gu;
    if (gu === null) continue;
    const buf = v8.serialize(gu);
    head.writeUInt32LE(buf.length, 0);
    if (!gz.write(Buffer.from(head))) {
      await new Promise<void>((r) => gz.once("drain", () => r()));
    }
    if (!gz.write(buf)) {
      await new Promise<void>((r) => gz.once("drain", () => r()));
    }
    frames++;
    bytes += buf.length;
    const t = runner.game.ticks();
    if (t % 1000 === 0) {
      const day = ww.inPrep(t) ? 0 : ww.day(t);
      console.error(
        `tick ${t} ${formatIsoDate(dateOfDay(day))} ${(bytes / 1e6).toFixed(0)} MB ${((performance.now() - t0) / 1000).toFixed(0)} s`,
      );
    }
  }
  gz.end();
  await new Promise<void>((r) => file.once("close", () => r()));
  console.log(
    `${frames} frames to tick ${runner.game.ticks()}, ${(bytes / 1e6).toFixed(0)} MB raw, hash ${ww.hash()}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
