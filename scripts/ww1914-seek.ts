/**
 * Great War 1914: can every locked option be opened by someone who goes after
 * it? Plays a bot per option on the real map and lists what never opened.
 *
 *   npx tsx scripts/ww1914-seek.ts [--tries 24] [--only regexp]
 */
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../tests/perf/fullgame/NodeGameMapLoader";
import { seekOptions } from "../tests/ww1914/sim/GwSeek";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main(): Promise<void> {
  const i = process.argv.indexOf("--tries");
  const tries = i < 0 ? 24 : Number(process.argv[i + 1]);
  const log = console.log;
  console.log = () => {};
  const map = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const j = process.argv.indexOf("--only");
  const rows = await seekOptions(
    map,
    tries,
    j < 0 ? null : process.argv[j + 1],
  );
  console.log = log;
  const shut = rows.filter((r) => !r.open);
  console.log(`${rows.length} locked options, ${shut.length} never opened`);
  for (const r of rows) {
    const mark = r.open ? "ok  " : "SHUT";
    console.log(
      `${mark} ${r.scene}.${r.option}: ${r.games} games, card came in ${r.came}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
