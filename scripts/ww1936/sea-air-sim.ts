/**
 * World War 1936 P4 balance and performance check (P4 spec §23.3, §20;
 * plan Task 15). Modes:
 *
 *   npx tsx scripts/ww1936/sea-air-sim.ts --game [--seeds WWSEA001,…]
 *       [--historical on|off] [--until 1945-08-21] [--out .cache/sea-air-sim]
 *       [--navy]
 *   npx tsx scripts/ww1936/sea-air-sim.ts --perf [--seed WWSEA001]
 *       [--until 1941-12-31] [--historical on|off]
 *   npx tsx scripts/ww1936/sea-air-sim.ts --summary [--out .cache/sea-air-sim]
 *   npx tsx scripts/ww1936/sea-air-sim.ts --show --seeds WWSEA001 [--out …]
 *   npx tsx scripts/ww1936/sea-air-sim.ts --naval-duel | --air-duel | --convoy
 *
 * --game: the real world1936 map, no humans, the historical AI on (or off),
 *   one run per seed. Every day it samples the sea and the air: each side's
 *   supremacy in the watched sea regions (Britain's home waters, the
 *   Mediterranean, the Pacific), the battles started (where, who), the
 *   ships sunk (class, owner, by whom, where), the invasions (launched,
 *   landed, failed, aborted), the convoys lost and Britain's trade
 *   efficiency, each major's fuel stock and ratio, the air superiority over
 *   the Low Countries and France and over southern England, the planes
 *   lost, the bomb points; and spec §23.3's nine-line table. One JSON per
 *   run (`<out>/<seed>-<on|off>.json`); `--navy` prints the navy report.
 * --perf: the same game with each P4 part timed (spec §20.1's table: sea
 *   regions' day, countries' day without and with the AI, fleet orders,
 *   fleet movement, battles, voyages, air zones' day, air countries' day,
 *   air AI, paradrops, updates): mean, p99 and max per tick.
 * --summary: every JSON in `<out>`: the seed table (one row per run) and
 *   the shares across runs.
 * --naval-duel / --air-duel: spec §23.3's duels as real battles of the
 *   engine on the sea test map (ww1936sea); --convoy: its convoy case on
 *   the pure rules with the real map's central North Atlantic.
 *
 * It only reports: tune the (내 판단) constants by hand (spec §23.3).
 * Several runs at once: one process per seed (the runs are independent).
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
  INVASION_STATES,
  SHIP_CLASSES,
  type ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { USE_TRADE } from "@openfront/engine/ww1936/navy/Convoys";
import type { NavalBattle } from "@openfront/engine/ww1936/navy/WwNavy";
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

// ---------------------------------------------------------------------------
// Options

interface Options {
  mode:
    | "game"
    | "perf"
    | "summary"
    | "show"
    | "naval-duel"
    | "air-duel"
    | "convoy";
  seeds: string[];
  historical: boolean;
  until: string;
  out: string;
  navy: boolean;
  /** Diagnostics: these countries' fleets and deployments every `every` days from `from`. */
  trace: CountryTag[];
  every: number;
  from: string;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    mode: "game",
    seeds: ["WWSEA001", "WWSEA002", "WWSEA003"],
    historical: true,
    until: "1945-08-21",
    out: ".cache/sea-air-sim",
    navy: false,
    trace: [],
    every: 60,
    from: "1939-09-01",
  };
  let untilSet = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${arg}`);
      return v;
    };
    switch (arg) {
      case "--game":
        o.mode = "game";
        break;
      case "--perf":
        o.mode = "perf";
        break;
      case "--summary":
        o.mode = "summary";
        break;
      case "--show":
        o.mode = "show";
        break;
      case "--naval-duel":
        o.mode = "naval-duel";
        break;
      case "--air-duel":
        o.mode = "air-duel";
        break;
      case "--convoy":
        o.mode = "convoy";
        break;
      case "--seeds":
      case "--seed":
        o.seeds = next().split(",");
        break;
      case "--historical":
        o.historical = next() !== "off";
        break;
      case "--until":
        o.until = next();
        untilSet = true;
        break;
      case "--out":
        o.out = next();
        break;
      case "--navy":
        o.navy = true;
        break;
      case "--trace":
        o.trace = next().split(",") as CountryTag[];
        break;
      case "--every":
        o.every = parseInt(next(), 10);
        break;
      case "--from":
        o.from = next();
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (o.mode === "perf" && !untilSet) o.until = "1941-12-31";
  if (o.mode === "perf" && o.seeds.length > 1) o.seeds = [o.seeds[0]];
  return o;
}

const ms = (x: number) => x.toFixed(3);
const iso = (d: number | undefined | null) =>
  d === undefined || d === null ? "-" : formatIsoDate(dateOfDay(d));

function pct(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

// ---------------------------------------------------------------------------
// What a run records

/** Watched sea regions (strategic ids) by area. */
const SEA_AREAS = {
  home: [1010, 1011, 1015, 1016], // NW Approaches, North Sea, Channel, W Approaches
  med: [1025, 1026, 1027, 1030], // W Med, Tyrrhenian, Central Med, E Med
  pacific: [1041, 1044, 1048, 1049, 1050, 1053], // S China Sea, Philippine Sea, Japanese Home Waters, Carolines, Marshalls, Hawaii
  atlantic: [1016, 1018, 1019, 1022, 1023], // the convoy war
} as const;
type SeaArea = keyof typeof SEA_AREAS;
/** Air zones (strategic ids). */
const AIR_ZONES = {
  lowCountries: [45, 47, 53, 55], // Rhineland, Belgium and Netherlands, Northern France, Alsace-Lorraine
  englandSouth: [46],
} as const;
type AirArea = keyof typeof AIR_ZONES;

const MAJORS: readonly CountryTag[] = [
  "DEU",
  "ITA",
  "JPN",
  "GBR",
  "FRA",
  "USA",
  "SUN",
];

const CONVOY = equipKey("convoy", 1);

interface AreaAcc {
  /** Days counted (the area's war was on). */
  days: number;
  /** Σ of the watched side's supremacy ‰ (mean over the area's regions). */
  sum: number;
  /** Σ of the enemy's (the strongest enemy side's) supremacy ‰. */
  enemySum: number;
  /** Days the watched side's mean supremacy ≥ 500‰. */
  control: number;
}

interface InvasionRec {
  day: number;
  owner: CountryTag;
  region: string;
  regionId: number;
  srName: string;
  outcome: "launched" | "landed" | "failed" | "aborted";
}

interface RunResult {
  seed: string;
  historical: boolean;
  until: string;
  ticks: number;
  hash: number;
  seconds: number;
  wars: Record<string, number>;
  fallen: Record<string, number>;
  conquered: string[];
  /** Days of each watched pairing's naval battles: [year → count]. */
  battles: {
    total: number;
    byArea: Record<string, number>;
    byPair: Record<string, number>;
    byYear: Record<string, number>;
  };
  sunk: Record<string, Record<string, number>>; // owner → class → n
  sunkBy: Record<string, number>; // "victim<-killer" → n
  sunkInArea: Record<string, Record<string, number>>; // area → owner → n
  areas: Record<SeaArea, AreaAcc & { side: string }>;
  invasions: InvasionRec[];
  invasionsBy: Record<string, Record<string, number>>; // owner → outcome → n
  convoys: {
    gbrStart: number;
    gbr1939: number;
    gbrLost: number;
    gbrLost39to42: number;
    gbrBuilt39to42: number;
    lostBy: Record<string, number>;
    gbrTradeLowStreakMax: number;
    gbrTradeEffMean: number;
  };
  fuel: Record<
    string,
    {
      day1: number;
      day30: number;
      day365: number;
      cap: number;
      gain: number;
      minRatio1936: number;
      shortDays: Record<string, number>; // year → days ratio < 1000
      emptyDays: Record<string, number>; // year → days ratio < 500
      immobileFleetDays: number; // days with ratio < 300 (fleet speed ≤ 65%)
    }
  >;
  air: Record<
    AirArea,
    { days: number; deuSup: number; gbrSup: number; fraSup: number }
  >;
  airLost: Record<string, number>;
  bombPoints: number;
  checks: { label: string; value: string; ok: boolean | null }[];
  core: Record<string, Record<string, number>>; // date → tag → lost ‰
  ships: Record<string, Record<string, number>>; // date → tag → ships
  fighters: Record<string, Record<string, number>>; // date → tag → fighters
  perf: {
    tickMean: number;
    tickP99: number;
    tickMax: number;
    p4Mean: number;
    p4P99: number;
    p4Max: number;
    parts?: Record<string, { mean: number; p99: number; max: number }>;
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

// ---------------------------------------------------------------------------
// --perf: the P4 parts, timed (the same sequence as WwNavy.tick / WwAir.tick)

const P4_PARTS = [
  "seaRegions",
  "navyCountries",
  "navyAi",
  "fleetOrders",
  "fleetMove",
  "battles",
  "voyages",
  "airZones",
  "airCountries",
  "airAi",
  "paradrops",
  "update",
] as const;
type P4Part = (typeof P4_PARTS)[number];

async function timedParts(
  ww: WorldWar,
  acc: Record<P4Part, number[]>,
): Promise<() => void> {
  const navyMod = await import("@openfront/engine/ww1936/navy/WwNavy");
  const fleets = await import("@openfront/engine/ww1936/navy/Fleets");
  const sea = await import("@openfront/engine/ww1936/navy/SeaMove");
  const nb = await import("@openfront/engine/ww1936/navy/NavalBattles");
  const st = await import("@openfront/engine/ww1936/navy/SeaTransfer");
  const fuel = await import("@openfront/engine/ww1936/economy/Fuel");
  const rep = await import("@openfront/engine/ww1936/navy/Repair");
  const conv = await import("@openfront/engine/ww1936/navy/Convoys");
  const inv = await import("@openfront/engine/ww1936/navy/Invasions");
  const aiN = await import("@openfront/engine/ww1936/navy/AiNavy");
  const aiI = await import("@openfront/engine/ww1936/navy/AiInvasion");
  const ac = await import("@openfront/engine/ww1936/air/AirCombat");
  const ae = await import("@openfront/engine/ww1936/air/AirEffects");
  const dep = await import("@openfront/engine/ww1936/air/Deploy");
  const aiA = await import("@openfront/engine/ww1936/air/AiAir");
  const para = await import("@openfront/engine/ww1936/air/Paradrop");
  const { PlayerType } = await import("@openfront/engine-api/game/GameTypes");
  const { WW_DAY_SPLIT } =
    await import("@openfront/engine-api/ww1936/EconomyTypes");
  const navy = ww.navy;
  const air = ww.air;
  const n = navy as unknown as {
    sunkThisTick: Map<number, unknown>;
    lastCommonDay: number;
    dailyCommon(): void;
    countryList: unknown[];
    navyDirtyCountries: Set<number>;
  };
  const a = air as unknown as {
    lastCommonDay: number;
    countryList: unknown[];
    zoneState: { lastDay: number }[];
    airDirtyCountries: Set<number>;
  };
  const cur: Record<P4Part, number> = Object.fromEntries(
    P4_PARTS.map((p) => [p, 0]),
  ) as Record<P4Part, number>;
  const time = (p: P4Part, f: () => void) => {
    const t0 = performance.now();
    f();
    cur[p] += performance.now() - t0;
  };
  const alive = (id: number) => {
    const p = navy.mg.playerBySmallID(id);
    return p.isPlayer() && p.isAlive() && !ww.isCapitulated(id);
  };
  navy.tick = (ticks: number) => {
    n.sunkThisTick.clear();
    const prep = ww.inPrep(ticks);
    if (!prep) {
      const day = ww.day(ticks);
      if (day !== n.lastCommonDay) {
        n.lastCommonDay = day;
        time("navyCountries", () => n.dailyCommon());
      }
      const k = ticks - dayStartTick(day, ww.prepEndTick());
      if (k >= 0 && k < WW_DAY_SPLIT) {
        time("seaRegions", () => {
          for (const s of ww.scenario.strategicList()) {
            if (s.kind === "sea" && s.idx % WW_DAY_SPLIT === k) {
              navyMod.dailySeaRegion(navy, s.id, day, ticks);
            }
          }
        });
        for (let id = 1; id < n.countryList.length; id++) {
          if (
            id % WW_DAY_SPLIT !== k ||
            n.countryList[id] === null ||
            n.countryList[id] === undefined
          )
            continue;
          if (!alive(id)) continue;
          time("navyCountries", () => {
            fleets.dailyFleetHousekeeping(navy, id, day);
            fuel.noteFleetFuel(navy, id, day);
            rep.dailyRepair(navy, id, day);
            conv.allocateConvoys(navy, id, day);
            st.dailyVoyages(navy, id, day);
            inv.dailyInvasions(navy, id, day, ticks);
            rep.dailyNavyXp(navy, id, day);
          });
          const p = navy.mg.playerBySmallID(id);
          if (
            (p as Player).type() !== PlayerType.Human ||
            navy.fleetsOf(id).some((f) => f.auto)
          ) {
            time("navyAi", () => {
              aiN.aiNavy(navy, id, day);
              aiI.aiInvasions(navy, id, day);
            });
          }
          n.navyDirtyCountries.add(id);
        }
      }
    }
    time("fleetOrders", () => fleets.applyFleetOrders(navy, ticks));
    time("fleetMove", () => sea.stepFleets(navy, ticks));
    if (!prep) {
      time("battles", () => nb.stepNavalBattles(navy, ticks));
      time("voyages", () => st.stepSeaVoyages(navy, ticks));
    }
  };
  air.tick = (ticks: number) => {
    const prep = ww.inPrep(ticks);
    if (prep) return;
    const day = ww.day(ticks);
    if (day !== a.lastCommonDay) a.lastCommonDay = day;
    const k = ticks - dayStartTick(day, ww.prepEndTick());
    if (k >= 0 && k < WW_DAY_SPLIT) {
      time("airZones", () => {
        for (const s of ww.scenario.strategicList()) {
          if (s.idx % WW_DAY_SPLIT !== k) continue;
          a.zoneState[s.idx].lastDay = day;
          ac.dailyAirZone(air, s.id, day);
          ae.airMissionEffects(air, s.id, day);
        }
      });
      for (let id = 1; id < a.countryList.length; id++) {
        if (
          id % WW_DAY_SPLIT !== k ||
          a.countryList[id] === null ||
          a.countryList[id] === undefined
        )
          continue;
        if (!alive(id)) continue;
        time("airCountries", () => dep.dailyAirCountry(air, id, day));
        const p = navy.mg.playerBySmallID(id);
        const c = air.country(id);
        if (
          (p as Player).type() !== PlayerType.Human ||
          (c?.autoZones.length ?? 0) > 0
        ) {
          time("airAi", () => aiA.aiAir(air, id, day));
        }
        a.airDirtyCountries.add(id);
      }
    }
    time("paradrops", () => para.stepParadrops(air, ticks));
  };
  const navyTake = navy.takeData.bind(navy);
  navy.takeData = () => {
    let d: ReturnType<typeof navyTake> = null;
    time("update", () => (d = navyTake()));
    return d;
  };
  const airTake = air.takeData.bind(air);
  air.takeData = () => {
    let d: ReturnType<typeof airTake> = null;
    time("update", () => (d = airTake()));
    return d;
  };
  // Called after every tick past the preparation minute.
  return () => {
    for (const p of P4_PARTS) {
      acc[p].push(cur[p]);
      cur[p] = 0;
    }
  };
}

// ---------------------------------------------------------------------------
// --game

async function playGame(
  seed: string,
  historical: boolean,
  until: string,
  perf: boolean,
  trace: { tags: readonly CountryTag[]; every: number; from: number } = {
    tags: [],
    every: 60,
    from: 0,
  },
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
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  const g: Game = runner.game;
  const ww = g.worldWar()!;
  const navy = ww.navy;
  const air = ww.air;
  const land = ww.land;
  const econ = ww.economy;
  const sc = ww.scenario;
  const tags = sc.countries as readonly CountryTag[];
  const idOf = (t: CountryTag) => sc.smallIdOf(t);
  const tagOf = (id: number) => tags[id - 1] ?? `#${id}`;
  const regionName = (id: number) =>
    sc.landRegions.find((r) => r.id === id)?.name ?? `#${id}`;
  const srName = (id: number) => sc.sr(id)?.name ?? `#${id}`;
  const areaOfSr = (sr: number): SeaArea | null => {
    for (const k of Object.keys(SEA_AREAS) as SeaArea[]) {
      if (k === "atlantic") continue;
      if ((SEA_AREAS[k] as readonly number[]).includes(sr)) return k;
    }
    if ((SEA_AREAS.atlantic as readonly number[]).includes(sr)) {
      return "atlantic";
    }
    return null;
  };

  const res: RunResult = {
    seed,
    historical,
    until,
    ticks: 0,
    hash: 0,
    seconds: 0,
    wars: {},
    fallen: {},
    conquered: [],
    battles: { total: 0, byArea: {}, byPair: {}, byYear: {} },
    sunk: {},
    sunkBy: {},
    sunkInArea: {},
    areas: {
      home: { days: 0, sum: 0, enemySum: 0, control: 0, side: "GBR" },
      med: { days: 0, sum: 0, enemySum: 0, control: 0, side: "ITA" },
      pacific: { days: 0, sum: 0, enemySum: 0, control: 0, side: "JPN" },
      atlantic: { days: 0, sum: 0, enemySum: 0, control: 0, side: "GBR" },
    },
    invasions: [],
    invasionsBy: {},
    convoys: {
      gbrStart: 0,
      gbr1939: 0,
      gbrLost: 0,
      gbrLost39to42: 0,
      gbrBuilt39to42: 0,
      lostBy: {},
      gbrTradeLowStreakMax: 0,
      gbrTradeEffMean: 0,
    },
    fuel: {},
    air: {
      lowCountries: { days: 0, deuSup: 0, gbrSup: 0, fraSup: 0 },
      englandSouth: { days: 0, deuSup: 0, gbrSup: 0, fraSup: 0 },
    },
    airLost: {},
    bombPoints: 0,
    checks: [],
    core: {},
    ships: {},
    fighters: {},
    perf: {
      tickMean: 0,
      tickP99: 0,
      tickMax: 0,
      p4Mean: 0,
      p4P99: 0,
      p4Max: 0,
    },
  };
  const bump = (m: Record<string, number>, k: string, v = 1) => {
    m[k] = (m[k] ?? 0) + v;
  };

  // ---- Hooks (instance methods; they only watch) ----
  const zoneArea = (zone: number) => {
    const sr = sc.zoneSr(zone);
    return { sr, area: areaOfSr(sr) };
  };
  const addBattle = navy.addBattle.bind(navy);
  navy.addBattle = (b: NavalBattle) => {
    addBattle(b);
    const { area } = zoneArea(b.zone);
    res.battles.total++;
    bump(res.battles.byArea, area ?? "other");
    bump(res.battles.byYear, `${dateOfDay(ww.day(g.ticks())).year}`);
  };
  // Who fought each battle: the owners of its fleets over its ticks.
  const battleOwners = new Map<string, [Set<number>, Set<number>]>();
  const noteBattles = () => {
    for (const b of navy.battles.values()) {
      const key = `${b.zone}:${b.startTick}`;
      let o = battleOwners.get(key);
      if (o === undefined) battleOwners.set(key, (o = [new Set(), new Set()]));
      for (const s of [0, 1] as const) {
        for (const f of b.fleets[s]) {
          const owner = navy.fleets.get(f)?.owner ?? 0;
          if (owner > 0) o[s].add(owner);
        }
      }
    }
  };
  const removeShip = navy.removeShip.bind(navy);
  navy.removeShip = (id: number, sunk: boolean, tick: number, by = 0) => {
    if (sunk) {
      const r = navy.ships.rowOf(id);
      if (r >= 0) {
        const owner = tagOf(navy.ships.owner[r]);
        const cls = SHIP_CLASSES[navy.ships.cls[r]];
        (res.sunk[owner] ??= {})[cls] = (res.sunk[owner][cls] ?? 0) + 1;
        bump(res.sunkBy, `${owner}<-${by > 0 ? tagOf(by) : "?"}`);
        const f = navy.fleets.get(navy.ships.fleet[r]);
        const area = f === undefined ? null : zoneArea(f.zone).area;
        (res.sunkInArea[area ?? "other"] ??= {})[owner] =
          (res.sunkInArea[area ?? "other"][owner] ?? 0) + 1;
      }
    }
    removeShip(id, sunk, tick, by);
  };
  const message = navy.message.bind(navy);
  const INV_KEYS: Record<string, InvasionRec["outcome"]> = {
    "events_display.ww1936_invasion_launched": "launched",
    "events_display.ww1936_invasion_landed": "landed",
    "events_display.ww1936_invasion_failed": "failed",
    "events_display.ww1936_invasion_aborted": "aborted",
  };
  const seenMsg = new Set<string>();
  navy.message = (to, key, params = {}) => {
    const outcome = INV_KEYS[key];
    if (outcome !== undefined) {
      const region = Number(params.region ?? 0);
      const k = `${g.ticks()}:${key}:${region}`;
      if (!seenMsg.has(k)) {
        seenMsg.add(k);
        const owner = tagOf(to);
        res.invasions.push({
          day: ww.day(g.ticks()),
          owner,
          region: regionName(region),
          regionId: region,
          srName: srName(sc.landRegions.find((r) => r.id === region)?.sr ?? 0),
          outcome,
        });
        (res.invasionsBy[owner] ??= {})[outcome] ??= 0;
        res.invasionsBy[owner][outcome]++;
      }
    }
    message(to, key, params);
  };
  const shootDown = air.shootDown.bind(air);
  air.shootDown = (id, counts, by) => {
    const d = air.deployments.get(id);
    const n = shootDown(id, counts, by);
    if (d !== undefined && n > 0) bump(res.airLost, tagOf(d.owner), n);
    return n;
  };

  // ---- Timing ----
  const tickMs: number[] = [];
  const p4Ms: number[] = [];
  const parts = Object.fromEntries(
    P4_PARTS.map((p) => [p, [] as number[]]),
  ) as Record<P4Part, number[]>;
  let p4Acc = 0;
  let flushParts: (() => void) | null = null;
  if (perf) flushParts = await timedParts(ww, parts);
  {
    const nt = navy.tick.bind(navy);
    navy.tick = (t: number) => {
      const a = performance.now();
      nt(t);
      p4Acc += performance.now() - a;
    };
    const at = air.tick.bind(air);
    air.tick = (t: number) => {
      const a = performance.now();
      at(t);
      p4Acc += performance.now() - a;
    };
    const nd = navy.takeData.bind(navy);
    navy.takeData = () => {
      const a = performance.now();
      const d = nd();
      p4Acc += performance.now() - a;
      return d;
    };
    const ad = air.takeData.bind(air);
    air.takeData = () => {
      const a = performance.now();
      const d = ad();
      p4Acc += performance.now() - a;
      return d;
    };
  }

  // ---- Daily sampling ----
  const prepEnd = ww.prepEndTick();
  const lastDay = dayOfDate(until);
  const endTick = dayStartTick(lastDay + 1, prepEnd);
  const watchedWars: [CountryTag, CountryTag][] = [
    ["DEU", "POL"],
    ["DEU", "FRA"],
    ["DEU", "GBR"],
    ["DEU", "SUN"],
    ["DEU", "NOR"],
    ["DEU", "USA"],
    ["ITA", "GBR"],
    ["ITA", "FRA"],
    ["ITA", "ALB"],
    ["ITA", "ETH"],
    ["ITA", "GRC"],
    ["JPN", "CHN"],
    ["JPN", "USA"],
    ["JPN", "GBR"],
    ["JPN", "NLD"],
    ["JPN", "SUN"],
  ];
  const gbr = idOf("GBR");
  const sideAcc = (area: SeaArea, tag: CountryTag) => {
    const me = navy.sideOf(idOf(tag));
    let mine = 0;
    let enemy = 0;
    const srs = SEA_AREAS[area] as readonly number[];
    for (const sr of srs) {
      const i = sc.srIdxOf(sr);
      if (i < 0) continue;
      let best = 0;
      for (const [side, v] of navy.srState[i].sup) {
        if (side === me) mine += v;
        else if (v > best) best = v;
      }
      enemy += best;
    }
    return { mine: mine / srs.length, enemy: enemy / srs.length };
  };
  const atWarWithMajor = (tag: CountryTag) =>
    ww
      .enemiesOf(idOf(tag))
      .some((e) => MAJORS.includes(tagOf(e) as CountryTag));
  const fuelOf = (tag: CountryTag) =>
    (res.fuel[tag] ??= {
      day1: 0,
      day30: 0,
      day365: 0,
      cap: 0,
      gain: 0,
      minRatio1936: 1000,
      shortDays: {},
      emptyDays: {},
      immobileFleetDays: 0,
    });
  const englishSouth = AIR_ZONES.englandSouth;
  let gbrTradeLow = 0;
  let gbrTradeEffSum = 0;
  let gbrTradeEffDays = 0;
  let gbrConvoysYesterday = -1;
  const frenchCorePorts = sc.landRegions
    .filter(
      (r) =>
        r.owner === "FRA" &&
        r.core &&
        r.port &&
        (r.sr ?? 0) < 1000 &&
        ![98, 99, 96].includes(r.sr ?? 0),
    )
    .map((r) => r.id);
  let alliedFrPortStreak = 0;
  let alliedFrPortBest = 0;
  const sunStartVp = sc.landRegions.filter((r) => r.owner === "SUN");
  const coreDates = new Map<number, string>(
    [
      "1940-01-01",
      "1940-12-31",
      "1941-06-22",
      "1942-06-30",
      "1943-12-31",
      "1945-08-21",
    ].map((d) => [dayOfDate(d), d]),
  );
  const shipDates = new Map<number, string>(
    ["1936-01-02", "1939-09-01", "1941-12-07", "1943-06-30", "1945-08-21"].map(
      (d) => [dayOfDate(d), d],
    ),
  );
  const japanHome = new Set([72, 86, 101]);
  let prevDay = -1;
  const t0 = performance.now();
  while (g.ticks() < endTick) {
    runner.addTurn({ turnNumber: g.ticks(), intents: [] });
    const before = p4Acc;
    const a = performance.now();
    if (!runner.executeNextTick()) {
      console.log(`stopped at tick ${g.ticks()}`);
      break;
    }
    const t = performance.now() - a;
    if (g.ticks() > prepEnd) {
      tickMs.push(t);
      p4Ms.push(p4Acc - before);
      flushParts?.();
    }
    if (navy.battles.size > 0) noteBattles();
    const day = ww.day(g.ticks());
    if (day === prevDay) continue;
    prevDay = day;
    const done = day - 1;
    if (done < 0) continue;
    const year = `${dateOfDay(done).year}`;
    if (
      trace.tags.length > 0 &&
      done >= trace.from &&
      (done - trace.from) % trace.every === 0
    ) {
      console.log(`-- ${iso(done)} battles ${navy.battles.size}`);
      for (const tg of trace.tags) {
        const id = idOf(tg);
        const ce = econ.country(id);
        console.log(
          `  ${tg}: fuel ${Math.round((ce?.fuelMilli ?? 0) / 1000)} r ${ce?.fuelRatioPm} enemies ${ww.enemiesOf(id).map(tagOf).join(",")}`,
        );
        for (const f of navy.fleetsOf(id)) {
          const counts = new Array<number>(SHIP_CLASSES.length).fill(0);
          for (const sid of f.ships) {
            const r = navy.ships.rowOf(sid);
            if (r >= 0) counts[navy.ships.cls[r]]++;
          }
          const comp = SHIP_CLASSES.map((c, i) =>
            counts[i] > 0 ? `${c}${counts[i]}` : "",
          )
            .filter((x) => x !== "")
            .join(" ");
          console.log(
            `    fleet ${f.id} [${comp}] ${FLEET_MISSIONS[f.mission]}@${srName(f.missionSr)} ${FLEET_STATES[f.state]} in ${srName(sc.zoneSr(f.zone))}${f.docked !== 0 ? ` docked ${regionName(f.docked)}` : ""}${f.auto ? "" : ""}`,
          );
        }
        const deps = air
          .deploymentsOf(id)
          .map(
            (d) =>
              `${AIR_TYPES[d.type]}/${AIR_MISSIONS[d.mission]}@${srName(d.sr)}:${d.counts.reduce((a, b) => a + b, 0)}`,
          );
        console.log(`    air: ${deps.join(", ") || "-"}`);
      }
    }
    // Wars and the fallen.
    for (const [x, y] of watchedWars) {
      const key = `${x}-${y}`;
      if (res.wars[key] === undefined && ww.isAtWar(idOf(x), idOf(y))) {
        res.wars[key] = done;
      }
    }
    for (const tg of tags) {
      const id = idOf(tg);
      if (res.fallen[tg] !== undefined) continue;
      if (ww.isCapitulated(id)) res.fallen[tg] = done;
      else if (ww.startVp(id) > 0 && !ww.playerOfTag(tg)?.isAlive()) {
        res.fallen[tg] = done;
        res.conquered.push(tg);
      }
    }
    // Sea areas: Britain at home (at war with a major), Italy in the
    // Mediterranean (at war with Britain or France), Japan in the Pacific
    // (at war with the US or Britain), Britain on the Atlantic routes.
    const areaDay = (area: SeaArea, tag: CountryTag, on: boolean) => {
      if (!on) return;
      const acc = res.areas[area];
      const v = sideAcc(area, tag);
      acc.days++;
      acc.sum += v.mine;
      acc.enemySum += v.enemy;
      if (v.mine >= 500) acc.control++;
    };
    areaDay("home", "GBR", atWarWithMajor("GBR"));
    areaDay(
      "med",
      "ITA",
      ww.isAtWar(idOf("ITA"), gbr) || ww.isAtWar(idOf("ITA"), idOf("FRA")),
    );
    areaDay(
      "pacific",
      "JPN",
      ww.isAtWar(idOf("JPN"), idOf("USA")) || ww.isAtWar(idOf("JPN"), gbr),
    );
    areaDay("atlantic", "GBR", ww.isAtWar(idOf("DEU"), gbr));
    // Convoys: Britain's stock, losses, trade efficiency.
    for (const cn of navy.countries()) {
      const lost = cn.convoyLoss[done % 30];
      if (lost > 0) bump(res.convoys.lostBy, cn.tag, lost / 1000);
    }
    const gce = econ.country(gbr);
    if (gce !== null) {
      const stock = gce.stock[CONVOY];
      if (done === 0) res.convoys.gbrStart = stock;
      if (done === dayOfDate("1939-09-01")) res.convoys.gbr1939 = stock;
      const lostToday = navy.country(gbr)!.convoyLoss[done % 30] / 1000;
      res.convoys.gbrLost += lostToday;
      if (done >= dayOfDate("1939-09-01") && done <= dayOfDate("1942-12-31")) {
        res.convoys.gbrLost39to42 += lostToday;
        if (gbrConvoysYesterday >= 0) {
          const built = stock - gbrConvoysYesterday + lostToday;
          if (built > 0) res.convoys.gbrBuilt39to42 += built;
        }
      }
      gbrConvoysYesterday = stock;
      let need = 0;
      let got = 0;
      for (const r of navy.routes.values()) {
        if (r.owner !== gbr || r.use !== USE_TRADE) continue;
        need += r.need;
        got += r.got;
      }
      if (need > 0 && done >= dayOfDate("1939-09-01")) {
        const eff = got / need;
        gbrTradeEffSum += eff;
        gbrTradeEffDays++;
        if (eff < 0.5) {
          gbrTradeLow++;
          res.convoys.gbrTradeLowStreakMax = Math.max(
            res.convoys.gbrTradeLowStreakMax,
            gbrTradeLow,
          );
        } else gbrTradeLow = 0;
      }
    }
    // Fuel.
    for (const tg of MAJORS) {
      const ce = econ.country(idOf(tg));
      if (ce === null) continue;
      const f = fuelOf(tg);
      if (done === 1) {
        f.day1 = ce.fuelMilli;
        f.gain = ce.fuelGainMilli;
        f.cap = (
          await import("@openfront/engine/ww1936/economy/Fuel")
        ).fuelCapOf(econ, ce);
      }
      if (done === 30) f.day30 = ce.fuelMilli;
      if (done === 365) f.day365 = ce.fuelMilli;
      if (year === "1936")
        f.minRatio1936 = Math.min(f.minRatio1936, ce.fuelRatioPm);
      if (ce.fuelRatioPm < 1000) bump(f.shortDays, year);
      if (ce.fuelRatioPm < 500) bump(f.emptyDays, year);
      if (ce.fuelRatioPm < 300) f.immobileFleetDays++;
    }
    // Air superiority.
    const deuSide = navy.sideOf(idOf("DEU"));
    const gbrSide = navy.sideOf(gbr);
    const fraSide = navy.sideOf(idOf("FRA"));
    const airDay = (area: AirArea, on: boolean) => {
      if (!on) return;
      const acc = res.air[area];
      const zs = AIR_ZONES[area] as readonly number[];
      acc.days++;
      for (const sr of zs) {
        acc.deuSup += air.airSup(deuSide, sr) / zs.length;
        acc.gbrSup += air.airSup(gbrSide, sr) / zs.length;
        acc.fraSup += air.airSup(fraSide, sr) / zs.length;
      }
    };
    airDay("lowCountries", ww.isAtWar(idOf("DEU"), idOf("FRA")));
    airDay(
      "englandSouth",
      ww.isAtWar(idOf("DEU"), gbr) &&
        done >= dayOfDate("1940-07-01") &&
        done <= dayOfDate("1941-06-30"),
    );
    void englishSouth;
    // Allies on the French coast (1943-06..1944-12).
    if (done >= dayOfDate("1943-06-01") && done <= dayOfDate("1944-12-31")) {
      const held = frenchCorePorts.some((r) => {
        const c = land.controller[r];
        const ct = tagOf(c);
        return ct !== "FRA" && land.sameSide(c, gbr);
      });
      alliedFrPortStreak = held ? alliedFrPortStreak + 1 : 0;
      alliedFrPortBest = Math.max(alliedFrPortBest, alliedFrPortStreak);
    }
    const coreLabel = coreDates.get(done);
    if (coreLabel !== undefined) {
      const rec: Record<string, number> = {};
      for (const tg of [
        "FRA",
        "BEL",
        "NLD",
        "GBR",
        "JPN",
        "ITA",
        "DEU",
      ] as CountryTag[]) {
        const id = idOf(tg);
        let held = 0;
        let total = 0;
        for (const r of sc.landRegions) {
          if (r.owner !== tg || !r.core) continue;
          total += r.vp;
          const c = land.controller[r.id];
          if (c !== id && !land.sameSide(id, c)) held += r.vp;
        }
        rec[tg] = total === 0 ? 0 : Math.floor((held * 1000) / total);
      }
      let sunHeld = 0;
      let sunTotal = 0;
      for (const r of sunStartVp) {
        sunTotal += r.vp;
        const c = land.controller[r.id];
        if (c !== idOf("SUN") && !land.sameSide(idOf("SUN"), c))
          sunHeld += r.vp;
      }
      rec.SUN = sunTotal === 0 ? 0 : Math.floor((sunHeld * 1000) / sunTotal);
      res.core[coreLabel] = rec;
      const secs = ((performance.now() - t0) / 1000).toFixed(0);
      console.log(
        `[${seed}/${historical ? "on" : "off"}] ${coreLabel} (${secs} s): lost FRA ${rec.FRA / 10}% GBR ${rec.GBR / 10}% SUN ${rec.SUN / 10}% JPN ${rec.JPN / 10}%; fallen ${Object.keys(res.fallen).join(" ") || "-"}; battles ${res.battles.total}; invasions ${res.invasions.filter((x) => x.outcome === "launched").length}`,
      );
    }
    const shipLabel = shipDates.get(done);
    if (shipLabel !== undefined) {
      const rec: Record<string, number> = {};
      for (const tg of MAJORS) rec[tg] = 0;
      const tt = navy.ships;
      for (let r = 0; r < tt.rows; r++) {
        if (tt.id[r] === 0) continue;
        const tg = tagOf(tt.owner[r]);
        if (tg in rec) rec[tg]++;
      }
      res.ships[shipLabel] = rec;
      // Fighters (stock and deployed, every generation) of each major.
      const fr: Record<string, number> = {};
      for (const tg of MAJORS) {
        const ce = econ.country(idOf(tg));
        if (ce === null) continue;
        let n = 0;
        for (const ty of ["fighter", "heavy_fighter"] as const) {
          for (let gen = 1; gen <= EQUIPMENT_GENS[ty]; gen++) {
            n += ce.stock[equipKey(ty, gen)] ?? 0;
          }
        }
        for (const d of air.deploymentsOf(idOf(tg))) {
          const ty = AIR_TYPES[d.type];
          if (ty === "fighter" || ty === "heavy_fighter") {
            n += d.counts.reduce((a, b) => a + b, 0);
          }
        }
        fr[tg] = n;
      }
      res.fighters[shipLabel] = fr;
    }
    // Spec table positions read on their days.
    const ctrlCheck = (
      date: string,
      label: string,
      regs: number[],
      tag: CountryTag,
    ) => {
      if (done !== dayOfDate(date)) return;
      const ok = regs.every((r) =>
        land.sameSide(land.controller[r], idOf(tag)),
      );
      res.checks.push({
        label,
        value: regs
          .map((r) => `${regionName(r)} ${tagOf(land.controller[r])}`)
          .join(", "),
        ok,
      });
    };
    ctrlCheck("1939-06-30", "1939-06-30 ITA holds Tiranë", [577], "ITA");
    ctrlCheck(
      "1940-06-30",
      "1940-06-30 DEU holds Oslo, Hordaland",
      [175, 167],
      "DEU",
    );
    ctrlCheck(
      "1942-06-30",
      "1942-06-30 JPN holds Philippines, Malaya, Batavia",
      [945, 1087, 1094],
      "JPN",
    );
  }
  for (const [a, b] of battleOwners.values()) {
    const name = (x: Set<number>) => [...x].map(tagOf).sort().join("+") || "?";
    bump(res.battles.byPair, [name(a), name(b)].sort().join(" v "));
  }
  res.ticks = g.ticks();
  res.hash = (g as unknown as { hash(): number }).hash();
  res.seconds = Math.round((performance.now() - t0) / 1000);
  res.bombPoints = air.bombPointsTotal;
  res.convoys.gbrTradeEffMean =
    gbrTradeEffDays === 0 ? 1 : gbrTradeEffSum / gbrTradeEffDays;
  // The rest of spec §23.3's table.
  const add = (label: string, value: string, ok: boolean | null) =>
    res.checks.push({ label, value, ok });
  const sealion = res.invasions.filter(
    (x) =>
      x.owner === "DEU" &&
      x.outcome === "launched" &&
      x.day >= dayOfDate("1940-07-01") &&
      x.day <= dayOfDate("1941-06-30") &&
      sc.landRegions.find((r) => r.id === x.regionId)?.owner === "GBR" &&
      sc.landRegions.find((r) => r.id === x.regionId)?.core === true,
  ).length;
  const es = res.air.englandSouth;
  add(
    "1940-07..1941-06 no DEU landing in Britain; GBR air ≥ 400‰ over S England",
    `${sealion} launched; GBR ${es.days === 0 ? "-" : (es.gbrSup / es.days).toFixed(0)}‰ DEU ${es.days === 0 ? "-" : (es.deuSup / es.days).toFixed(0)}‰ (${es.days} d)`,
    sealion === 0 && (es.days === 0 || es.gbrSup / es.days >= 400),
  );
  const usLandings = res.invasions.filter(
    (x) =>
      x.owner === "USA" &&
      x.outcome === "landed" &&
      x.day >= dayOfDate("1942-06-01") &&
      x.day <= dayOfDate("1943-12-31"),
  ).length;
  add("1942-06..1943-12 US landings ≥ 2", `${usLandings}`, usLandings >= 2);
  add(
    "1943-06..1944-12 Allies hold a French coastal port > 30 days",
    `${alliedFrPortBest} days`,
    alliedFrPortBest > 30,
  );
  const c39 = res.convoys.gbr1939 || res.convoys.gbrStart;
  const lostShare = c39 === 0 ? 0 : res.convoys.gbrLost39to42 / c39;
  add(
    "1939-09..1942-12 GBR convoy losses ≥ 25% of 1939 stock; trade < 50% ≤ 60 days",
    `${(lostShare * 100).toFixed(0)}% of ${c39} (built ${res.convoys.gbrBuilt39to42.toFixed(0)}); low streak ${res.convoys.gbrTradeLowStreakMax} d; mean eff ${(res.convoys.gbrTradeEffMean * 100).toFixed(0)}%`,
    lostShare >= 0.25 && res.convoys.gbrTradeLowStreakMax <= 60,
  );
  const jpHome = res.invasions.filter(
    (x) =>
      x.owner !== "JPN" &&
      x.outcome === "launched" &&
      japanHome.has(sc.landRegions.find((r) => r.id === x.regionId)?.sr ?? 0),
  ).length;
  add(
    "1945-08-21 Japan home invasion tried or Japan fallen",
    `${jpHome} launched; JPN ${iso(res.fallen.JPN)}`,
    jpHome > 0 || res.fallen.JPN !== undefined,
  );
  // Perf.
  const sorted = [...tickMs].sort((x, y) => x - y);
  const sorted4 = [...p4Ms].sort((x, y) => x - y);
  const mean = (xs: readonly number[]) =>
    xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  res.perf = {
    tickMean: mean(tickMs),
    tickP99: pct(sorted, 0.99),
    tickMax: sorted[sorted.length - 1] ?? 0,
    p4Mean: mean(p4Ms),
    p4P99: pct(sorted4, 0.99),
    p4Max: sorted4[sorted4.length - 1] ?? 0,
  };
  if (perf) {
    res.perf.parts = {};
    for (const p of P4_PARTS) {
      const xs = parts[p];
      const s = [...xs].sort((x, y) => x - y);
      res.perf.parts[p] = {
        mean: mean(xs),
        p99: pct(s, 0.99),
        max: s[s.length - 1] ?? 0,
      };
    }
  }
  add(
    "P4 tick mean ≤ 0.6 ms, p99 ≤ 3 ms",
    `${ms(res.perf.p4Mean)} / ${ms(res.perf.p4P99)} (max ${ms(res.perf.p4Max)})`,
    res.perf.p4Mean <= 0.6 && res.perf.p4P99 <= 3,
  );
  return res;
}

