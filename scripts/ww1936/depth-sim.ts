/**
 * World War 1936 P6 depth balance and performance check (P6 spec §25.3,
 * §22.1; plan Task 22 Step 1). The same games as P5's endgame-sim — it
 * plugs into that game loop (SimExtension) instead of copying it — plus
 * the depth systems:
 *
 *   npx tsx scripts/ww1936/depth-sim.ts [--seeds 20 | --seeds WWEND001,…]
 *       [--no-history] [--until 1945-08-21] [--out .cache/depth-sim]
 *       [--jobs 4]
 *   npx tsx scripts/ww1936/depth-sim.ts --perf [--seed WWEND001]
 *   npx tsx scripts/ww1936/depth-sim.ts --summary [--out …]
 *
 * Every run writes `<out>/<seed>-<on|off>.json` and the endgame CSV with
 * these rows added (`date,kind,a,b,c,d,e`):
 *   dep     (daily, the majors) country, mastery levels (9 tracks),
 *           designs tank/plane/ship, MIO sizes (6 families),
 *           "energy‰ atomic-stock project‰…"
 *   crypto  (daily, the majors' rows) breaker>target, progress‰, broken 0/1, exploiting 0/1
 *   intel   (daily) mean intelligence level over the majors' ordered pairs, by domain
 *   coup    owner, target (a successful op_coup)
 *   nuke    owner, region, dropped|intercepted
 *   atomic  country (sp_atomic done)
 *   p6flag  region, what (Korea or Taiwan holds P6 data or was struck)
 * Then the final-balance brief's targets (P6 Task 22 Step 2 as ranges and
 * the open P5 targets), each with its value and PASS/OPEN.
 *
 * --perf: one game in this process, the depth parts of spec §22.1 timed
 * in thread CPU (means) and wall clock (p99, max).
 *
 * It only reports: tune the constants and AI weights by hand.
 */
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BUILDING_IDS,
  equipKey,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { dateOfDay, dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { mioSize } from "@openfront/engine-lib/ww1936/MioRules";
import {
  decryptedOwn,
  exploiting,
} from "@openfront/engine/ww1936/depth/Crypto";
import { trackLevels } from "@openfront/engine/ww1936/depth/Doctrine";
import { mioFundsOf } from "@openfront/engine/ww1936/depth/Mio";
import { projectEta } from "@openfront/engine/ww1936/depth/Projects";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { formatTable } from "../domestic-sim-report";
import {
  iso,
  median,
  Options,
  parseArgs,
  PerfStat,
  readResults,
  runBatch,
  runOne,
  RunResult,
  seedTable,
  SimContext,
  SimExtension,
  stat,
} from "./endgame-sim";

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), "../..");

const MAJORS: readonly CountryTag[] = [
  "DEU",
  "GBR",
  "FRA",
  "ITA",
  "USA",
  "SUN",
  "JPN",
  "CHN",
];
const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");
const ATOMIC_KEY = equipKey("atomic_bomb", 1);
const COAL = RESOURCE_IDS.indexOf("coal");
const T_INFANTRY = 0;
const T_ARMOR = 1;
const MIO_ARMOR = 2;

interface DepthResult {
  /** 1941-06-22: Germany's armour track level, the USSR's infantry track level. */
  deuArmor194106: number;
  sunInf194106: number;
  /** First day GBR broke DEU's codes itself (null: never). */
  gbrBreaksDeu: number | null;
  /** 1942-06-30: Germany's armour MIO size; the USA's MIO sizes (6). */
  deuArmorMio194206: number;
  usaMio194206: number[];
  /** Day each country completed sp_atomic. */
  atomicDone: Record<string, number>;
  /** At the end: the USA's atomic progress ‰ and days left at today's pace (-1 none). */
  usaAtomicEnd: { progressPm: number; daysLeft: number; done: boolean };
  /** 1940: mean energy ‰ (all days; Italy also on days without a German coal deal) and the minimum. */
  energy1940: Record<
    string,
    { mean: number; min: number; meanNoDeal?: number; daysNoDeal?: number }
  >;
  nukes: { day: number; owner: string; region: number; hit: boolean }[];
  coups: { day: number; owner: string; target: string }[];
  /** Korea/Taiwan: P6 data held or struck (first day of each). */
  p6flags: { day: number; region: number; what: string }[];
  /** Max atomic stock any country held, and who. */
  atomicStockMax: { tag: string; n: number };
  /**
   * Pol/Fra balance lane: every war pair that started with Germany, Poland
   * or France in it (WorldWar.setWar; `a` declared, or joined `b`'s war).
   */
  wars: { day: number; a: string; b: string; kind: string }[];
  /** The DEU–POL and DEU–FRA pairs' wars (daily): start, end (null: running at the end), and who was down when it ended. */
  pairs: Record<
    string,
    {
      start: number;
      end: number | null;
      foeDown: boolean;
      deuDown: boolean;
    }[]
  >;
}

type DepthRun = RunResult & { depth: DepthResult };

