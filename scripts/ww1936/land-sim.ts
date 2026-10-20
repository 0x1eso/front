/**
 * World War 1936 P2 balance and performance check (P2 spec §19.3, §19.4;
 * plan Task 11). Three modes:
 *
 *   npx tsx scripts/ww1936/land-sim.ts --duel
 *   npx tsx scripts/ww1936/land-sim.ts --game [--seeds WWSIM001,WWSIM002,WWSIM003]
 *                                     [--until 1942-12-31] [--out .cache/land-sim]
 *   npx tsx scripts/ww1936/land-sim.ts --perf [--seeds WWSIM001] [--until 1941-12-31]
 *
 * Diagnostics: --trace DEU,POL [--every 30] [--from 1939-08-01] [--armies]
 * prints those countries (divisions, manpower, stock, fill, org, supply,
 * battles, points, orders; with --armies every army) every `every` days;
 * --surrender FRA=31 tries a surrender line for one run.
 *
 * --duel: spec §19.3's five battles, each as the pure preview
 *   (`predictBattle`) and as one real battle of the engine on the test map
 *   (Germany and Poland human, Warsaw's or Krakow's terrain, river and fort
 *   set per case; clear weather, supply 1000, no generals, no readiness):
 *   the day it ends, who wins, each side's strength lost.
 * --game: the real world1936 map, no humans, the historical AI on, one run
 *   per seed (one after the other; run several processes for speed). A CSV
 *   per seed (`<out>/<seed>.csv`): every day, per country, divisions, men in
 *   the field and in training, the day's casualties, regions controlled,
 *   battles it is in, and the day's mean tick and land tick (ms). Then the
 *   events (wars, capitulations) and spec §19.3's expectation table plus the
 *   controller's Task 11 targets, each with its value and PASS/FAIL.
 * --perf: the same game; the tick time distribution (p50, p99, max) of the
 *   whole tick and of the land war, and the land war by part (daily common
 *   step, supply, the countries' days with the AI apart, orders, movement,
 *   battles, recovery, spread, update), against spec §17.3's budget.
 *
 * It only reports: tune the (내 판단) constants by hand (spec §19.3).
 */
import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import type { GameStartInfo } from "@openfront/engine-api/Schemas";
import {
  COUNTRIES,
  type CountryTag,
} from "@openfront/engine-api/ww1936/Countries";
import {
  EQUIP_KEYS,
  EQUIPMENT_TYPES,
  WW_DAY_SPLIT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  idleOrder,
  type LandTerrain,
  MOVE_RETREAT,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  dateOfDay,
  dayOfDate,
  dayStartTick,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { aiLandTick } from "@openfront/engine/ww1936/land/AiLand";
import {
  dailyEntrench,
  joinBattle,
  stepBattles,
  stepRecovery,
} from "@openfront/engine/ww1936/land/Battles";
import { dailyFronts } from "@openfront/engine/ww1936/land/Fronts";
import { stepMovement } from "@openfront/engine/ww1936/land/Movement";
import { stepSpread } from "@openfront/engine/ww1936/land/Occupation";
import { applyArmyOrders } from "@openfront/engine/ww1936/land/Orders";
import { predictAttack } from "@openfront/engine/ww1936/land/Plans";
import { dailySupply } from "@openfront/engine/ww1936/land/Supply";
import { dailySustain } from "@openfront/engine/ww1936/land/Sustain";
import type { Army, WwLand } from "@openfront/engine/ww1936/land/WwLand";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../../tests/perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  placeArmy,
  stamped,
  step,
  stepTo,
  wwRunner,
} from "../../tests/ww1936/util";
import { formatTable } from "../domestic-sim-report";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

// ---------------------------------------------------------------------------
// Options

interface Options {
  mode: "duel" | "game" | "perf";
  seeds: string[];
  until: string;
  out: string;
  /** Countries to print every `every` days (--trace DEU,POL --every 10). */
  trace: CountryTag[];
  every: number;
  from: string;
  /** With --trace: one line per army too. */
  armies: boolean;
  /**
   * Experiment: a surrender line per country for one run (--surrender
   * FRA=31,BEL=25), to try a P0 table value before writing it.
   */
  surrender: Partial<Record<CountryTag, number>>;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    mode: "game",
    seeds: ["WWSIM001", "WWSIM002", "WWSIM003"],
    until: "1942-12-31",
    out: ".cache/land-sim",
    trace: [],
    every: 30,
    from: "1936-01-01",
    armies: false,
    surrender: {},
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
      case "--duel":
        o.mode = "duel";
        break;
      case "--game":
        o.mode = "game";
        break;
      case "--perf":
        o.mode = "perf";
        break;
      case "--seeds":
      case "--seed":
        o.seeds = next().split(",");
        break;
      case "--until":
        o.until = next();
        untilSet = true;
        break;
      case "--out":
        o.out = next();
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
      case "--armies":
        o.armies = true;
        break;
      case "--surrender":
        for (const part of next().split(",")) {
          const [tag, pct] = part.split("=");
          if (!(tag in COUNTRIES)) throw new Error(`unknown country ${tag}`);
          o.surrender[tag as CountryTag] = Number(pct);
        }
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (o.mode === "perf" && !untilSet) o.until = "1941-12-31";
  if (o.mode === "perf" && o.seeds.length > 1) o.seeds = [o.seeds[0]];
  return o;
}

const ms = (x: number) => x.toFixed(2);