// ---------------------------------------------------------------------------
// Reports

function printRun(r: RunResult, navyReport: boolean): void {
  console.log(
    `\n== ${r.seed} historical ${r.historical ? "on" : "off"} (to ${r.until}, ticks ${r.ticks}, ${r.seconds} s, hash ${r.hash}) ==`,
  );
  const fallen = Object.entries(r.fallen)
    .sort((a, b) => a[1] - b[1])
    .map(([t, d]) => `${t}${r.conquered.includes(t) ? "✝" : ""} ${iso(d)}`);
  console.log(`fallen: ${fallen.join(", ") || "none"}`);
  console.log(
    `wars: ${Object.entries(r.wars)
      .map(([k, d]) => `${k} ${iso(d)}`)
      .join(", ")}`,
  );
  console.log(
    formatTable(
      ["check", "value", ""],
      r.checks.map((c) => [
        c.label,
        c.value,
        c.ok === null ? "" : c.ok ? "PASS" : "FAIL",
      ]),
    ),
  );
  if (!navyReport) return;
  console.log("\n-- navy");
  console.log(
    formatTable(
      [
        "area",
        "side",
        "war days",
        "mean sup ‰",
        "enemy ‰",
        "control ≥500 days",
      ],
      (Object.keys(r.areas) as SeaArea[]).map((k) => {
        const a = r.areas[k];
        return [
          k,
          a.side,
          `${a.days}`,
          a.days === 0 ? "-" : (a.sum / a.days).toFixed(0),
          a.days === 0 ? "-" : (a.enemySum / a.days).toFixed(0),
          a.days === 0
            ? "-"
            : `${a.control} (${((a.control * 100) / a.days).toFixed(0)}%)`,
        ];
      }),
    ),
  );
  console.log(
    `battles ${r.battles.total}: by area ${JSON.stringify(r.battles.byArea)}, by year ${JSON.stringify(r.battles.byYear)}`,
  );
  const pairs = Object.entries(r.battles.byPair)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => `${k} ${v}`);
  console.log(`top pairings: ${pairs.join("; ")}`);
  console.log(
    `sunk: ${Object.entries(r.sunk)
      .map(
        ([o, m]) =>
          `${o} ${Object.entries(m)
            .map(([c, n]) => `${c}${n}`)
            .join(" ")}`,
      )
      .join(" | ")}`,
  );
  console.log(`sunk in area: ${JSON.stringify(r.sunkInArea)}`);
  console.log(`invasions: ${JSON.stringify(r.invasionsBy)}`);
  for (const x of r.invasions
    .filter((y) => y.outcome !== "launched")
    .slice(0, 30)) {
    console.log(
      `  ${iso(x.day)} ${x.owner} ${x.outcome} ${x.region} (${x.srName})`,
    );
  }
  console.log(
    `convoys: GBR start ${r.convoys.gbrStart}, 1939 ${r.convoys.gbr1939}, lost ${r.convoys.gbrLost.toFixed(0)} (1939–42 ${r.convoys.gbrLost39to42.toFixed(0)}, built ${r.convoys.gbrBuilt39to42.toFixed(0)}); lost by ${JSON.stringify(Object.fromEntries(Object.entries(r.convoys.lostBy).map(([k, v]) => [k, Math.round(v)])))}`,
  );
  console.log("-- fuel (milli → units; ratio ‰)");
  console.log(
    formatTable(
      [
        "tag",
        "cap",
        "gain/d",
        "day 1",
        "day 30",
        "day 365",
        "min r 1936",
        "short days by year",
        "r<500 by year",
        "r<300 days",
      ],
      Object.entries(r.fuel).map(([t, f]) => [
        t,
        `${Math.round(f.cap / 1000)}`,
        `${(f.gain / 1000).toFixed(1)}`,
        `${Math.round(f.day1 / 1000)}`,
        `${Math.round(f.day30 / 1000)}`,
        `${Math.round(f.day365 / 1000)}`,
        `${f.minRatio1936}`,
        JSON.stringify(f.shortDays),
        JSON.stringify(f.emptyDays),
        `${f.immobileFleetDays}`,
      ]),
    ),
  );
  console.log("-- air");
  for (const k of Object.keys(r.air) as AirArea[]) {
    const a = r.air[k];
    if (a.days === 0) continue;
    console.log(
      `  ${k}: ${a.days} d, DEU ${(a.deuSup / a.days).toFixed(0)}‰, GBR ${(a.gbrSup / a.days).toFixed(0)}‰, FRA ${(a.fraSup / a.days).toFixed(0)}‰`,
    );
  }
  console.log(
    `  planes lost ${JSON.stringify(r.airLost)}; bomb points ${r.bombPoints}`,
  );
  console.log(`core lost ‰: ${JSON.stringify(r.core)}`);
  console.log(`ships: ${JSON.stringify(r.ships)}`);
  console.log(`fighters: ${JSON.stringify(r.fighters ?? {})}`);
  if (r.perf.parts !== undefined) {
    console.log(
      formatTable(
        ["part", "mean ms/tick", "p99", "max"],
        Object.entries(r.perf.parts).map(([p, v]) => [
          p,
          ms(v.mean),
          ms(v.p99),
          ms(v.max),
        ]),
      ),
    );
  }
  console.log(
    `tick mean ${ms(r.perf.tickMean)} p99 ${ms(r.perf.tickP99)} max ${ms(r.perf.tickMax)}; P4 mean ${ms(r.perf.p4Mean)} p99 ${ms(r.perf.p4P99)} max ${ms(r.perf.p4Max)}`,
  );
}

