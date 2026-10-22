// World War 1936 P6 (plan Task 23, spec §21.6, §27.5-4, Review Focus 4):
// the depth systems' snapshot oracle. Game A plays to a moment; copies are
// restored from A's snapshot at chosen ticks (mid-day, before and after a
// country's turn) and run beside it with the same turns. WorldWar.hash(),
// depth.hash() and the game hash must agree every tick, the whole World
// War state (P0–P6) every few ticks, and depth.snapshot(), the full game
// snapshot and the live object graphs at both ends. Then: every depth field
// the oracle leaves out (DERIVED_FIELDS) is rebuilt from state, or is a
// screen's buffer that never reaches the state; the values made on one day
// and read on a later one are state (pre-flight §0-8).
import type { StampedIntent } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  type AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  DAMS,
  type DesignDef,
  MARKET_DAYS,
  SPECIAL_PROJECTS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  EQUIPMENT_TYPES,
  WW_DAY_SPLIT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  P_INTEL_CAPTURE,
  P_INTEL_OP,
  P_RAID,
} from "@openfront/engine-lib/ww1936/DepthRules";
import { upgradeBit } from "@openfront/engine-lib/ww1936/IntelRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { aceCallNo } from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import {
  addDecryptMilli,
  decryptRow,
  exploiting,
} from "@openfront/engine/ww1936/depth/Crypto";
import { destroyDam } from "@openfront/engine/ww1936/depth/Dams";
import {
  M_BUILD_NETWORK,
  ST_CAPTURED,
  ST_IDLE,
  ST_MISSION,
} from "@openfront/engine/ww1936/depth/Operatives";
import { regionStatus } from "@openfront/engine/ww1936/depth/World";
import type {
  Operative,
  WwDepth,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DERIVED_FIELDS, diffGraphs, diffSnapshots } from "../util/Snapshot";
