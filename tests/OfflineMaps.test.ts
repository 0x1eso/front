import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapManifest } from "@openfront/engine-api/game/MapFiles";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import { OFFLINE_CACHE } from "@openfront/shared/ServiceWorkerRules";
import { describe, expect, test } from "vitest";
import {
  type AssetSizes,
  type CacheStore,
  downloadOfflineMaps,
  formatMegabytes,
  mapFlags,
  mapFolderFiles,
  mapPlayableOffline,
  missingFiles,
  offlineMapChoices,
  planOfflineMap,
  requiredMapFiles,
} from "../src/client/pwa/OfflineMaps";

// No BOOTSTRAP_CONFIG and no define in the node tests: assetUrl leaves the
// asset path as it is, which keeps these URLs readable.
const url = (path: string) => `/${path}`;

const SIZES: AssetSizes = {
  ...Object.fromEntries(
    Object.values(COUNTRIES).map((c) => [`flags/${c.flag}.svg`, 3]),
  ),
  "maps/world/manifest.json": 100,
  "maps/world/thumbnail.webp": 50,
  "maps/world/map.bin": 4000,
  "maps/world/map4x.bin": 1000,
  "maps/world/map16x.bin": 250,
  "maps/world1936/manifest.json": 10,
  "maps/world1936/map.bin": 8000,
  "maps/world1936/map4x.bin": 2000,
  "maps/world1936/map16x.bin": 500,
  "maps/world1936/regions.bin": 400,
  "maps/world1936/scenario.json": 1100,
  "maps/world1936/thumbnail.webp": 20,
  "maps/brainrot/manifest.json": 1,
  "maps/brainrot/map.bin": 1,
  "maps/brainrot/map4x.bin": 1,
  "maps/brainrot/map16x.bin": 1,
  "maps/brainrot/brland.webp": 1,
  "maps/brainrot/brland.4x.webp": 1,
  "maps/brainrot/thumbnail.webp": 1,
  "flags/us.svg": 7,
  "flags/ca.svg": 5,
};

const WORLD: MapManifest = {
  nations: [
    { name: "United States", flag: "us", coordinates: [0, 0] },
    { name: "Canada", flag: "ca", coordinates: [0, 0] },
    { name: "Nowhere", flag: "not-a-flag", coordinates: [0, 0] },
  ],
} as unknown as MapManifest;
const WW1936: MapManifest = {
  nations: [],
  ww1936: true,
} as unknown as MapManifest;

/** A Cache Storage stand-in: one set of URLs, and what was put. */
function fakeStore(cached: string[] = []) {
  const urls = new Set(cached);
  const put: Array<{ cache: string; url: string; body: Blob }> = [];
  const store: CacheStore = {
    match: async (u) => (urls.has(u) ? new Response("x") : undefined),
    open: async (name) => ({
      put: async (request, response) => {
        const u = String(request);
        put.push({ cache: name, url: u, body: await response.blob() });
        urls.add(u);
      },
    }),
  };
  return { store, put, urls };
}

/** A fetch that answers every URL with its size's worth of bytes. */
function fakeFetch(sizes: AssetSizes, calls: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = String(input);
    calls.push(u);
    const size = sizes[u.slice(1)] ?? 0;
    return new Response(new Uint8Array(size), {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }) as typeof fetch;
}

describe("which maps the download offers", () => {
  test("World War 1936 first, then the featured solo maps, World leading", () => {
    const choices = offlineMapChoices();
    expect(choices[0]).toBe(GameMapType.World1936);
    expect(choices[1]).toBe(GameMapType.World);
    expect(choices.length).toBeGreaterThan(2);
    expect(new Set(choices).size).toBe(choices.length);
  });
});

describe("what a map's download holds", () => {
  test("its whole folder, as the build lists it", () => {
    expect(mapFolderFiles(GameMapType.World, SIZES)).toEqual([
      "maps/world/manifest.json",
      "maps/world/map.bin",
      "maps/world/map16x.bin",
      "maps/world/map4x.bin",
      "maps/world/thumbnail.webp",
    ]);
  });

  test("the flags of its nations that exist", () => {
    expect(mapFlags(WORLD, SIZES)).toEqual(["flags/ca.svg", "flags/us.svg"]);
  });

  test("World War 1936: every country's flag", () => {
    const flags = mapFlags(WW1936, SIZES);
    for (const country of Object.values(COUNTRIES)) {
      expect(flags).toContain(`flags/${country.flag}.svg`);
    }
  });

  test("what is still missing", async () => {
    const plan = planOfflineMap(GameMapType.World, WORLD, SIZES);
    const have = [url("maps/world/manifest.json"), url("flags/us.svg")];
    expect(await missingFiles(plan, fakeStore(have).store)).toEqual(
      plan.files.filter((f) => !have.includes(url(f))),
    );
    expect(await missingFiles(plan, null)).toEqual(plan.files);
  });

  test("its size", () => {
    const plan = planOfflineMap(GameMapType.World, WORLD, SIZES);
    expect(plan.bytes).toBe(100 + 50 + 4000 + 1000 + 250 + 7 + 5);
    expect(formatMegabytes(12.34 * 1024 * 1024)).toBe("12 MB");
    expect(formatMegabytes(2.25 * 1024 * 1024)).toBe("2.3 MB");
  });
});

