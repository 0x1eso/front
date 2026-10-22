/**
 * World War 1936 whole-tick performance check (P6 spec §22.1–§22.2, Task 22
 * Step 3; the final perf lane). The engine only, no screen, one game in
 * this process on the real world1936 map, every country an AI:
 *
 *   npx tsx scripts/ww1936/perf-sim.ts [--seed WWPERF01] [--until 1941-12-31]
 *       [--no-history] [--hash-every 50] [--json <file>] [--no-parts] [--hooks]
 *
 * Every system's share of each tick is timed through its instance methods
 * (the same calls WorldWarExecution makes): politics, the endgame clock,
 * the depth clock, the economy, the land war, the navy, the air war, the
 * endgame's order 8, the event-card deadlines, the depth end of tick, and
 * each update. "P6" is the depth clock + end of tick + update; `--hooks`
 * also times the hooks the other systems call on WwDepth (sea region day,
 * air zone day, rail guns, army mods, …: about 1,700 calls a tick, so the
 * timers' own cost inflates every part that calls them — take the hooks'
 * share from a CPU profile instead). Means are thread CPU (honest
 * on a busy machine), p99 and max the wall clock. `--hash-every N` prints
 * the WorldWar hash every N days and at the end: two builds that print the
 * same lines played the same game (the perf lane's behaviour-identity
 * proof). `--no-parts` times the whole tick only (no wrapper overhead).
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { createGameRunner } from "@openfront/engine/GameRunner";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../../tests/perf/fullgame/NodeGameMapLoader";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "../..");

interface Options {
  seed: string;
  historical: boolean;
  until: string;
  hashEvery: number;
  json: string;
  parts: boolean;
  hooks: boolean;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    seed: "WWPERF01",
    historical: true,
    until: "1941-12-31",
    hashEvery: 0,
    json: "",
    parts: true,
    hooks: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${argv[i - 1]} needs a value`);
      return v;
    };
    switch (argv[i]) {
      case "--seed":
        o.seed = next();
        break;
      case "--until":
        o.until = next();
        break;
      case "--no-history":
        o.historical = false;
        break;
      case "--hash-every":
        o.hashEvery = Number(next());
        break;
      case "--json":
        o.json = next();
        break;
      case "--no-parts":
        o.parts = false;
        break;
      case "--hooks":
        o.hooks = true;
        break;
      default:
        throw new Error(`unknown option ${argv[i]}`);
    }
  }
  return o;
}

type ThreadCpu = () => { user: number; system: number };
const threadCpu = (
  process as unknown as { threadCpuUsage?: ThreadCpu }
).threadCpuUsage?.bind(process);
const cpuNow = (): number => {
  if (threadCpu === undefined) return performance.now();
  const u = threadCpu();
  return (u.user + u.system) / 1000;
};
const iso = (d: number) => formatIsoDate(dateOfDay(d));

interface PerfStat {
  n: number;
  mean: number;
  p50: number;
  p99: number;
  max: number;
}

function stat(cpu: readonly number[], wall: readonly number[]): PerfStat {
  if (cpu.length === 0) return { n: 0, mean: 0, p50: 0, p99: 0, max: 0 };
  const s = [...wall].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  let sum = 0;
  for (const x of cpu) sum += x;
  return {
    n: cpu.length,
    mean: sum / cpu.length,
    p50: at(0.5),
    p99: at(0.99),
    max: s[s.length - 1],
  };
}

function startInfo(seed: string, historical: boolean): GameStartInfo {
  return {
    gameID: seed,
    lobbyCreatedAt: 0,
    config: {
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Private,
      difficulty: Difficulty.Medium,
      nations: "default",
      bots: 0,
      donateGold: true,
      donateTroops: true,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      worldWar1936: true,
      historicalAi: historical,
    },
    players: [],
  };
}

/** The timed parts, in WorldWarExecution's order. */
const PARTS = [
  "politics",
  "endgameClock",
  "depthClock",
  "economy",
  "land",
  "navy",
  "air",
  "endgameTick",
  "deadlines",
  "depthEnd",
  "updates",
  "depthHooks",
] as const;
type Part = (typeof PARTS)[number];

