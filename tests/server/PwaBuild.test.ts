import { htmlBuildId } from "@openfront/shared/ServiceWorkerRules";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, test } from "vitest";
import { listHashedPublicAssetPaths } from "../../src/server/PublicAssetManifest";
import {
  buildIdOf,
  languageFlags,
  offlineAssetHashes,
  offlineAssetSizes,
  planPrecache,
  PRECACHE_BUDGET_BYTES,
  renderServiceWorker,
  writeServiceWorker,
} from "../../src/server/PwaBuild";

const ROOT = path.join(__dirname, "../..");
const RESOURCES = path.join(ROOT, "resources");

const MANIFEST = {
  "lang/ko.json": "/_assets/lang/ko.aaaaaaaaaaaa.json",
  "images/background.webp": "/_assets/images/background.bbbbbbbbbbbb.webp",
  "maps/world/manifest.json": "/_assets/maps/world/manifest.cccccccccccc.json",
  "maps/world/thumbnail.webp":
    "/_assets/maps/world/thumbnail.dddddddddddd.webp",
  "maps/world/map.bin": "/_assets/maps/world/map.eeeeeeeeeeee.bin",
  "maps/world/map4x.bin": "/_assets/maps/world/map4x.ffffffffffff.bin",
  "flags/kr.svg": "/_assets/flags/kr.111111111111.svg",
  "flags/us.svg": "/_assets/flags/us.222222222222.svg",
  "assets/index-abc.js": "/assets/index-abc.js",
};

describe("what the service worker precaches", () => {
  const plan = planPrecache({
    assetManifest: MANIFEST,
    bundleFiles: [
      "index.html",
      "assets/index-abc.js",
      "assets/index-abc.css",
      "assets/Worker.worker-xyz.js",
      "assets/index-abc.js.map",
    ],
    coreFlags: new Set(["kr"]),
  });

  test("the whole Vite bundle, no source maps, not index.html", () => {
    expect(plan).toContain("/assets/index-abc.js");
    expect(plan).toContain("/assets/index-abc.css");
    expect(plan).toContain("/assets/Worker.worker-xyz.js");
    expect(plan).not.toContain("/assets/index-abc.js.map");
    expect(plan.some((url) => url.endsWith("index.html"))).toBe(false);
  });

  test("the hashed assets the menus and a game need", () => {
    expect(plan).toContain(MANIFEST["lang/ko.json"]);
    expect(plan).toContain(MANIFEST["images/background.webp"]);
  });

  test("of the maps only what the map picker shows", () => {
    expect(plan).toContain(MANIFEST["maps/world/manifest.json"]);
    expect(plan).toContain(MANIFEST["maps/world/thumbnail.webp"]);
    expect(plan).not.toContain(MANIFEST["maps/world/map.bin"]);
    expect(plan).not.toContain(MANIFEST["maps/world/map4x.bin"]);
  });

  test("of the flags only the core ones", () => {
    expect(plan).toContain(MANIFEST["flags/kr.svg"]);
    expect(plan).not.toContain(MANIFEST["flags/us.svg"]);
  });

  test("sorted, each once", () => {
    expect(plan).toEqual([...new Set(plan)].sort());
  });

  test("the real resources stay well inside the budget", () => {
    // Vite's bundle (~8 MB) comes on top of this, so leave it room.
    const sourceDirs = [RESOURCES, path.join(ROOT, "proprietary")];
    const manifest = Object.fromEntries(
      listHashedPublicAssetPaths(sourceDirs).map((p) => [p, `/_assets/${p}`]),
    );
    const urls = planPrecache({
      assetManifest: manifest,
      bundleFiles: [],
      coreFlags: languageFlags(RESOURCES),
    });
    const bytes = urls.reduce(
      (sum, url) =>
        sum +
        fs.statSync(path.join(RESOURCES, url.slice("/_assets/".length))).size,
      0,
    );
    expect(bytes).toBeLessThan(PRECACHE_BUDGET_BYTES - 15 * 1024 * 1024);
    // And no map's game files.
    expect(urls.some((url) => /\/maps\/[^/]+\/map/.test(url))).toBe(false);
  });
});