describe("what a game needs to start offline", () => {
  test("a Normal game: the manifest, map.bin and map4x.bin", () => {
    expect(
      requiredMapFiles(
        mapFolderFiles(GameMapType.World, SIZES),
        GameMapSize.Normal,
      ),
    ).toEqual([
      "maps/world/manifest.json",
      "maps/world/map.bin",
      "maps/world/map4x.bin",
    ]);
  });

  test("a Compact game: the manifest, map4x.bin and map16x.bin", () => {
    expect(
      requiredMapFiles(
        mapFolderFiles(GameMapType.World, SIZES),
        GameMapSize.Compact,
      ),
    ).toEqual([
      "maps/world/manifest.json",
      "maps/world/map16x.bin",
      "maps/world/map4x.bin",
    ]);
  });

  test("World War 1936 adds its scenario", () => {
    const files = requiredMapFiles(
      mapFolderFiles(GameMapType.World1936, SIZES),
      GameMapSize.Normal,
    );
    expect(files).toContain("maps/world1936/regions.bin");
    expect(files).toContain("maps/world1936/scenario.json");
    expect(files).not.toContain("maps/world1936/thumbnail.webp");
  });

  test("a map with a layer image needs the one for its size", () => {
    const folder = mapFolderFiles(GameMapType.BrainRot, SIZES);
    expect(requiredMapFiles(folder, GameMapSize.Normal)).toContain(
      "maps/brainrot/brland.webp",
    );
    expect(requiredMapFiles(folder, GameMapSize.Normal)).not.toContain(
      "maps/brainrot/brland.4x.webp",
    );
    expect(requiredMapFiles(folder, GameMapSize.Compact)).toContain(
      "maps/brainrot/brland.4x.webp",
    );
  });

  test("playable once every needed file is cached", async () => {
    const config = {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
    };
    const needed = requiredMapFiles(
      mapFolderFiles(GameMapType.World1936, SIZES),
      GameMapSize.Normal,
    ).map(url);
    expect(
      await mapPlayableOffline(config, SIZES, fakeStore(needed.slice(1)).store),
    ).toBe(false);
    expect(
      await mapPlayableOffline(config, SIZES, fakeStore(needed).store),
    ).toBe(true);
  });

  test("with nothing to check against (no build sizes, no Cache API), it tries", async () => {
    const config = {
      gameMap: GameMapType.World,
      gameMapSize: GameMapSize.Normal,
    };
    expect(await mapPlayableOffline(config, {}, fakeStore().store)).toBe(true);
    expect(await mapPlayableOffline(config, SIZES, null)).toBe(true);
  });
});

describe("downloading", () => {
  test("fetches what is missing into the offline cache, with progress", async () => {
    const plan = planOfflineMap(GameMapType.World, WORLD, SIZES);
    const { store, put } = fakeStore([url("maps/world/manifest.json")]);
    const calls: string[] = [];
    const progress: Array<[number, number]> = [];

    await downloadOfflineMaps(
      [plan],
      SIZES,
      (done, total) => progress.push([done, total]),
      store,
      fakeFetch(SIZES, calls),
    );

    // The cached manifest is not fetched again.
    expect(calls).not.toContain(url("maps/world/manifest.json"));
    expect(calls).toContain(url("maps/world/map.bin"));
    expect(put.every((p) => p.cache === OFFLINE_CACHE)).toBe(true);
    const mapBin = put.find((p) => p.url === url("maps/world/map.bin"));
    expect(mapBin?.body.size).toBe(4000);
    // Progress only grows, and ends at the total.
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i][0]).toBeGreaterThanOrEqual(progress[i - 1][0]);
    }
    expect(progress[progress.length - 1]).toEqual([plan.bytes, plan.bytes]);
    expect(await missingFiles(plan, store)).toEqual([]);
  });

  test("maps that share flags fetch each once", async () => {
    const other = planOfflineMap(GameMapType.World1936, WORLD, SIZES);
    const world = planOfflineMap(GameMapType.World, WORLD, SIZES);
    const calls: string[] = [];
    await downloadOfflineMaps(
      [world, other],
      SIZES,
      () => {},
      fakeStore().store,
      fakeFetch(SIZES, calls),
    );
    expect(calls.filter((c) => c === url("flags/us.svg"))).toHaveLength(1);
  });

  test("stops at a failed file, keeping what came before", async () => {
    const plan = planOfflineMap(GameMapType.World, WORLD, SIZES);
    const { store, urls } = fakeStore();
    const failing = (async (input: RequestInfo | URL) =>
      String(input).endsWith("map.bin")
        ? new Response("", { status: 503 })
        : new Response("ok")) as typeof fetch;
    await expect(
      downloadOfflineMaps([plan], SIZES, () => {}, store, failing),
    ).rejects.toThrow(/503/);
    expect(urls.has(url("maps/world/manifest.json"))).toBe(true);
    expect(urls.has(url("maps/world/map.bin"))).toBe(false);
  });
});
