/**
 * Great War 1914 (design §2.1, §14): checks the replay claim on the content as
 * it stands. Plays series of solo games with a seeded bot on the real map and
 * prints how often each scene comes, what never comes and why, what comes too
 * often, and how much of run 2 on was already seen. Not part of the test suite;
 * tests/ww1914/GwSim.test.ts checks the tool itself.
 *
 *   npx tsx scripts/ww1914-sim.ts [--series 30] [--runs 3] [--calendar y1914]
 *                                 [--overused 80] [--label sim] [--no-control]
 *                                 [--seat DEU] [--json report.json]
 */
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  GW_CALENDAR_IDS,
  GwCalendarId,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../tests/perf/fullgame/NodeGameMapLoader";
import {
  formatReport,
  GW_SIM_DEFAULTS,
  GwSimOptions,
  runSim,
} from "../tests/ww1914/sim/GwSim";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parse(
  argv: readonly string[],
): GwSimOptions & { json: string | null } {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i < 0 ? undefined : argv[i + 1];
  };
  const number = (flag: string, fallback: number) => {
    const v = value(flag);
    return v === undefined ? fallback : Number(v);
  };
  const calendar = value("--calendar") ?? GW_SIM_DEFAULTS.calendar;
  if (!GW_CALENDAR_IDS.includes(calendar as GwCalendarId)) {
    throw new Error(`calendar: one of ${GW_CALENDAR_IDS.join(", ")}`);
  }
  return {
    series: number("--series", GW_SIM_DEFAULTS.series),
    runsPerSeries: number("--runs", GW_SIM_DEFAULTS.runsPerSeries),
    calendar: calendar as GwCalendarId,
    overusedAt: number("--overused", GW_SIM_DEFAULTS.overusedAt * 100) / 100,
    control: !argv.includes("--no-control"),
    label: value("--label") ?? GW_SIM_DEFAULTS.label,
    seat: (value("--seat") ?? GW_SIM_DEFAULTS.seat) as GwTag,
    json: value("--json") ?? null,
  };
}

async function main(): Promise<void> {
  const opts = parse(process.argv.slice(2));
  const log = console.log;
  // The game logs its construction; the report is what this prints.
  console.log = () => {};
  const map = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const started = performance.now();
  const r = await runSim(map, opts);
  console.log = log;
  console.log(formatReport(r));
  console.log(`\n${((performance.now() - started) / 1000).toFixed(1)} s`);
  if (opts.json !== null)
    fs.writeFileSync(opts.json, JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
