/**
 * World War 1936 P5 endgame balance and performance check (P5 spec §23.3,
 * §21.7; plan Task 18). The engine only, no screen, like the P3/P4 sims:
 *
 *   npx tsx scripts/ww1936/endgame-sim.ts [--seeds 20 | --seeds WWEND001,…]
 *       [--no-history] [--until 1945-08-21] [--out .cache/endgame-sim]
 *       [--jobs 6]
 *   npx tsx scripts/ww1936/endgame-sim.ts --perf [--seed WWEND001]
 *       [--until 1945-08-21]
 *   npx tsx scripts/ww1936/endgame-sim.ts --summary [--out …] [--no-history]
 *
 * One game per seed on the real world1936 map, every country an AI, the
 * historical AI on (`--no-history`: off, 10 seeds by default), each in its
 * own process (`--jobs` at once). Every run writes `<out>/<seed>-<on|off>.json`
 * (what the targets read) and a long CSV `<out>/<seed>-<on|off>.csv`, one
 * row per fact: `date,kind,a,b,c,d,e`:
 *   day       wars ongoing, of them civil, independence; conferences open+queued; exiles
 *   occ       administered regions, mean resistance %, mean compliance %, mean garrison fulfilment %
 *   war_end   war id, kind, side-0 leader, side-1 leader, winner side
 *   treaty    losers, line count, the line keys
 *   cap       loser, victor
 *   exile     country, host
 *   woken     country (news_country_created)
 *   civil_war country, ideology
 *   uprising  region, controller before
 *   subject   (monthly) subject, overlord, level, autonomy %
 *   ll_month  (monthly) from → to, item, sent, arrived (month just ended)
 *   sea_loss  (monthly) shipments' sea loss % that month (all routes), arctic loss %
 * Then the controller's targets (combined brief ruling 1: plausible ranges
 * with variety across seeds), each with its value and PASS/OPEN.
 *
 * --perf: one game in this process, the P5 parts of spec §21.7 timed in
 * thread CPU (means) and wall clock (max): the occupation day, garrisons,
 * the day's common step, subjects/exiles/lend-lease, the endgame AIs, the
 * order-8 step (conferences, takeovers, wakes), and the event ticks (an
 * AI-only conference closing, a civil war, a woken country).
 *
 * It only reports: tune the (내 판단) constants and AI weights by hand.
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { SUBJECT_LEVELS } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { coveragePct } from "@openfront/engine-lib/ww1936/EndgameRules";
import { normalizeWorldWar1936Config } from "@openfront/engine-lib/ww1936/ModeConfig";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { aiAidDay } from "@openfront/engine/ww1936/endgame/AiAid";
import { aiOccupationDay } from "@openfront/engine/ww1936/endgame/AiOccupation";
import { aiSubjectsDay } from "@openfront/engine/ww1936/endgame/AiSubjects";
import { stepExile } from "@openfront/engine/ww1936/endgame/Exile";
import {
  assignGarrisons,
  needOf,
} from "@openfront/engine/ww1936/endgame/Garrison";
import {
  hasNoLendLease,
  stepLendLease,
} from "@openfront/engine/ww1936/endgame/LendLease";
import { stepOccupation } from "@openfront/engine/ww1936/endgame/Occupation";
import { stepSubject } from "@openfront/engine/ww1936/endgame/Subjects";
import type {
  InTransit,
  WwEndgame,
} from "@openfront/engine/ww1936/endgame/WwEndgame";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable } from "../domestic-sim-report";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "../..");

// ---------------------------------------------------------------------------
// Options

export interface Options {
  seeds: string[];
  historical: boolean;
  until: string;
  out: string;
  jobs: number;
  perf: boolean;
  summary: boolean;
  /** Internal: run one game in this process and write its JSON here. */
  one: string;
}

const seedName = (i: number) => `WWEND${String(i).padStart(3, "0")}`;