function summary(dir: string): void {
  const runs: RunResult[] = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map(
      (f) =>
        JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as RunResult,
    );
  if (runs.length === 0) {
    console.log(`no runs in ${dir}`);
    return;
  }
  const yes = (b: boolean) => (b ? "Y" : "·");
  const rows = runs.map((r) => {
    const home = r.areas.home;
    const med = r.areas.med;
    const pac = r.areas.pacific;
    const jpUs = r.wars["JPN-USA"];
    const usJpBattles = Object.entries(r.battles.byPair)
      .filter(([k]) => /JPN/.test(k) && /USA/.test(k))
      .reduce((s, [, v]) => s + v, 0);
    const launched = r.invasions.filter((x) => x.outcome === "launched").length;
    const landed = r.invasions.filter((x) => x.outcome === "landed").length;
    const c39 = r.convoys.gbr1939 || r.convoys.gbrStart;
    const lostShare = c39 === 0 ? 0 : r.convoys.gbrLost39to42 / c39;
    const lc = r.air.lowCountries;
    return [
      `${r.seed}/${r.historical ? "on" : "off"}`,
      home.days === 0
        ? "-"
        : `${((home.control * 100) / home.days).toFixed(0)}%`,
      med.days === 0
        ? "-"
        : `${(med.sum / med.days).toFixed(0)}/${(med.enemySum / med.days).toFixed(0)}`,
      `${jpUs === undefined ? "-" : iso(jpUs).slice(0, 7)} ${usJpBattles}b`,
      pac.days === 0
        ? "-"
        : `${(pac.sum / pac.days).toFixed(0)}/${(pac.enemySum / pac.days).toFixed(0)}`,
      `${(lostShare * 100).toFixed(0)}% ${r.convoys.gbrTradeLowStreakMax}d`,
      `${launched}/${landed}`,
      lc.days === 0
        ? "-"
        : `${(lc.deuSup / lc.days).toFixed(0)}/${(lc.fraSup / lc.days).toFixed(0)}`,
      r.fallen.FRA === undefined ? "-" : iso(r.fallen.FRA),
      `${Math.round((r.fuel.ITA?.day30 ?? 0) / 1000)} ${r.fuel.ITA?.minRatio1936 ?? "-"}`,
      `${r.battles.total}`,
      `${ms(r.perf.p4Mean)}/${ms(r.perf.p4P99)}`,
    ];
  });
  console.log(
    formatTable(
      [
        "run",
        "GBR home ctrl",
        "Med ITA/enemy ‰",
        "JPN-USA war",
        "Pac JPN/enemy ‰",
        "GBR convoy loss / low",
        "inv launched/landed",
        "LowC air DEU/FRA ‰",
        "FRA falls",
        "ITA fuel d30, min r",
        "battles",
        "P4 ms mean/p99",
      ],
      rows,
    ),
  );
  const n = runs.length;
  const share = (f: (r: RunResult) => boolean) =>
    `${runs.filter(f).length}/${n}`;
  console.log(`\nFrance falls: ${share((r) => r.fallen.FRA !== undefined)}`);
  console.log(
    `France falls by 1941-12-31: ${share((r) => r.fallen.FRA !== undefined && r.fallen.FRA <= dayOfDate("1941-12-31"))}`,
  );
  console.log(
    `GBR keeps home waters (control ≥ 50% of war days): ${share((r) => r.areas.home.days > 0 && r.areas.home.control * 2 >= r.areas.home.days)}`,
  );
  console.log(
    `Italy contests the Med (mean ≥ 200‰): ${share((r) => r.areas.med.days > 0 && r.areas.med.sum / r.areas.med.days >= 200)}`,
  );
  console.log(`JPN–USA war: ${share((r) => r.wars["JPN-USA"] !== undefined)}`);
  console.log(
    `JPN–USA naval battles ≥ 3: ${share(
      (r) =>
        Object.entries(r.battles.byPair)
          .filter(([k]) => /JPN/.test(k) && /USA/.test(k))
          .reduce((s, [, v]) => s + v, 0) >= 3,
    )}`,
  );
  console.log(
    `invasions landed ≥ 1: ${share((r) => r.invasions.some((x) => x.outcome === "landed"))}`,
  );
  const checkLabels = [
    ...new Set(runs.flatMap((r) => r.checks.map((c) => c.label))),
  ];
  for (const l of checkLabels) {
    console.log(
      `${l}: ${share((r) => r.checks.find((c) => c.label === l)?.ok === true)}`,
    );
  }
  void yes;
}

