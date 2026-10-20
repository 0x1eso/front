// World War 1936 P1 (plan Task 9, spec §1.3 and §14.6): what the economy
// costs on the real world1936 map with its 79 countries, all AI. Targets on
// a desktop: a whole day (its 7-8 ticks) at most 2 ms, a tick at most 1 ms,
// the region neighbours' first build 100 ms; the bounds allow twice that
// for CI. The full suite runs six workers at once, so wall time there also
// measures the neighbours: a day is bounded by the CPU time of the test's
// own thread (process.threadCpuUsage, Node 23.9 and later; wall time
// without it), which is too coarse for a single tick, so a tick's 99th
// percentile is bounded in wall time with a third more room (2 ms was
// measured under the full suite's load, 0.7-0.9 ms alone). A tick's maximum
// is not bounded: any tick's window can hold a garbage collection.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { step, stepTo, wwGameStart } from "./util";

const SLACK = 2;
/** The full suite's load on a tick's wall time (see above). */
const TICK_SLACK = 3;
const DAY_MS = 2;
const TICK_MS = 1;
const NEIGHBOURS_MS = 100;

async function worldFiles(): Promise<MapFiles> {
  return loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
}

const pct = (sorted: readonly number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

describe("the economy's cost on world1936 (spec §14.6)", () => {
  test("the region neighbours are built quickly the first time", async () => {
    const files = await worldFiles();
    const index = ScenarioIndex.fromFiles(files.scenario!, files.regionsBin!);
    const t0 = performance.now();
    const pairs = index.regionPairs();
    const ms = performance.now() - t0;
    console.log(
      `world1936: ${pairs.length} region pairs in ${ms.toFixed(1)} ms`,
    );
    expect(pairs.length).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(NEIGHBOURS_MS * SLACK);
    // Built once: the neighbours of a region come from it.
    const t1 = performance.now();
    index.regionNeighbours(pairs[0][0]);
    expect(performance.now() - t1).toBeLessThan(5);
  }, 60_000);

  test("79 AI countries: 600 ticks, then 100 days timed", async () => {
    const files = await worldFiles();
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      files,
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    expect(econ.countries()).toHaveLength(79);
    stepTo(runner, WW_PREP_TICKS);
    const tick = econ.tick.bind(econ);
    let cpu = 0;
    let wall = 0;
    const threadCpu = (
      process as {
        threadCpuUsage?: (prev?: NodeJS.CpuUsage) => NodeJS.CpuUsage;
      }
    ).threadCpuUsage?.bind(process);
    econ.tick = (t: number) => {
      const a = performance.now();
      const c = threadCpu?.();
      tick(t);
      wall = performance.now() - a;
      const used = threadCpu?.(c);
      cpu = used === undefined ? wall : (used.user + used.system) / 1000;
    };
    const cpuTicks: number[] = [];
    const wallTicks: number[] = [];
    const cpuDays: number[] = [];
    const wallDays: number[] = [];
    let day0 = 0;
    for (let d = 0; d < 101; d++) {
      let cpuSum = 0;
      let wallSum = 0;
      while (g.ticks() < dayStartTick(d + 1, WW_PREP_TICKS)) {
        step(runner);
        cpuSum += cpu;
        wallSum += wall;
        // Day 0 (the JIT's first pass and the majors' first turns) is
        // told, not bounded.
        if (d > 0) {
          cpuTicks.push(cpu);
          wallTicks.push(wall);
        }
      }
      if (d === 0) day0 = wallSum;
      else {
        cpuDays.push(cpuSum);
        wallDays.push(wallSum);
      }
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
    const [ct, wt] = [sorted(cpuTicks), sorted(wallTicks)];
    console.log(
      `world1936 economy (wall | cpu): day 0 ${day0.toFixed(2)} ms; days 1-100 mean ` +
        `${mean(wallDays).toFixed(3)} | ${mean(cpuDays).toFixed(3)} ms/day; tick p50 ` +
        `${pct(wt, 0.5).toFixed(3)} | ${pct(ct, 0.5).toFixed(3)} ms, p99 ${pct(wt, 0.99).toFixed(3)} | ` +
        `${pct(ct, 0.99).toFixed(3)} ms, max ${wt[wt.length - 1].toFixed(3)} | ` +
        `${ct[ct.length - 1].toFixed(3)} ms over ${ct.length} ticks`,
    );
    expect(mean(cpuDays)).toBeLessThan(DAY_MS * SLACK);
    expect(pct(wt, 0.99)).toBeLessThan(TICK_MS * TICK_SLACK);
  }, 120_000);
});
