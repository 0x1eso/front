import type { Plugin } from "vite";

/**
 * Serves `version` as resources/version.txt to the `?raw` imports that label
 * the build (the nav bar and the footer, src/client/GameVersion.ts). Only a
 * tagged release writes that file; an untagged self-hosted build would show
 * its "x.xx.xx" placeholder, and must not dirty the tree to replace it, so
 * scripts/selfhost/game-night.sh passes GAME_VERSION to the build instead.
 * Without a version every import reads the file as usual.
 */
export function gameVersionOverride(version: string | undefined): Plugin {
  return {
    name: "game-version-override",
    enforce: "pre",
    load(id) {
      if (!version) return undefined;
      const [file, query] = id.split("?", 2);
      if (query !== "raw") return undefined;
      if (!file.replace(/\\/g, "/").endsWith("/resources/version.txt")) {
        return undefined;
      }
      return `export default ${JSON.stringify(`${version}\n`)};`;
    },
  };
}