// ---------------------------------------------------------------------------
// Duels on the pure rules (spec §23.3)

/** Britain and Italy at war on the sea test map (the duels' board). */
async function seaBoard() {
  const { usePoliticsContent } =
    await import("@openfront/engine/ww1936/politics/ContentSource");
  const { politicsFixture } =
    await import("../../tests/ww1936/politicsFixture");
  const u = await import("../../tests/ww1936/util");
  usePoliticsContent(politicsFixture());
  const runner = await u.wwRunner(
    {},
    [
      { clientID: u.HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "ITA" },
    ],
    u.SEA_MAP,
  );
  u.warAfterPrep(runner, u.HUMAN, "ITA");
  return runner;
}

type Comp = readonly (readonly [ShipClass, number, number])[];

interface NavalDuel {
  name: string;
  expect: string;
  /** Britain's (the attacker's) ships and Italy's: [class, generation, count]. */
  a: Comp;
  b: Comp;
  /** Carrier decks: [fighters, naval bombers] of each carrier, generation 2. */
  deck?: [number, number];
}

const NAVAL_DUELS: readonly NavalDuel[] = [
  {
    name: "1922 battleship 1 v 1",
    expect: "both break off in rounds 7–10, none sunk",
    a: [["bb", 1, 1]],
    b: [["bb", 1, 1]],
  },
  {
    name: "La Plata: Exeter, Ajax, Achilles v Graf Spee",
    expect: "Graf Spee gets away at 25–40% HP",
    a: [
      ["ca", 1, 1],
      ["cl", 2, 2],
    ],
    b: [["ca", 2, 1]],
  },
  {
    name: "1922 destroyers 12 v battleships 4 (no screen)",
    expect: "destroyers break off within 6 rounds; battleships lose 10–25% HP",
    a: [["dd", 1, 12]],
    b: [["bb", 1, 4]],
  },
  {
    name: "battleships 4 + destroyers 12 v destroyers 12",
    expect: "battle line loses ≤ 5% HP",
    a: [
      ["bb", 1, 4],
      ["dd", 1, 12],
    ],
    b: [["dd", 1, 12]],
  },
  {
    name: "1936 carriers 4 + destroyers 8 v 1936 battleships 4 + destroyers 8",
    expect:
      "the carriers win (battleships break off first), ≤ 1 carrier-side ship sunk",
    a: [
      ["cv", 2, 4],
      ["dd", 2, 8],
    ],
    b: [
      ["bb", 2, 4],
      ["dd", 2, 8],
    ],
    deck: [20, 40],
  },
];