function pct(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

// ---------------------------------------------------------------------------
// --duel (spec §19.3)

type DuelTemplate = keyof typeof DUEL_TEMPLATES;

interface DuelCase {
  label: string;
  expect: string;
  /** The attacker's divisions per attacking region: one or two directions. */
  att: { tpl: DuelTemplate; per: number[]; gen: number };
  def: { tpl: DuelTemplate; n: number };
  land: LandTerrain;
  river: 0 | 1 | 2;
  fort: number;
  entrench: number;
  ok: (r: DuelResult) => boolean;
}

interface DuelResult {
  winner: "attacker" | "defender" | "none";
  days: number;
  /** Strength lost, ‰ of the men at the start. */
  attLossPm: number;
  defLossPm: number;
}

/** Test map v3 regions (plan "테스트 지도 v3"). */
const BERLIN = 3;
const MUNICH = 4;
const WARSAW = 6;
const KRAKOW = 7;

/** Spec §19.3's templates, as battalion lists (spec §9.10, §4.5). */
const DUEL_TEMPLATES = {
  // Spec §9.10's German division: infantry 7 · artillery 2 (width 20).
  inf72: {
    battalions: [
      ...Array<"infantry">(7).fill("infantry"),
      "artillery",
      "artillery",
    ],
    support: [],
  },
  // "기갑(경전차 4)": the German 1936 panzer division, light tanks 4 ·
  // motorised 2 · motorised artillery 1, recon (spec §4.5).
  panzer: {
    battalions: [
      "light_armor",
      "light_armor",
      "light_armor",
      "light_armor",
      "motorized",
      "motorized",
      "mot_artillery",
    ],
    support: ["recon"],
  },
  // The German infantry division (infantry 9 · artillery 2, engineers, recon).
  inf92: {
    battalions: [
      ...Array<"infantry">(9).fill("infantry"),
      "artillery",
      "artillery",
    ],
    support: ["engineer", "recon"],
  },
  // The Polish infantry division (infantry 9).
  inf9: { battalions: Array<"infantry">(9).fill("infantry"), support: [] },
  // The French infantry division (infantry 9 · artillery 3, engineers).
  inf93: {
    battalions: [
      ...Array<"infantry">(9).fill("infantry"),
      "artillery",
      "artillery",
      "artillery",
    ],
    support: ["engineer"],
  },
} as const;

const DUELS: readonly DuelCase[] = [
  {
    label: "inf 7·2 ×1 vs inf 9 ×1, plains",
    expect: "defender wins",
    att: { tpl: "inf72", per: [1], gen: 1 },
    def: { tpl: "inf9", n: 1 },
    land: "plains",
    river: 0,
    fort: 0,
    entrench: 0,
    ok: (r) => r.winner === "defender",
  },
  {
    label: "inf 7·2 ×7 (2 ways) vs inf 9 ×5, plains",
    expect: "attacker wins in 1.5–3 days",
    att: { tpl: "inf72", per: [4, 3], gen: 1 },
    def: { tpl: "inf9", n: 5 },
    land: "plains",
    river: 0,
    fort: 0,
    entrench: 0,
    ok: (r) => r.winner === "attacker" && r.days >= 1.5 && r.days <= 3,
  },
  {
    label: "same, hills + small river",
    expect: "defender wins",
    att: { tpl: "inf72", per: [4, 3], gen: 1 },
    def: { tpl: "inf9", n: 5 },
    land: "hills",
    river: 1,
    fort: 0,
    entrench: 0,
    ok: (r) => r.winner === "defender",
  },
  {
    label: "panzer (light tanks 4) ×3 vs inf 9 ×3, plains",
    expect: "attacker wins in ≤ 2 days, loses ≤ 10%",
    att: { tpl: "panzer", per: [3], gen: 1 },
    def: { tpl: "inf9", n: 3 },
    land: "plains",
    river: 0,
    fort: 0,
    entrench: 0,
    ok: (r) => r.winner === "attacker" && r.days <= 2 && r.attLossPm <= 100,
  },
  {
    // Controller ruling 8 (lane C's C6): the real map's 1936 German
    // division (9·2, engineers, recon) against the Polish one (9), one on
    // one: HOI4's single attack without readiness is about even.
    label: "German 9·2+eng+recon ×1 vs Polish inf 9 ×1, plains",
    expect: "close (HOI4: about even)",
    att: { tpl: "inf92", per: [1], gen: 1 },
    def: { tpl: "inf9", n: 1 },
    land: "plains",
    river: 0,
    fort: 0,
    entrench: 0,
    ok: (r) => Math.abs(r.attLossPm - r.defLossPm) <= 100,
  },
  {
    // Spec §9.10's version of the Maginot check: five attackers.
    label: "1940 German inf ×5 (2 ways) vs French 9·3 ×3, fort 5, entrench 5",
    expect: "defender wins",
    att: { tpl: "inf92", per: [3, 2], gen: 2 },
    def: { tpl: "inf93", n: 3 },
    land: "plains",
    river: 0,
    fort: 5,
    entrench: 5,
    ok: (r) => r.winner === "defender",
  },
  {
    label: "1940 German inf ×10 (2 ways) vs French 9·3 ×3, fort 5, entrench 5",
    expect: "defender wins",
    att: { tpl: "inf92", per: [5, 5], gen: 2 },
    def: { tpl: "inf93", n: 3 },
    land: "plains",
    river: 0,
    fort: 5,
    entrench: 5,
    ok: (r) => r.winner === "defender",
  },
];

/** A duel template as a country's own (beside its 1936 ones). */
function addTemplate(l: WwLand, smallID: number, key: DuelTemplate): number {
  const def = DUEL_TEMPLATES[key];
  const cl = l.country(smallID)!;
  const id = cl.nextTemplateId++;
  cl.templates.push({
    id,
    key: "",
    def: {
      name: key,
      battalions: [...def.battalions],
      support: [...def.support],
    },
  });
  return id;
}

function menOf(l: WwLand, ids: readonly number[]): number {
  let men = 0;
  for (const id of ids) {
    const r = l.divisions.rowOf(id);
    if (r >= 0) men += l.divisions.men[r];
  }
  return men;
}

/**
 * One duel: the pure preview (`predictAttack`, the engine's own call of
 * `predictBattle`) and the engine's battle, round by round, on the test
 * map. Germany (human) attacks Poland (human) on 1936-06-01, a clear day
 * in Warsaw and Krakow; the board is cleared and only the duel's
 * divisions stand. Two ways: Warsaw from Berlin and Munich; one way:
 * Krakow from Munich. The defended region takes the case's terrain, river
 * on the attacking edges, fort and entrenchment; supply is pinned at 1000,
 * no general, no readiness, no experience.
 */
async function runDuel(c: DuelCase): Promise<{
  real: DuelResult;
  pred: { ratioPm: number; days: number };
}> {
  const runner = await wwRunner({}, [
    { clientID: "HUMAN001", country: "DEU" },
    { clientID: "HUMAN002", country: "POL" },
  ]);
  const g = runner.game;
  stepTo(runner, dayStartTick(dayOfDate("1936-06-01"), WW_PREP_TICKS));
  step(runner, 2, [
    stamped("HUMAN001", {
      type: "declare_war",
      target: byTag(g, "POL").id(),
    }),
  ]);
  clearLand(g);
  const l = g.worldWar()!.land;
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  for (const id of [deu, pol]) {
    const ce = l.econ.country(id)!;
    for (let k = 0; k < ce.stock.length; k++) {
      // The attacker's generation only (1940: the second).
      const gen = EQUIP_KEYS[k][1];
      const want = id === deu ? c.att.gen : 1;
      if (gen === want) ce.stock[k] += 200_000;
    }
    ce.manpower += 2_000_000;
  }
  const twoWays = c.att.per.length > 1;
  const region = twoWays ? WARSAW : KRAKOW;
  const from = twoWays ? [BERLIN, MUNICH] : [MUNICH];
  // The case's ground: the region's terrain and the rivers into it.
  const sc = l.scenario as unknown as {
    landOf(r: number): LandTerrain;
  };
  const landOf = sc.landOf.bind(sc);
  sc.landOf = (r: number) => (r === region ? c.land : landOf(r));
  for (const e of l.scenario.edgesOf(region)) {
    if (from.includes(e.to)) {
      (l.scenario.edge(e.edge) as { river: number }).river = c.river;
    }
  }
  l.econ.fort[region] = c.fort;
  const attTpl = addTemplate(l, deu, c.att.tpl);
  const defTpl = addTemplate(l, pol, c.def.tpl);
  const attArmies: Army[] = c.att.per.map((n, i) =>
    placeArmy(g, "DEU", from[i], n, attTpl),
  );
  const defArmy = placeArmy(g, "POL", region, c.def.n, defTpl);
  const attIds = attArmies.flatMap((a) => [...a.divisions]);
  const defIds = [...defArmy.divisions];
  const t = l.divisions;
  for (const a of [...attArmies, defArmy]) {
    a.order = idleOrder();
    a.general = 0;
    a.planBp = 0;
  }
  for (const id of defIds) t.entrench[t.rowOf(id)] = c.entrench;
  const pin = () => {
    for (const id of [...attIds, ...defIds]) {
      const r = t.rowOf(id);
      if (r >= 0) t.supply[r] = 1000;
    }
  };
  pin();
  const pred = predictAttack(
    l,
    attIds.map((id) => t.rowOf(id)),
    region,
  );
  // The engine's battle: every attacker joins, then one round a tick.
  const attStart = menOf(l, attIds);
  const defStart = menOf(l, defIds);
  for (const id of attIds) joinBattle(l, id, region);
  const t0 = g.ticks();
  let rounds = 0;
  while (l.battles.has(region) && rounds < 2000) {
    pin();
    stepBattles(l, t0 + rounds);
    rounds++;
  }
  const standing = (ids: readonly number[], at: (r: number) => boolean) =>
    ids.filter((id) => {
      const r = t.rowOf(id);
      return r >= 0 && t.org[r] > 0 && t.mode[r] !== MOVE_RETREAT && at(r);
    }).length;
  const attLeft = standing(attIds, () => true);
  const defLeft = standing(defIds, (r) => t.region[r] === region);
  const winner: DuelResult["winner"] = l.battles.has(region)
    ? "none"
    : defLeft === 0 && attLeft > 0
      ? "attacker"
      : "defender";
  // The last round ends it; the battle closes on the next tick's check.
  const days = Math.round(((rounds - 1) * 2 * 10) / 15) / 10;
  return {
    real: {
      winner,
      days,
      attLossPm: Math.floor(((attStart - menOf(l, attIds)) * 1000) / attStart),
      defLossPm: Math.floor(((defStart - menOf(l, defIds)) * 1000) / defStart),
    },
    pred: { ratioPm: pred.ratioPm, days: pred.days },
  };
}

async function duels(): Promise<void> {
  const rows: string[][] = [];
  let fails = 0;
  for (const c of DUELS) {
    const { real, pred } = await runDuel(c);
    const ok = c.ok(real);
    if (!ok) fails++;
    rows.push([
      c.label,
      c.expect,
      `${(pred.ratioPm / 1000).toFixed(2)} / ${pred.days} d`,
      real.winner,
      `${real.days}`,
      `${(real.attLossPm / 10).toFixed(1)}%`,
      `${(real.defLossPm / 10).toFixed(1)}%`,
      ok ? "PASS" : "FAIL",
    ]);
  }
  console.log(
    formatTable(
      [
        "case",
        "expected",
        "preview ρ / days",
        "winner",
        "days",
        "att lost",
        "def lost",
        "",
      ],
      rows,
    ),
  );
  console.log(`\n${DUELS.length - fails}/${DUELS.length} duels as expected`);
}

// ---------------------------------------------------------------------------
// --game and --perf

const MAJORS: readonly CountryTag[] = [
  "DEU",
  "ITA",
  "JPN",
  "GBR",
  "FRA",
  "USA",
  "SUN",
];

/** Land parts --perf times (spec §17.3). */
const PARTS = [
  "common",
  "supply",
  "fronts",
  "sustain",
  "entrench",
  "ai",
  "orders",
  "movement",
  "battles",
  "recovery",
  "spread",
  "update",
] as const;
type Part = (typeof PARTS)[number];

interface GameRun {
  seed: string;
  /**
   * The day a country fell: it capitulated (P0 gauge) or lost its last
   * tile (a country conquered whole dies before its gauge fills).
   */
  capDay: Map<CountryTag, number>;
  /** The fallen that died rather than capitulated. */
  conquered: Set<CountryTag>;
  /** The day each watched war began. */
  warDay: Map<string, number>;
  checks: { label: string; value: string; ok: boolean | null }[];
  divs: Map<string, number>;
  tickMs: number[];
  landMs: number[];
  parts: Record<Part, number>;
  partMax: Record<Part, number>;
  ticks: number;
  hash: number;
}

function startInfo(seed: string): GameStartInfo {
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
      historicalAi: true,
    },
    players: [],
  };
}