/** The WwDepth methods P1–P5 call (plan decision 37's hooks). */
const DEPTH_HOOKS = [
  "seaRegionDay",
  "airZoneDay",
  "railGunHits",
  "armyMods",
  "planCutBp",
  "fortCut",
  "reinforceOrder",
  "medalXpPct",
  "supplyPm",
  "moveCutPct",
  "onDamRepaired",
  "onFacilityBuilt",
  "noteSorties",
  "energyOutputPct",
  "priorityDemand",
  "priorityGot",
  "civsOut",
  "civsIn",
  "embargoed",
  "noStrike",
  "designSlot",
  "keyStats",
  "intelOf",
  "intelRow",
  "statsPart",
  "surrenderCutPp",
  "resistanceAdjPp",
] as const;

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const files = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner = await createGameRunner(
    startInfo(o.seed, o.historical),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) {
        const st = (gu as { stack?: string }).stack;
        throw new Error(`${gu.errMsg}\n${st ?? ""}`);
      }
    },
  );
  const g = runner.game;
  const ww = g.worldWar()!;

  // ---- Part timers (instance wrappers; the engine calls these methods) ----
  const acc = Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<
    Part,
    number
  >;
  const accW = { ...acc };
  const calls: Record<string, [number, number]> = {};
  const wrap = (obj: object, name: string, part: Part, cpu = true) => {
    const rec = obj as Record<string, (...a: unknown[]) => unknown>;
    const f = rec[name].bind(obj);
    rec[name] = (...a: unknown[]) => {
      const c0 = cpu ? cpuNow() : 0;
      const w0 = performance.now();
      const v = f(...a);
      const dw = performance.now() - w0;
      accW[part] += dw;
      acc[part] += cpu ? cpuNow() - c0 : dw;
      return v;
    };
  };
  let hookDepth = 0;
  const wrapHook = (obj: object, name: string) => {
    const rec = obj as Record<string, (...a: unknown[]) => unknown>;
    const f = rec[name].bind(obj);
    const c = (calls[name] = [0, 0]);
    rec[name] = (...a: unknown[]) => {
      if (hookDepth > 0) return f(...a);
      hookDepth++;
      const w0 = performance.now();
      try {
        return f(...a);
      } finally {
        const dw = performance.now() - w0;
        hookDepth--;
        acc.depthHooks += dw;
        accW.depthHooks += dw;
        c[0]++;
        c[1] += dw;
      }
    };
  };
  if (o.parts) {
    wrap(ww.politics, "tick", "politics");
    wrap(ww.endgame, "clock", "endgameClock");
    wrap(ww.depth, "clock", "depthClock");
    wrap(ww.economy, "tick", "economy");
    wrap(ww.land, "tick", "land");
    wrap(ww.navy, "tick", "navy");
    wrap(ww.air, "tick", "air");
    wrap(ww.endgame, "tick", "endgameTick");
    wrap(ww.politics, "tickDeadlines", "deadlines");
    wrap(ww.depth, "endTick", "depthEnd");
    for (const s of [
      ww,
      ww.economy,
      ww.land,
      ww.politics,
      ww.navy,
      ww.air,
      ww.endgame,
      ww.depth,
    ]) {
      wrap(s, "takeData", "updates");
    }
    if (o.hooks) for (const h of DEPTH_HOOKS) wrapHook(ww.depth, h);
  }
  // Depth's own update, apart (part of P6's sum).
  let depthTake = 0;
  let depthTakeW = 0;
  if (o.parts) {
    const rec = ww.depth as unknown as { takeData: () => unknown };
    const f = rec.takeData;
    rec.takeData = () => {
      const c0 = cpuNow();
      const w0 = performance.now();
      const v = f();
      depthTake += cpuNow() - c0;
      depthTakeW += performance.now() - w0;
      return v;
    };
  }
  // P3's recomputeStats (the brief's item 3): calls and time, inside its callers.
  const rs: [number, number] = [0, 0];
  if (o.parts) {
    const rec = ww.politics as unknown as {
      recomputeStats: (id: number) => void;
    };
    const f = rec.recomputeStats.bind(ww.politics);
    rec.recomputeStats = (id: number) => {
      const w0 = performance.now();
      f(id);
      rs[0]++;
      rs[1] += performance.now() - w0;
    };
  }

  // ---- The run ----
  const prepEnd = ww.prepEndTick();
  const lastDay = dayOfDate(o.until);
  const endTick = dayStartTick(lastDay + 1, prepEnd);
  const tickCpu: number[] = [];
  const tickWall: number[] = [];
  const partCpu = Object.fromEntries(PARTS.map((p) => [p, [] as number[]]));
  const partWall = Object.fromEntries(PARTS.map((p) => [p, [] as number[]]));
  const p6Cpu: number[] = [];
  const p6Wall: number[] = [];
  const p4Cpu: number[] = [];
  const p4Wall: number[] = [];
  const hashes: string[] = [];
  let prevDay = -1;
  const t0 = performance.now();
  while (g.ticks() < endTick) {
    runner.addTurn({ turnNumber: g.ticks(), intents: [] });
    const before = { ...acc };
    const beforeW = { ...accW };
    const dt0 = depthTake;
    const dtw0 = depthTakeW;
    const a = cpuNow();
    const aw = performance.now();
    if (!runner.executeNextTick()) {
      console.error(`stopped at tick ${g.ticks()}`);
      break;
    }
    const t = cpuNow() - a;
    const tw = performance.now() - aw;
    if (g.ticks() > prepEnd) {
      tickCpu.push(t);
      tickWall.push(tw);
      if (o.parts) {
        for (const p of PARTS) {
          partCpu[p].push(acc[p] - before[p]);
          partWall[p].push(accW[p] - beforeW[p]);
        }
        const d = (p: Part, w: boolean) =>
          w ? accW[p] - beforeW[p] : acc[p] - before[p];
        p6Cpu.push(
          d("depthClock", false) +
            d("depthEnd", false) +
            d("depthHooks", false) +
            (depthTake - dt0),
        );
        p6Wall.push(
          d("depthClock", true) +
            d("depthEnd", true) +
            d("depthHooks", true) +
            (depthTakeW - dtw0),
        );
        p4Cpu.push(d("navy", false) + d("air", false));
        p4Wall.push(d("navy", true) + d("air", true));
      }
    }
    const day = ww.inPrep(g.ticks()) ? -1 : ww.day(g.ticks());
    if (day !== prevDay && day > 0) {
      prevDay = day;
      if (o.hashEvery > 0 && day % o.hashEvery === 0) {
        const line = `${iso(day)} tick ${g.ticks()} hash ${ww.hash()}`;
        hashes.push(line);
        console.log(line);
      }
      if (day % 365 === 0) {
        const secs = ((performance.now() - t0) / 1000).toFixed(0);
        console.error(`${iso(day)} (${secs} s)`);
      }
    }
  }
  const finalHash = `final ${iso(lastDay)} tick ${g.ticks()} hash ${ww.hash()}`;
  hashes.push(finalHash);
  console.log(finalHash);

  const fmt = (s: PerfStat) =>
    `mean ${s.mean.toFixed(3)}  p50 ${s.p50.toFixed(3)}  p99 ${s.p99.toFixed(3)}  max ${s.max.toFixed(2)}`;
  const out: Record<string, PerfStat> = {};
  out.tick = stat(tickCpu, tickWall);
  if (o.parts) {
    for (const p of PARTS) out[p] = stat(partCpu[p], partWall[p]);
    out.P6 = stat(p6Cpu, p6Wall);
    out.P4 = stat(p4Cpu, p4Wall);
  }
  const [l1, l5, l15] = os.loadavg();
  console.log(
    `\n== ${o.seed} ${o.historical ? "hist on" : "hist off"} to ${o.until}, ${tickCpu.length} ticks, ${((performance.now() - t0) / 1000).toFixed(0)} s, load at end ${l1.toFixed(2)} / ${l5.toFixed(2)} / ${l15.toFixed(2)} ==`,
  );
  console.log("ms per tick (mean: thread CPU; p50/p99/max: wall)");
  for (const [k, s] of Object.entries(out)) {
    console.log(`${k.padEnd(13)} ${fmt(s)}`);
  }
  if (o.parts) {
    console.log(
      `recomputeStats: ${rs[0]} calls, ${rs[1].toFixed(0)} ms (${(rs[1] / tickCpu.length).toFixed(4)} ms/tick)`,
    );
    const hooks = Object.entries(calls)
      .filter(([, c]) => c[0] > 0)
      .sort((a, b) => b[1][1] - a[1][1]);
    console.log("depth hooks (wall, outermost):");
    for (const [k, c] of hooks) {
      console.log(
        `  ${k.padEnd(16)} ${String(c[0]).padStart(9)} calls  ${(c[1] / tickCpu.length).toFixed(4)} ms/tick`,
      );
    }
  }
  if (o.json !== "") {
    fs.writeFileSync(
      o.json,
      JSON.stringify(
        {
          seed: o.seed,
          historical: o.historical,
          until: o.until,
          load: [l1, l5, l15],
          stats: out,
          recomputeStats: rs,
          hooks: calls,
          hashes,
        },
        null,
        1,
      ),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