/** The depth sampler: one per run. */
function depthExtension(perfAcc: PerfAcc | null): SimExtension {
  let c!: SimContext;
  let d!: WwDepth;
  const majors: number[] = [];
  const noStrike = new Set<number>();
  const res: DepthResult = {
    deuArmor194106: -1,
    sunInf194106: -1,
    gbrBreaksDeu: null,
    deuArmorMio194206: -1,
    usaMio194206: [],
    atomicDone: {},
    usaAtomicEnd: { progressPm: 0, daysLeft: -1, done: false },
    energy1940: {},
    nukes: [],
    coups: [],
    p6flags: [],
    atomicStockMax: { tag: "-", n: 0 },
    wars: [],
    pairs: { POL: [], FRA: [] },
  };
  const flagged = new Set<string>();
  const flag = (day: number, region: number, what: string) => {
    const k = `${region}:${what}`;
    if (flagged.has(k)) return;
    flagged.add(k);
    res.p6flags.push({ day, region, what });
    c.row(day, "p6flag", region, what);
  };
  const d194106 = dayOfDate("1941-06-22");
  const d194206 = dayOfDate("1942-06-30");
  const y1940 = [dayOfDate("1940-01-01"), dayOfDate("1940-12-31")];
  const energy = new Map<string, number[]>();
  const energyNoDeal: number[] = [];
  return {
    start(ctx) {
      c = ctx;
      d = ctx.ww.depth;
      for (const t of MAJORS) majors.push(ctx.idOf(t));
      const pol = ctx.ww.politics;
      for (const g of ["korea_north", "korea_south", "taiwan"]) {
        for (const r of pol.content.groupIdx.get(g)?.regions ?? []) {
          noStrike.add(r);
        }
      }
      for (const r of ctx.ww.scenario.landRegions) {
        if (d.noStrike(r.id)) noStrike.add(r.id);
      }
      // Successful coups: the owner's "operation done" line for op_coup.
      const msg = d.message.bind(d);
      d.message = (to, key, params = {}) => {
        if (
          key === "ww1936_operation_done" &&
          params.op === "op_coup" &&
          ctx.tagOf(to) !== params.countryTag
        ) {
          const day = ctx.today();
          res.coups.push({
            day,
            owner: ctx.tagOf(to),
            target: String(params.countryTag),
          });
          ctx.row(day, "coup", ctx.tagOf(to), String(params.countryTag));
        }
        if (key === "ww1936_nuke_intercepted" && params.region !== undefined) {
          // Told to the owner first, then the victim: one entry per drop.
          const day = ctx.today();
          const region = Number(params.region);
          const last = res.nukes[res.nukes.length - 1];
          if (
            last === undefined ||
            last.day !== day ||
            last.region !== region ||
            last.hit
          ) {
            res.nukes.push({ day, owner: ctx.tagOf(to), region, hit: false });
            ctx.row(day, "nuke", ctx.tagOf(to), region, "intercepted");
          }
        }
        msg(to, key, params);
      };
      const news = d.news.bind(d);
      d.news = (id, params) => {
        if (id === "news_nuke_dropped") {
          const day = ctx.today();
          const owner = String(params.countryTag);
          const region = Number(params.region);
          res.nukes.push({ day, owner, region, hit: true });
          ctx.row(day, "nuke", owner, region, "dropped");
        }
        news(id, params);
      };
      const fx = d.addFx.bind(d);
      d.addFx = (f) => {
        if (noStrike.has(f.region)) flag(ctx.today(), f.region, `fx ${f.kind}`);
        fx(f);
      };
      // Pol/Fra lane: the war pairs with Germany, Poland or France in them.
      const watch = new Set(
        ["DEU", "POL", "FRA"].map((t) => ctx.idOf(t as CountryTag)),
      );
      const ww = ctx.ww;
      const setWar = ww.setWar.bind(ww);
      ww.setWar = (a, b, tick, link) => {
        const ok = setWar(a, b, tick, link);
        if (ok && (watch.has(a) || watch.has(b))) {
          const day = ctx.today();
          const kind = link?.kind ?? "declare";
          res.wars.push({ day, a: ctx.tagOf(a), b: ctx.tagOf(b), kind });
          ctx.row(day, "war", ctx.tagOf(a), ctx.tagOf(b), kind);
        }
        return ok;
      };
      if (perfAcc !== null) timeDepth(d, perfAcc);
    },
    tick() {
      if (perfAcc !== null) perfAcc.endTick();
    },
    day(done) {
      const ww = c.ww;
      const econ = ww.economy;
      // ---- the majors' daily rows ----
      for (const id of majors) {
        const cd = d.country(id);
        if (cd === null || !ww.isActor(id)) continue;
        const lv = trackLevels(cd);
        const des = (["tank", "plane", "ship"] as const).map(
          (k) => cd.des[k].filter((s) => s !== null).length,
        );
        const mio = cd.mio.arch.map((_, f) => mioSize(mioFundsOf(cd, f)));
        const stock = econ.country(id)?.stock[ATOMIC_KEY] ?? 0;
        const proj = cd.proj.running
          .map((r) => `${r.project}:${Math.floor(r.progressMilli / 1000)}`)
          .join(";");
        c.row(
          done,
          "dep",
          c.tagOf(id),
          lv.join(" "),
          des.join("/"),
          mio.join(" "),
          `${cd.mech.energyPm} ${stock} ${proj}`,
        );
      }
      for (const r of d.decrypted) {
        if (!majors.includes(r.o) || !majors.includes(r.t)) continue;
        c.row(
          done,
          "crypto",
          `${c.tagOf(r.o)}>${c.tagOf(r.t)}`,
          Math.floor(r.progressMilli / 1000),
          decryptedOwn(d, r.o, r.t) ? 1 : 0,
          exploiting(d, r.o, r.t) ? 1 : 0,
        );
      }
      {
        const sum = [0, 0, 0, 0];
        let n = 0;
        for (const o of majors) {
          if (!ww.isActor(o)) continue;
          for (const t of majors) {
            if (t === o || !ww.isActor(t)) continue;
            for (let k = 0; k < 4; k++) sum[k] += d.intelOf(o, t, k);
            n++;
          }
        }
        if (n > 0) c.row(done, "intel", ...sum.map((s) => s / n));
      }
      // ---- the targets' readings ----
      const deu = c.idOf("DEU");
      const gbr = c.idOf("GBR");
      const usa = c.idOf("USA");
      const sun = c.idOf("SUN");
      const ita = c.idOf("ITA");
      if (done === d194106) {
        const cd = d.country(deu);
        const cs = d.country(sun);
        res.deuArmor194106 = cd === null ? -1 : trackLevels(cd)[T_ARMOR];
        res.sunInf194106 = cs === null ? -1 : trackLevels(cs)[T_INFANTRY];
      }
      if (res.gbrBreaksDeu === null && decryptedOwn(d, gbr, deu)) {
        res.gbrBreaksDeu = done;
      }
      if (done === d194206) {
        const cd = d.country(deu);
        res.deuArmorMio194206 =
          cd === null ? -1 : mioSize(mioFundsOf(cd, MIO_ARMOR));
        const cu = d.country(usa);
        res.usaMio194206 =
          cu === null
            ? []
            : cu.mio.arch.map((_, f) => mioSize(mioFundsOf(cu, f)));
      }
      for (let id = 1; id < d.cap; id++) {
        const cd = d.country(id);
        if (cd === null) continue;
        const tag = c.tagOf(id);
        if (
          res.atomicDone[tag] === undefined &&
          (cd.proj.done & (1 << ATOMIC)) !== 0
        ) {
          res.atomicDone[tag] = done;
          c.row(done, "atomic", tag);
        }
        const st = econ.country(id)?.stock[ATOMIC_KEY] ?? 0;
        if (st > res.atomicStockMax.n) res.atomicStockMax = { tag, n: st };
      }
      if (done >= y1940[0] && done <= y1940[1]) {
        for (const t of ["ITA", "GBR", "USA", "DEU"] as CountryTag[]) {
          const cd = d.country(c.idOf(t));
          if (cd === null) continue;
          let a = energy.get(t);
          if (a === undefined) energy.set(t, (a = []));
          a.push(cd.mech.energyPm);
        }
        const deal = econ
          .trades()
          .some(
            (tr) => tr.buyer === ita && tr.seller === deu && tr.res === COAL,
          );
        const ci = d.country(ita);
        if (!deal && ci !== null) energyNoDeal.push(ci.mech.energyPm);
      }
      // ---- Korea and Taiwan: no P6 data, never struck ----
      for (const r of noStrike) {
        const nb = BUILDING_IDS.length;
        for (let b = 0; b < nb; b++) {
          if ((econ.damage[r * nb + b] ?? 0) > 0) {
            flag(done, r, `damage ${BUILDING_IDS[b]}`);
          }
        }
        if (d.nuked.has(r)) flag(done, r, "nuked");
        if (d.resistBoostIndex.has(r)) flag(done, r, "resistBoost");
        if (d.regionStatusIndex.has(r)) flag(done, r, "regionStatus");
        if (d.facilityIndex.has(r)) flag(done, r, "facility");
      }
      const w = d.world;
      const tuples: [string, readonly (readonly number[])[]][] = [
        ["flood", w.floodUntil],
        ["scorchQueue", w.scorchQueue],
        ["scorched", w.scorchedUntil],
        ["harbor", w.harbors],
        ["exhausted", w.exhaustedUntil],
      ];
      for (const [name, rows] of tuples) {
        for (const t of rows) if (noStrike.has(t[0])) flag(done, t[0], name);
      }
      for (const g of w.railGuns) {
        if (noStrike.has(g[3])) flag(done, g[3], "railGun");
      }
      for (const q of d.nukeQueue) {
        if (noStrike.has(q.region)) flag(done, q.region, "nukeQueue");
      }
      for (const q of d.rocketQueue) {
        if (noStrike.has(q.target)) flag(done, q.target, "rocketQueue");
      }
      for (const q of d.raids) {
        if (noStrike.has(q.target)) flag(done, q.target, "raid");
      }
      // ---- Pol/Fra lane: the DEU–POL and DEU–FRA wars ----
      const eg = ww.endgame;
      const down = (id: number) =>
        ww.isCapitulated(id) ||
        eg.isExile(id) ||
        eg.countryState(id) !== "active";
      for (const t of ["POL", "FRA"] as CountryTag[]) {
        const x = c.idOf(t);
        const list = res.pairs[t];
        const open = list.length > 0 && list[list.length - 1].end === null;
        const war = ww.isAtWar(deu, x);
        if (war && !open) {
          list.push({ start: done, end: null, foeDown: false, deuDown: false });
        } else if (!war && open) {
          list[list.length - 1].end = done;
        }
        // Down while the war ran (an exile fights on: the pair stays at war).
        if (war || open) {
          const w = list[list.length - 1];
          w.foeDown ||= down(x);
          w.deuDown ||= down(deu);
        }
      }
    },
    end(run) {
      const usa = c.idOf("USA");
      const cu = d.country(usa);
      if (cu !== null) {
        const done = (cu.proj.done & (1 << ATOMIC)) !== 0;
        const r = cu.proj.running.find((x) => x.project === ATOMIC);
        res.usaAtomicEnd = {
          done,
          progressPm: done ? 1000 : Math.floor((r?.progressMilli ?? 0) / 1000),
          daysLeft:
            done || r === undefined ? -1 : projectEta(d, usa, r).daysLeft,
        };
      }
      for (const [t, xs] of energy) {
        res.energy1940[t] = {
          mean: xs.reduce((s, x) => s + x, 0) / xs.length,
          min: Math.min(...xs),
        };
      }
      if (res.energy1940.ITA !== undefined) {
        res.energy1940.ITA.daysNoDeal = energyNoDeal.length;
        res.energy1940.ITA.meanNoDeal =
          energyNoDeal.length === 0
            ? undefined
            : energyNoDeal.reduce((s, x) => s + x, 0) / energyNoDeal.length;
      }
      (run as DepthRun).depth = res;
      if (perfAcc !== null) {
        run.perf.parts = perfAcc.result();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// --perf: the depth parts of spec §22.1, per tick

const PARTS = [
  "depth (all)",
  "country turns",
  "day common",
  "sea region day (mines)",
  "air zone day",
  "land hooks",
  "update",
] as const;
type Part = (typeof PARTS)[number];

interface PerfAcc {
  endTick(): void;
  result(): Record<string, PerfStat>;
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

function makePerfAcc(): PerfAcc & {
  acc: Record<Part, number>;
  accW: Record<Part, number>;
} {
  const zero = () =>
    Object.fromEntries(PARTS.map((p) => [p, 0])) as Record<Part, number>;
  const acc = zero();
  const accW = zero();
  const ticks = Object.fromEntries(PARTS.map((p) => [p, [] as number[]]));
  const wall = Object.fromEntries(PARTS.map((p) => [p, [] as number[]]));
  return {
    acc,
    accW,
    endTick() {
      acc["depth (all)"] =
        acc["country turns"] +
        acc["day common"] +
        acc["sea region day (mines)"] +
        acc["air zone day"] +
        acc["land hooks"] +
        acc.update;
      accW["depth (all)"] =
        accW["country turns"] +
        accW["day common"] +
        accW["sea region day (mines)"] +
        accW["air zone day"] +
        accW["land hooks"] +
        accW.update;
      for (const p of PARTS) {
        ticks[p].push(acc[p]);
        wall[p].push(accW[p]);
        acc[p] = 0;
        accW[p] = 0;
      }
    },
    result() {
      return Object.fromEntries(PARTS.map((p) => [p, stat(ticks[p], wall[p])]));
    },
  };
}

/** Wraps the depth entry points the engine calls (instance methods). */
function timeDepth(d: WwDepth, a: PerfAcc): void {
  const p = a as ReturnType<typeof makePerfAcc>;
  const wrap = <K extends keyof WwDepth>(k: K, part: Part) => {
    const f = (d[k] as unknown as (...xs: unknown[]) => unknown).bind(d);
    (d as unknown as Record<string, unknown>)[k as string] = (
      ...xs: unknown[]
    ) => {
      const t0 = cpuNow();
      const w0 = performance.now();
      const v = f(...xs);
      p.acc[part] += cpuNow() - t0;
      p.accW[part] += performance.now() - w0;
      return v;
    };
  };
  wrap("countryTurn", "country turns");
  wrap("dayCommon", "day common");
  wrap("seaRegionDay", "sea region day (mines)");
  wrap("airZoneDay", "air zone day");
  for (const k of [
    "armyMods",
    "railGunHits",
    "planCutBp",
    "fortCut",
    "noteLandCombat",
    "noteNavalCombat",
    "noteSorties",
    "supplyPm",
    "moveCutPct",
  ] as const) {
    wrap(k, "land hooks");
  }
  wrap("takeData", "update");
}

// ---------------------------------------------------------------------------
// The targets (final-balance brief: P6 Task 22 Step 2 as ranges, open P5)

interface Check {
  target: string;
  value: string;
  ok: boolean;
}

const meanOf = (xs: number[]) =>
  xs.length === 0 ? NaN : xs.reduce((s, x) => s + x, 0) / xs.length;
const f1 = (x: number) => (Number.isNaN(x) ? "-" : x.toFixed(1));

function checksOn(rs: DepthRun[]): Check[] {
  const n = rs.length;
  const sc = (k: number) => Math.ceil((k * n) / 20);
  const count = (f: (r: DepthRun) => boolean) => rs.filter(f).length;
  const out: Check[] = [];
  // ---- P6 ----
  const arm = rs.map((r) => r.depth.deuArmor194106);
  const inf = rs.map((r) => r.depth.sunInf194106);
  const armOk = count(
    (r) => r.depth.deuArmor194106 >= 3 && r.depth.deuArmor194106 <= 5,
  );
  const infOk = count(
    (r) => r.depth.sunInf194106 >= 1 && r.depth.sunInf194106 <= 3,
  );
  out.push({
    target: "1941-06-22: DEU armour track L3-L5, SUN infantry L1-L3",
    value: `DEU [${arm.join(" ")}] in range ${armOk}/${n}; SUN [${inf.join(" ")}] in range ${infOk}/${n}`,
    ok: armOk >= sc(16) && infOk >= sc(16),
  });
  const y42 = dayOfDate("1942-12-31");
  const brk = rs.filter(
    (r) => r.depth.gbrBreaksDeu !== null && r.depth.gbrBreaksDeu <= y42,
  );
  out.push({
    target: `GBR breaks DEU's code by end-1942 in >= ${sc(12)}/${n}`,
    value: `${brk.length}/${n} (median ${iso(median(brk.map((r) => r.depth.gbrBreaksDeu!)))}; ever ${count((r) => r.depth.gbrBreaksDeu !== null)})`,
    ok: brk.length >= sc(12),
  });
  const mio = rs.map((r) => r.depth.deuArmorMio194206);
  const mioOk = count(
    (r) => r.depth.deuArmorMio194206 >= 5 && r.depth.deuArmorMio194206 <= 11,
  );
  const usa4 = rs.map((r) => r.depth.usaMio194206.filter((s) => s >= 4).length);
  const usaOk = usa4.filter((x) => x >= 3).length;
  out.push({
    target: "1942-06: DEU armour MIO size 5-11; USA >= 3 MIOs of size >= 4",
    value: `DEU [${mio.join(" ")}] in range ${mioOk}/${n}; USA MIOs >= 4: [${usa4.join(" ")}] ok ${usaOk}/${n}`,
    ok: mioOk >= sc(16) && usaOk >= sc(16),
  });
  const a0 = dayOfDate("1944-10-01");
  const a1 = dayOfDate("1946-06-30");
  const end = dayOfDate(rs[0]?.until ?? "1945-08-21");
  const usaDay = (r: DepthRun): number | null => {
    const d = r.depth.atomicDone.USA;
    if (d !== undefined) return d;
    const e = r.depth.usaAtomicEnd;
    return e.daysLeft >= 0 ? end + e.daysLeft : null;
  };
  const usaIn = rs.filter((r) => {
    const d = usaDay(r);
    return d !== null && d >= a0 && d <= a1;
  });
  const usaDone = count((r) => r.depth.atomicDone.USA !== undefined);
  out.push({
    target: `USA atomic bomb done 1944-10..1946-06 in >= ${sc(12)}/${n}`,
    value: `${usaIn.length}/${n} (done by the end ${usaDone}; days [${rs.map((r) => iso(usaDay(r))).join(" ")}]; progress at end [${rs.map((r) => r.depth.usaAtomicEnd.progressPm).join(" ")}])`,
    ok: usaIn.length >= sc(12),
  });
  const early = dayOfDate("1944-06-01");
  const earlyRuns = rs.filter((r) =>
    Object.values(r.depth.atomicDone).some((d) => d < early),
  );
  out.push({
    target: `Any atomic bomb done before 1944-06 in <= ${sc(1)}/${n}`,
    value: `${earlyRuns.length}/${n} (${earlyRuns
      .map(
        (r) =>
          `${r.seed}: ${Object.entries(r.depth.atomicDone)
            .map(([t, d]) => `${t} ${iso(d)}`)
            .join(", ")}`,
      )
      .join(" | ")})`,
    ok: earlyRuns.length <= sc(1),
  });
  const en = (t: string) =>
    rs
      .map((r) => r.depth.energy1940[t]?.mean)
      .filter((x): x is number => x !== undefined);
  const itaNo = rs
    .map((r) => r.depth.energy1940.ITA?.meanNoDeal)
    .filter((x): x is number => x !== undefined);
  const majorsOk = ["GBR", "USA", "DEU"].every(
    (t) => en(t).length > 0 && meanOf(en(t)) >= 950,
  );
  out.push({
    target:
      "1940 energy: ITA < 100% without a DEU coal deal; GBR, USA, DEU >= 95%",
    value: `ITA ${f1(meanOf(itaNo) / 10)}% (no-deal days, ${itaNo.length} seeds; all days ${f1(meanOf(en("ITA")) / 10)}%), GBR ${f1(meanOf(en("GBR")) / 10)}%, USA ${f1(meanOf(en("USA")) / 10)}%, DEU ${f1(meanOf(en("DEU")) / 10)}% (min ${["GBR", "USA", "DEU"].map((t) => Math.min(...rs.map((r) => r.depth.energy1940[t]?.min ?? 1000)) / 10).join("/")})`,
    ok: itaNo.length > 0 && meanOf(itaNo) < 1000 && majorsOk,
  });
  const nk = rs.map((r) => r.depth.nukes.filter((x) => x.hit).length);
  out.push({
    target: "Nukes dropped per game <= 3",
    value: `[${nk.join(" ")}] (intercepted [${rs.map((r) => r.depth.nukes.filter((x) => !x.hit).length).join(" ")}])`,
    ok: nk.every((x) => x <= 3),
  });
  // ---- open P5 ----
  const esn = count((r) => r.spain.winner === "ESN");
  out.push({
    target: `Spain: Nationalists win >= ${sc(8)}/${n}`,
    value: `${esn}/${n} (ESR ${count((r) => r.spain.winner === "ESR")}, none ${count((r) => r.spain.winner === null)})`,
    ok: esn >= sc(8),
  });
  const [s0, s1] = [dayOfDate("1937-06-01"), dayOfDate("1940-06-30")];
  const ends = rs
    .map((r) => r.spain.day)
    .filter((d): d is number => d !== null);
  const inWin = ends.filter((d) => d >= s0 && d <= s1).length;
  out.push({
    target: `Spain: ends 1937-06..1940-06 in >= ${sc(12)}/${n}`,
    value: `${inWin}/${n} (median end ${iso(median(ends))})`,
    ok: inWin >= sc(12),
  });
  const plBy = dayOfDate("1940-12-31");
  const plCaps = rs.filter(
    (r) => r.poland.capDay !== null && r.poland.capDay <= plBy,
  );
  out.push({
    target: `Poland: capitulates by 1940-12 in >= ${sc(12)}/${n}`,
    value: `${plCaps.length}/${n} (median ${iso(median(plCaps.map((r) => r.poland.capDay!)))})`,
    ok: plCaps.length >= sc(12),
  });
  const plAll = rs.filter((r) => r.poland.capDay !== null);
  const plEx = plAll.filter((r) => r.poland.exile).length;
  out.push({
    target: "Poland: exile in >= 60% of its capitulations",
    value: `${plEx}/${plAll.length}`,
    ok: plAll.length > 0 && plEx * 10 >= plAll.length * 6,
  });
  const frFalls = count(
    (r) => r.france.capDay !== null || r.france.vichyDay !== null,
  );
  out.push({
    target: `France falls in ${sc(6)}-${sc(16)}/${n}`,
    value: `${frFalls}/${n} (Vichy ${count((r) => r.france.vichyDay !== null)})`,
    ok: frFalls >= sc(6) && frFalls <= sc(16),
  });
  const deCaps = rs.filter((r) => r.germany.capDay !== null);
  out.push({
    target: `Germany capitulates in ${sc(6)}-${sc(18)}/${n}`,
    value: `${deCaps.length}/${n} (years ${deCaps.map((r) => dateOfDay(r.germany.capDay!).year).join(" ")})`,
    ok: deCaps.length >= sc(6) && deCaps.length <= sc(18),
  });
  // Pol/Fra lane (2026-10-29 brief): the 1940 collapse and France by 1941-06.
  const de40 = deCaps.filter((r) => r.germany.capDay! <= plBy);
  out.push({
    target: `Germany capitulates by 1940-12 in <= ${sc(3)}/${n}`,
    value: `${de40.length}/${n} (${de40.map((r) => iso(r.germany.capDay)).join(" ")})`,
    ok: de40.length <= sc(3),
  });
  const fr41 = dayOfDate("1941-06-30");
  const frBy = rs.filter((r) => {
    const d = Math.min(
      r.france.capDay ?? Infinity,
      r.france.vichyDay ?? Infinity,
    );
    return d <= fr41;
  });
  out.push({
    target: `France falls by 1941-06 in ${sc(6)}-${sc(16)}/${n}`,
    value: `${frBy.length}/${n}`,
    ok: frBy.length >= sc(6) && frBy.length <= sc(16),
  });
  out.push(pairCheck(rs, "POL"));
  const zoned = deCaps.filter((r) => r.germany.zones > 0).length;
  out.push({
    target: "Germany: occupation zones in >= 50% of its capitulations",
    value: `${zoned}/${deCaps.length}`,
    ok: deCaps.length === 0 || zoned * 2 >= deCaps.length,
  });
  const ex = rs.map((r) => r.exiles194112);
  const exMed = median(ex);
  out.push({
    target: "Exiles alive at 1941-12: median 1-6",
    value: `median ${exMed} [${ex.join(" ")}]`,
    ok: exMed >= 1 && exMed <= 6,
  });
  const occ = rs.map((r) => r.occ194206).filter((o) => o !== null);
  const fulM = meanOf(occ.map((o) => o.fulfilPct));
  out.push({
    target: "Occupation 1942-06: garrison fulfilment >= 50%",
    value: `${f1(fulM)}% over ${occ.length} seeds (resistance ${f1(meanOf(occ.map((o) => o.resPct)))}%)`,
    ok: occ.length > 0 && fulM >= 50,
  });
  const d4206 = dayOfDate("1942-06-30");
  const upr = rs.map((r) => r.uprisings.filter((u) => u.day <= d4206).length);
  out.push({
    target: "Uprisings to 1942-06: mean <= 8, no seed above 25",
    value: `mean ${f1(meanOf(upr))}, max ${Math.max(0, ...upr)} [${upr.join(" ")}] (whole game mean ${f1(meanOf(rs.map((r) => r.uprisings.length)))}, max ${Math.max(0, ...rs.map((r) => r.uprisings.length))})`,
    ok: meanOf(upr) <= 8 && upr.every((x) => x <= 25),
  });
  const qual: number[] = [];
  let qualSeeds = 0;
  for (const r of rs) {
    const ms = r.ll1942.months.filter((m) => m.usaWar || m.law);
    if (ms.length > 0) qualSeeds++;
    for (const m of ms) qual.push(m.inf);
  }
  out.push({
    target:
      "Lend-lease 1942 USA -> GBR+SUN >= 1,000/month (USA at war or LL law)",
    value: `mean ${Math.round(meanOf(qual))}/month over ${qual.length} months, ${qualSeeds}/${n} seeds; median ${Math.round(median(qual))}`,
    ok: qual.length > 0 && meanOf(qual) >= 1000,
  });
  const arcS = rs.reduce((s, r) => s + r.ll1942.arcticSent, 0);
  const arcA = rs.reduce((s, r) => s + r.ll1942.arcticArrived, 0);
  const arcLoss = arcS === 0 ? -1 : (100 * (arcS - arcA)) / arcS;
  out.push({
    target: "Lend-lease 1942: Arctic losses 3-35%",
    value:
      arcS === 0
        ? "no arctic shipments"
        : `${f1(arcLoss)}% of ${Math.round(arcS / 1000)}`,
    ok: arcS > 0 && arcLoss >= 3 && arcLoss <= 35,
  });
  const sigs = new Map<string, number>();
  for (const r of rs) sigs.set(r.signature, (sigs.get(r.signature) ?? 0) + 1);
  const top = Math.max(...sigs.values());
  out.push({
    target: `Variety: >= ${sc(6)} distinct world outcomes, none > ${sc(6)}/${n}`,
    value: `${sigs.size} distinct, largest ${top}`,
    ok: sigs.size >= sc(6) && top <= sc(6),
  });
  out.push(koreaCheck(rs));
  return out;
}

function koreaCheck(rs: DepthRun[]): Check {
  const bad = rs.filter(
    (r) =>
      r.sensitive.some((x) => !x.what.startsWith("taiwan legal CHN")) ||
      r.depth.p6flags.length > 0,
  );
  const tw = rs.filter((r) =>
    r.sensitive.some((x) => x.what.startsWith("taiwan legal CHN")),
  ).length;
  const what = bad
    .map(
      (r) =>
        `${r.seed}: ${[...r.sensitive.map((x) => x.what), ...r.depth.p6flags.map((x) => `${x.region} ${x.what}`)].join("; ")}`,
    )
    .join(" | ");
  return {
    target:
      "Korea/Taiwan: legal owner unchanged, no P6 data, never struck (daily)",
    value: `${bad.length}/${rs.length} flagged${tw > 0 ? ` (Taiwan to CHN by treaty: ${tw})` : ""}${bad.length > 0 ? ` (${what})` : ""}`,
    ok: bad.length === 0,
  };
}

/**
 * Pol/Fra lane: of the DEU–`foe` wars that lasted 90 days or more (or
 * ended sooner with `foe` down), how many saw `foe` down (capitulated, in
 * exile or gone) while it ran. Poland's target: >= 60%; France: data.
 */
function pairCheck(rs: DepthRun[], foe: "POL" | "FRA"): Check {
  let n = 0;
  let fell = 0;
  let deuFell = 0;
  let wars = 0;
  for (const r of rs) {
    const last = dayOfDate(r.until);
    for (const w of r.depth.pairs?.[foe] ?? []) {
      wars++;
      const len = (w.end ?? last) - w.start;
      if (len < 90 && !w.foeDown) continue;
      n++;
      if (w.foeDown) fell++;
      if (w.deuDown) deuFell++;
    }
  }
  const pct = n === 0 ? NaN : (100 * fell) / n;
  return {
    target:
      foe === "POL"
        ? "Poland falls in >= 60% of DEU-POL wars lasting >= 90 days"
        : "France falls in DEU-FRA wars lasting >= 90 days (data)",
    value: `${fell}/${n} (${f1(pct)}%; DEU down in ${deuFell}; ${wars} wars in all)`,
    ok: foe === "FRA" || (n > 0 && fell * 10 >= n * 6),
  };
}

/** Pol/Fra lane: the wars Germany declared, per seed. */
function deuWars(rs: DepthRun[]): string {
  return formatTable(
    ["seed", "DEU declared (day target)", "DEU-POL wars", "DEU-FRA wars"],
    rs.map((r) => {
      const p = r.depth.pairs ?? { POL: [], FRA: [] };
      const ws = (r.depth.wars ?? []).filter(
        (w) => w.a === "DEU" && w.kind === "declare",
      );
      const iv = (l: DepthResult["pairs"][string]) =>
        l
          .map(
            (w) =>
              `${iso(w.start)}..${w.end === null ? "" : iso(w.end)}${w.foeDown ? " fell" : ""}${w.deuDown ? " DEUdown" : ""}`,
          )
          .join(", ") || "-";
      return [
        r.seed,
        ws.map((w) => `${iso(w.day)} ${w.b}`).join(", ") || "-",
        iv(p.POL ?? []),
        iv(p.FRA ?? []),
      ];
    }),
  );
}

function checksOff(rs: DepthRun[]): Check[] {
  const conf = rs.map((r) => r.conferences);
  const cw = rs.map((r) => r.civilWars.length);
  const coups = rs.map((r) => r.depth.coups.length);
  return [
    pairCheck(rs, "POL"),
    pairCheck(rs, "FRA"),
    {
      target: "History off: France falls (capitulation or Vichy) (data)",
      value: `${rs.filter((r) => r.france.capDay !== null || r.france.vichyDay !== null).length}/${rs.length}; Poland ${rs.filter((r) => r.poland.capDay !== null).length}/${rs.length}; Germany ${rs.filter((r) => r.germany.capDay !== null).length}/${rs.length}`,
      ok: true,
    },
    {
      target: "History off: >= 1 conference per game",
      value: `[${conf.join(" ")}]`,
      ok: conf.every((x) => x >= 1),
    },
    {
      target: "History off: civil wars 0-3 per game",
      value: `[${cw.join(" ")}]`,
      ok: cw.every((x) => x <= 3),
    },
    {
      target: "History off: successful coups <= 3 per game",
      value: `[${coups.join(" ")}]`,
      ok: coups.every((x) => x <= 3),
    },
    {
      target: "History off: nukes dropped per game (info)",
      value: `[${rs.map((r) => r.depth.nukes.filter((x) => x.hit).length).join(" ")}]`,
      ok: true,
    },
    koreaCheck(rs),
  ];
}

function depthTable(xs: readonly DepthRun[]): string {
  return formatTable(
    [
      "seed",
      "DEU arm",
      "SUN inf",
      "GBR>DEU",
      "DEU mio",
      "USA mio",
      "atomic",
      "USA end",
      "E1940 I/G/U/D",
      "ITA nodeal",
      "nukes",
      "coups",
      "p6flags",
    ],
    xs.map((r) => {
      const dp = r.depth;
      const e = (t: string) =>
        dp.energy1940[t] === undefined
          ? "-"
          : String(Math.round(dp.energy1940[t].mean / 10));
      return [
        r.seed,
        String(dp.deuArmor194106),
        String(dp.sunInf194106),
        iso(dp.gbrBreaksDeu),
        String(dp.deuArmorMio194206),
        dp.usaMio194206.join(""),
        Object.entries(dp.atomicDone)
          .map(([t, d]) => `${t} ${iso(d)}`)
          .join(", ") || "-",
        `${dp.usaAtomicEnd.progressPm}‰ ${dp.usaAtomicEnd.daysLeft}d`,
        ["ITA", "GBR", "USA", "DEU"].map(e).join("/"),
        dp.energy1940.ITA?.meanNoDeal === undefined
          ? "-"
          : `${Math.round(dp.energy1940.ITA.meanNoDeal / 10)}% ${dp.energy1940.ITA.daysNoDeal}d`,
        dp.nukes
          .map((x) => `${x.owner}${x.hit ? "" : "(x)"} ${iso(x.day)}`)
          .join(", ") || "0",
        dp.coups.map((x) => `${x.owner}>${x.target}`).join(" ") || "0",
        String(dp.p6flags.length),
      ];
    }),
  );
}

function report(rs: DepthRun[]): void {
  rs.sort((a, b) => a.seed.localeCompare(b.seed));
  for (const [label, xs] of [
    ["historical AI on", rs.filter((r) => r.historical)],
    ["historical AI off", rs.filter((r) => !r.historical)],
  ] as const) {
    if (xs.length === 0) continue;
    console.log(`\n== ${label}: ${xs.length} seeds ==`);
    console.log(seedTable(xs));
    console.log("\n" + depthTable(xs));
    console.log("\n" + deuWars(xs));
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
      `\nwhole tick mean ${mean((r) => r.perf.tick.mean)} ms (loaded, ${xs.length} runs), p99 ${mean((r) => r.perf.tick.p99)} ms, max ${Math.max(...xs.map((r) => r.perf.tick.max)).toFixed(1)} ms`,
    );
  }
}

function printPerf(r: RunResult): void {
  console.log(
    `\n== depth perf ${r.seed} historical ${r.historical ? "on" : "off"} to ${r.until} (${r.ticks} ticks, ${r.seconds} s, load ${os
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
  for (const [k, v] of Object.entries(r.perf.parts ?? {})) add(k, v);
  console.log(
    formatTable(["part", "ticks", "mean ms", "p99 ms", "max ms"], rows),
  );
  console.log(
    "budgets (spec §22.1): depth mean <= 0.3 ms, p99 <= 2 ms, max <= 6 ms; whole tick p99 <= 22 ms, max <= 60 ms",
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const o: Options = parseArgs(argv);
  if (!argv.includes("--out")) o.out = path.join(ROOT, ".cache/depth-sim");
  if (!argv.includes("--jobs")) o.jobs = Math.min(o.jobs, 4);
  if (o.one !== "") {
    const r = await runOne(
      o.seeds[0],
      o.historical,
      o.until,
      o.out,
      false,
      depthExtension(null),
    );
    fs.writeFileSync(o.one, JSON.stringify(r));
    return;
  }
  if (o.perf) {
    const acc = makePerfAcc();
    const r = await runOne(
      o.seeds[0],
      o.historical,
      o.until,
      "",
      false,
      depthExtension(acc),
    );
    printPerf(r);
    return;
  }
  if (o.summary) {
    report(readResults(o.out, null) as DepthRun[]);
    return;
  }
  const failed = await runBatch(o, SELF);
  report(readResults(o.out, o.historical) as DepthRun[]);
  if (failed.length > 0) console.log(`\nFAILED runs: ${failed.join(" ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
