// ww238: a save opens. Every 1936 game with the designer off (the game's
// default) gives the minors catalogue designs named by their catalogue id,
// longer than the 24 characters a player may name one; the save reader
// checked them with the wire's name rule and refused every such save
// ("이 버전의 게임으로는 불러올 수 없는 저장 파일입니다"). These run each mode
// the way the solo menu starts it, on the real map, through a save and back.
import {
  GameMapSize,
  GameMapType,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameConfig, GameStartInfo } from "@openfront/engine-api/Schemas";
import { EXTRA_CIVIL_WAR_SLOTS } from "@openfront/engine-api/ww1936/Countries";
import {
  DESIGN_NAME_MAX,
  StoredDesignDefSchema,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { HIST_ALL } from "@openfront/engine-lib/ww1936/hist/index";
import {
  createGameRunner,
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { readSnapshotHeader } from "@openfront/engine/snapshot/GameSnapshot";
import { histDef } from "@openfront/engine/ww1936/depth/Hist";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { diffSnapshots } from "../util/Snapshot";
import { gameHash, HUMAN, step, wwGameStart, WwHuman } from "./util";

const here = path.dirname(fileURLToPath(import.meta.url));
const maps = new NodeGameMapLoader(path.resolve(here, "../../resources/maps"));
const SAVES = path.resolve(here, "../testdata/saves");

interface Mode {
  config: Partial<GameConfig>;
  humans: WwHuman[];
  map: GameMapType;
}

// As the solo menu sends them: a solo game, the designer left off.
const SOLO = { gameType: GameType.Singleplayer, ww1936Designer: undefined };
const MODES: Record<string, Mode> = {
  ww1936: {
    config: SOLO,
    humans: [{ clientID: HUMAN, country: "DEU" }],
    map: GameMapType.World1936,
  },
  gw1914: {
    config: { ...SOLO, greatWar1914: true },
    humans: [{ clientID: HUMAN, country: "DEU" }],
    map: GameMapType.World1936,
  },
  imjin: {
    config: {
      ...SOLO,
      gameMap: GameMapType.Imjin1592,
      ww1936Scenario: "imjin1590",
    },
    humans: [{ clientID: HUMAN }],
    map: GameMapType.Imjin1592,
  },
};

const noUpdates = () => {};

async function runnerFrom(
  start: GameStartInfo,
  map: GameMapType,
  snapshot?: Uint8Array,
  viewer: string = HUMAN,
): Promise<GameRunner> {
  const files = await loadMapFiles(maps, map, GameMapSize.Normal);
  return snapshot === undefined
    ? createGameRunner(start, viewer, files, (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      })
    : createGameRunnerFromSnapshot(start, snapshot, viewer, files, noUpdates);
}

/** How the solo menu resumes a save: its config, its human, a new game id. */
async function resume(bytes: Uint8Array): Promise<GameRunner> {
  const header = readSnapshotHeader(bytes);
  expect(header.humans).toHaveLength(1);
  const clientID = header.humans[0].clientID;
  const start: GameStartInfo = {
    gameID: "RESUMED1",
    lobbyCreatedAt: 0,
    config: header.gameConfig,
    players: [
      {
        clientID,
        username: "player0",
        clanTag: null,
      },
    ],
  };
  return runnerFrom(start, header.gameConfig.gameMap, bytes, clientID);
}

describe("a save opens (ww238)", { timeout: 120_000 }, () => {
  test("a save holds every catalogue design the engine makes", () => {
    let long = 0;
    for (const e of HIST_ALL) {
      const def = histDef(e);
      if (def === null) continue;
      if (def.name.length > DESIGN_NAME_MAX) long++;
      expect(StoredDesignDefSchema.safeParse(def).success).toBe(true);
    }
    // The reason the wire's name rule can't check a save.
    expect(long).toBeGreaterThan(0);
  });

  test.each(Object.keys(MODES))(
    "%s: saved, opened, the same game, and it plays on",
    async (name) => {
      const m = MODES[name];
      const start = wwGameStart(m.config, m.humans);
      const live = await runnerFrom(start, m.map);
      step(live, 600);
      const bytes = live.snapshot();
      const opened = await resume(bytes);
      expect(opened.game.ticks()).toBe(live.game.ticks());
      // The same game, but for the new game id the solo menu gives it.
      expect(
        diffSnapshots(bytes, opened.snapshot()).filter(
          (d) => !d.startsWith("snapshot.gameID:"),
        ),
      ).toEqual([]);
      expect(gameHash(opened)).toBe(gameHash(live));
      for (let i = 0; i < 50; i++) {
        step(live, 1);
        step(opened, 1);
      }
      expect(gameHash(opened)).toBe(gameHash(live));
    },
  );

  // Saves earlier builds wrote: the live build's own before this fix
  // (a387fbee0, a catalogue design named past 24 characters) and one from
  // before ww226 (2dcaeb59f, no players for the extra civil-war slots).
  test.each(fs.readdirSync(SAVES).filter((f) => f.endsWith(".snapshot.gz")))(
    "%s opens and plays on",
    async (file) => {
      const bytes = new Uint8Array(
        gunzipSync(fs.readFileSync(path.join(SAVES, file))),
      );
      const opened = await resume(bytes);
      const tick = opened.game.ticks();
      step(opened, 300);
      expect(opened.game.ticks()).toBe(tick + 300);
      // Every country of its scenario has its player.
      const ww = opened.game.worldWar()!;
      for (let id = 1; id <= ww.scenario.countries.length; id++) {
        expect(opened.game.playerBySmallID(id).isPlayer()).toBe(true);
      }
    },
  );

  test("a save from before ww226 goes on without the extra civil-war slots", async () => {
    const bytes = new Uint8Array(
      gunzipSync(
        fs.readFileSync(path.join(SAVES, "ww1936-ww222-2dcaeb59f.snapshot.gz")),
      ),
    );
    const sc = (await resume(bytes)).game.worldWar()!.scenario;
    expect(sc.smallIdOf(EXTRA_CIVIL_WAR_SLOTS[0])).toBe(0);
    expect(sc.smallIdOf("CW6")).toBeGreaterThan(0);
    // A save of this build keeps them.
    const live = await runnerFrom(
      wwGameStart(MODES.ww1936.config, MODES.ww1936.humans),
      GameMapType.World1936,
    );
    step(live, 2);
    const again = await resume(live.snapshot());
    expect(
      again.game.worldWar()!.scenario.smallIdOf(EXTRA_CIVIL_WAR_SLOTS[0]),
    ).toBeGreaterThan(0);
  });
});