describe("what the build tells the worker", () => {
  test("the content hashes of every map file and flag", () => {
    expect(offlineAssetHashes(MANIFEST)).toEqual([
      "111111111111",
      "222222222222",
      "cccccccccccc",
      "dddddddddddd",
      "eeeeeeeeeeee",
      "ffffffffffff",
    ]);
  });

  test("map and flag sizes for the offline download", () => {
    const sizes = offlineAssetSizes([RESOURCES]);
    expect(sizes["maps/world1936/map.bin"]).toBe(
      fs.statSync(path.join(RESOURCES, "maps/world1936/map.bin")).size,
    );
    expect(sizes["maps/world1936/scenario.json"]).toBeGreaterThan(0);
    expect(sizes["flags/us.svg"]).toBeGreaterThan(0);
    expect(Object.keys(sizes).every((p) => /^(maps|flags)\//.test(p))).toBe(
      true,
    );
  });

  test("the language picker's flags", () => {
    const flags = languageFlags(RESOURCES);
    expect(flags.has("kr")).toBe(true);
    for (const stem of flags) {
      expect(fs.existsSync(path.join(RESOURCES, "flags", `${stem}.svg`))).toBe(
        true,
      );
    }
  });

  test("the build id changes with any part", () => {
    const id = buildIdOf(["code", "html"]);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(buildIdOf(["code", "html"])).toBe(id);
    expect(buildIdOf(["code", "html2"])).not.toBe(id);
    // Parts are length-prefixed: moving a byte across them is a change.
    expect(buildIdOf(["codeh", "tml"])).not.toBe(id);
  });

  test("sw.js is the build's data, then the worker", () => {
    const sw = renderServiceWorker("(()=>{})();", {
      id: "abc",
      precache: ["/assets/x.js"],
      offlineHashes: [],
    });
    expect(sw.startsWith('var __SW_BUILD__ = {"id":"abc"')).toBe(true);
    expect(sw.endsWith("(()=>{})();")).toBe(true);
  });
});

describe("writeServiceWorker", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir !== null) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  function outDirWith(files: Record<string, string>): string {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pwa-build-"));
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(tempDir, rel)), { recursive: true });
      fs.writeFileSync(path.join(tempDir, rel), content);
    }
    return tempDir;
  }

  const INDEX = "<!doctype html><html><head><title>x</title></head></html>";

  test("writes sw.js and names the same build in index.html", async () => {
    const outDir = outDirWith({
      "index.html": INDEX,
      "assets/index-abc.js": "console.log(1)",
      "_assets/lang/ko.aaaaaaaaaaaa.json": "{}",
    });
    const summary = await writeServiceWorker({
      outDir,
      assetManifest: { "lang/ko.json": "/_assets/lang/ko.aaaaaaaaaaaa.json" },
      bundleFiles: ["assets/index-abc.js", "index.html"],
      coreFlags: new Set(),
      compile: async () => "(()=>{})();",
    });
    const sw = fs.readFileSync(path.join(outDir, "sw.js"), "utf8");
    const build = JSON.parse(/^var __SW_BUILD__ = (.*);\n/.exec(sw)![1]) as {
      id: string;
      precache: string[];
    };
    expect(build.id).toBe(summary.buildId);
    expect(build.precache).toEqual([
      "/_assets/lang/ko.aaaaaaaaaaaa.json",
      "/assets/index-abc.js",
    ]);
    const html = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
    expect(htmlBuildId(html)).toBe(summary.buildId);
    expect(summary.files).toBe(3);
    expect(summary.bytes).toBe(
      "console.log(1)".length + "{}".length + INDEX.length,
    );
  });

  test("refuses a precache entry the build did not write", async () => {
    const outDir = outDirWith({ "index.html": INDEX });
    await expect(
      writeServiceWorker({
        outDir,
        assetManifest: {},
        bundleFiles: ["assets/missing.js"],
        coreFlags: new Set(),
        compile: async () => "",
      }),
    ).rejects.toThrow(/assets\/missing\.js/);
  });
});
