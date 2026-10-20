/**
 * World War 1936 P1 balance check (P1 spec §16, plan Task 9).
 *
 * Plays the real world1936 map with no humans and the historical AI on, the
 * engine alone (no screens), and writes every country's economy every
 * `--every` days to a CSV. At the §16 dates it prints the majors' factories,
 * stockpiles, army, manpower, research and resource fill, then checks the
 * §16 targets. It also times the whole tick and the economy's share of it,
 * counts trains and trade ships (P0's spike sources, off in this mode), and
 * counts trade deals the day's check closed before they ever delivered.
 * It only reports: tune the (내 판단) constants by hand.
 *
 *   npx tsx scripts/ww1936/econ-sim.ts [--days 2000] [--out .cache/econ.csv]
 *                                      [--every 30] [--seed WWSIM001]
 *                                      [--tune '{"AI_MIL_PER_CIV":{"aggressor":4}}']
 *                                      [--res-scale tungsten=2,chromium=2]
 *
 * --tune overrides the AI's exported target tables for one run (try a value
 * before writing it into AiEconomy.ts); --res-scale multiplies every
 * region's deposits of a resource (try a data change before regenerating
 * the scenario).
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEYS,
  EQUIPMENT_TYPES,
  EquipmentType,
  RESOURCE_COUNT,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import type { Player } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import * as AiEconomy from "@openfront/engine/ww1936/economy/AiEconomy";
import type {
  CountryEconomy,
  WwEconomy,
} from "@openfront/engine/ww1936/economy/WwEconomy";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../../tests/perf/fullgame/NodeGameMapLoader";
import { formatTable } from "../domestic-sim-report";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const MAJORS: readonly CountryTag[] = [
  "DEU",
  "ITA",
  "JPN",
  "GBR",
  "FRA",
  "USA",
  "SUN",
];

interface Options {
  days: number;
  out: string;
  every: number;
  seed: string;
  tune: Record<string, Record<string, unknown>>;
  resScale: Partial<Record<(typeof RESOURCE_IDS)[number], number>>;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    days: dayOfDate("1941-06-22") + 1,
    out: ".cache/econ.csv",
    every: 30,
    seed: "WWSIM001",
    tune: {},
    resScale: {},
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--days":
        o.days = parseInt(next(), 10);
        break;
      case "--out":
        o.out = next();
        break;
      case "--every":
        o.every = parseInt(next(), 10);
        break;
      case "--seed":
        o.seed = next();
        break;
      case "--tune":
        o.tune = JSON.parse(next()) as Options["tune"];
        break;
      case "--res-scale":
        for (const part of next().split(",")) {
          const [res, by] = part.split("=");
          if (!(RESOURCE_IDS as readonly string[]).includes(res)) {
            throw new Error(`unknown resource ${res}`);
          }
          o.resScale[res as (typeof RESOURCE_IDS)[number]] = Number(by);
        }
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return o;
}

/** Spec §16 checkpoints. */
const CHECKS: readonly { date: string; label: string }[] = [
  { date: "1937-07-01", label: "1937-07 (aggressors switch)" },
  { date: "1939-09-01", label: "1939-09-01" },
  { date: "1941-06-22", label: "1941-06-22" },
  { date: "1944-06-06", label: "1944-06-06" },
];

interface Row {
  tag: CountryTag;
  alive: boolean;
  capitulated: boolean;
  civ: number;
  mil: number;
  dock: number;
  idleMil: number;
  freeCiv: number;
  troops: number;
  army: number;
  troopCap: number;
  manpower: number;
  recruitable: number;
  stock: Record<EquipmentType, number>;
  attackPct: number;
  defensePct: number;
  speedPct: number;
  techs: number;
  slotsBusy: number;
  slotCount: number;
  /** Lowest fill (‰) of a working line; 1000 when none lacks anything. */
  minFill: number;
  /** Factories on working lines weighted by fill, ‰. */
  avgFill: number;
  short: string;
  buying: number;
  selling: number;
  laws: string;
  queue: number;
}