/**
 * WwLand.tick with a timer around each part (perf mode). It must stay the
 * same sequence as WwLand.tick and dailyCountry; the run prints the final
 * hash so a game and a perf run of one seed can be compared.
 */
function timedLandTick(
  land: WwLand,
  parts: Record<Part, number>,
  partMax: Record<Part, number>,
) {
  const l = land as unknown as {
    ww: WorldWar;
    lastCommonDay: number;
    sideListCache: { rep: number; key: number }[];
    countryList: unknown[];
    dailyCommon(): void;
    markCountry(id: number): void;
    mg: Game;
  };
  const tickAcc: Record<Part, number> = Object.fromEntries(
    PARTS.map((p) => [p, 0]),
  ) as Record<Part, number>;
  const time = (p: Part, f: () => void) => {
    const a = performance.now();
    f();
    tickAcc[p] += performance.now() - a;
  };
  return (ticks: number) => {
    for (const p of PARTS) tickAcc[p] = 0;
    const ww = l.ww;
    const prep = ww.inPrep(ticks);
    if (!prep) {
      const day = ww.day(ticks);
      if (day !== l.lastCommonDay) {
        l.lastCommonDay = day;
        time("common", () => l.dailyCommon());
      }
      const k = ticks - dayStartTick(day, ww.prepEndTick());
      if (k >= 0 && k < WW_DAY_SPLIT) {
        time("supply", () => {
          for (const side of l.sideListCache) {
            if (side.rep % WW_DAY_SPLIT === k) dailySupply(land, side.key);
          }
        });
        for (let id = 1; id < l.countryList.length; id++) {
          if (id % WW_DAY_SPLIT !== k) continue;
          const cl = land.country(id);
          const p = l.mg.playerBySmallID(id);
          if (
            cl === null ||
            !p.isPlayer() ||
            !p.isAlive() ||
            ww.isCapitulated(id)
          ) {
            continue;
          }
          let divisions = 0;
          for (const a of land.armiesOf(id)) divisions += a.divisions.length;
          if (divisions > cl.peakDivisions) cl.peakDivisions = divisions;
          time("fronts", () => dailyFronts(land, id, day));
          time("sustain", () => dailySustain(land, id, day));
          time("entrench", () => dailyEntrench(land, id));
          if (
            p.type() !== PlayerType.Human ||
            land.armiesOf(id).some((a) => a.auto)
          ) {
            time("ai", () => aiLandTick(land, id, day));
          }
          (p as Player).setTroops(land.fieldMen(id));
          l.markCountry(id);
        }
      }
    }
    time("orders", () => applyArmyOrders(land, ticks));
    time("movement", () => stepMovement(land, ticks));
    if (!prep) time("battles", () => stepBattles(land, ticks));
    time("recovery", () => stepRecovery(land));
    if (!prep) time("spread", () => stepSpread(land));
    for (const p of PARTS) {
      parts[p] += tickAcc[p];
      if (tickAcc[p] > partMax[p]) partMax[p] = tickAcc[p];
    }
  };
}