/**
 * Spec §23.3 --naval-duel: each case as one real battle of the engine on
 * the sea test map (Britain against Italy at sea west of London, no
 * admirals, no techs beyond the start's), round by round: the round each
 * side breaks off, its HP lost, its ships sunk.
 */
async function navalDuels(): Promise<void> {
  const { startNavalBattle, stepNavalBattles } =
    await import("@openfront/engine/ww1936/navy/NavalBattles");
  const { FLEET_STATES } =
    await import("@openfront/engine-api/ww1936/NavyTypes");
  const { REGION, TAG_ID, ZONE } =
    await import("../../tests/ww1936/seaFixture");
  const rows: string[][] = [];
  for (const c of NAVAL_DUELS) {
    const runner = await seaBoard();
    const navy = runner.game.worldWar()!.navy;
    const tick = runner.game.ticks();
    const put = (owner: number, port: number, comp: Comp) => {
      const f = navy.fleets.get(navy.createFleet(owner, port, comp))!;
      f.docked = 0;
      f.state = FLEET_STATES.indexOf("on_station");
      navy.setFleetZone(f, ZONE.west);
      if (c.deck !== undefined) {
        for (const id of f.ships) {
          const r = navy.ships.rowOf(id);
          if (navy.ships.cls[r] !== SHIP_CLASSES.indexOf("cv")) continue;
          const d = navy.ships.deckOf(r);
          // (cv_fighter, cv_cas, cv_naval_bomber) × generation 1..3.
          d[1] = c.deck[0];
          d[7] = c.deck[1];
        }
      }
      return f;
    };
    const fa = put(TAG_ID.GBR, REGION.london, c.a);
    const fb = put(TAG_ID.ITA, REGION.rome, c.b);
    const sideShips = [new Set(fa.ships), new Set(fb.ships)];
    const hpOf = (s: 0 | 1) => {
      let hp = 0;
      let max = 0;
      for (const id of sideShips[s]) {
        const r = navy.ships.rowOf(id);
        if (r < 0) continue;
        hp += navy.ships.hp[r];
        max += navy.shipStatsOf(r).hpMilli;
      }
      return { hp, max };
    };
    const start = [hpOf(0), hpOf(1)];
    startNavalBattle(navy, ZONE.west, navy.sideOf(TAG_ID.GBR), fb.id, tick);
    const breakOff: (number | null)[] = [null, null];
    let rounds = 0;
    for (let i = 0; i < 60 && navy.battles.has(ZONE.west); i++) {
      stepNavalBattles(navy, tick);
      const b = navy.battles.get(ZONE.west);
      rounds = b?.round ?? rounds + 1;
      for (const s of [0, 1] as const) {
        if (breakOff[s] === null && b?.retreating[s]) breakOff[s] = rounds;
      }
    }
    const end = [hpOf(0), hpOf(1)];
    const lost = (s: 0 | 1) =>
      `${(((start[s].hp - end[s].hp) * 100) / Math.max(1, start[s].hp)).toFixed(0)}%`;
    const sunk = (s: 0 | 1) =>
      [...sideShips[s]].filter((id) => navy.ships.rowOf(id) < 0).length;
    rows.push([
      c.name,
      c.expect,
      `${rounds}`,
      `${breakOff[0] ?? "-"} / ${breakOff[1] ?? "-"}`,
      `${lost(0)} / ${lost(1)}`,
      `${sunk(0)} / ${sunk(1)}`,
    ]);
  }
  console.log(
    formatTable(
      [
        "case (A v B)",
        "spec §23.3",
        "rounds",
        "A / B break off",
        "HP lost A / B",
        "sunk A / B",
      ],
      rows,
    ),
  );
}