function rowOf(ww: WorldWar, econ: WwEconomy, ce: CountryEconomy): Row {
  const p = econ.mg.playerBySmallID(ce.smallID) as Player;
  const t = ce.totals;
  const stock = Object.fromEntries(
    EQUIPMENT_TYPES.map((e) => [e, 0]),
  ) as Record<EquipmentType, number>;
  EQUIP_KEYS.forEach(([type], i) => (stock[type] += ce.stock[i]));
  let minFill = 1000;
  let weighted = 0;
  let working = 0;
  const shortRes = new Set<string>();
  const need = new Array<number>(RESOURCE_COUNT).fill(0);
  for (const l of ce.lines) {
    if (l.active === 0) continue;
    minFill = Math.min(minFill, l.fill);
    weighted += l.fill * l.active;
    working += l.active;
  }
  for (let k = 0; k < RESOURCE_COUNT; k++) {
    void need;
    const avail = t.produced[k] - t.exported[k] + t.imported[k];
    if (
      t.used[k] >= avail &&
      ce.lines.some((l) => l.active > 0 && l.fill < 1000)
    )
      shortRes.add(RESOURCE_IDS[k]);
  }
  let buying = 0;
  let selling = 0;
  for (const tr of econ.trades()) {
    if (tr.buyer === ce.smallID) buying += tr.civs;
    if (tr.seller === ce.smallID) selling += tr.civs;
  }
  return {
    tag: ce.tag,
    alive: p.isAlive(),
    capitulated: ww.isCapitulated(ce.smallID),
    civ: t.civ,
    mil: t.mil,
    dock: t.dock,
    idleMil: t.idleMil,
    freeCiv: Math.floor(t.freeCivMilli / 1000),
    troops: Math.floor(p.troops()),
    army: p.isAlive() ? econ.armyMen(p) : 0,
    troopCap: t.troopCap,
    manpower: ce.manpower,
    recruitable: t.recruitable,
    stock,
    attackPct: t.attackPct,
    defensePct: t.defensePct,
    speedPct: t.speedPct,
    techs: ce.researched.size,
    slotsBusy: ce.slots.filter((s, i) => s !== null && i < t.slotCount).length,
    slotCount: t.slotCount,
    minFill,
    avgFill: working === 0 ? 1000 : Math.floor(weighted / working),
    short: [...shortRes].join("+"),
    buying,
    selling,
    laws: `${ce.laws.economy}/${ce.laws.conscription}`,
    queue: ce.queue.length,
  };
}

const CSV_HEAD = [
  "day",
  "date",
  "tag",
  "alive",
  "capitulated",
  "civ",
  "mil",
  "dock",
  "idleMil",
  "freeCiv",
  "troops",
  "army",
  "troopCap",
  "manpower",
  "recruitable",
  ...EQUIPMENT_TYPES,
  "attackPct",
  "defensePct",
  "speedPct",
  "techs",
  "slotsBusy",
  "slotCount",
  "minFill",
  "avgFill",
  "short",
  "buyingCivs",
  "sellingCivs",
  "laws",
  "queue",
];

function csvLine(day: number, r: Row): string {
  return [
    day,
    formatIsoDate(dateOfDay(day)),
    r.tag,
    r.alive ? 1 : 0,
    r.capitulated ? 1 : 0,
    r.civ,
    r.mil,
    r.dock,
    r.idleMil,
    r.freeCiv,
    r.troops,
    r.army,
    r.troopCap,
    r.manpower,
    r.recruitable,
    ...EQUIPMENT_TYPES.map((e) => r.stock[e]),
    r.attackPct,
    r.defensePct,
    r.speedPct,
    r.techs,
    r.slotsBusy,
    r.slotCount,
    r.minFill,
    r.avgFill,
    r.short,
    r.buying,
    r.selling,
    r.laws,
    r.queue,
  ].join(",");
}

const k = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 10_000
      ? `${Math.round(n / 1000)}k`
      : `${n}`;

function majorsTable(rows: readonly Row[]): string {
  return formatTable(
    [
      "tag",
      "civ",
      "mil",
      "dock",
      "idle",
      "army",
      "cap",
      "manpower",
      "inf",
      "sup",
      "art",
      "AT",
      "AA",
      "mot",
      "LT",
      "MT",
      "ftr",
      "bmb",
      "atk/def/spd",
      "techs",
      "slots",
      "fill min/avg",
      "short",
      "buy/sell",
      "laws",
    ],
    rows.map((r) => [
      r.tag + (r.capitulated ? "†" : r.alive ? "" : "✝"),
      `${r.civ}`,
      `${r.mil}`,
      `${r.dock}`,
      `${r.idleMil}`,
      k(r.army),
      k(r.troopCap),
      k(r.manpower),
      k(r.stock.infantry_equipment),
      k(r.stock.support_equipment),
      k(r.stock.artillery),
      k(r.stock.anti_tank),
      k(r.stock.anti_air),
      k(r.stock.motorized),
      k(r.stock.light_tank),
      k(r.stock.medium_tank),
      k(r.stock.fighter),
      k(r.stock.bomber),
      `${r.attackPct}/${r.defensePct}/${r.speedPct}`,
      `${r.techs}`,
      `${r.slotsBusy}/${r.slotCount}`,
      `${r.minFill}/${r.avgFill}`,
      r.short || "-",
      `${r.buying}/${r.selling}`,
      r.laws,
    ]),
  );
}

