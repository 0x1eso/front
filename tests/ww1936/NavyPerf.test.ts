// P4 Task 10 (lane AI review): the navy, invasion and air AI at war scale
// on world1936 — every major at war, the 1936 navies (historical order of
// battle) and 140 more fleets. The country days are split over 7 ticks
// (smallID % 7); each tick's AI calls (and the orders they give) are
// timed. Spec §20.1 gives a country turn, AI included, ≤ 0.2 ms a tick on
// average and ≤ 2 ms at the heaviest tick on a desktop; this machine's
// bounds are looser (see MEAN_MS).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { aiAir } from "@openfront/engine/ww1936/air/AiAir";
import { aiInvasions } from "@openfront/engine/ww1936/navy/AiInvasion";
import { aiMainBase, aiNavy } from "@openfront/engine/ww1936/navy/AiNavy";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { stepTo, wwGameStart } from "./util";

/**
 * Budgets, ms a tick (one seventh of the countries): the mean on the
 * thread's CPU clock, the heaviest tick on the wall clock. Measured with
 * 180 fleets: 0.9–1.8 ms mean, 3–5.5 ms at the heaviest tick under load
 * averages of 4–12 on 12 cores (spec §20.1's desktop budget for a whole
 * country turn is 0.2 / 2 ms: Task 15's perf pass); the bounds catch a
 * regression of two or three times without flaking on a busy machine.
 */
const MEAN_MS = 4;
const MAX_MS = 20;
const DAYS = 14;

test("the navy, invasion and air AI at war scale stay within budget", async () => {
  const files = await loadMapFiles(
    new NodeGameMapLoader(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../resources/maps",
      ),
    ),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner = await createGameRunner(
    wwGameStart(),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  const g = runner.game;
  const ww = g.worldWar()!;
  const sc = ww.scenario;
  stepTo(runner, WW_PREP_TICKS + 1);
  const id = (t: CountryTag) => sc.smallIdOf(t);
  const wars: [CountryTag, CountryTag][] = [
    ["DEU", "GBR"],
    ["DEU", "FRA"],
    ["DEU", "SUN"],
    ["ITA", "GBR"],
    ["ITA", "FRA"],
    ["JPN", "USA"],
    ["JPN", "GBR"],
    ["JPN", "CHN"],
    ["USA", "DEU"],
    ["USA", "ITA"],
  ];
  for (const [a, b] of wars) ww.setWar(id(a), id(b), g.ticks());
  // More fleets: twenty more for every major at its best base (spec §20.1
  // plans for 400).
  for (const t of ["GBR", "USA", "JPN", "DEU", "ITA", "FRA", "SUN"] as const) {
    const port = aiMainBase(ww, id(t));
    for (let i = 0; i < 20; i++) {
      ww.navy.createFleet(id(t), port, [
        ["dd", 2, 4],
        ["cl", 2, 1 + (i % 2)],
        ...(i % 4 === 0 ? ([["bb", 2, 1]] as const) : []),
        ...(i % 5 === 0 ? ([["ss", 2, 6]] as const) : []),
      ]);
    }
  }
  expect(ww.navy.fleets.size).toBeGreaterThan(150);
  const countries = ww.navy.countries().map((c) => c.smallID);
  const times: number[] = [];
  // The mean on this thread's CPU clock where Node has one (the other
  // test workers do not stretch it; its step is coarse, so only the sum),
  // the heaviest tick on the wall clock.
  type ThreadCpu = (prev?: NodeJS.CpuUsage) => NodeJS.CpuUsage;
  const threadCpu = (
    process as { threadCpuUsage?: ThreadCpu }
  ).threadCpuUsage?.bind(process);
  let cpuMs = 0;
  for (let d = 0; d < DAYS; d++) {
    const day = ww.day(g.ticks());
    for (let k = 0; k < 7; k++) {
      const t0 = performance.now();
      const c0 = threadCpu?.();
      for (const c of countries) {
        if (c % 7 !== k) continue;
        aiNavy(ww.navy, c, day);
        aiInvasions(ww.navy, c, day);
        aiAir(ww.air, c, day);
      }
      times.push(performance.now() - t0);
      const used = threadCpu?.(c0);
      if (d > 0) {
        cpuMs +=
          used === undefined
            ? times[times.length - 1]
            : (used.user + used.system) / 1000;
      }
    }
    stepTo(runner, dayStartTick(day + 1, ww.prepEndTick()));
  }
  // The first day warms the JIT up: told, not bounded.
  const warm = times.slice(7);
  const mean = cpuMs / warm.length;
  const max = Math.max(...warm);
  console.log(
    `navy/air AI at war: mean ${mean.toFixed(3)} ms/tick, max ${max.toFixed(2)} ms (fleets ${ww.navy.fleets.size})`,
  );
  expect(mean).toBeLessThan(MEAN_MS);
  expect(max).toBeLessThan(MAX_MS);
}, 600_000);