export function parseArgs(argv: string[]): Options {
  const o: Options = {
    seeds: [],
    historical: true,
    until: "1945-08-21",
    out: path.join(ROOT, ".cache/endgame-sim"),
    jobs: Math.max(1, Math.min(6, os.cpus().length - 1)),
    perf: false,
    summary: false,
    one: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--seeds":
      case "--seed": {
        const v = next();
        o.seeds = /^\d+$/.test(v)
          ? Array.from({ length: Number(v) }, (_, k) => seedName(k + 1))
          : v.split(",");
        break;
      }
      case "--no-history":
        o.historical = false;
        break;
      case "--historical":
        o.historical = next() !== "off";
        break;
      case "--until":
        o.until = next();
        break;
      case "--out":
        o.out = path.resolve(next());
        break;
      case "--jobs":
        o.jobs = Math.max(1, Number(next()));
        break;
      case "--perf":
        o.perf = true;
        break;
      case "--summary":
        o.summary = true;
        break;
      case "--one":
        o.one = next();
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (o.seeds.length === 0) {
    const n = o.perf ? 1 : o.historical ? 20 : 10;
    o.seeds = Array.from({ length: n }, (_, k) => seedName(k + 1));
  }
  return o;
}

/** The thread's CPU time in ms (honest on a busy machine). */
type ThreadCpu = () => { user: number; system: number };
const threadCpu = (
  process as unknown as { threadCpuUsage?: ThreadCpu }
).threadCpuUsage?.bind(process);
const cpuNow = (): number => {
  if (threadCpu === undefined) return performance.now();
  const u = threadCpu();
  return (u.user + u.system) / 1000;
};
export const iso = (d: number | null | undefined) =>
  d === null || d === undefined || Number.isNaN(d)
    ? "-"
    : formatIsoDate(dateOfDay(Math.floor(d)));
const pctOf = (sorted: readonly number[], p: number): number =>
  sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

// ---------------------------------------------------------------------------
// What a run records

/** The arctic sea regions (strategic ids): a lend-lease route through one is "arctic". */
const ARCTIC_SRS = new Set([1001, 1003, 1004, 1005, 1007]);
/** The variety signature's countries (combined brief ruling 1). */
const SIGNATURE_TAGS: readonly CountryTag[] = [
  "POL",
  "FRA",
  "ITA",
  "DEU",
  "SUN",
  "GBR",
  "JPN",
  "CHN",
];
const ALLIED_MAJORS: readonly CountryTag[] = ["GBR", "FRA", "USA", "SUN"];

export interface PerfStat {
  n: number;
  mean: number;
  p99: number;
  max: number;
}

export interface RunResult {
  seed: string;
  historical: boolean;
  until: string;
  ticks: number;
  hash: number;
  seconds: number;
  caps: { day: number; tag: string; victor: string }[];
  exiles: { day: number; tag: string; host: string }[];
  woken: { day: number; tag: string }[];
  civilWars: { day: number; tag: string; ideology: string }[];
  conferences: number;
  treaties: { day: number; losers: string[]; keys: string[] }[];
  uprisings: { day: number; region: number; controller: string }[];
  newsFirst: Record<string, number>;
  spain: { winner: string | null; day: number | null };
  poland: { capDay: number | null; exile: boolean };
  france: { capDay: number | null; vichyDay: number | null };
  exiles194112: number;
  italy: { leftDay: number | null; how: string | null };
  germany: {
    capDay: number | null;
    zones: number;
    zoneHolders: string[];
  };
  occ194206: {
    occupier: string;
    regions: number;
    resPct: number;
    compPct: number;
    fulfilPct: number;
    uprisingsTo: number;
  } | null;
  ll1942: {
    months: { usaWar: boolean; law: boolean; inf: number }[];
    arcticSent: number;
    arcticArrived: number;
    seaSent: number;
    seaArrived: number;
  };
  dominions: Record<
    string,
    { state: string; independent: boolean; autPct: number; level: string }
  >;
  signature: string;
  /** Sensitivity (owner ruling): Korea annexed or administered, Taiwan to anyone but CHN — first day of each. */
  sensitive: { day: number; region: number; what: string }[];
  perf: {
    tick: PerfStat;
    endgame: PerfStat;
    parts?: Record<string, PerfStat>;
    events?: Record<string, PerfStat>;
  };
}

/**
 * A simulator that measures more (P6 depth-sim) plugs into the same game
 * loop instead of copying it: `start` once the game exists, `tick` after
 * every executed tick, `day` once a day after the endgame sampling (with
 * the finished day), `end` to write its part of the result.
 */
export interface SimContext {
  g: Game;
  ww: NonNullable<ReturnType<Game["worldWar"]>>;
  idOf: (t: CountryTag) => number;
  tagOf: (id: number) => string;
  /** Adds a CSV row `date,kind,a,b,c,d,e` to this run's file. */
  row: (day: number, kind: string, ...cells: (string | number)[]) => void;
  /** Today's game day (0 in the preparation). */
  today: () => number;
}
export interface SimExtension {
  start(ctx: SimContext): void;
  tick?(tick: number): void;
  day(done: number): void;
  end(res: RunResult): void;
}

/**
 * The lobby's config after the server's mode rules (ConfigPatch), as a
 * real game gets it — final balance: before this the simulator ran
 * without the lobby's defaults (ww1936Nukes on), so no atomic project.
 */
function startInfo(seed: string, historical: boolean): GameStartInfo {
  return {
    gameID: seed,
    lobbyCreatedAt: 0,
    config: normalizeWorldWar1936Config({
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
      ww1936Nukes: true,
    }),
    players: [],
  };
}

/**
 * Means in thread CPU (honest on a busy machine), p99 and max in the wall
 * clock (the CPU clock ticks in whole milliseconds here).
 */
export function stat(cpu: number[], wall: number[] = cpu): PerfStat {
  if (cpu.length === 0) return { n: 0, mean: 0, p99: 0, max: 0 };
  const s = [...wall].sort((a, b) => a - b);
  let sum = 0;
  for (const x of cpu) sum += x;
  return {
    n: cpu.length,
    mean: sum / cpu.length,
    p99: pctOf(s, 0.99),
    max: s[s.length - 1],
  };
}

// ---------------------------------------------------------------------------
// --perf: the endgame parts, timed (the same sequence as WwEndgame)

const PARTS = [
  "occupation",
  "garrison",
  "subjExileLl",
  "ai",
  "common",
  "order8",
  "update",
] as const;
type Part = (typeof PARTS)[number];

function timeParts(
  eg: WwEndgame,
  acc: Record<Part, number>,
  accW: Record<Part, number>,
): void {
  const time = (p: Part, f: () => void) => {
    const t0 = cpuNow();
    const w0 = performance.now();
    f();
    acc[p] += cpuNow() - t0;
    accW[p] += performance.now() - w0;
  };
  const priv = eg as unknown as {
    dropDayNotes(id: number): void;
    flushDayNotes(id: number): void;
  };
  eg.dailyCountry = (id: number, day: number, tick: number) => {
    if (!eg.isActor(id)) {
      priv.dropDayNotes(id);
      return;
    }
    if (eg.adminDirty) eg.rebuildAdmin();
    time("occupation", () => stepOccupation(eg, id, day));
    time("garrison", () => assignGarrisons(eg, id, day));
    time("subjExileLl", () => {
      if (eg.subjectIdx.has(id)) stepSubject(eg, id, day);
      if (eg.exileIdx.has(id)) stepExile(eg, id, day);
      stepLendLease(eg, id, day);
    });
    if (!eg.isHumanControlled(id)) {
      time("ai", () => {
        aiOccupationDay(eg, id, day, tick);
        aiSubjectsDay(eg, id, day, tick);
        aiAidDay(eg, id, day, tick);
      });
    }
    priv.flushDayNotes(id);
  };
  const common = eg.dailyCommon.bind(eg);
  eg.dailyCommon = (day: number, tick: number) =>
    time("common", () => common(day, tick));
  const t8 = eg.tick.bind(eg);
  eg.tick = (tick: number) => time("order8", () => t8(tick));
  const take = eg.takeData.bind(eg);
  eg.takeData = () => {
    let d: ReturnType<typeof take> = null;
    time("update", () => (d = take()));
    return d;
  };
}

// ---------------------------------------------------------------------------
// One game

export async function runOne(
  seed: string,
  historical: boolean,
  until: string,
  csvPath: string,
  perf: boolean,
  ext?: SimExtension,
): Promise<RunResult> {
  const files = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner: GameRunner = await createGameRunner(
    startInfo(seed, historical),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) {
        const st = (gu as { stack?: string }).stack;
        throw new Error(`${gu.errMsg}\n${st ?? ""}`);
      }
    },
  );
  const g: Game = runner.game;
  const ww = g.worldWar()!;
  const eg = ww.endgame;
  const pol = ww.politics;
  const sc = ww.scenario;
  const idOf = (t: CountryTag) => sc.smallIdOf(t);
  const tagOf = (id: number) =>
    id <= 0 ? "-" : (sc.tagOfSmallId(id) ?? `#${id}`);
  const csv: string[] = ["date,kind,a,b,c,d,e"];
  const row = (day: number, kind: string, ...cells: (string | number)[]) => {
    const c = cells.map((x) =>
      typeof x === "number"
        ? Number.isInteger(x)
          ? String(x)
          : x.toFixed(1)
        : x.includes(",")
          ? `"${x}"`
          : x,
    );
    while (c.length < 5) c.push("");
    csv.push([iso(day), kind, ...c].join(","));
  };
  const today = () => (ww.inPrep(g.ticks()) ? 0 : ww.day(g.ticks()));
  ext?.start({ g, ww, idOf, tagOf, row, today });

  const res: RunResult = {
    seed,
    historical,
    until,
    ticks: 0,
    hash: 0,
    seconds: 0,
    caps: [],
    exiles: [],
    woken: [],
    civilWars: [],
    conferences: 0,
    treaties: [],
    uprisings: [],
    newsFirst: {},
    spain: { winner: null, day: null },
    poland: { capDay: null, exile: false },
    france: { capDay: null, vichyDay: null },
    exiles194112: -1,
    italy: { leftDay: null, how: null },
    germany: { capDay: null, zones: 0, zoneHolders: [] },
    occ194206: null,
    ll1942: {
      months: [],
      arcticSent: 0,
      arcticArrived: 0,
      seaSent: 0,
      seaArrived: 0,
    },
    dominions: {},
    signature: "",
    sensitive: [],
    perf: {
      tick: stat([]),
      endgame: stat([]),
    },
  };

  // ---- Events (instance hooks: the engine calls these methods) ----
  const lastAdmin = new Map<number, number>();
  const eventTicks = new Map<number, Set<string>>();
  const markEvent = (kind: string) => {
    const t = g.ticks();
    let s = eventTicks.get(t);
    if (s === undefined) eventTicks.set(t, (s = new Set()));
    s.add(kind);
  };
  const onCap = eg.onCapitulated.bind(eg);
  eg.onCapitulated = (loser: number, victor: number, tick: number) => {
    const day = today();
    res.caps.push({ day, tag: tagOf(loser), victor: tagOf(victor) });
    row(day, "cap", tagOf(loser), tagOf(victor));
    markEvent("capitulation");
    onCap(loser, victor, tick);
  };
  const egNews = eg.news.bind(eg);
  eg.news = (id: string, params: Record<string, string | number>) => {
    const day = today();
    switch (id) {
      case "news_exiled":
        res.exiles.push({
          day,
          tag: String(params.tag),
          host: String(params.hostTag),
        });
        row(day, "exile", String(params.tag), String(params.hostTag));
        break;
      case "news_country_created":
        res.woken.push({ day, tag: String(params.tag) });
        row(day, "woken", String(params.tag));
        markEvent("woken");
        break;
      case "news_civil_war":
        res.civilWars.push({
          day,
          tag: String(params.tag),
          ideology: String(params.ideology),
        });
        row(day, "civil_war", String(params.tag), String(params.ideology));
        markEvent("civil_war");
        break;
      case "news_peace_conference":
        res.conferences++;
        markEvent("conference_open");
        break;
      case "news_peace_treaty": {
        const e = eg.peaceLog[0];
        const losers = e?.losers.map(tagOf) ?? [];
        const keys = e?.lines.map((l) => l.key) ?? [];
        res.treaties.push({ day, losers, keys });
        row(day, "treaty", losers.join(" "), keys.length, keys.join(" "));
        markEvent("treaty");
        break;
      }
      case "news_uprising": {
        const r = Number(params.region);
        const c = tagOf(lastAdmin.get(r) ?? 0);
        res.uprisings.push({ day, region: r, controller: c });
        row(day, "uprising", r, c);
        break;
      }
    }
    egNews(id, params);
  };
  const polNews = pol.news.bind(pol);
  pol.news = (id: string, params: Record<string, string | number> = {}) => {
    res.newsFirst[id] ??= today();
    polNews(id, params);
  };

  // ---- Lend-lease shipments (registered before, settled after the common day) ----
  interface Ship {
    from: number;
    to: number;
    item: string;
    gen: number;
    sea: boolean;
    arctic: boolean;
    initial: number;
    day: number;
    returned: boolean;
  }
  const ships = new Map<InTransit, Ship>();
  const monthSent = new Map<string, number>(); // "from>to>item" → sent this month
  const monthArrived = new Map<string, number>();
  let monthSea = [0, 0];
  let monthArctic = [0, 0];
  const usa = idOf("USA");
  const gbr = idOf("GBR");
  const sun = idOf("SUN");
  const year1942 = [dayOfDate("1942-01-01"), dayOfDate("1942-12-31")];
  const months1942 = Array.from({ length: 12 }, () => ({
    usaWar: false,
    law: false,
    inf: 0,
  }));
  const register = (day: number) => {
    for (const t of eg.inTransit) {
      if (ships.has(t)) continue;
      const s: Ship = {
        from: t.from,
        to: t.to,
        item: t.item,
        gen: t.gen,
        sea: t.sea,
        arctic: t.sea && t.srs.some((x) => ARCTIC_SRS.has(x)),
        initial: t.countMilli,
        day,
        returned: false,
      };
      ships.set(t, s);
      const k = `${tagOf(t.from)}>${tagOf(t.to)}>${t.item}`;
      monthSent.set(k, (monthSent.get(k) ?? 0) + t.countMilli / 1000);
      if (
        t.from === usa &&
        (t.to === gbr || t.to === sun) &&
        t.item === "infantry_equipment" &&
        day >= year1942[0] &&
        day <= year1942[1]
      ) {
        months1942[dateOfDay(day).month - 1].inf += t.countMilli / 1000;
      }
    }
  };
  const settle = () => {
    const live = new Set(eg.inTransit);
    for (const [t, s] of ships) {
      if (live.has(t)) continue;
      ships.delete(t);
      if (s.returned) continue;
      const k = `${tagOf(s.from)}>${tagOf(s.to)}>${s.item}`;
      monthArrived.set(k, (monthArrived.get(k) ?? 0) + t.countMilli / 1000);
      if (!s.sea) continue;
      monthSea = [monthSea[0] + s.initial, monthSea[1] + t.countMilli];
      if (s.arctic) {
        monthArctic = [
          monthArctic[0] + s.initial,
          monthArctic[1] + t.countMilli,
        ];
      }
      if (s.day >= year1942[0] && s.day <= year1942[1]) {
        res.ll1942.seaSent += s.initial;
        res.ll1942.seaArrived += t.countMilli;
        if (s.arctic) {
          res.ll1942.arcticSent += s.initial;
          res.ll1942.arcticArrived += t.countMilli;
        }
      }
    }
  };
  const common = eg.dailyCommon.bind(eg);
  eg.dailyCommon = (day: number, tick: number) => {
    register(day);
    for (const [t, s] of ships) if (!eg.isActor(t.to)) s.returned = true;
    common(day, tick);
    settle();
  };

  // ---- Timing ----
  const tickMs: number[] = [];
  const tickWall: number[] = [];
  const egMs: number[] = [];
  const egWall: number[] = [];
  let egAcc = 0;
  let egAccW = 0;
  const parts = Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<
    Part,
    number
  >;
  const partsW = { ...parts };
  const partTicks = Object.fromEntries(PARTS.map((p) => [p, [] as number[]]));
  const partWall = Object.fromEntries(PARTS.map((p) => [p, [] as number[]]));
  if (perf) timeParts(eg, parts, partsW);
  {
    const timed = <T>(f: () => T): T => {
      const a = cpuNow();
      const w = performance.now();
      const v = f();
      egAcc += cpuNow() - a;
      egAccW += performance.now() - w;
      return v;
    };
    const clock = eg.clock.bind(eg);
    eg.clock = (t: number) => timed(() => clock(t));
    const t8 = eg.tick.bind(eg);
    eg.tick = (t: number) => timed(() => t8(t));
    const td = eg.takeData.bind(eg);
    eg.takeData = () => timed(() => td());
  }
  const events: Record<string, number[]> = {};
  const eventsW: Record<string, number[]> = {};
  const eventEg: Record<string, number[]> = {};
  const eventEgW: Record<string, number[]> = {};

  // ---- Daily sampling ----
  const prepEnd = ww.prepEndTick();
  const lastDay = dayOfDate(until);
  const endTick = dayStartTick(lastDay + 1, prepEnd);
  const [esn, esr, pl, fra, vic, ita, deu] = (
    ["ESN", "ESR", "POL", "FRA", "VIC", "ITA", "DEU"] as CountryTag[]
  ).map(idOf);
  const down = (id: number) =>
    ww.isCapitulated(id) || eg.isExile(id) || eg.countryState(id) !== "active";
  const everDown = new Map<string, number>();
  const zoneHolders = new Set<string>();
  const zoneRegions = new Set<number>();
  let itaFought = false;
  const d194112 = dayOfDate("1941-12-01");
  const d194206 = dayOfDate("1942-06-30");
  const uprisingsTo = () =>
    res.uprisings.filter((u) => u.day <= d194206).length;
  const occStats = (ctrl: number | null) => {
    let n = 0;
    let resSum = 0;
    let compSum = 0;
    let fulSum = 0;
    const ids = ctrl === null ? [...eg.adminByController.keys()] : [ctrl];
    for (const c of ids) {
      for (const r of eg.administeredOf(c)) {
        n++;
        resSum += eg.resBp[r];
        compSum += eg.compBp[r];
        fulSum += coveragePct(eg.supDeci[r], needOf(eg, c, r));
      }
    }
    return n === 0
      ? { n: 0, res: 0, comp: 0, ful: 0 }
      : {
          n,
          res: resSum / n / 100,
          comp: compSum / n / 100,
          ful: fulSum / n,
        };
  };
  const seenEnded = new Set<number>();
  // Sensitivity: Korea's regions stay Japan's by law (zones move control
  // only) and are never administered; Taiwan's legal owner is JPN or CHN.
  const grp = (g: string) => pol.content.groupIdx.get(g)?.regions ?? [];
  const korea = [...grp("korea_north"), ...grp("korea_south")];
  const taiwan = grp("taiwan");
  const jpn = idOf("JPN");
  const chn = idOf("CHN");
  const flagged = new Set<string>();
  const flag = (day: number, region: number, what: string) => {
    const k = `${region}:${what}`;
    if (flagged.has(k)) return;
    flagged.add(k);
    res.sensitive.push({ day, region, what });
    row(day, "sensitive", region, what);
  };
  let prevDay = -1;
  const t0 = performance.now();
  while (g.ticks() < endTick) {
    runner.addTurn({ turnNumber: g.ticks(), intents: [] });
    const before = egAcc;
    const beforeW = egAccW;
    const before8 = perf ? { ...parts } : null;
    const before8W = perf ? { ...partsW } : null;
    const a = cpuNow();
    const aw = performance.now();
    if (!runner.executeNextTick()) {
      console.error(`${seed}: stopped at tick ${g.ticks()}`);
      break;
    }
    const t = cpuNow() - a;
    const tw = performance.now() - aw;
    const tick = g.ticks() - 1;
    ext?.tick?.(tick);
    if (g.ticks() > prepEnd) {
      tickMs.push(t);
      tickWall.push(tw);
      egMs.push(egAcc - before);
      egWall.push(egAccW - beforeW);
      if (before8 !== null && before8W !== null) {
        for (const p of PARTS) {
          partTicks[p].push(parts[p] - before8[p]);
          partWall[p].push(partsW[p] - before8W[p]);
        }
      }
      const ev = eventTicks.get(tick) ?? eventTicks.get(g.ticks());
      if (ev !== undefined) {
        for (const k of ev) {
          (events[k] ??= []).push(t);
          (eventsW[k] ??= []).push(tw);
          (eventEg[k] ??= []).push(egAcc - before);
          (eventEgW[k] ??= []).push(egAccW - beforeW);
        }
        eventTicks.delete(tick);
        eventTicks.delete(g.ticks());
      }
    }
    const day = ww.inPrep(g.ticks()) ? -1 : ww.day(g.ticks());
    if (day === prevDay || day < 0) continue;
    prevDay = day;
    const done = day - 1;
    if (done < 0) continue;
    if (eg.adminDirty) eg.rebuildAdmin();
    lastAdmin.clear();
    for (const [c, rs] of eg.adminByController) {
      for (const r of rs) lastAdmin.set(r, c);
    }
    // Who is down (capitulated, in exile, gone), the first day.
    for (const tg of [...SIGNATURE_TAGS, "ESN", "ESR", "USA"] as CountryTag[]) {
      if (!everDown.has(tg) && down(idOf(tg))) everDown.set(tg, done);
    }
    // Spain (spec §15.6): whichever side is left standing.
    if (res.spain.winner === null) {
      if (down(esr) && !down(esn)) res.spain = { winner: "ESN", day: done };
      else if (down(esn) && !down(esr))
        res.spain = { winner: "ESR", day: done };
    }
    if (res.poland.capDay === null && down(pl)) res.poland.capDay = done;
    if (eg.isExile(pl)) res.poland.exile = true;
    if (res.france.capDay === null && down(fra)) res.france.capDay = done;
    if (res.france.vichyDay === null && eg.countryState(vic) === "active") {
      res.france.vichyDay = done;
    }
    if (done === d194112) res.exiles194112 = eg.exiles.length;
    for (const r of korea) {
      const lo = pol.legalOwner[r] ?? 0;
      if (lo !== jpn) flag(done, r, `korea legal ${tagOf(lo)}`);
      if (eg.isAdministered(r)) flag(done, r, "korea administered");
    }
    for (const r of taiwan) {
      const lo = pol.legalOwner[r] ?? 0;
      if (lo !== jpn && lo !== chn) flag(done, r, `taiwan legal ${tagOf(lo)}`);
      if (eg.isAdministered(r)) flag(done, r, "taiwan administered");
    }
    // Italy leaves the war: down, the armistice, or peace with the Allies.
    if (res.italy.leftDay === null) {
      const allied = ALLIED_MAJORS.some((t) => ww.isAtWar(ita, idOf(t)));
      if (down(ita)) res.italy = { leftDay: done, how: "capitulation" };
      else if (res.newsFirst["ita_news_armistice"] !== undefined) {
        res.italy = { leftDay: done, how: "armistice" };
      } else if (itaFought && !allied) {
        res.italy = { leftDay: done, how: "peace" };
      }
      if (allied) itaFought = true;
    }
    if (res.germany.capDay === null && down(deu)) res.germany.capDay = done;
    for (const z of eg.zones) {
      if ((pol.legalOwner[z.region] ?? 0) !== deu) continue;
      zoneRegions.add(z.region);
      zoneHolders.add(tagOf(z.holder));
    }
    if (done === d194206) {
      let best = 0;
      let bestN = 0;
      for (const [c, rs] of eg.adminByController) {
        if (rs.length > bestN || (rs.length === bestN && c < best)) {
          best = c;
          bestN = rs.length;
        }
      }
      if (best > 0) {
        const s = occStats(best);
        res.occ194206 = {
          occupier: tagOf(best),
          regions: s.n,
          resPct: s.res,
          compPct: s.comp,
          fulfilPct: s.ful,
          uprisingsTo: uprisingsTo(),
        };
      }
    }
    // The CSV's day rows.
    let ongoing = 0;
    let civil = 0;
    let indep = 0;
    for (const w of eg.wars) {
      if (w.ended !== null) continue;
      ongoing++;
      if (w.kind === "civil") civil++;
      if (w.kind === "independence") indep++;
    }
    const confLive = eg.conferences.filter((c) => c.status !== 2).length;
    row(done, "day", ongoing, civil, indep, confLive, eg.exiles.length);
    const o = occStats(null);
    row(done, "occ", o.n, o.res, o.comp, o.ful);
    // The month's rows on its last day.
    const dd = dateOfDay(done);
    const tomorrow = dateOfDay(done + 1);
    if (tomorrow.month !== dd.month) {
      for (const s of eg.subjects) {
        row(
          done,
          "subject",
          tagOf(s.subject),
          tagOf(s.overlord),
          SUBJECT_LEVELS[s.level],
          s.autBp / 100,
        );
      }
      for (const [k, v] of monthSent) {
        const [f, tt, item] = k.split(">");
        row(done, "ll_month", `${f}>${tt}`, item, v, monthArrived.get(k) ?? 0);
      }
      const loss = (x: number[]) =>
        x[0] === 0 ? -1 : (100 * (x[0] - x[1])) / x[0];
      if (monthSea[0] > 0) {
        row(done, "sea_loss", loss(monthSea), loss(monthArctic));
      }
      monthSent.clear();
      monthArrived.clear();
      monthSea = [0, 0];
      monthArctic = [0, 0];
    }
    // 1942: the month's lend-lease condition, read mid-month.
    if (dd.year === 1942 && dd.day === 15) {
      const m = months1942[dd.month - 1];
      m.usaWar = ww.enemiesOf(usa).length > 0;
      m.law = !hasNoLendLease(pol, usa);
    }
    // Wars that ended (they stay 30 days in the records).
    for (const w of eg.wars) {
      if (w.ended === null || seenEnded.has(w.id)) continue;
      seenEnded.add(w.id);
      row(
        done,
        "war_end",
        w.id,
        w.kind,
        tagOf(w.sides[0].leader),
        tagOf(w.sides[1].leader),
        w.ended.winner,
      );
    }
    ext?.day(done);
  }
  res.seconds = Math.round((performance.now() - t0) / 1000);
  res.ticks = g.ticks();
  res.hash = (g as unknown as { hash(): number }).hash();
  res.ll1942.months = months1942;
  res.germany.zones = zoneRegions.size;
  res.germany.zoneHolders = [...zoneHolders].sort();
  for (const tg of ["CAN", "AUS"] as CountryTag[]) {
    const id = idOf(tg);
    const s = eg.subjectOf(id);
    const line = eg.subjects.find((x) => x.subject === id);
    res.dominions[tg] = {
      state: eg.countryState(id),
      independent: s === null && eg.isActor(id),
      autPct: line === undefined ? 100 : line.autBp / 100,
      level: s === null ? "independent" : s.level,
    };
  }
  const capped = SIGNATURE_TAGS.filter((t) => everDown.has(t));
  const deuEnd = everDown.get("DEU");
  res.signature = `${capped.join("+") || "none"}|DEU:${deuEnd === undefined ? "alive" : dateOfDay(deuEnd).year}`;
  res.perf = {
    tick: stat(tickMs, tickWall),
    endgame: stat(egMs, egWall),
  };
  if (perf) {
    res.perf.parts = Object.fromEntries(
      PARTS.map((p) => [p, stat(partTicks[p], partWall[p])]),
    );
  }
  res.perf.events = Object.fromEntries(
    Object.entries(events).map(([k, v]) => [k, stat(v, eventsW[k])]),
  );
  for (const [k, v] of Object.entries(eventEg)) {
    res.perf.events[`${k}:endgame`] = stat(v, eventEgW[k]);
  }
  ext?.end(res);
  if (csvPath !== "") fs.writeFileSync(csvPath, csv.join("\n") + "\n");
  return res;
}
// ---------------------------------------------------------------------------
// The targets (combined brief ruling 1)