/**
 * Spec §23.3 --air-duel on the sea test map: fighters of Britain and Italy
 * over the central sea for one day (the zone's own clear day), as the
 * engine flies them — losses each side, superiority. And --convoy's
 * numbers from the pure rules: thirty 1936 submarines on 300 British
 * convoys in the central North Atlantic (the real map's area), without
 * and with forty destroyers.
 */
async function airDuels(): Promise<void> {
  const { dailyAirZone, zoneWeather } =
    await import("@openfront/engine/ww1936/air/AirCombat");
  const { EQUIPMENT_GENS: GENS, equipKey: key } =
    await import("@openfront/engine-api/ww1936/EconomyTypes");
  const { SR, TAG_ID } = await import("../../tests/ww1936/seaFixture");
  const rows: string[][] = [];
  const cases: [string, string, number[], number[]][] = [
    [
      "1936 fighters 500 v 500",
      "7–9 lost a day each, 450–550‰",
      [500, 0, 0],
      [500, 0, 0],
    ],
    [
      "generation 2 500 v generation 1 500",
      "gen 2 ≥ 600‰, losses 1:1.8 or better",
      [0, 500, 0],
      [500, 0, 0],
    ],
  ];
  for (const [name, expect, gbrStock, itaStock] of cases) {
    const runner = await seaBoard();
    const ww = runner.game.worldWar()!;
    const air = ww.air;
    for (const [id, stock] of [
      [TAG_ID.GBR, gbrStock],
      [TAG_ID.ITA, itaStock],
    ] as const) {
      const ce = ww.economy.country(id)!;
      for (let gen = 1; gen <= GENS.fighter; gen++) {
        ce.stock[key("fighter", gen)] = stock[gen - 1] ?? 0;
      }
      const block = air.issue(
        id,
        {
          kind: "air_deploy",
          sr: SR.central,
          type: "fighter",
          mission: "air_superiority",
          count: 500,
        },
        runner.game.ticks(),
      );
      if (block !== null) throw new Error(`air_deploy: ${block}`);
    }
    let day = ww.day(runner.game.ticks()) + 1;
    while (zoneWeather(air, SR.central, day) !== "clear") day++;
    // Yesterday's superiority comes first (an even day), then the duel.
    dailyAirZone(air, SR.central, day - 1);
    const before = air.planesLostTotal;
    const lostBy = (id: number) =>
      air
        .deploymentsOf(id)
        .reduce((n, d) => n + d.counts.reduce((a, b) => a + b, 0), 0);
    const g0 = lostBy(TAG_ID.GBR);
    const i0 = lostBy(TAG_ID.ITA);
    dailyAirZone(air, SR.central, day);
    const g1 = lostBy(TAG_ID.GBR);
    const i1 = lostBy(TAG_ID.ITA);
    rows.push([
      name,
      expect,
      `${g0 - g1} / ${i0 - i1} (${air.planesLostTotal - before})`,
      `${air.airSup(ww.land.sideOf(TAG_ID.GBR), SR.central)}‰`,
    ]);
  }
  console.log(
    formatTable(
      ["case (Britain v Italy)", "spec §23.3", "lost a day", "Britain's sky"],
      rows,
    ),
  );
}