/** Countries whose lost homeland share --game reports (their colonies hold most of their points). */
const CORE_WATCH: readonly CountryTag[] = ["FRA", "BEL", "NLD", "POL"];

const CSV_HEAD = [
  "day",
  "date",
  "tag",
  "divisions",
  "fieldMen",
  "trainingMen",
  "casualties",
  "regions",
  "battles",
  "capitulated",
  "tickMs",
  "landMs",
].join(",");

/** One line per army of a traced country (--trace … --armies). */
function armyLines(land: WwLand, tag: CountryTag): string[] {
  const sc = land.scenario;
  const id = sc.smallIdOf(tag);
  const name = (r: number) => sc.region(r)?.name ?? `${r}`;
  const t = land.divisions;
  return land.armiesOf(id).map((a) => {
    const rows = a.divisions.map((d) => t.rowOf(d)).filter((r) => r >= 0);
    let org = 0;
    let max = 0;
    let fighting = 0;
    let moving = 0;
    for (const r of rows) {
      org += t.org[r];
      max += land.orgMaxOf(r);
      if (t.battle[r] !== 0) fighting++;
      if (t.mode[r] !== 0) moving++;
    }
    const o = a.order;
    const what =
      o.kind === "plan"
        ? `plan${o.executing ? "*" : ""}(${o.stance[0]}) → ${o.targets.map(name).join(",")}`
        : o.kind === "front"
          ? `front vs ${o.enemy === 0 ? "all" : sc.tagOfSmallId(o.enemy)}`
          : o.kind === "move"
            ? `move → ${name(o.to)}`
            : o.kind;
    return `      #${a.id} ${rows.length}d at ${name(land.armyRegion(a))} ${what} | front ${a.front.length} | org ${max === 0 ? 0 : Math.floor((org * 100) / max)}% ready ${a.planBp} | fight ${fighting} move ${moving}${a.general === 0 ? "" : " G"}`;
  });
}