interface Check {
  target: string;
  value: string;
  ok: boolean;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const f1 = (x: number) => x.toFixed(1);

function checksOn(rs: RunResult[]): Check[] {
  const n = rs.length;
  const scale = (k: number) => Math.ceil((k * n) / 20);
  const out: Check[] = [];
  const count = (f: (r: RunResult) => boolean) => rs.filter(f).length;
  // Spain.
  const esn = count((r) => r.spain.winner === "ESN");
  out.push({
    target: `Spain: Nationalists win >= ${scale(11)}/${n}`,
    value: `${esn}/${n} (ESR ${count((r) => r.spain.winner === "ESR")}, none ${count((r) => r.spain.winner === null)})`,
    ok: esn >= scale(11),
  });
  const [s0, s1] = [dayOfDate("1938-06-01"), dayOfDate("1940-06-30")];
  const ends = rs
    .map((r) => r.spain.day)
    .filter((d): d is number => d !== null);
  const inWin = ends.filter((d) => d >= s0 && d <= s1).length;
  out.push({
    target: `Spain: ends 1938-06..1940-06 in >= ${scale(14)}/${n}`,
    value: `${inWin}/${n} (median end ${iso(median(ends))})`,
    ok: inWin >= scale(14),
  });
  // Poland.
  const plBy = dayOfDate("1940-12-31");
  const plCaps = rs.filter(
    (r) => r.poland.capDay !== null && r.poland.capDay <= plBy,
  );
  out.push({
    target: `Poland: capitulates by 1940-12 in >= ${scale(14)}/${n}`,
    value: `${plCaps.length}/${n} (median ${iso(median(plCaps.map((r) => r.poland.capDay!)))})`,
    ok: plCaps.length >= scale(14),
  });
  const plAll = rs.filter((r) => r.poland.capDay !== null);
  const plEx = plAll.filter((r) => r.poland.exile).length;
  out.push({
    target: "Poland: exile in >= 70% of its capitulations",
    value: `${plEx}/${plAll.length}`,
    ok: plAll.length > 0 && plEx * 10 >= plAll.length * 7,
  });
  // France.
  const frFalls = count(
    (r) => r.france.capDay !== null || r.france.vichyDay !== null,
  );
  out.push({
    target: `France: falls in ${scale(8)}-${scale(18)}/${n}`,
    value: `${frFalls}/${n}`,
    ok: frFalls >= scale(8) && frFalls <= scale(18),
  });
  const frCaps = rs.filter((r) => r.france.capDay !== null);
  const vichy = frCaps.filter((r) => r.france.vichyDay !== null).length;
  out.push({
    target: "France: Vichy in >= 50% of its capitulations",
    value: `${vichy}/${frCaps.length}`,
    ok: frCaps.length > 0 && vichy * 2 >= frCaps.length,
  });
  // Exiles at 1941-12.
  const ex = rs.map((r) => r.exiles194112);
  const exMed = median(ex);
  out.push({
    target: "Exiles alive at 1941-12: 1-8 each, median 2-6",
    value: `median ${exMed}, range ${Math.min(...ex)}-${Math.max(...ex)} [${ex.join(" ")}]`,
    ok: exMed >= 2 && exMed <= 6 && ex.every((x) => x >= 1 && x <= 8),
  });
  // Italy.
  const itBy = dayOfDate("1945-08-21");
  const itLeft = rs.filter(
    (r) => r.italy.leftDay !== null && r.italy.leftDay <= itBy,
  );
  const hows = new Map<string, number>();
  for (const r of itLeft)
    hows.set(r.italy.how!, (hows.get(r.italy.how!) ?? 0) + 1);
  out.push({
    target: `Italy: leaves the war by 1945-08 in >= ${scale(6)}/${n}`,
    value: `${itLeft.length}/${n} (${[...hows].map(([k, v]) => `${k} ${v}`).join(", ")})`,
    ok: itLeft.length >= scale(6),
  });
  // Germany.
  const deCaps = rs.filter((r) => r.germany.capDay !== null);
  out.push({
    target: `Germany: capitulates by 1945-08 in ${scale(6)}-${scale(18)}/${n}`,
    value: `${deCaps.length}/${n} (years ${deCaps.map((r) => dateOfDay(r.germany.capDay!).year).join(" ")})`,
    ok: deCaps.length >= scale(6) && deCaps.length <= scale(18),
  });
  const zoned = deCaps.filter((r) => r.germany.zones > 0).length;
  out.push({
    target: "Germany: occupation zones in >= 60% of its capitulations",
    value: `${zoned}/${deCaps.length}`,
    ok: deCaps.length > 0 && zoned * 10 >= deCaps.length * 6,
  });
  // Occupation 1942-06.
  const occ = rs.map((r) => r.occ194206).filter((o) => o !== null);
  const meanOf = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
  const resM = meanOf(occ.map((o) => o.resPct));
  const fulM = meanOf(occ.map((o) => o.fulfilPct));
  const upr = occ.map((o) => o.uprisingsTo);
  const occupiers = new Map<string, number>();
  for (const o of occ)
    occupiers.set(o.occupier, (occupiers.get(o.occupier) ?? 0) + 1);
  out.push({
    target: "Occupation 1942-06 (largest occupier): mean resistance 15-60%",
    value: `${f1(resM)}% over ${occ.length} seeds (${[...occupiers].map(([k, v]) => `${k} ${v}`).join(", ")})`,
    ok: occ.length > 0 && resM >= 15 && resM <= 60,
  });
  out.push({
    target: "Occupation 1942-06: garrison fulfilment >= 50%",
    value: `${f1(fulM)}%`,
    ok: occ.length > 0 && fulM >= 50,
  });
  out.push({
    target: "Occupation: uprisings to 1942-06 <= 8 per game",
    value: `mean ${f1(meanOf(upr))}, max ${Math.max(0, ...upr)} (whole game: mean ${f1(meanOf(rs.map((r) => r.uprisings.length)))})`,
    ok: meanOf(upr) <= 8,
  });
  // Lend-lease 1942.
  const qual: number[] = [];
  let qualSeeds = 0;
  for (const r of rs) {
    const ms = r.ll1942.months.filter((m) => m.usaWar || m.law);
    if (ms.length > 0) qualSeeds++;
    for (const m of ms) qual.push(m.inf);
  }
  out.push({
    target:
      "Lend-lease 1942: USA -> GBR+SUN infantry equipment >= 1,500/month (USA at war or lend-lease law)",
    value: `mean ${Math.round(meanOf(qual))}/month over ${qual.length} months, ${qualSeeds}/${n} seeds; median ${Math.round(median(qual))}`,
    ok: qual.length > 0 && meanOf(qual) >= 1500,
  });
  const arcS = rs.reduce((s, r) => s + r.ll1942.arcticSent, 0);
  const arcA = rs.reduce((s, r) => s + r.ll1942.arcticArrived, 0);
  const seaS = rs.reduce((s, r) => s + r.ll1942.seaSent, 0);
  const seaA = rs.reduce((s, r) => s + r.ll1942.seaArrived, 0);
  const arcLoss = arcS === 0 ? -1 : (100 * (arcS - arcA)) / arcS;
  out.push({
    target: "Lend-lease 1942: Arctic losses 3-35%",
    value:
      arcS === 0
        ? `no arctic shipments (all sea: ${seaS === 0 ? "none" : f1((100 * (seaS - seaA)) / seaS) + "%"})`
        : `${f1(arcLoss)}% of ${Math.round(arcS / 1000)} (all sea ${f1((100 * (seaS - seaA)) / seaS)}%)`,
    ok: arcS > 0 && arcLoss >= 3 && arcLoss <= 35,
  });
  // Dominions 1945.
  for (const tg of ["CAN", "AUS"]) {
    const ind = count((r) => r.dominions[tg]?.independent === true);
    const subs = rs.filter((r) => r.dominions[tg]?.independent === false);
    const aut = meanOf(subs.map((r) => r.dominions[tg].autPct));
    out.push({
      target: `Dominions 1945: ${tg} autonomy >= 60% or >= ${scale(8)}/${n} independent`,
      value: `independent ${ind}/${n}, autonomy mean ${f1(aut)}% (${subs.map((r) => Math.round(r.dominions[tg].autPct)).join(" ")})`,
      ok: aut >= 60 || ind >= scale(8),
    });
  }
  out.push(sensitivityCheck(rs));
  // Variety.
  const sigs = new Map<string, number>();
  for (const r of rs) sigs.set(r.signature, (sigs.get(r.signature) ?? 0) + 1);
  const top = Math.max(...sigs.values());
  out.push({
    target: `Variety: >= 4 distinct world outcomes, none > ${scale(8)}/${n}`,
    value: `${sigs.size} distinct, largest ${top}`,
    ok: sigs.size >= 4 && top <= scale(8),
  });
  return out;
}

function sensitivityCheck(rs: RunResult[]): Check {
  const sens = rs.filter((r) => (r.sensitive ?? []).length > 0);
  const what = sens
    .map((r) => `${r.seed}: ${r.sensitive.map((x) => x.what).join("; ")}`)
    .join(" | ");
  return {
    target:
      "Sensitivity: Korea never annexed/administered, Taiwan only JPN/CHN",
    value: `${sens.length}/${rs.length} games flagged${sens.length > 0 ? ` (${what})` : ""}`,
    ok: sens.length === 0,
  };
}

function checksOff(rs: RunResult[]): Check[] {
  const n = rs.length;
  const conf = rs.map((r) => r.conferences);
  const cw = rs.map((r) => r.civilWars.length);
  const exiles = rs.filter((r) => r.exiles.length >= 1).length;
  return [
    {
      target: "History off: >= 1 conference per game",
      value: `[${conf.join(" ")}]`,
      ok: conf.every((x) => x >= 1),
    },
    {
      target: "History off: civil wars 0-3 per game",
      value: `[${cw.join(" ")}]`,
      ok: cw.every((x) => x >= 0 && x <= 3),
    },
    {
      target: `History off: >= 1 exile in >= ${Math.ceil((6 * n) / 10)}/${n} games`,
      value: `${exiles}/${n}`,
      ok: exiles * 10 >= n * 6,
    },
    sensitivityCheck(rs),
  ];
}

/** The per-seed endgame table (P5 Task 18). */
export function seedTable(xs: readonly RunResult[]): string {
  return formatTable(
    [
      "seed",
      "spain",
      "POL cap",
      "exile",
      "FRA cap",
      "VIC",
      "ex41",
      "ITA out",
      "DEU cap",
      "zones",
      "occ 1942-06",
      "upr",
      "conf",
      "cw",
      "woken",
      "signature",
      "s",
    ],
    xs.map((r) => [
      r.seed,
      `${r.spain.winner ?? "-"} ${iso(r.spain.day)}`,
      iso(r.poland.capDay),
      r.poland.exile ? "y" : "n",
      iso(r.france.capDay),
      iso(r.france.vichyDay),
      String(r.exiles194112),
      `${iso(r.italy.leftDay)} ${r.italy.how ?? ""}`,
      iso(r.germany.capDay),
      `${r.germany.zones} ${r.germany.zoneHolders.join("/")}`,
      r.occ194206 === null
        ? "-"
        : `${r.occ194206.occupier} ${r.occ194206.regions} r${Math.round(r.occ194206.resPct)} f${Math.round(r.occ194206.fulfilPct)}`,
      String(r.uprisings.length),
      String(r.conferences),
      String(r.civilWars.length),
      r.woken.map((w) => w.tag).join(" "),
      r.signature,
      String(r.seconds),
    ]),
  );
}

function report(rs: RunResult[]): void {
  rs.sort((a, b) => a.seed.localeCompare(b.seed));
  const on = rs.filter((r) => r.historical);
  const off = rs.filter((r) => !r.historical);
  for (const [label, xs] of [
    ["historical AI on", on],
    ["historical AI off", off],
  ] as const) {
    if (xs.length === 0) continue;
    console.log(`\n== ${label}: ${xs.length} seeds ==`);
    console.log(seedTable(xs));
    const checks = label === "historical AI on" ? checksOn(xs) : checksOff(xs);
    console.log(
      "\n" +
        formatTable(
          ["target", "result", "status"],
          checks.map((c) => [c.target, c.value, c.ok ? "PASS" : "OPEN"]),
        ),
    );
    const sigs = new Map<string, number>();
    for (const r of xs) sigs.set(r.signature, (sigs.get(r.signature) ?? 0) + 1);
    console.log("\nworld outcomes:");
    for (const [k, v] of [...sigs].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${v}x ${k}`);
    }
    const mean = (f: (r: RunResult) => number) =>
      (xs.reduce((s, r) => s + f(r), 0) / xs.length).toFixed(3);
    console.log(
      `\nendgame CPU per tick (loaded, ${xs.length} runs): mean ${mean((r) => r.perf.endgame.mean)} ms, p99 ${mean((r) => r.perf.endgame.p99)} ms, max ${Math.max(...xs.map((r) => r.perf.endgame.max)).toFixed(2)} ms; whole tick mean ${mean((r) => r.perf.tick.mean)} ms`,
    );
    const beats = ["ita_news_armistice", "news_esp_civil_war_ends"];
    for (const b of beats) {
      console.log(
        `  ${b}: ${xs.filter((r) => r.newsFirst[b] !== undefined).length}/${xs.length}`,
      );
    }
  }
}

function printPerf(r: RunResult): void {
  console.log(
    `\n== perf ${r.seed} historical ${r.historical ? "on" : "off"} to ${r.until} (${r.ticks} ticks, ${r.seconds} s, load ${os
      .loadavg()
      .map((x) => x.toFixed(1))
      .join(" ")}) ==`,
  );
  const rows: string[][] = [];
  const add = (name: string, s: PerfStat | undefined) => {
    if (s === undefined) return;
    rows.push([
      name,
      String(s.n),
      s.mean.toFixed(4),
      s.p99.toFixed(3),
      s.max.toFixed(3),
    ]);
  };
  add("whole tick", r.perf.tick);
  add("endgame (clock + order 8 + update)", r.perf.endgame);
  for (const [k, v] of Object.entries(r.perf.parts ?? {})) add(`  ${k}`, v);
  for (const [k, v] of Object.entries(r.perf.events ?? {})) {
    add(`event ${k}`, v);
  }
  console.log(
    formatTable(["part", "ticks", "mean ms", "p99 ms", "max ms"], rows),
  );
}

// ---------------------------------------------------------------------------
// Main

function runChild(
  o: Options,
  seed: string,
  json: string,
  csvPath: string,
  script: string,
): Promise<void> {
  const args = [
    ...process.execArgv,
    script,
    "--one",
    json,
    "--seeds",
    seed,
    "--historical",
    o.historical ? "on" : "off",
    "--until",
    o.until,
    "--out",
    csvPath,
  ];
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, args, {
      stdio: ["ignore", "inherit", "inherit"],
    });
    p.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`${seed} exited ${code}`)),
    );
  });
}

export function readResults(
  dir: string,
  historical: boolean | null,
): RunResult[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
    .filter(
      (r: RunResult) => historical === null || r.historical === historical,
    );
}

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  if (o.one !== "") {
    // Internal: `--out` is this run's CSV path.
    const r = await runOne(o.seeds[0], o.historical, o.until, o.out, false);
    fs.writeFileSync(o.one, JSON.stringify(r));
    return;
  }
  if (o.perf) {
    const r = await runOne(o.seeds[0], o.historical, o.until, "", true);
    printPerf(r);
    return;
  }
  if (o.summary) {
    report(readResults(o.out, null));
    return;
  }
  const failed = await runBatch(o, SELF);
  report(readResults(o.out, o.historical));
  if (failed.length > 0) console.log(`\nFAILED runs: ${failed.join(" ")}`);
}

/**
 * Runs `o.seeds`, one child process of `script` per seed (`--jobs` at
 * once); each writes `<out>/<seed>-<on|off>.json` and `.csv`. Returns the
 * failed seeds.
 */
export async function runBatch(o: Options, script: string): Promise<string[]> {
  fs.mkdirSync(o.out, { recursive: true });
  const mode = o.historical ? "on" : "off";
  let next = 0;
  let doneN = 0;
  const failed: string[] = [];
  const t0 = performance.now();
  const worker = async () => {
    while (next < o.seeds.length) {
      const s = o.seeds[next++];
      const json = path.join(o.out, `${s}-${mode}.json`);
      try {
        await runChild(
          o,
          s,
          json,
          path.join(o.out, `${s}-${mode}.csv`),
          script,
        );
      } catch (e) {
        failed.push(s);
        console.error(`FAILED ${s} ${mode}: ${String(e)}`);
      }
      doneN++;
      console.error(
        `done ${s} ${mode} (${doneN}/${o.seeds.length}, ${((performance.now() - t0) / 1000).toFixed(0)} s, load ${os.loadavg()[0].toFixed(1)})`,
      );
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(o.jobs, o.seeds.length) }, worker),
  );
  return failed;
}

// Run only as a script (depth-sim imports this file).
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === SELF) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