import { DEEP, findRoll, setInfra } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { valueDiffs } from "./lockstep";
import {
  gameHash,
  HUMAN,
  order,
  step,
  stepTo,
  takeRegion,
  warAfterPrep,
  type WwHuman,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const { DEU, GBR, ITA, FRA, POL, SUN, TUR } = DEEP.tag;
const R = DEEP.region;
const WEST = DEEP.sr.westLand;
const CENTRAL = DEEP.sr.central;
const ATOMIC = SPECIAL_PROJECTS.indexOf("sp_atomic");
const ATOMIC_KEY = equipKey("atomic_bomb", 1);
const INF1 = equipKey("infantry_equipment", 1);

const wwOf = (r: GameRunner): WorldWar => r.game.worldWar()!;
/** The World War state (P0–P6) as plain data, through JSON. */
const wwState = (r: GameRunner): unknown =>
  JSON.parse(JSON.stringify(wwOf(r).snapshot()));
const depthState = (r: GameRunner): unknown =>
  JSON.parse(JSON.stringify(wwOf(r).depth.snapshot()));
const dayOf = (r: GameRunner): number => wwOf(r).day(r.game.ticks());
/** The first tick of `day`. */
const dayTick = (r: GameRunner, day: number): number =>
  dayStartTick(day, wwOf(r).prepEndTick());
/**
 * The tick of `id`'s turn on `day` (P1's split, which the depth clock
 * shares): stepTo it and the next tick is the turn; one more, it is done.
 */
const turnTick = (r: GameRunner, id: number, day: number): number =>
  dayTick(r, day) + (id % WW_DAY_SPLIT);

/** The full World War state every this many ticks (the hashes every tick). */
const EVERY = 25;

/**
 * Plan Task 23 Step 1: A plays on; each copy is restored from A's snapshot
 * at the tick `restore` is called and then runs every tick A runs, with the
 * same turns.
 */
class Oracle {
  private readonly copies: { b: GameRunner; at: number; ran: number }[] = [];

  constructor(
    readonly a: GameRunner,
    readonly humans: WwHuman[],
  ) {}

  /** A copy restored from A's snapshot now; equal to A at once. */
  async restore(): Promise<GameRunner> {
    const { a } = this;
    const b = await wwRestore(a, this.humans, DEEP.map);
    expect(diffGraphs(a.game, b.game)).toEqual([]);
    expect(depthState(b)).toEqual(depthState(a));
    expect(wwOf(b).hash()).toBe(wwOf(a).hash());
    this.copies.push({ b, at: a.game.ticks(), ran: 0 });
    return b;
  }

  /** A and every copy `n` ticks on, the same turns (`intents` by A's tick). */
  run(n: number, intents?: (tick: number) => StampedIntent[]): void {
    for (let i = 0; i < n; i++) {
      const turn = intents?.(this.a.game.ticks()) ?? [];
      step(this.a, 1, turn);
      for (const c of this.copies) {
        step(c.b, 1, turn);
        c.ran++;
        this.compare(c);
      }
    }
  }

  /** Runs until A's next tick is `tick`. */
  runTo(tick: number, intents?: (tick: number) => StampedIntent[]): void {
    this.run(Math.max(0, tick - this.a.game.ticks()), intents);
  }

  private compare(c: { b: GameRunner; at: number; ran: number }): void {
    const { a } = this;
    const [x, y] = [wwOf(a), wwOf(c.b)];
    const where = `copy restored at tick ${c.at}, ${c.ran} tick(s) on`;
    if (
      x.depth.hash() !== y.depth.hash() ||
      x.hash() !== y.hash() ||
      gameHash(a) !== gameHash(c.b)
    ) {
      throw new Error(
        `${where}: hash diverged\n` +
          valueDiffs(wwState(a), wwState(c.b)).join("\n"),
      );
    }
    if (c.ran % EVERY !== 0) return;
    const d = valueDiffs(wwState(a), wwState(c.b));
    if (d.length > 0) {
      throw new Error(`${where}: state diverged\n${d.join("\n")}`);
    }
  }

  /** The end: depth and World War state, game snapshot and object graph equal A's. */
  finish(): GameRunner[] {
    const { a } = this;
    for (const c of this.copies) {
      expect(depthState(c.b)).toEqual(depthState(a));
      expect(valueDiffs(wwState(a), wwState(c.b))).toEqual([]);
      expect(
        diffSnapshots(snapshotGame(a.game), snapshotGame(c.b.game)),
      ).toEqual([]);
      expect(diffGraphs(a.game, c.b.game)).toEqual([]);
    }
    return this.copies.map((c) => c.b);
  }
}

/** The deep map with `humans`, past the preparation minute. */
async function started(humans: WwHuman[]) {
  const runner = await wwRunner({}, humans, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = wwOf(runner);
  return { runner, g: runner.game, ww, d: ww.depth };
}

function stockUp(g: Game, id: number): void {
  const ce = g.worldWar()!.economy.country(id)!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** A deployment of `n` planes of `owner` over `sr` (drawn from the stock). */
function deploy(
  g: Game,
  owner: number,
  sr: number,
  type: AirType,
  mission: AirMission,
  n: number,
  base: number,
) {
  const ww = g.worldWar()!;
  const ce = ww.economy.country(owner)!;
  return ww.air.addDeployment({
    owner,
    sr,
    type: AIR_TYPES.indexOf(type),
    mission: AIR_MISSIONS.indexOf(mission),
    counts: drawPlanes(ce, type, n),
    target: n,
    base,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

// ---- intelligence (lane I) ----

/** Above any capture chance these games meet (5%, milli‰). */
const CAPTURE_MAX = 50_000;
/** The lowest capture chance of an operative on a mission abroad (no counter-intelligence), milli‰. */
const CAPTURE_FLOOR = 2_000;

const captureRoll = (seed: number, uid: number, day: number, t: number) =>
  wwRoll(seed, P_INTEL_CAPTURE, uid, day, t) % 1_000_000;

/** The first operative uid ≥ from never caught in `t` from day `d0` to `d1`. */
function freeUid(
  seed: number,
  from: number,
  t: number,
  d0: number,
  d1: number,
) {
  for (let uid = from; ; uid++) {
    let ok = true;
    for (let day = d0; day <= d1 && ok; day++) {
      ok = captureRoll(seed, uid, day, t) >= CAPTURE_MAX;
    }
    if (ok) return uid;
  }
}

/** The first operative uid ≥ from free in `t` from day `d0` and caught on day `on`. */
function caughtUid(
  seed: number,
  from: number,
  t: number,
  d0: number,
  on: number,
) {
  for (let uid = from; ; uid++) {
    if (captureRoll(seed, uid, on, t) >= CAPTURE_FLOOR) continue;
    if (freeUid(seed, uid, t, d0, on - 1) === uid) return uid;
  }
}

/** `owner`'s agency with idle operatives `uids`, PP and rifles to spare (as lane I's tests). */
function agency(d: WwDepth, owner: number, uids: number[]): Operative[] {
  const c = d.country(owner)!;
  c.intel.agency = true;
  d.ww.politics.country(owner)!.ppMilli = 500_000;
  d.ww.economy.country(owner)!.stock[INF1] += 5_000;
  return uids.map((uid) => {
    const o: Operative = {
      uid,
      codename: c.intel.nextCodename++,
      skill: 1,
      abroadDays: 0,
      state: ST_IDLE,
      target: 0,
      mission: -1,
      op: 0,
      sinceDay: 0,
      travelLeft: 0,
      releaseDay: -1,
      recruitLeft: 0,
    };
    c.intel.operatives.push(o);
    return o;
  });
}

// ---- the sea (lane W2) ----

/** Ship design slot 1 of `id`: a destroyer with `module` in its special slot (as lane W2's tests). */
function ddDesign(d: WwDepth, id: number, module: string): void {
  const def: DesignDef = {
    kind: "ship",
    base: "dd_1",
    modules: ["", "", "", module],
    name: "Test DD",
  };
  d.country(id)!.des.ship[0] = {
    def: def as never,
    origin: "own",
    from: 0,
    fromSlot: 0,
    obsolete: false,
    savedDay: 0,
  };
  d.markDesign(id, "ship", 1);
}

/** A new fleet of `dds` destroyers in `port`, `designed` of them built to design slot 1, on `mission` in the central waters. */
function fleetOn(
  g: Game,
  owner: number,
  port: number,
  dds: number,
  designed: number,
  mission: "lay_mines" | "sweep_mines" | "patrol",
): number {
  const navy = g.worldWar()!.navy;
  const id = navy.createFleet(owner, port, [["dd", 1, dds]]);
  const t = navy.ships;
  let n = 0;
  for (const sid of navy.fleets.get(id)!.ships) {
    if (n++ < designed) t.design[t.rowOf(sid)] = 1;
  }
  expect(
    navy.issue(
      owner,
      { kind: "fleet_mission", fleet: id, mission, sr: CENTRAL },
      g.ticks(),
    ),
  ).toBeNull();
  return id;
}

describe("World War 1936 P6: the depth snapshot oracle (Review Focus 4)", () => {
  it("restoring mid-operation continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: "HUMANGBR", country: "GBR" }];
    const { runner: a, g, ww, d } = await started(humans);
    const seed = ww.politics.seed;
    const day0 = dayOf(a);
    // The coup's 150 days cut to 20 (its row's last day, below); restored on
    // day 10, the tick before Britain's turn (its operatives' capture rolls)
    // and the tick after; the network operative in Germany is caught on day 14.
    const end = day0 + 20;
    const mid = day0 + 10;
    const caught = day0 + 14;
    const ua = freeUid(seed, 1_000, ITA, day0, end + 2);
    const ub = freeUid(seed, ua + 1, ITA, day0, end + 2);
    const uc = caughtUid(seed, ub + 1, DEU, day0, caught);
    const [, , oc] = agency(d, GBR, [ua, ub, uc]);
    Object.assign(oc, {
      state: ST_MISSION,
      target: DEU,
      mission: M_BUILD_NETWORK,
      sinceDay: day0,
    });
    d.setNetMilli(GBR, ITA, 900_000);
    // Britain's ideology at 91% in Italy.
    const me = ww.politics.country(GBR)!.ruling;
    const ita = ww.politics.country(ITA)!;
    expect(ita.ruling).not.toBe(me);
    ita.pop = ita.pop.map((_, i) => (i === me ? 9_100 : 300));
    // The coup's uid made to succeed (a roll under 10%: any odds above it).
    d.nextUid = findRoll(
      seed,
      P_INTEL_OP,
      (n, roll) => n >= d.nextUid && roll % 1_000_000 < 100_000,
    );
    expect(
      d.issue(
        GBR,
        {
          kind: "operation_start",
          op: "op_coup",
          target: ITA,
          operatives: [ua, ub],
        },
        g.ticks(),
      ),
    ).toBeNull();
    const row = d.ops[d.ops.length - 1];
    row.endDay = end;
    const o = new Oracle(a, humans);
    stepTo(a, turnTick(a, GBR, mid));
    await o.restore();
    o.run(1);
    await o.restore();
    o.runTo(turnTick(a, GBR, end + 2));
    for (const r of [a, ...o.finish()]) {
      const dd = wwOf(r).depth;
      const ops = dd.country(GBR)!.intel.operatives;
      // The coup went in: Italy rules as Britain; its operatives are home.
      expect(dd.ops).toEqual([]);
      expect(wwOf(r).politics.country(ITA)!.ruling).toBe(me);
      expect(ops.find((x) => x.uid === ua)!.state).toBe(ST_IDLE);
      // Germany caught the network operative on its day.
      expect(ops.find((x) => x.uid === uc)).toMatchObject({
        state: ST_CAPTURED,
        target: DEU,
        sinceDay: caught,
      });
    }
  }, 120_000);

  it("restoring during decryption exploitation continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "FRA" }];
    const a = await wwRunner({}, humans, DEEP.map);
    warAfterPrep(a, HUMAN, "DEU");
    const g = a.game;
    const ww = wwOf(a);
    const d = ww.depth;
    expect(ww.land.isEnemy(FRA, DEU)).toBe(true);
    // France's agency and code-breakers break Germany's codes and use them.
    expect(d.issue(FRA, { kind: "intel_found" }, g.ticks())).toBeNull();
    d.country(FRA)!.intel.upgrades |=
      upgradeBit("ag_crypto_1") | upgradeBit("ag_crypto_2");
    expect(
      d.issue(FRA, { kind: "crypto_target", target: DEU }, g.ticks()),
    ).toBeNull();
    addDecryptMilli(d, FRA, DEU, 1_000_000);
    expect(
      d.issue(FRA, { kind: "crypto_activate", target: DEU }, g.ticks()),
    ).toBeNull();
    const until = decryptRow(d, FRA, DEU)!.activeUntil;
    expect(until).toBeGreaterThan(dayOf(a) + 60);
    const o = new Oracle(a, humans);
    // Half-way through (mid-day), and the tick before France's turn on the
    // day it ends (its codes change: back to 300‰, Germany learns of it).
    stepTo(a, turnTick(a, FRA, until - 45) - 2);
    expect(exploiting(d, FRA, DEU)).toBe(true);
    await o.restore();
    o.runTo(turnTick(a, FRA, until));
    await o.restore();
    o.runTo(turnTick(a, FRA, until + 3));
    for (const r of [a, ...o.finish()]) {
      const dd = wwOf(r).depth;
      const row = decryptRow(dd, FRA, DEU)!;
      expect(exploiting(dd, FRA, DEU)).toBe(false);
      expect(row.activeUntil).toBe(-2 - until);
      expect(row.progressMilli).toBeGreaterThan(300_000);
      expect(row.progressMilli).toBeLessThan(1_000_000);
    }
  }, 120_000);

  it("restoring mid-project continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "FRA" }];
    const { runner: a, g, ww, d } = await started(humans);
    ww.economy.country(FRA)!.addTech("nuclear_physics");
    // Lyon's whole uranium deposit (2 a day) at infrastructure 5; its lab.
    setInfra(ww, R.lyon, 5);
    ww.economy.buildingArray("facility_nuclear")[R.lyon] = 1;
    d.onFacilityBuilt(R.lyon);
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: R.lyon },
        g.ticks(),
      ),
    ).toBeNull();
    expect(
      d.issue(
        FRA,
        { kind: "project_scientist", project: "sp_atomic", scientist: 0 },
        g.ticks(),
      ),
    ).toBeNull();
    const run = d.country(FRA)!.proj.running[0];
    expect(run.project).toBe(ATOMIC);
    // A day or two short of the second milestone (600‰).
    run.progressMilli = 598_800;
    const pm = (r: GameRunner) =>
      Math.floor(
        wwOf(r).depth.country(FRA)!.proj.running[0].progressMilli / 1000,
      );
    const o = new Oracle(a, humans);
    // Before the milestone, mid-day (France's turn not yet run).
    stepTo(a, turnTick(a, FRA, dayOf(a) + 2) - 2);
    expect(pm(a)).toBeLessThan(600);
    await o.restore();
    let guard = 0;
    while (pm(a) < 600 && guard++ < 30 * 8) o.run(1);
    expect(pm(a)).toBeGreaterThanOrEqual(600);
    // After it, the tick after France's turn that crossed it.
    await o.restore();
    o.run(5 * 8);
    for (const r of [a, ...o.finish()]) {
      expect(pm(r)).toBe(pm(a));
      expect(wwOf(r).depth.lastPriorityGot.get(FRA)).toEqual(
        d.lastPriorityGot.get(FRA),
      );
    }
    expect(d.lastPriorityGot.get(FRA)?.some((v) => v > 0)).toBe(true);
  }, 120_000);

  it("restoring with a nuke queued continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "GBR" }];
    const a = await wwRunner({}, humans, DEEP.map);
    warAfterPrep(a, HUMAN, "DEU");
    const g = a.game;
    const ww = wwOf(a);
    const d = ww.depth;
    stockUp(g, GBR);
    stockUp(g, DEU);
    ww.economy.country(GBR)!.stock[ATOMIC_KEY] = 2;
    // Thirty bombers over the western land zone; German fighters in its sky.
    deploy(g, GBR, WEST, "strat_bomber", "strategic_bombing", 30, R.london);
    deploy(g, DEU, WEST, "fighter", "air_superiority", 40, R.berlin);
    const t = g.ticks();
    for (const region of [R.berlin, R.munich]) {
      expect(
        d.issue(GBR, { kind: "nuke_drop", region, rocket: false }, t),
      ).toBeNull();
    }
    expect(d.nukeQueue.length).toBe(2);
    // Queued: before the zone's day and its interception rolls.
    const o = new Oracle(a, humans);
    await o.restore();
    o.run(3 * 8);
    const copies = o.finish();
    expect(d.nuked.size).toBeGreaterThan(0);
    for (const r of [a, ...copies]) {
      const dd = wwOf(r).depth;
      expect(dd.nukeQueue).toEqual([]);
      expect(wwOf(r).economy.country(GBR)!.stock[ATOMIC_KEY]).toBe(0);
      expect([...dd.nuked.keys()]).toEqual([...d.nuked.keys()]);
    }
  }, 120_000);

  it("restoring mid-market-deal continues exactly", async () => {
    const humans: WwHuman[] = [
      { clientID: "HUMANDEU", country: "DEU" },
      { clientID: "HUMANFRA", country: "FRA" },
    ];
    const { runner: a, g, ww, d } = await started(humans);
    const fra = ww.economy.country(FRA)!;
    const had = fra.stock[INF1];
    expect(
      d.issue(DEU, { kind: "market_list", key: INF1, count: 6000 }, g.ticks()),
    ).toBeNull();
    const listing = d.market.listings[0];
    expect(
      d.issue(
        FRA,
        { kind: "market_buy", listing: listing.id, count: 600 },
        g.ticks(),
      ),
    ).toBeNull();
    const deal = d.market.deals[0];
    const o = new Oracle(a, humans);
    // While it pays (and the first shipments are on the road), mid-day.
    stepTo(a, turnTick(a, FRA, deal.startDay + 12));
    expect(deal.paidMilli).toBeGreaterThan(0);
    expect(deal.paidMilli).toBeLessThan(deal.priceMilli);
    await o.restore();
    // Paid, still delivering.
    o.runTo(turnTick(a, FRA, deal.startDay + MARKET_DAYS + 3));
    expect(deal.paidMilli).toBe(deal.priceMilli);
    expect(deal.deliveredMilli).toBeLessThan(deal.priceMilli);
    await o.restore();
    // Germany withdraws the rest a day on, by order (the same turn to all).
    const unlist = a.game.ticks() + 8;
    o.runTo(dayTick(a, deal.endDay + 2), (t) =>
      t === unlist
        ? [order("HUMANDEU", { kind: "market_unlist", listing: listing.id })]
        : [],
    );
    for (const r of [a, ...o.finish()]) {
      const w = wwOf(r);
      expect(w.depth.market.deals).toEqual([]);
      expect(w.depth.market.listings).toEqual([]);
      expect(w.economy.country(FRA)!.stock[INF1] - had).toBe(
        fra.stock[INF1] - had,
      );
    }
  }, 120_000);

  it("restoring during raid preparation continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "GBR" }];
    const a = await wwRunner({}, humans, DEEP.map);
    warAfterPrep(a, HUMAN, "DEU");
    const g = a.game;
    const ww = wwOf(a);
    const d = ww.depth;
    stockUp(g, GBR);
    const dam = DAMS.indexOf("dam_mohne");
    deploy(g, GBR, WEST, "strat_bomber", "strategic_bombing", 40, R.london);
    const dep = deploy(
      g,
      GBR,
      WEST,
      "strat_bomber",
      "strategic_bombing",
      20,
      R.london,
    );
    // The raid's uid made to succeed whatever its odds (as lane S's tests).
    const from = d.nextUid;
    d.nextUid = findRoll(
      ww.politics.seed,
      P_RAID,
      (n, roll) => n >= from && roll % 1_000_000 < 50_000,
    );
    const day = dayOf(a);
    expect(
      d.issue(
        GBR,
        {
          kind: "raid",
          raid: "raid_bomb",
          unit: dep.id,
          target: R.munich,
          building: "dam",
        },
        g.ticks(),
      ),
    ).toBeNull();
    const ready = d.raids[0].readyDay;
    expect(ready).toBeGreaterThan(day + 3);
    const o = new Oracle(a, humans);
    stepTo(a, turnTick(a, GBR, day + 3) - 1);
    await o.restore();
    o.runTo(dayTick(a, ready + 3));
    for (const r of [a, ...o.finish()]) {
      const dd = wwOf(r).depth;
      expect(dd.raids).toEqual([]);
      // The raid went in: the dam is gone, its land flooded.
      expect(dd.world.damLevel[dam]).toBe(0);
      expect(dd.world.floodUntil.length).toBe(2);
    }
  }, 120_000);

  it("restoring during a flood continues exactly", async () => {
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "GBR" }];
    const { runner: a, g, ww, d } = await started(humans);
    // Germany fights Poland through the flooded land.
    ww.setWar(DEU, POL, g.ticks(), { kind: "declare" });
    const mohne = DEEP.dam.dam_mohne;
    const day0 = dayOf(a);
    destroyDam(d, mohne.index, GBR, g.ticks());
    expect(d.world.floodUntil.length).toBe(2);
    // The 60 days cut to 12 (the row holds the last wet day).
    for (const row of d.world.floodUntil) row[1] = day0 + 11;
    const o = new Oracle(a, humans);
    stepTo(a, turnTick(a, DEU, day0 + 5) + 1);
    expect(regionStatus(d, mohne.region).supplyPm).toBe(500);
    await o.restore();
    o.runTo(dayTick(a, day0 + 14));
    for (const r of [a, ...o.finish()]) {
      const dd = wwOf(r).depth;
      expect(dd.world.floodUntil).toEqual([]);
      expect(regionStatus(dd, mohne.region).supplyPm).toBe(1000);
    }
  }, 120_000);

  it("restoring with mines and an ace continues exactly", async () => {
    const humans: WwHuman[] = [
      { clientID: "HUMANGBR", country: "GBR" },
      { clientID: "HUMANITA", country: "ITA" },
    ];
    const { runner: a, g, ww, d } = await started(humans);
    ww.setWar(GBR, ITA, g.ticks());
    stockUp(g, GBR);
    stockUp(g, ITA);
    // Italy lays mines in the central waters; Britain sweeps and patrols there.
    ddDesign(d, ITA, "mine_layer");
    ddDesign(d, GBR, "minesweep");
    fleetOn(g, ITA, R.rome, 3, 2, "lay_mines");
    fleetOn(g, GBR, R.malta, 2, 2, "sweep_mines");
    fleetOn(g, GBR, R.malta, 2, 0, "patrol");
    d.sea.mines = [[CENTRAL, ww.land.sideOf(ITA), 300_000]];
    d.reindexSparse();
    // Fighters of both over the western land zone, British recon; an ace on
    // Britain's biggest record, as the zone's day makes one.
    const big = deploy(
      g,
      GBR,
      WEST,
      "fighter",
      "air_superiority",
      60,
      R.london,
    );
    deploy(g, GBR, WEST, "fighter", "recon", 10, R.london);
    deploy(g, ITA, WEST, "fighter", "air_superiority", 60, R.rome);
    const ace = {
      id: d.uid(),
      owner: GBR,
      deployment: big.id,
      sinceDay: dayOf(a),
      callNo: aceCallNo(big.id),
    };
    d.sea.aces = [...d.sea.aces, ace];
    big.ace = ace.id;
    ww.air.markDeployment(big.id);
    const o = new Oracle(a, humans);
    stepTo(a, turnTick(a, GBR, dayOf(a) + 3) - 1);
    await o.restore();
    o.runTo(turnTick(a, ITA, dayOf(a) + 12));
    await o.restore();
    o.run(10 * 8);
    for (const r of [a, ...o.finish()]) {
      const dd = wwOf(r).depth;
      expect(dd.sea.mines).toEqual(d.sea.mines);
      expect(dd.sea.aces).toEqual(d.sea.aces);
    }
    expect(d.sea.mines.length).toBeGreaterThan(0);
  }, 120_000);

  it("the depth hash matches across two runs", async () => {
    // Two games of one seed, AI everywhere, the same hand at the same tick:
    // wars, an agency breaking codes, a minefield, a blown dam.
    const run = async (): Promise<number[]> => {
      const { runner, g, ww, d } = await started([]);
      const out: number[] = [];
      for (let i = 0; i < 1500; i++) {
        if (i === 10) {
          ww.setWar(DEU, POL, g.ticks(), { kind: "declare" });
          ww.setWar(GBR, ITA, g.ticks(), { kind: "declare" });
        }
        if (i === 20) {
          d.country(GBR)!.intel.agency = true;
          d.country(GBR)!.intel.cryptoTarget = ITA;
          addDecryptMilli(d, GBR, ITA, 900_000);
          d.sea.mines = [[CENTRAL, ww.land.sideOf(ITA), 400_000]];
          d.reindexSparse();
        }
        if (i === 30) destroyDam(d, DEEP.dam.dam_mohne.index, GBR, g.ticks());
        step(runner);
        out.push(d.hash(), ww.hash(), gameHash(runner));
      }
      return out;
    };
    const x = await run();
    const y = await run();
    const first = x.findIndex((v, i) => v !== y[i]);
    expect(first).toBe(-1);
  }, 180_000);
});