/** One line per traced country (--trace): what limits its army and its war. */
function traceLine(land: WwLand, ww: WorldWar, tag: CountryTag): string {
  const sc = land.scenario;
  const id = sc.smallIdOf(tag);
  const cl = land.country(id);
  const ce = land.econ.country(id);
  if (cl === null || ce === null) return `${tag} -`;
  const stock: Record<string, number> = {};
  EQUIP_KEYS.forEach(([type], i) => {
    stock[type] = (stock[type] ?? 0) + ce.stock[i];
  });
  let trainingDivs = cl.trainees.length;
  for (const e of cl.training) trainingDivs += e.remaining;
  const first = cl.templates[0];
  const s = first === undefined ? null : land.templateStatsOf(id, first.id);
  let low = 1000;
  let lowType = "-";
  if (s !== null) {
    s.need.forEach((n, i) => {
      if (n <= 0) return;
      const f = Math.floor((stock[EQUIPMENT_TYPES[i]] * 1000) / n);
      if (f < low) {
        low = f;
        lowType = EQUIPMENT_TYPES[i].replace("_equipment", "");
      }
    });
  }
  const t = land.divisions;
  let divs = 0;
  let org = 0;
  let orgMax = 0;
  let supply = 0;
  let inBattle = 0;
  let enc = 0;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0 || t.owner[r] !== id) continue;
    divs++;
    org += t.org[r];
    orgMax += land.orgMaxOf(r);
    supply += t.supply[r];
    if (t.battle[r] !== 0) inBattle++;
    if (t.encircled[r] !== 0) enc++;
  }
  const orders = new Map<string, number>();
  for (const a of land.armiesOf(id)) {
    const k =
      a.order.kind === "plan"
        ? a.order.executing
          ? "plan*"
          : "plan"
        : a.order.kind;
    orders.set(k, (orders.get(k) ?? 0) + 1);
  }
  let vp = 0;
  for (const r of sc.landRegions) if (land.controller[r.id] === id) vp += r.vp;
  const k = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : `${n}`);
  return [
    `${tag}${ww.isCapitulated(id) ? "†" : ""}`,
    `divs ${divs}+${trainingDivs}`,
    `mp ${k(ce.manpower)}`,
    `inf ${k(stock.infantry_equipment)} sup ${k(stock.support_equipment)} art ${k(stock.artillery)}`,
    `fill ${low}${lowType}`,
    `org ${orgMax === 0 ? 0 : Math.floor((org * 100) / orgMax)}%`,
    `sup ${divs === 0 ? 0 : Math.floor(supply / divs)}`,
    `battle ${inBattle} enc ${enc}`,
    `vp ${vp}/${ww.startVp(id)} g${ww.capitulationGauge(id)}`,
    [...orders].map(([o, n]) => `${o}:${n}`).join(" "),
  ].join(" | ");
}