/**
 * Who produces the scarce resources, how much each may export and has
 * sold, and every deal a major buys through; the majors' lines.
 */
function marketReport(ww: WorldWar, econ: WwEconomy): string {
  const out: string[] = [];
  const tagOf = (id: number) => econ.country(id)?.tag ?? `#${id}`;
  for (const res of ["oil", "rubber", "tungsten", "chromium"] as const) {
    const r = RESOURCE_IDS.indexOf(res);
    const cells: string[] = [];
    for (const ce of econ.countries()) {
      const t = ce.totals;
      if (t.produced[r] <= 0) continue;
      const cap = Math.floor((t.produced[r] * ce.law().exportPct) / 100);
      cells.push(`${ce.tag} ${t.produced[r]}/${cap}/${t.exported[r]}`);
    }
    out.push(`${res} (produced/export cap/sold): ${cells.join(", ")}`);
  }
  for (const tag of MAJORS) {
    const ce = econ.countries().find((c) => c.tag === tag)!;
    const deals = econ
      .trades()
      .filter((t) => t.buyer === ce.smallID)
      .map((t) => `${RESOURCE_IDS[t.res]}←${tagOf(t.seller)}×${t.civs}`);
    const lines = ce.lines.map((l) => {
      const [e, g] = EQUIP_KEYS[l.key];
      return `${e.replace("_equipment", "")}${g}:${l.active}/${l.factories}@${Math.floor(l.effBp / 100)}%f${l.fill}`;
    });
    out.push(
      `${tag} buys [${deals.join(" ")}] lines [${lines.join(" ")}] queue ${ce.queue.map((q) => `${q.building}x${q.count}`).join(",")}`,
    );
    out.push(
      `${tag} researched [${[...ce.researched].join(" ")}] slots [${ce.slots.map((x) => x?.tech ?? "-").join(" ")}]`,
    );
  }
  void ww;
  return out.join("\n");
}

interface Target {
  date: string;
  what: string;
  ok: (by: (tag: CountryTag) => Row) => [boolean, string];
}

/** Spec §16 targets. */
const TARGETS: readonly Target[] = [
  {
    date: "1939-09-01",
    what: "DEU mil >= 35",
    ok: (by) => [by("DEU").mil >= 35, `${by("DEU").mil}`],
  },
  {
    date: "1939-09-01",
    what: "DEU army 1.2M-2.5M",
    ok: (by) => [
      by("DEU").army >= 1_200_000 && by("DEU").army <= 2_500_000,
      k(by("DEU").army),
    ],
  },
  {
    date: "1939-09-01",
    what: "SUN army >= DEU army",
    ok: (by) => [
      by("SUN").army >= by("DEU").army,
      `${k(by("SUN").army)} vs ${k(by("DEU").army)}`,
    ],
  },
  {
    date: "1939-09-01",
    what: "USA civ >= 90, mil <= 20",
    ok: (by) => [
      by("USA").civ >= 90 && by("USA").mil <= 20,
      `${by("USA").civ}/${by("USA").mil}`,
    ],
  },
  {
    date: "1941-06-22",
    what: "DEU army >= 2M",
    ok: (by) => [by("DEU").army >= 2_000_000, k(by("DEU").army)],
  },
  {
    date: "1941-06-22",
    what: "SUN mil >= 45",
    ok: (by) => [by("SUN").mil >= 45, `${by("SUN").mil}`],
  },
  {
    date: "1944-06-06",
    what: "USA mil >= 60",
    ok: (by) => [by("USA").mil >= 60, `${by("USA").mil}`],
  },
];

