// World War 1936 P2 (plan Task 11 Step 4, spec §17.3, §19.4): the land
// war's cost, and the caches that pay for it. On the test map: 2,000
// divisions, every country at war with every other side, battles in the
// regions the map has room for (one a defending region: the test map's
// ten regions hold four at a time here). Every country is a human's, so
// the battles go on (the AI would take its armies out of attacks it did
// not plan) and every country's detail goes to the screens. A tick's land war
// (WwLand.tick and the screens' update) must average within three times
// the desktop budget (1.5 ms), on the best of five timed batches after a
// warm-up (load-robust: a neighbour's burst slows one batch, not the
// verdict). The caches are derived: each is checked against a fresh
// computation, supply against an independent reference under random
// changes, and a restored game must continue tick for tick.
import {
  GameMapSize,
  GameMapType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_SLOTS,
  groundSlotOf,
  ROLE_ATTACK,
  WW_SUPPLY_RANGE,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { divisionMods } from "@openfront/engine-lib/ww1936/CombatRules";
import * as SR from "@openfront/engine-lib/ww1936/SupplyRules";
import {
  divisionStats,
  genMixOf,
  strengthPm,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import {
  createGameRunnerFromSnapshot,
  GameRunner,
} from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  joinBattle,
  modInputOf,
  modsOf,
} from "@openfront/engine/ww1936/land/Battles";
import {
  capitalRegion,
  fieldDivision,
} from "@openfront/engine/ww1936/land/LandStartRun";
import { dailySupply } from "@openfront/engine/ww1936/land/Supply";
import type { WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { diffSnapshots } from "../util/Snapshot";
import {
  byTag,
  HUMAN,
  land,
  MINI,
  step,
  stepTo,
  wwGameStart,
  WwHuman,
  wwRunner,
} from "./util";

/** Spec §17.3: the land war's desktop average, and the CI bound (×3). */
const LAND_BUDGET_MS = 1.5;
const CI_FACTOR = 3;
const DIVISIONS = 2_000;
const WARMUP_TICKS = 100;
const BATCHES = 5;
const TICKS_PER_BATCH = 200;
/** Attack from → into (test map v3): Berlin → Warsaw, Rome → Lyon, Kiev → Krakow, Paris → Munich. */
const BATTLES: readonly (readonly [number, number])[] = [
  [3, 6],
  [5, 2],
  [9, 7],
  [1, 4],
];

const hash = (r: GameRunner) =>
  (r.game as unknown as { hash(): number }).hash();

/**
 * Everybody at war with every other side after the preparation minute,
 * men and stock to spare, DIVISIONS divisions spread over the regions in
 * armies of 20, a tenth of them on second-generation rifles (generation
 * mixes for the stats caches), the four battles joined.
 */
/** Every country of the test map a human's. */
const ALL_HUMAN: WwHuman[] = (
  ["FRA", "DEU", "ITA", "POL", "SUN", "GBR"] as const
).map((country, i) => ({ clientID: `HUMAN00${i + 1}`, country }));

async function warGame(humans: WwHuman[] = ALL_HUMAN): Promise<GameRunner> {
  const runner = await wwRunner({}, humans);
  const g = runner.game;
  const ww = g.worldWar()!;
  const l = land(g);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ids = l.countries().map((c) => c.smallID);
  for (const a of ids) {
    for (const b of ids) {
      if (a < b && !l.sameSide(a, b)) ww.setWar(a, b, g.ticks());
    }
  }
  for (const ce of l.econ.countries()) {
    ce.manpower = 1_000_000_000;
    for (let i = 0; i < ce.stock.length; i++) ce.stock[i] = 100_000_000;
  }
  const regions = l.scenario.landRegions.map((r) => r.id);
  const rifles2 = groundSlotOf(equipKey("infantry_equipment", 2));
  const rifles1 = groundSlotOf(equipKey("infantry_equipment", 1));
  let n = l.divisions.count();
  for (let i = 0; n < DIVISIONS; i++) {
    const region = regions[i % regions.length];
    const owner = l.controller[region];
    const cl = l.country(owner)!;
    const a = l.newArmy(owner);
    if (a === null) continue;
    for (let k = 0; k < 20 && n < DIVISIONS; k++, n++) {
      fieldDivision(l, cl, l.econ.country(owner)!, cl.templates[0], region, a);
      if (n % 10 === 0) {
        const r = l.divisions.rowOf(a.divisions[a.divisions.length - 1]);
        const half = Math.floor(
          l.divisions.equip[r * GROUND_SLOTS + rifles1] / 2,
        );
        l.addEquip(r, rifles1, -half);
        l.addEquip(r, rifles2, half);
      }
    }
  }
  for (const [from, to] of BATTLES) {
    for (const r of [...l.rowsIn(from)]) joinBattle(l, l.divisions.id[r], to);
  }
  return runner;
}

/** Times WwLand.tick plus its update (takeData) of every tick `runner` steps. */
function timeLand(runner: GameRunner): { last: () => number } {
  const l = land(runner.game);
  const tick = l.tick.bind(l);
  const take = l.takeData.bind(l);
  let ms = 0;
  l.tick = (t: number) => {
    const a = performance.now();
    tick(t);
    ms = performance.now() - a;
  };
  l.takeData = () => {
    const a = performance.now();
    const d = take();
    ms += performance.now() - a;
    return d;
  };
  return { last: () => ms };
}

describe("the land war's cost (spec §17.3, §19.4)", () => {
  test(`${DIVISIONS} divisions at war on the test map: the land tick within ${CI_FACTOR}× its budget`, async () => {
    const runner = await warGame();
    const g = runner.game;
    const l = land(g);
    expect(l.divisions.count()).toBe(DIVISIONS);
    expect(l.battles.size).toBe(BATTLES.length);
    const timer = timeLand(runner);
    step(runner, WARMUP_TICKS);
    const batches: number[][] = [];
    let battles = 0;
    for (let b = 0; b < BATCHES; b++) {
      const ms: number[] = [];
      for (let i = 0; i < TICKS_PER_BATCH; i++) {
        step(runner);
        ms.push(timer.last());
        battles += l.battles.size;
      }
      batches.push(ms);
    }
    const mean = (xs: readonly number[]) =>
      xs.reduce((a, b) => a + b, 0) / xs.length;
    const means = batches.map(mean);
    const best = Math.min(...means);
    const all = batches.flat().sort((a, b) => a - b);
    console.log(
      `land war, test map, ${l.divisions.count()} divisions, ` +
        `${(battles / (BATCHES * TICKS_PER_BATCH)).toFixed(1)} battles a tick: ` +
        `best batch ${best.toFixed(3)} ms/tick (batches ${means.map((m) => m.toFixed(3)).join(" / ")}); ` +
        `p50 ${all[all.length >> 1].toFixed(3)} p99 ${all[Math.floor(all.length * 0.99)].toFixed(3)} ` +
        `max ${all[all.length - 1].toFixed(2)} ms over ${all.length} ticks`,
    );
    // Still a war at the end: the timed ticks fought.
    expect(battles).toBeGreaterThan(BATCHES * TICKS_PER_BATCH);
    expect(best).toBeLessThan(LAND_BUDGET_MS * CI_FACTOR);
    // Spec §17.2, P1 decision 7: no cities, factories, trains or trade ships in this mode.
    for (const u of [UnitType.City, UnitType.Factory, UnitType.TradeShip]) {
      expect(g.config().isUnitDisabled(u)).toBe(true);
    }
    for (const u of [
      UnitType.City,
      UnitType.Factory,
      UnitType.Train,
      UnitType.TradeShip,
    ]) {
      expect(g.units(u)).toHaveLength(0);
    }
  }, 120_000);
});

// ---- The caches are derived (P2 Task 11) ----

/** Every cached number of every division, against a fresh computation. */
function checkCaches(l: WwLand): void {
  const t = l.divisions;
  let n = 0;
  for (let r = 0; r < t.rows; r++) {
    if (t.id[r] === 0) continue;
    n++;
    const owner = t.owner[r];
    const ce = l.econ.country(owner)!;
    const def = l.templateOf(owner, t.template[r])!.def;
    const equip = Array.from(t.equipOf(r));
    const base = templateStats(def, ce.tech, genMixOf(equip));
    const what = `division ${t.id[r]}`;
    expect(l.baseStatsOf(r), what).toEqual(base);
    expect(l.statsOf(r), what).toEqual(divisionStats(base, equip, t.men[r]));
    expect(l.strengthOf(r), what).toBe(strengthPm(base, equip, t.men[r]));
    expect(l.orgMaxOf(r), what).toBe(
      Math.floor((base.orgMilli * (100 + ce.tech.orgPct)) / 100),
    );
    expect(l.flagsOf(r), what).toBe(base.flags);
    expect(l.widthOf(r), what).toBe(base.width);
    expect(l.supplyBaseOf(r), what).toBe(base.supplyMilli);
    const tn = l.templateNumbersOf(r);
    for (const k of [
      "width",
      "men",
      "orgMilli",
      "supplyMilli",
      "trainDays",
      "need",
      "flags",
      "special",
      "battalions",
    ] as const) {
      expect(tn[k], `${what} ${k}`).toEqual(base[k]);
    }
    if (t.battle[r] !== 0) {
      const att = t.role[r] === ROLE_ATTACK;
      expect(modsOf(l, r, t.battle[r], att), what).toEqual(
        divisionMods(modInputOf(l, r, t.battle[r], att)).mods,
      );
    }
  }
  expect(n).toBe(t.count());
  // The country lists and men.
  for (const cl of l.countries()) {
    const rows: number[] = [];
    let men = 0;
    for (let r = 0; r < t.rows; r++) {
      if (t.id[r] !== 0 && t.owner[r] === cl.smallID) {
        rows.push(r);
        men += t.men[r];
      }
    }
    expect([...l.rowsOf(cl.smallID)], cl.tag).toEqual(rows);
    expect(l.fieldMen(cl.smallID), cl.tag).toBe(men);
  }
  // Weather.
  const sc = l.scenario;
  const day = l.day();
  for (const reg of sc.landRegions) {
    expect(l.weatherOn(reg.id, day)).toBe(
      weatherAt(day, sc.latC(reg.id), sc.landOf(reg.id), sc.wcell(reg.id)),
    );
  }
}

describe("the land caches are derived (P2 Task 11)", () => {
  test("every cached number equals a fresh computation, also after writes that skip the helpers", async () => {
    const runner = await warGame();
    const g = runner.game;
    const l = land(g);
    checkCaches(l);
    step(runner, 150);
    checkCaches(l);
    // Writes the helpers did not see (pre-flight U8), a tech, a new def.
    const t = l.divisions;
    let k = 0;
    for (let r = 0; r < t.rows; r += 7) {
      if (t.id[r] === 0) continue;
      l.statsOf(r);
      l.orgMaxOf(r);
      if (k % 3 === 0) t.men[r] = Math.floor(t.men[r] / 2);
      if (k % 3 === 1) t.equip[r * GROUND_SLOTS + (k % GROUND_SLOTS)] = 0;
      k++;
    }
    const deu = byTag(g, "DEU").smallID();
    l.econ.country(deu)!.addTech("firepower_1");
    const cl = l.country(byTag(g, "POL").smallID())!;
    cl.templates[0].def = {
      ...cl.templates[0].def,
      battalions: [...cl.templates[0].def.battalions, "infantry"],
    };
    checkCaches(l);
    step(runner, 100);
    checkCaches(l);
  }, 120_000);

  test("the screens: casualties alone send the summary, not the detail", async () => {
    const runner = await warGame();
    const l = land(runner.game);
    const deu = byTag(runner.game, "DEU").smallID();
    l.takeData();
    l.noteCasualties(deu, 100, 80);
    const d = l.takeData()!;
    expect(d.countries.map((c) => c.smallID)).toContain(deu);
    expect(d.countries.find((c) => c.smallID === deu)!.casualtiesToday).toBe(
      l.country(deu)!.casualtiesToday,
    );
    expect(d.details.map((x) => x.smallID)).not.toContain(deu);
    // A change in the detail (a template, training, generals) sends both.
    l.markCountry(deu);
    const e = l.takeData()!;
    expect(e.countries.map((c) => c.smallID)).toContain(deu);
    expect(e.details.map((x) => x.smallID)).toEqual([deu]);
  }, 60_000);

  test("a restored game continues tick for tick in the middle of the war", async () => {
    const a = await warGame();
    step(a, 120);
    expect(land(a.game).battles.size).toBeGreaterThan(0);
    const b = await createGameRunnerFromSnapshot(
      wwGameStart({}, ALL_HUMAN),
      a.snapshot(),
      undefined,
      await loadMapFiles(
        new TestDataMapLoader(MINI),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
      () => {},
    );
    for (let i = 0; i < 250; i++) {
      step(a);
      step(b);
      if (hash(a) !== hash(b)) {
        throw new Error(`hash diverged ${i + 1} tick(s) after restore`);
      }
    }
    expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual(
      [],
    );
    checkCaches(land(b.game));
  }, 120_000);
});

// ---- Supply: the warm caches against an independent reference ----

/**
 * Spec §11.1–§11.5 from scratch: the side's regions, the rail net from the
 * capitals, the hubs, one plain Dijkstra a hub (no heap, no cache), the
 * reach, each region's supply and encirclement.
 */
function referenceSupply(
  l: WwLand,
  side: number,
): Map<number, [number, number]> {
  const sc = l.scenario;
  const members = l.sideMembers(side);
  const ours = (r: number) => members.includes(l.controller[r]);
  const regions = sc.landRegions.map((r) => r.id).filter(ours);
  const day = l.day();
  const capitals = members
    .map((m) => capitalRegion(l, m))
    .filter((r) => r !== 0);
  const railNet = new Set<number>(capitals);
  const q = [...capitals].sort((x, y) => x - y);
  for (let i = 0; i < q.length; i++) {
    for (const e of sc.edgesOf(q[i])) {
      if (
        !railNet.has(e.to) &&
        ours(e.to) &&
        l.econ.rail[e.to] >= 1 &&
        l.econ.rail[q[i]] >= 1
      ) {
        railNet.add(e.to);
        q.push(e.to);
      }
    }
  }
  const hubs: { region: number; cap: number }[] = [];
  for (const r of regions) {
    const reg = sc.region(r)!;
    const rail = l.econ.rail[r];
    if (capitals.includes(r)) {
      hubs.push({ region: r, cap: SR.hubCapacityMilli(SR.HUB_CAPITAL, rail) });
    } else if (reg.vp >= SR.HUB_CITY_VP && railNet.has(r)) {
      hubs.push({ region: r, cap: SR.hubCapacityMilli(SR.HUB_CITY, rail) });
    } else if (l.econ.hub[r] >= 1 && railNet.has(r)) {
      hubs.push({ region: r, cap: SR.hubCapacityMilli(SR.HUB_BUILT, rail) });
    }
    if (sc.isPort(r)) {
      hubs.push({ region: r, cap: SR.hubCapacityMilli(SR.HUB_SEA, rail) });
    }
  }
  const reached = new Set<number>(hubs.map((h) => h.region));
  const bq = [...reached].sort((x, y) => x - y);
  for (let i = 0; i < bq.length; i++) {
    for (const e of sc.edgesOf(bq[i])) {
      if (!reached.has(e.to) && ours(e.to)) {
        reached.add(e.to);
        bq.push(e.to);
      }
    }
  }
  const best = new Map<number, number>();
  const range = WW_SUPPLY_RANGE * 100;
  for (const h of hubs) {
    const dist = new Map<number, number>([[h.region, 0]]);
    const open = [h.region];
    const done = new Set<number>();
    while (open.length > 0) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) {
        const x = dist.get(open[i])!;
        const y = dist.get(open[bi])!;
        if (x < y || (x === y && open[i] < open[bi])) bi = i;
      }
      const u = open.splice(bi, 1)[0];
      done.add(u);
      const v = SR.supplyFrom(h.cap, dist.get(u)!);
      if (v > (best.get(u) ?? 0)) best.set(u, v);
      for (const e of sc.edgesOf(u)) {
        if (done.has(e.to) || !ours(e.to)) continue;
        const nd =
          dist.get(u)! +
          SR.supplyEdgeCost(
            sc.edge(e.edge).km,
            l.econ.rail[u],
            l.econ.rail[e.to],
            sc.landOf(e.to),
            l.econ.infra[e.to],
          );
        if (nd >= range) continue;
        const old = dist.get(e.to);
        if (old === undefined || nd < old) {
          if (old === undefined) open.push(e.to);
          dist.set(e.to, nd);
        }
      }
    }
  }
  const out = new Map<number, [number, number]>();
  const owners = sc.ownerByRegion();
  for (const r of regions) {
    const core = sc.region(r)!.core && l.sameSide(owners[r], l.controller[r]);
    const w = weatherAt(day, sc.latC(r), sc.landOf(r), sc.wcell(r));
    const cut = !reached.has(r);
    out.set(r, [
      cut
        ? 0
        : SR.regionSupplyMilli(
            best.get(r) ?? 0,
            SR.localSupplyMilli(core, l.econ.infra[r]),
            w,
          ),
      cut ? 1 : 0,
    ]);
  }
  return out;
}

describe("supply's warm caches (P2 Task 11)", () => {
  test("random control, rail, infrastructure and hub changes: the daily supply equals a fresh reference", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    stepTo(runner, WW_PREP_TICKS + 8);
    const l = land(runner.game);
    const sc = l.scenario;
    const ids = sc.landRegions.map((r) => r.id);
    const countries = l.countries().map((c) => c.smallID);
    // A seeded LCG (the test's own; the engine never sees it).
    let seed = 12_345;
    const rnd = (n: number) => {
      seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
      return seed % n;
    };
    let checks = 0;
    for (let day = 0; day < 300; day++) {
      // Some days nothing changes (the warm path), some days a lot.
      const changes = day % 4 === 0 ? 0 : 1 + rnd(4);
      for (let i = 0; i < changes; i++) {
        const r = ids[rnd(ids.length)];
        const k = rnd(4);
        if (k === 0) {
          l.setController(
            r,
            countries[rnd(countries.length)],
            runner.game.ticks(),
          );
        } else if (k === 1) l.econ.rail[r] = rnd(6);
        else if (k === 2) l.econ.infra[r] = rnd(6);
        else l.econ.hub[r] = rnd(2);
      }
      // A day later now and then (the weather moves).
      if (day % 5 === 4) step(runner, 8);
      for (const s of l.sideList()) {
        dailySupply(l, s.key);
        for (const [r, [supply, enc]] of referenceSupply(l, s.key)) {
          checks++;
          expect(
            [l.supplyMilli[r], l.encircled[r]],
            `day ${day} side ${s.key} region ${r}`,
          ).toEqual([supply, enc]);
        }
      }
    }
    expect(checks).toBeGreaterThan(1000);
  }, 120_000);
});
