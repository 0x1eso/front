import fs from "fs";
import os from "os";
import path from "path";
import { build, createServer, type Plugin, type Rolldown } from "vite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { gameVersionOverride } from "../../src/server/GameVersionOverride";

// The nav bar and the footer read resources/version.txt through `?raw`
// imports; only a tagged release overwrites the file. A self-hosted build
// (game-night.sh) passes GAME_VERSION instead, and vite serves it in the
// file's place.
describe("gameVersionOverride", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "game-version-"));
    fs.mkdirSync(path.join(root, "resources"));
    fs.writeFileSync(path.join(root, "resources/version.txt"), "x.xx.xx\n");
    fs.writeFileSync(path.join(root, "resources/other.txt"), "other\n");
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function load(plugin: Plugin, id: string): Promise<string> {
    const server = await createServer({
      configFile: false,
      root,
      logLevel: "silent",
      appType: "custom",
      server: { middlewareMode: true, hmr: false, ws: false },
      plugins: [plugin],
    });
    try {
      return (await server.ssrLoadModule(id)).default;
    } finally {
      await server.close();
    }
  }

  test("serves GAME_VERSION as the version file", async () => {
    expect(
      await load(
        gameVersionOverride("2026.10.15+3e5f4f7"),
        "/resources/version.txt?raw",
      ),
    ).toBe("2026.10.15+3e5f4f7\n");
  });

  test("leaves the file alone without one", async () => {
    for (const version of [undefined, ""]) {
      expect(
        await load(gameVersionOverride(version), "/resources/version.txt?raw"),
      ).toBe("x.xx.xx\n");
    }
  });

  test("leaves other files alone", async () => {
    expect(
      await load(
        gameVersionOverride("2026.10.15+3e5f4f7"),
        "/resources/other.txt?raw",
      ),
    ).toBe("other\n");
  });

  test("a production build bundles the version", async () => {
    fs.writeFileSync(
      path.join(root, "main.js"),
      'import version from "./resources/version.txt?raw";\nconsole.log(version);\n',
    );
    const output = (await build({
      configFile: false,
      root,
      logLevel: "silent",
      plugins: [gameVersionOverride("2026.10.15+3e5f4f7")],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: path.join(root, "main.js") },
      },
    })) as Rolldown.RolldownOutput[] | Rolldown.RolldownOutput;
    const code = (Array.isArray(output) ? output : [output])
      .flatMap((o) => o.output)
      .map((chunk) => ("code" in chunk ? chunk.code : ""))
      .join("\n");
    expect(code).toContain("2026.10.15+3e5f4f7");
    expect(code).not.toContain("x.xx.xx");
  });
});