async function convoyDuel(): Promise<void> {
  const { shipStats } = await import("@openfront/engine-lib/ww1936/ShipStats");
  const { emptyStats } = await import("@openfront/engine-lib/ww1936/Stats");
  const cr = await import("@openfront/engine-lib/ww1936/ConvoyRules");
  const files = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner = await createGameRunner(
    startInfo("WWCONVOY", true),
    undefined,
    files,
    () => {},
  );
  const sc = runner.game.worldWar()!.scenario;
  const area = sc.sr(1018)?.area ?? 0;
  const z = emptyStats();
  const none = new Set<never>();
  const ss = shipStats("ss", 2, z, none);
  const dd = shipStats("dd", 2, z, none);
  const raid = cr.raidPowerCenti(ss.torpedo * 30, 0, 0, z, none, 1000);
  const escort = cr.escortPowerCenti(
    (dd.depth * 2 + dd.light) * 40,
    0,
    0,
    0,
    z,
  );
  const traffic = 300;
  const loss = (e: number) => cr.convoySinkMilli(traffic, raid, e, area) / 1000;
  const subHp = ss.hpMilli;
  // Spotted half the day on average (the escort's spotting ‰).
  const subsLost = (spot: number) => cr.aswDamageMilli(escort, spot) / subHp;
  console.log(
    formatTable(
      ["case", "spec §23.3", "value"],
      [
        ["central North Atlantic area", "", `${area}`],
        [
          "no escort: convoys lost a day",
          "2.5–3.5%",
          `${loss(0).toFixed(1)} (${((loss(0) * 100) / traffic).toFixed(2)}%)`,
        ],
        [
          "40 destroyers: convoys lost a day",
          "1–1.6%",
          `${loss(escort).toFixed(1)} (${((loss(escort) * 100) / traffic).toFixed(2)}%)`,
        ],
        [
          "submarines lost a day (spotting 500‰ / 1000‰)",
          "0.3–1.0",
          `${subsLost(500).toFixed(2)} / ${subsLost(1000).toFixed(2)}`,
        ],
      ],
    ),
  );
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const o = parseArgs(process.argv.slice(2));
  const out = path.resolve(ROOT, o.out);
  if (o.mode === "summary") {
    summary(out);
    return;
  }
  if (o.mode === "show") {
    // Every run's report (the navy part too) from its JSON.
    for (const f of fs.readdirSync(out).filter((x) => x.endsWith(".json"))) {
      const r = JSON.parse(
        fs.readFileSync(path.join(out, f), "utf8"),
      ) as RunResult;
      if (o.seeds.some((seed) => f.startsWith(seed))) printRun(r, true);
    }
    return;
  }
  if (o.mode === "naval-duel") {
    await navalDuels();
    return;
  }
  if (o.mode === "air-duel") {
    await airDuels();
    return;
  }
  if (o.mode === "convoy") {
    await convoyDuel();
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  for (const seed of o.seeds) {
    const r = await playGame(seed, o.historical, o.until, o.mode === "perf", {
      tags: o.trace,
      every: o.every,
      from: dayOfDate(o.from),
    });
    const file = path.join(
      out,
      `${seed}-${o.historical ? "on" : "off"}${o.mode === "perf" ? "-perf" : ""}.json`,
    );
    if (o.mode === "game") fs.writeFileSync(file, JSON.stringify(r, null, 1));
    printRun(r, o.navy || o.mode === "perf");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

void COUNTRIES;
void INVASION_STATES;