async function playGame(
  seed: string,
  until: string,
  outDir: string | null,
  perf: boolean,
  trace: {
    tags: readonly CountryTag[];
    every: number;
    from: number;
    armies: boolean;
  } = {
    tags: [],
    every: 30,
    from: 0,
    armies: false,
  },
): Promise<GameRun> {
  const files = await loadMapFiles(
    new NodeGameMapLoader(path.join(ROOT, "resources/maps")),
    GameMapType.World1936,
    GameMapSize.Normal,
  );
  const runner: GameRunner = await createGameRunner(
    startInfo(seed),
    undefined,
    files,
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  const g = runner.game;
  const ww = g.worldWar()!;
  const land = ww.land;
  const sc = land.scenario;
  const tags = sc.countries as readonly CountryTag[];
  const idOf = (t: CountryTag) => sc.smallIdOf(t);
  // Casualties per country and day (noteCasualties is the one way in).
  const casualties = new Array<number>(tags.length + 1).fill(0);
  const note = land.noteCasualties.bind(land);
  land.noteCasualties = (smallID, lost, dead) => {
    casualties[smallID] += lost;
    note(smallID, lost, dead);
  };
  // The land war's share of each tick (and its parts in perf mode).
  const parts = Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<
    Part,
    number
  >;
  const partMax = { ...parts };
  let landAcc = 0;
  if (perf) {
    const timed = timedLandTick(land, parts, partMax);
    land.tick = (ticks: number) => {
      const a = performance.now();
      timed(ticks);
      landAcc += performance.now() - a;
    };
    const take = land.takeData.bind(land);
    land.takeData = () => {
      const a = performance.now();
      const d = take();
      const t = performance.now() - a;
      parts.update += t;
      if (t > partMax.update) partMax.update = t;
      landAcc += t;
      return d;
    };
  } else {
    const tick = land.tick.bind(land);
    land.tick = (ticks: number) => {
      const a = performance.now();
      tick(ticks);
      landAcc += performance.now() - a;
    };
  }
  const prepEnd = ww.prepEndTick();
  const lastDay = dayOfDate(until);
  const endTick = dayStartTick(lastDay + 1, prepEnd);
  const csv: string[] = [CSV_HEAD];
  const run: GameRun = {
    seed,
    capDay: new Map(),
    conquered: new Set(),
    warDay: new Map(),
    checks: [],
    divs: new Map(),
    tickMs: [],
    landMs: [],
    parts,
    partMax,
    ticks: 0,
    hash: 0,
  };
  const watchedWars: [CountryTag, CountryTag][] = [
    ["DEU", "POL"],
    ["DEU", "FRA"],
    ["DEU", "BEL"],
    ["DEU", "NLD"],
    ["DEU", "SUN"],
    ["JPN", "CHN"],
    ["ESN", "ESR"],
    ["ITA", "ETH"],
  ];
  const axis = new Set(
    tags.filter((t) => COUNTRIES[t].faction === "axis").map(idOf),
  );
  const sunStartVp = sc.landRegions
    .filter((r) => r.owner === "SUN")
    .map((r) => r.id);
  const regionByName = (name: string) =>
    sc.landRegions.find((r) => r.name === name)!.id;
  const MOSCOW = regionByName("Moskva");
  const BEIJING = regionByName("Beijing");
  const SHANGHAI = regionByName("Shanghai");
  const snapshotDays = new Map<number, string>([
    [dayOfDate("1936-09-30"), "1936-09-30"],
    [dayOfDate("1939-01-01"), "1939-01-01"],
    [dayOfDate("1939-09-01"), "1939-09-01"],
    [dayOfDate("1940-01-01"), "1940-01-01"],
    [dayOfDate("1940-05-10"), "1940-05-10"],
    [dayOfDate("1941-06-22"), "1941-06-22"],
    [dayOfDate("1941-12-07"), "1941-12-07"],
    [dayOfDate("1941-12-31"), "1941-12-31"],
    [dayOfDate("1942-06-30"), "1942-06-30"],
  ]);
  const at = new Map<string, Record<string, number>>();
  let dayTickMs = 0;
  let dayLandMs = 0;
  let dayTicks = 0;
  let prevDay = -1;
  const t0 = performance.now();
  while (g.ticks() < endTick) {
    runner.addTurn({ turnNumber: g.ticks(), intents: [] });
    const before = landAcc;
    const a = performance.now();
    if (!runner.executeNextTick()) {
      console.log(`stopped at tick ${g.ticks()}`);
      break;
    }
    const tickMs = performance.now() - a;
    if (g.ticks() > prepEnd) {
      run.tickMs.push(tickMs);
      run.landMs.push(landAcc - before);
      dayTickMs += tickMs;
      dayLandMs += landAcc - before;
      dayTicks++;
    }
    const day = ww.day(g.ticks());
    if (day === prevDay) continue;
    prevDay = day;
    const done = day - 1;
    if (done < 0) continue;
    // The day `done` is complete.
    for (const [x, y] of watchedWars) {
      const key = `${x}-${y}`;
      if (!run.warDay.has(key) && ww.isAtWar(idOf(x), idOf(y))) {
        run.warDay.set(key, done);
      }
    }
    for (const t of tags) {
      const id = idOf(t);
      if (run.capDay.has(t)) continue;
      if (ww.isCapitulated(id)) {
        run.capDay.set(t, done);
      } else if (ww.startVp(id) > 0 && !ww.playerOfTag(t)?.isAlive()) {
        run.capDay.set(t, done);
        run.conquered.add(t);
      }
    }
    const divs = new Array<number>(tags.length + 1).fill(0);
    const men = new Array<number>(tags.length + 1).fill(0);
    const battles = new Array<Set<number>>(tags.length + 1);
    const t = land.divisions;
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] === 0) continue;
      const o = t.owner[r];
      divs[o]++;
      men[o] += t.men[r];
      if (t.battle[r] !== 0) (battles[o] ??= new Set()).add(t.battle[r]);
    }
    const regions = new Array<number>(tags.length + 1).fill(0);
    for (const r of sc.landRegions) regions[land.controller[r.id]]++;
    const date = formatIsoDate(dateOfDay(done));
    if (outDir !== null) {
      for (let id = 1; id <= tags.length; id++) {
        csv.push(
          [
            done,
            date,
            tags[id - 1],
            divs[id],
            men[id],
            land.trainingMen(id),
            casualties[id],
            regions[id],
            battles[id]?.size ?? 0,
            ww.isCapitulated(id) ? 1 : 0,
            dayTicks === 0 ? 0 : (dayTickMs / dayTicks).toFixed(3),
            dayTicks === 0 ? 0 : (dayLandMs / dayTicks).toFixed(3),
          ].join(","),
        );
      }
    }
    if (
      trace.tags.length > 0 &&
      done >= trace.from &&
      (done - trace.from) % trace.every === 0
    ) {
      console.log(`-- ${date} battles ${land.battles.size}`);
      for (const tag of trace.tags) {
        console.log(
          `   ${traceLine(land, ww, tag)} | cas ${casualties[idOf(tag)]}`,
        );
        if (trace.armies) for (const l of armyLines(land, tag)) console.log(l);
      }
    }
    casualties.fill(0);
    dayTickMs = 0;
    dayLandMs = 0;
    dayTicks = 0;
    const label = snapshotDays.get(done);
    if (label !== undefined) {
      const rec: Record<string, number> = {};
      for (const m of MAJORS) rec[m] = divs[idOf(m)];
      let held = 0;
      let total = 0;
      for (const id of sunStartVp) {
        const vp = sc.landRegions.find((r) => r.id === id)!.vp;
        total += vp;
        if (axis.has(land.controller[id])) held += vp;
      }
      rec.axisSunVpPm = total === 0 ? 0 : Math.floor((held * 1000) / total);
      rec.moscowSun = land.controller[MOSCOW] === idOf("SUN") ? 1 : 0;
      rec.beijingJpn = land.controller[BEIJING] === idOf("JPN") ? 1 : 0;
      rec.shanghaiJpn = land.controller[SHANGHAI] === idOf("JPN") ? 1 : 0;
      rec.battles = land.battles.size;
      // The share of a country's core (homeland) points others hold:
      // colonies weigh in its surrender line, not here.
      for (const tag of CORE_WATCH) {
        const id = idOf(tag);
        let held = 0;
        let total = 0;
        for (const r of sc.landRegions) {
          if (r.owner !== tag || !r.core) continue;
          total += r.vp;
          const c = land.controller[r.id];
          if (c !== id && !land.sameSide(id, c)) held += r.vp;
        }
        rec[`core${tag}`] = total === 0 ? 0 : Math.floor((held * 1000) / total);
      }
      at.set(label, rec);
      const secs = ((performance.now() - t0) / 1000).toFixed(0);
      console.log(
        `[${seed}] ${label} (tick ${g.ticks()}, ${secs} s): ${MAJORS.map((m) => `${m} ${rec[m]}`).join(", ")}; battles ${rec.battles}; fallen ${[...run.capDay.keys()].join(" ") || "-"}`,
      );
    }
  }
  run.ticks = g.ticks();
  run.hash = (g as unknown as { hash(): number }).hash();
  if (outDir !== null) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${seed}.csv`), csv.join("\n") + "\n");
  }
  for (const [label, rec] of at) {
    for (const m of MAJORS) run.divs.set(`${label} ${m}`, rec[m]);
  }
  // --- The expectations (spec §19.3 and the controller's Task 11 targets).
  const cap = (t: CountryTag) => run.capDay.get(t);
  const iso = (d: number | undefined) =>
    d === undefined ? "never" : formatIsoDate(dateOfDay(d));
  const add = (label: string, value: string, ok: boolean | null) =>
    run.checks.push({ label, value, ok });
  const end = lastDay;
  const by = (date: string) => dayOfDate(date) <= end;
  if (by("1936-09-30")) {
    const d = cap("ETH");
    add(
      "ETH capitulates before 1936-09-30",
      iso(d),
      d !== undefined && d < dayOfDate("1936-09-30"),
    );
  }
  if (by("1940-12-31")) {
    const d = cap("ESN") ?? cap("ESR");
    const who = cap("ESN") !== undefined ? "ESN" : "ESR";
    add(
      "Spanish civil war ends 1937–1940",
      d === undefined ? "never" : `${who} ${iso(d)}`,
      d !== undefined &&
        d >= dayOfDate("1937-01-01") &&
        d <= dayOfDate("1940-12-31"),
    );
  }
  const polWar = run.warDay.get("DEU-POL");
  if (by("1939-12-31")) {
    const d = cap("POL");
    const after =
      d === undefined || polWar === undefined ? undefined : d - polWar;
    add(
      "POL falls war + 25..75 days (spec)",
      `${iso(d)} (+${after ?? "?"})`,
      after !== undefined && after >= 25 && after <= 75,
    );
    add(
      "POL falls Sep–Oct 1939 ±1 month (controller)",
      iso(d),
      d !== undefined &&
        d >= dayOfDate("1939-08-01") &&
        d <= dayOfDate("1939-11-30"),
    );
  }
  if (by("1939-12-31")) {
    const d = cap("FRA");
    add(
      "FRA holds through 1939",
      iso(d),
      d === undefined || d > dayOfDate("1939-12-31"),
    );
  }
  const fraWar = run.warDay.get("DEU-FRA");
  if (by("1940-12-31")) {
    const d = cap("FRA");
    const start = dayOfDate("1940-05-10");
    add(
      "FRA falls 1940-05-10 + 30..120 days (spec)",
      iso(d),
      d !== undefined && d >= start + 30 && d <= start + 120,
    );
    const bel = cap("BEL");
    const nld = cap("NLD");
    add(
      "BEL and NLD fall before FRA",
      `BEL ${iso(bel)}, NLD ${iso(nld)}`,
      bel !== undefined &&
        nld !== undefined &&
        (d === undefined || (bel <= d && nld <= d)),
    );
    void fraWar;
  }
  const coreAt = (date: string, tag: CountryTag) =>
    at.get(date)?.[`core${tag}`];
  for (const date of ["1940-01-01", "1941-06-22"]) {
    const v = coreAt(date, "FRA");
    if (v === undefined) continue;
    add(
      `FRA homeland lost on ${date}`,
      `${(v / 10).toFixed(0)}% (BEL ${((coreAt(date, "BEL") ?? 0) / 10).toFixed(0)}%, NLD ${((coreAt(date, "NLD") ?? 0) / 10).toFixed(0)}%)`,
      null,
    );
  }
  if (by("1939-01-01")) {
    const d = cap("JPN");
    add(
      "JPN not capitulated by 1939",
      iso(d),
      d === undefined || d > dayOfDate("1939-01-01"),
    );
  }
  for (const [label, date] of [
    ["DEU divisions 1939-09-01 (> 40)", "1939-09-01"],
    ["DEU divisions 1940-05-10 (> 40)", "1940-05-10"],
  ] as const) {
    const rec = at.get(date);
    if (rec !== undefined) add(label, `${rec.DEU}`, rec.DEU > 40);
  }
  const dec41 = at.get("1941-12-31");
  if (dec41 !== undefined) {
    add(
      "1941-12-31 Axis holds 25–60% of SUN's VP",
      `${(dec41.axisSunVpPm / 10).toFixed(1)}%`,
      dec41.axisSunVpPm >= 250 && dec41.axisSunVpPm <= 600,
    );
    add(
      "1941-12-31 Moscow Soviet (2 of 3 seeds)",
      dec41.moscowSun === 1 ? "SUN" : "lost",
      null,
    );
    const d = cap("SUN");
    add(
      "SUN survives 1941",
      iso(d),
      d === undefined || d > dayOfDate("1941-12-31"),
    );
  }
  const jun42 = at.get("1942-06-30");
  if (jun42 !== undefined) {
    const d = cap("SUN");
    add(
      "SUN not capitulated 1942-06-30",
      iso(d),
      d === undefined || d > dayOfDate("1942-06-30"),
    );
  }
  const dec7 = at.get("1941-12-07");
  if (dec7 !== undefined) {
    const d = cap("CHN");
    add(
      "1941-12-07 CHN stands",
      iso(d),
      d === undefined || d > dayOfDate("1941-12-07"),
    );
    add(
      "1941-12-07 JPN holds Beijing and Shanghai",
      `Beijing ${dec7.beijingJpn ? "JPN" : "no"}, Shanghai ${dec7.shanghaiJpn ? "JPN" : "no"}`,
      dec7.beijingJpn === 1 && dec7.shanghaiJpn === 1,
    );
  }
  const sortedLand = [...run.landMs].sort((x, y) => x - y);
  const avgLand =
    run.landMs.reduce((s, x) => s + x, 0) / Math.max(1, run.landMs.length);
  add(
    "land tick avg ≤ 1.5 ms, p99 ≤ 6 ms",
    `${ms(avgLand)} / ${ms(pct(sortedLand, 0.99))}`,
    avgLand <= 1.5 && pct(sortedLand, 0.99) <= 6,
  );
  return run;
}

function printRun(run: GameRun): void {
  console.log(`\n== ${run.seed} (ticks ${run.ticks}, hash ${run.hash}) ==`);
  const caps = [...run.capDay]
    .sort((a, b) => a[1] - b[1])
    .map(
      ([t, d]) =>
        `${t}${run.conquered.has(t) ? "✝" : ""} ${formatIsoDate(dateOfDay(d))}`,
    );
  console.log(`fallen (✝: conquered whole): ${caps.join(", ") || "none"}`);
  const wars = [...run.warDay].map(
    ([k, d]) => `${k} ${formatIsoDate(dateOfDay(d))}`,
  );
  console.log(`wars: ${wars.join(", ")}`);
  console.log(
    formatTable(
      ["check", "value", ""],
      run.checks.map((c) => [
        c.label,
        c.value,
        c.ok === null ? "" : c.ok ? "PASS" : "FAIL",
      ]),
    ),
  );
}

function printPerf(run: GameRun): void {
  const sortedTick = [...run.tickMs].sort((a, b) => a - b);
  const sortedLand = [...run.landMs].sort((a, b) => a - b);
  const avg = (xs: readonly number[]) =>
    xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  console.log(
    formatTable(
      ["", "avg", "p50", "p99", "max", "budget (avg / p99 / max)"],
      [
        [
          "whole tick",
          ms(avg(run.tickMs)),
          ms(pct(sortedTick, 0.5)),
          ms(pct(sortedTick, 0.99)),
          ms(sortedTick[sortedTick.length - 1] ?? 0),
          "- / 15 / 50",
        ],
        [
          "land war",
          ms(avg(run.landMs)),
          ms(pct(sortedLand, 0.5)),
          ms(pct(sortedLand, 0.99)),
          ms(sortedLand[sortedLand.length - 1] ?? 0),
          "1.5 / 6 / 30",
        ],
      ],
    ),
  );
  const n = Math.max(1, run.landMs.length);
  const budget: Partial<Record<Part, string>> = {
    movement: "0.2",
    battles: "0.5",
    recovery: "0.1",
    spread: "0.2 (1.5 worst)",
    update: "0.2",
  };
  console.log(
    formatTable(
      ["part", "avg ms/tick", "max ms", "budget avg"],
      PARTS.map((p) => [
        p,
        (run.parts[p] / n).toFixed(3),
        ms(run.partMax[p]),
        budget[p] ?? "",
      ]),
    ),
  );
  const daily =
    (run.parts.common +
      run.parts.supply +
      run.parts.fronts +
      run.parts.sustain +
      run.parts.entrench +
      run.parts.ai) /
    n;
  console.log(
    `daily share (common + supply + countries): ${daily.toFixed(3)} ms/tick (budget 0.8)`,
  );
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  for (const [tag, pct] of Object.entries(opts.surrender)) {
    (COUNTRIES[tag as CountryTag] as { surrenderPct: number }).surrenderPct =
      pct;
    console.log(`surrender line of ${tag}: ${pct}%`);
  }
  if (opts.mode === "duel") {
    await duels();
    return;
  }
  const runs: GameRun[] = [];
  for (const seed of opts.seeds) {
    const run = await playGame(
      seed,
      opts.until,
      opts.mode === "game" ? path.resolve(ROOT, opts.out) : null,
      opts.mode === "perf",
      {
        tags: opts.trace,
        every: opts.every,
        from: dayOfDate(opts.from),
        armies: opts.armies,
      },
    );
    runs.push(run);
    printRun(run);
    if (opts.mode === "perf") printPerf(run);
  }
  if (runs.length > 1) {
    const moscow = runs.filter((r) =>
      r.checks.some(
        (c) => c.label.startsWith("1941-12-31 Moscow") && c.value === "SUN",
      ),
    ).length;
    console.log(
      `\nMoscow Soviet on 1941-12-31 in ${moscow} of ${runs.length} seeds (spec: 2 of 3)`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