function pct(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const start: GameStartInfo = {
    gameID: opts.seed,
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
      historicalAi: true,
    },
    players: [],
  };
  // Experiment overrides of the AI's target tables (merged, one level deep).
  for (const [name, values] of Object.entries(opts.tune)) {
    const table = (AiEconomy as unknown as Record<string, unknown>)[name];
    if (typeof table !== "object" || table === null) {
      throw new Error(`--tune: no table ${name} in AiEconomy`);
    }
    for (const [key, v] of Object.entries(values)) {
      const t = table as Record<string, unknown>;
      t[key] =
        typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
          ? dayOfDate(v)
          : typeof v === "object" && v !== null
            ? { ...(t[key] as object), ...v }
            : v;
    }
    console.log(`tune ${name}: ${JSON.stringify(table)}`);
  }
  const files = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  for (const [res, by] of Object.entries(opts.resScale)) {
    const k = RESOURCE_IDS.indexOf(res as (typeof RESOURCE_IDS)[number]);
    for (const r of files.scenario!.regions)
      r.res[k] = Math.round(r.res[k] * by);
    console.log(`deposits of ${res} x${by}`);
  }
  const t0 = performance.now();
  const runner = await createGameRunner(start, undefined, files, (gu) => {
    if ("errMsg" in gu) throw new Error(gu.errMsg);
  });
  const game = runner.game;
  const ww = game.worldWar()!;
  const econ = ww.economy;

  console.log(
    `world1936: ${game.allPlayers().length} countries, set up in ${(performance.now() - t0).toFixed(0)} ms`,
  );

  // The economy's share of each tick.
  let econMs = 0;
  const econTick = econ.tick.bind(econ);
  econ.tick = (ticks: number) => {
    const a = performance.now();
    econTick(ticks);
    econMs += performance.now() - a;
  };
  // Deals the day's check closed before the buyer ever counted them.
  const opened = new Map<number, number>();
  let dealsOpened = 0;
  let dealsUndelivered = 0;
  // And deals reopened (same buyer, seller, resource) within 30 days of
  // closing: an AI that buys back what it just let go.
  const closedAt = new Map<string, number>();
  let dealsReopened = 0;
  const addTrade = econ.addTrade.bind(econ);
  econ.addTrade = (b, s, r, c) => {
    const tr = addTrade(b, s, r, c);
    opened.set(tr.id, game.ticks());
    dealsOpened++;
    const at = closedAt.get(`${b}:${s}:${r}`);
    if (at !== undefined && ww.day(game.ticks()) - at <= 30) dealsReopened++;
    return tr;
  };
  const removeTrade = econ.removeTrade.bind(econ);
  econ.removeTrade = (id) => {
    const tr = removeTrade(id);
    const at = opened.get(id);
    // Opened on the buyer's tick; the buyer's next step is 7–8 ticks later.
    if (tr !== null && at !== undefined && game.ticks() - at <= 8) {
      dealsUndelivered++;
    }
    if (tr !== null) {
      closedAt.set(`${tr.buyer}:${tr.seller}:${tr.res}`, ww.day(game.ticks()));
    }
    opened.delete(id);
    return tr;
  };

  const prepEnd = ww.prepEndTick();
  const endTick = dayStartTick(opts.days, prepEnd);
  const checkDays = new Map(CHECKS.map((c) => [dayOfDate(c.date), c.label]));
  const csv: string[] = [CSV_HEAD.join(",")];
  const tickMs: number[] = [];
  const econDayMs: number[] = [];
  const econTickMs: number[] = [];
  const slowTicks: string[] = [];
  let lastDay = -1;
  let econDayAcc = 0;
  const snapshots = new Map<number, Row[]>();
  const markets = new Map<number, string>();
  let maxTrains = 0;
  let maxTradeShips = 0;
  const tRun = performance.now();
  while (game.ticks() < endTick) {
    runner.addTurn({ turnNumber: game.ticks(), intents: [] });
    const before = econMs;
    const a = performance.now();
    if (!runner.executeNextTick()) {
      console.log(`stopped at tick ${game.ticks()}`);
      break;
    }
    if (game.ticks() > prepEnd) {
      tickMs.push(performance.now() - a);
      econTickMs.push(econMs - before);
      if (econMs - before > 2) {
        slowTicks.push(`${game.ticks() - 1}:${(econMs - before).toFixed(1)}`);
      }
    }
    econDayAcc += econMs - before;
    const day = ww.day(game.ticks());
    if (day === lastDay) continue;
    // A new day began on this tick: the previous one is complete.
    if (lastDay >= 0 && game.ticks() > prepEnd + 1) econDayMs.push(econDayAcc);
    econDayAcc = 0;
    lastDay = day;
    const done = day - 1;
    if (done < 0) continue;
    const rows = econ.countries().map((ce) => rowOf(ww, econ, ce));
    if (done % opts.every === 0 || checkDays.has(done)) {
      for (const r of rows) csv.push(csvLine(done, r));
    }
    if (checkDays.has(done)) {
      snapshots.set(done, rows);
      markets.set(done, marketReport(ww, econ));
    }
    maxTrains = Math.max(maxTrains, game.units(UnitType.Train).length);
    maxTradeShips = Math.max(
      maxTradeShips,
      game.units(UnitType.TradeShip).length,
    );
    if (done % 180 === 0) {
      const secs = ((performance.now() - tRun) / 1000).toFixed(0);
      console.log(
        `${formatIsoDate(dateOfDay(done))} (day ${done}, tick ${game.ticks()}, ${secs} s)`,
      );
    }
  }

  fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
  fs.writeFileSync(opts.out, csv.join("\n") + "\n");
  console.log(`\nCSV: ${opts.out} (${csv.length - 1} rows)`);

  for (const [day, label] of checkDays) {
    const rows = snapshots.get(day);
    if (rows === undefined) continue;
    console.log(`\n== ${label} ==`);
    console.log(majorsTable(rows.filter((r) => MAJORS.includes(r.tag))));
    console.log(markets.get(day) ?? "");
    const minors = rows.filter((r) => !MAJORS.includes(r.tag) && r.alive);
    const trading = minors.filter((r) => r.buying > 0).length;
    const starved = minors.filter((r) => r.minFill < 1000).length;
    console.log(
      `minors alive ${minors.length}: buying ${trading}, a line short ${starved}, ` +
        `mil ${minors.reduce((n, r) => n + r.mil, 0)}, army ${k(minors.reduce((n, r) => n + r.army, 0))}`,
    );
  }

  console.log("\n== spec §16 targets ==");
  const results: string[][] = [];
  for (const t of TARGETS) {
    const rows = snapshots.get(dayOfDate(t.date));
    if (rows === undefined) {
      results.push([t.date, t.what, "-", "not reached"]);
      continue;
    }
    const by = (tag: CountryTag) => rows.find((r) => r.tag === tag)!;
    const [ok, value] = t.ok(by);
    results.push([t.date, t.what, value, ok ? "ok" : "MISS"]);
  }
  console.log(formatTable(["date", "target", "value", "result"], results));

  const sorted = [...tickMs].sort((x, y) => x - y);
  const days = [...econDayMs].sort((x, y) => x - y);
  const mean = (xs: readonly number[]) =>
    xs.reduce((n, x) => n + x, 0) / Math.max(1, xs.length);
  console.log("\n== performance ==");
  console.log(
    `whole tick over ${sorted.length} ticks: p50 ${pct(sorted, 0.5).toFixed(2)} ms, ` +
      `p99 ${pct(sorted, 0.99).toFixed(2)} ms, max ${sorted[sorted.length - 1]?.toFixed(2)} ms, mean ${mean(sorted).toFixed(2)} ms`,
  );
  console.log(
    `economy per day over ${days.length} days: mean ${mean(days).toFixed(3)} ms, ` +
      `p50 ${pct(days, 0.5).toFixed(3)} ms, p99 ${pct(days, 0.99).toFixed(3)} ms, max ${days[days.length - 1]?.toFixed(3)} ms`,
  );
  const et = [...econTickMs].sort((x, y) => x - y);
  console.log(
    `economy per tick: p50 ${pct(et, 0.5).toFixed(3)} ms, p99 ${pct(et, 0.99).toFixed(3)} ms, ` +
      `p99.9 ${pct(et, 0.999).toFixed(3)} ms, max ${et[et.length - 1]?.toFixed(3)} ms`,
  );
  console.log(
    `economy ticks over 2 ms (tick:ms): ${slowTicks.slice(0, 30).join(" ")}`,
  );
  console.log(
    `trains at most ${maxTrains}, trade ships at most ${maxTradeShips}; ` +
      `deals opened ${dealsOpened}, closed before delivering ${dealsUndelivered}, ` +
      `reopened within 30 days of closing ${dealsReopened}`,
  );
  const humans = game.allPlayers().filter((p) => p.type() === PlayerType.Human);
  if (humans.length > 0) throw new Error("the balance run has no humans");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
