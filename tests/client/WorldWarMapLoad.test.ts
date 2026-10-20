/**
 * World War 1936 (spec §2.2): the mode fixes its map and size, so the client
 * loads the map of the normalized config even when the raw config it was
 * handed names another one (the engine refuses files that don't match).
 */

import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import fs from "fs";
import path from "path";
import { WorkerClient } from "../../src/client/WorkerClient";
import { testGameConfig } from "../util/Wire";

const worker = vi.hoisted(() => ({
  posted: [] as Record<string, unknown>[],
  listeners: [] as ((e: MessageEvent) => void)[],
}));
const loader = vi.hoisted(() => ({ requested: [] as string[] }));

vi.mock("@openfront/engine/worker/Worker.worker?worker&inline", () => ({
  default: class {
    addEventListener(_type: string, l: (e: MessageEvent) => void) {
      worker.listeners.push(l);
    }
    postMessage(msg: Record<string, unknown>) {
      worker.posted.push(msg);
    }
    terminate() {}
  },
}));

// Every map's files come from the World War test map's folder; the test
// checks which map was asked for.
vi.mock("../../src/client/TerrainMapFileLoader", () => {
  const dir = path.join(__dirname, "../testdata/maps/ww1936mini");
  const read = async (name: string) =>
    new Uint8Array(fs.readFileSync(path.join(dir, name)));
  return {
    terrainMapFileLoader: {
      getMapData: (map: string) => {
        loader.requested.push(map);
        return {
          manifest: async () =>
            JSON.parse(new TextDecoder().decode(await read("manifest.json"))),
          mapBin: () => read("map.bin"),
          map4xBin: () => read("map4x.bin"),
          map16xBin: () => read("map16x.bin"),
          file: read,
        };
      },
    },
  };
});

beforeEach(() => {
  worker.posted = [];
  worker.listeners = [];
  loader.requested = [];
});

/** Starts the client and returns the init message the worker got. */
async function init(info: GameStartInfo): Promise<Record<string, unknown>> {
  const ready = new WorkerClient(info, undefined).initialize();
  await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
  const msg = worker.posted[0];
  for (const l of worker.listeners) {
    l(
      new MessageEvent("message", {
        data: { type: "initialized", id: msg.id },
      }),
    );
  }
  await ready;
  return msg;
}

describe("a World War 1936 game whose raw config names another map", () => {
  const start = {
    gameID: "wwMapLd1",
    players: [],
    config: testGameConfig({
      worldWar1936: true,
      gameMap: GameMapType.Onion,
      gameMapSize: GameMapSize.Compact,
    }),
  } as unknown as GameStartInfo;

  test("the worker gets the world1936 files, regions and scenario included", async () => {
    const msg = await init(start);
    expect(loader.requested).toEqual([GameMapType.World1936]);
    const map = msg.map as Record<string, unknown>;
    expect(map).toMatchObject({
      map: GameMapType.World1936,
      mapSize: GameMapSize.Normal,
    });
    expect(map.regionsBin).toBeInstanceOf(Uint8Array);
    expect(map.scenario).toBeDefined();
    // The engine normalizes the config itself: it gets the one it was sent.
    expect(msg.gameStartInfo).toBe(start);
  });

  test("outside the mode the raw map is loaded", async () => {
    const vanilla = {
      ...start,
      config: testGameConfig({
        gameMap: GameMapType.Onion,
        gameMapSize: GameMapSize.Compact,
      }),
    } as unknown as GameStartInfo;
    const msg = await init(vanilla);
    expect(loader.requested).toEqual([GameMapType.Onion]);
    expect(msg.map).toMatchObject({
      map: GameMapType.Onion,
      mapSize: GameMapSize.Compact,
    });
  });
});