describe("World War 1936 P6: derived depth fields (plan Task 23 Step 2)", () => {
  /** rebuildDerived (and the first read) makes them from state: equal after it. */
  const REBUILT = [
    "designStatCache",
    "keyStatTables",
    "mineIndex",
    "facilityIndex",
    "regionStatusIndex",
    "resistBoostIndex",
    "reconIndex",
    "designCacheKey",
  ] as const;
  /**
   * Versions the caches outside key on (P2's StatsInputs, P4's ship and
   * plane memos): rebuildDerived moves keyStatsSeq and clears designVer, so
   * no cache entry built against the old tables can hit (a restored game's
   * caches start empty).
   */
  const VERSIONS = ["keyStatsSeq", "designVer"] as const;
  /** armyMods' reused query object (written before every read). */
  const SCRATCH = ["modQuery"] as const;
  /** Screens' buffers: emptied by takeData, never read by the rules. */
  const SCREEN = [
    "depthFx",
    "depthNews",
    "depthDirty",
    "depthDirtyIntel",
    "depthDirtyDesigns",
    "depthDirtyGlobal",
    "congressLlSent",
  ] as const;

  const humans: WwHuman[] = [{ clientID: HUMAN, country: "FRA" }];

  /** A game with some of every index: designs, a minefield, a lab, a flood, the §0-8 tuples. */
  async function rich() {
    const s = await started(humans);
    const { runner, g, ww, d } = s;
    const deu = d.country(DEU)!;
    deu.des.tank[1] = {
      def: TEST_TANK as never,
      origin: "own",
      from: 0,
      fromSlot: 0,
      obsolete: false,
      savedDay: 0,
    };
    d.markDesign(DEU, "tank", 2);
    ddDesign(d, ITA, "mine_layer");
    d.sea.mines = [
      [CENTRAL, ww.land.sideOf(ITA), 200_000],
      [DEEP.sr.approaches, ww.land.sideOf(GBR), 100_000],
    ];
    d.sea.reconBySide = [[GBR, WEST, 12]];
    d.resistBoost = [[R.warsaw, 5]];
    d.reindexSparse();
    ww.economy.buildingArray("facility_nuclear")[R.lyon] = 1;
    d.onFacilityBuilt(R.lyon);
    destroyDam(d, DEEP.dam.dam_mohne.index, GBR, g.ticks());
    step(runner, 3);
    expect(d.world.regionStatus.length).toBeGreaterThan(0);
    expect(d.facilityIndex.size).toBeGreaterThan(0);
    return s;
  }

  it("every derived depth field is rebuilt from state", async () => {
    const { runner, d } = await rich();
    const rec = d as unknown as Record<string, unknown>;
    // Every depth field the oracle leaves out is classified here.
    const derivedHere = Object.keys(d).filter((k) => DERIVED_FIELDS.has(k));
    expect([...derivedHere].sort()).toEqual(
      [...REBUILT, ...VERSIONS, ...SCRATCH, ...SCREEN].sort(),
    );
    // The values made on one day and read on a later one are state (§0-8).
    for (const k of ["lastPriorityGot", "resistBoost", "dayTally"]) {
      expect(DERIVED_FIELDS.has(k)).toBe(false);
    }
    expect(DERIVED_FIELDS.has("reconBySide")).toBe(false);
    expect(DERIVED_FIELDS.has("regionStatus")).toBe(false);
    // The indexes and tables as the game built them (the lazy ones read).
    const read = () => {
      for (let id = 1; id < d.cap; id++) {
        if (d.country(id) === null) continue;
        d.keyStats(id);
        d.designStatsOf(id, "tank", 1);
      }
    };
    read();
    const clone = (v: unknown): unknown =>
      v instanceof Map
        ? new Map([...v].map(([k, x]) => [k, clone(x)]))
        : v instanceof Set
          ? new Set(v)
          : ArrayBuffer.isView(v)
            ? (v as Int32Array).slice()
            : Array.isArray(v)
              ? v.map(clone)
              : v;
    const before = Object.fromEntries(REBUILT.map((k) => [k, clone(rec[k])]));
    const seq = d.keyStatsSeq;
    expect(d.designVersion(DEU)).toBeGreaterThan(0);
    for (const k of REBUILT) {
      // Broken on purpose: emptied and filled with junk.
      const v = rec[k] as Map<number, unknown>;
      v.clear();
      v.set(999, [999] as never);
    }
    d.rebuildDerived();
    read();
    for (const k of REBUILT) expect([k, rec[k]]).toEqual([k, before[k]]);
    expect(d.keyStatsSeq).toBeGreaterThan(seq);
    expect(d.designVersion(DEU)).toBe(0);
    // And the game goes on as a restored copy does.
    const o = new Oracle(runner, humans);
    await o.restore();
    o.run(40);
    o.finish();
  }, 120_000);

  it("the intel neighbour table follows the state it is made from", async () => {
    // Lane I's neighbour table (plan Task 5 Step 5) is the observer row's
    // land neighbours (P1's lists) and the harbour zones the tick's first
    // row lists (IntelLevels' tick cache, never state): a restored copy makes
    // it afresh, the live game keeps its own, and both follow a change of
    // control on the next row. Britain (human: a row every day) and the
    // Soviet Union share nothing until Britain holds the Isthmus (its land
    // borders Kiev, its harbour is on Kiev's waters); nothing else between
    // them changes.
    const humans: WwHuman[] = [{ clientID: HUMAN, country: "GBR" }];
    const { runner: a } = await started(humans);
    stepTo(a, dayTick(a, dayOf(a) + 2));
    const row = (r: GameRunner) =>
      [0, 1, 2, 3].map((dom) => wwOf(r).depth.intelOf(GBR, SUN, dom));
    const before = row(a);
    expect(before.every((v) => v < 100)).toBe(true);
    const o = new Oracle(a, humans);
    const b = await o.restore();
    // Britain takes the Isthmus from Turkey (a war of theirs, in both).
    for (const r of [a, b]) {
      wwOf(r).setWar(GBR, TUR, r.game.ticks(), { kind: "declare" });
      takeRegion(r.game, R.isthmus, "GBR");
    }
    // P1's mirror of control moves on the next day's common step; Britain's
    // turn that day makes the row.
    o.run(2 * 8);
    for (const r of [a, b]) {
      expect(wwOf(r).economy.countryNeighbours(GBR)).toContain(SUN);
      expect(row(r)).toEqual(before.map((v) => v + 10));
    }
    o.finish();
  }, 120_000);

  it("the screens' buffers never reach the state", async () => {
    const { runner: a, d } = await rich();
    const o = new Oracle(a, humans);
    const b = await o.restore();
    const db = wwOf(b).depth;
    // Junk in every buffer of B (A keeps its own).
    const rec = db as unknown as Record<string, unknown>;
    rec.depthFx = [
      { kind: "dam", region: 1, from: 1, owner: 1, tick: 1 },
    ] as unknown;
    rec.depthNews = [{ id: "junk", params: {} }];
    (rec.depthDirty as Set<number>).add(1).add(2).add(3);
    (rec.depthDirtyIntel as Set<number>).add(1).add(2);
    rec.depthDirtyDesigns = [[1, "tank", 1]];
    rec.depthDirtyGlobal = true;
    rec.congressLlSent = false;
    o.run(40);
    o.finish();
    // takeData empties them every tick (the runner sends the updates).
    expect(rec.depthNews).toEqual([]);
    expect((rec.depthDirty as Set<number>).size).toBe(0);
    expect((d as unknown as { depthDirty: Set<number> }).depthDirty.size).toBe(
      0,
    );
  }, 120_000);

  it("the values made on one day and read on a later one are state (pre-flight §0-8)", async () => {
    // France's atomic project draws uranium (lastPriorityGot, written on
    // the economy turn, read on the next day's depth turn); Britain's recon
    // over the western zone (reconBySide, written on the zone's day, read on
    // the observers' turns); a flood (regionStatus); the resistance table.
    const { runner: a, g, ww, d } = await rich();
    ww.economy.country(FRA)!.addTech("nuclear_physics");
    setInfra(ww, R.lyon, 5);
    expect(
      d.issue(
        FRA,
        { kind: "project_start", project: "sp_atomic", facility: R.lyon },
        g.ticks(),
      ),
    ).toBeNull();
    stockUp(g, GBR);
    deploy(g, GBR, WEST, "fighter", "recon", 20, R.london);
    // Two days on: every value made at least once; then the tick after
    // France's economy turn (it wrote today's uranium; its depth turn reads
    // it tomorrow).
    stepTo(a, turnTick(a, FRA, dayOf(a) + 2) + 1);
    expect(d.lastPriorityGot.get(FRA)?.some((v) => v > 0)).toBe(true);
    const side = ww.land.sideOf(GBR);
    expect(d.sea.reconBySide.some(([s]) => s === side)).toBe(true);
    expect(d.world.regionStatus.length).toBeGreaterThan(0);
    const o = new Oracle(a, humans);
    const b = await o.restore();
    const db = wwOf(b).depth;
    // Carried exactly by the snapshot (not rebuilt), and folded into the hash.
    expect(db.lastPriorityGot).toEqual(d.lastPriorityGot);
    expect(db.sea.reconBySide).toEqual(d.sea.reconBySide);
    expect(db.world.regionStatus).toEqual(d.world.regionStatus);
    expect(db.resistBoost).toEqual(d.resistBoost);
    const h = db.hash();
    const got = db.lastPriorityGot.get(FRA)!;
    db.lastPriorityGot.set(
      FRA,
      got.map((v) => v + 1),
    );
    expect(db.hash()).not.toBe(h);
    db.lastPriorityGot.set(FRA, got);
    const recon = db.sea.reconBySide;
    db.sea.reconBySide = recon.map(([s, sr, n]) => [s, sr, n + 1]);
    expect(db.hash()).not.toBe(h);
    db.sea.reconBySide = recon;
    expect(db.hash()).toBe(h);
    // Through the days that read them.
    o.run(3 * 8);
    o.finish();
  }, 120_000);
});
