// The air overhaul's lane B (ww8): the sortie cycle, the pulses, escort and
// interception, the superiority score, the zones' close, close air support in
// the battles and their odds, wing_mission. Wing-model games on ww1936sea,
// driven through stepWings and pulseZones (or the real tick where it matters).
import {
  WING_NO_MISSION,
  WingFlightRow,
  WP_BACK,
  WP_GROUND,
  WP_OUT,
  WP_REARM,
  WP_STATION,
  WW_RADAR_WARN_TICKS,
} from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import { airGroundPenaltyBp } from "@openfront/engine-lib/ww1936/AirRules";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { predictBattle } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  airLuckPm,
  casTickCenti,
  escortKeepPm,
  legTicks,
  pulseMilli,
  rearmTicks,
} from "@openfront/engine-lib/ww1936/WingRules";
import { airDuelMilli } from "@openfront/engine/ww1936/air/AirCombat";
import { casHitsFor } from "@openfront/engine/ww1936/air/AirEffects";
import { radarPmAt } from "@openfront/engine/ww1936/air/AirSuperiority";
import {
  closeAirZone,
  pulseZones,
  radarAt,
  stepWings,
  wingStats,
} from "@openfront/engine/ww1936/air/Sorties";
import { type Wing, wingPlanes } from "@openfront/engine/ww1936/air/WwAir";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import { joinBattle, stepBattles } from "@openfront/engine/ww1936/land/Battles";
import { fillDecks } from "@openfront/engine/ww1936/navy/Carriers";
import { airOf } from "@openfront/engine/ww1936/navy/ConvoyWar";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  clearLand,
  clearStartSetup,
  gameHash,
  HUMAN,
  order,
  placeArmy,
  step,
  warAfterPrep,
  withTestPolitics,
  WwHuman,
  wwRestore,
  wwRunner,
} from "./util";
import { giveWing, liveWings } from "./wingUtil";

withTestPolitics();

const DEU = TAG_ID.DEU;
const POL = TAG_ID.POL;
const HUMANS: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];

/** Germany and Poland at war, the board cleared, wings on, air bases at both ends. */
async function war() {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  const g = runner.game;
  const ww = g.worldWar()!;
  for (const id of [DEU, POL]) {
    clearStartSetup(ww.economy, ww.economy.country(id)!);
  }
  warAfterPrep(runner, HUMAN, "POL");
  clearLand(g);
  const air = ww.air;
  liveWings(air);
  ww.economy.addBuilding(REGION.warsaw, "air_base", 4);
  ww.economy.addBuilding(REGION.berlin, "air_base", 4);
  const rows: WingFlightRow[] = [];
  const note = air.noteFlight.bind(air);
  air.noteFlight = (r) => {
    rows.push(r);
    note(r);
  };
  const notices: string[] = [];
  const message = air.message.bind(air);
  air.message = (to, key, params) => {
    notices.push(key);
    message(to, key, params);
  };
  // A tick on a day clear over both ends of the map.
  const land = air.land;
  let day = ww.day(g.ticks()) + 1;
  while (
    land.weatherOn(REGION.berlin, day) !== "clear" ||
    land.weatherOn(REGION.krakow, day) !== "clear" ||
    land.weatherOn(REGION.warsaw, day) !== "clear"
  ) {
    day++;
  }
  const tick = dayStartTick(day, ww.prepEndTick());
  return { runner, g, ww, air, land, rows, notices, tick };
}

type Air = Awaited<ReturnType<typeof war>>["air"];

/** Runs the two air steps from `from` through `to`. */
function drive(air: Air, from: number, to: number): void {
  for (let t = from; t <= to; t++) {
    stepWings(air, t);
    pulseZones(air, t);
  }
}

/** Runs ticks until the wing's phase changes; returns [phase, tick]. */
function untilPhase(air: Air, w: Wing, phase: number, from: number): number {
  for (let t = from; t < from + 500; t++) {
    stepWings(air, t);
    pulseZones(air, t);
    if (w.phase === phase) return t;
  }
  throw new Error(`wing never reached phase ${phase}`);
}

describe("the sortie cycle (design §3.5)", () => {
  test("out, station, back, rearm, and out again, the fuel only at take-off", async () => {
    const { ww, air, rows, tick } = await war();
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    const ce = ww.economy.country(DEU)!;
    const km = ww.scenario.targetKm(REGION.berlin, REGION.krakow);
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [w.id],
          mission: "air_superiority",
          target: REGION.krakow,
        },
        tick,
      ),
    ).toBeNull();
    expect(w.mission).toBe(0);
    expect(w.sr).toBe(ww.scenario.regionSr(REGION.krakow));
    expect(w.phase).toBe(WP_GROUND);
    const fuel0 = ce.fuelLedgerMilli;
    const off = untilPhase(air, w, WP_OUT, tick);
    const st = wingStats(air, w);
    const L = legTicks(km, st.speedKmh);
    expect(w.leg).toBe(L);
    expect(w.flySr).toBe(w.sr);
    expect(w.hit).toBe(REGION.krakow);
    expect(w.flyMilli).toBe(100_000);
    expect(rows[rows.length - 1]).toEqual([
      w.id,
      WP_OUT,
      off + L,
      L,
      10,
      5,
      REGION.krakow,
      100,
    ]);
    const burned = ce.fuelLedgerMilli - fuel0;
    expect(burned).toBeGreaterThan(0);
    expect(untilPhase(air, w, WP_STATION, off + 1)).toBe(off + L);
    expect(untilPhase(air, w, WP_BACK, off + L + 1)).toBe(off + L + 10);
    expect(untilPhase(air, w, WP_REARM, off + L + 11)).toBe(off + 2 * L + 10);
    expect(w.flySr).toBe(0);
    expect(w.flyMission).toBe(WING_NO_MISSION);
    // Nothing more burned on the whole trip.
    expect(ce.fuelLedgerMilli - fuel0).toBe(burned);
    const again = untilPhase(air, w, WP_OUT, off + 2 * L + 11);
    expect(again).toBe(off + 2 * L + 10 + 5);
    expect(rows.filter((r) => r[1] === WP_OUT)).toHaveLength(2);
  });

  test("wings ordered together leave in staggered waves; a bombed base rearms slower", async () => {
    const { ww, air, tick } = await war();
    const a = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    const b = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    air.issue(
      DEU,
      {
        kind: "wing_mission",
        wings: [a.id, b.id],
        mission: "air_superiority",
        target: REGION.krakow,
      },
      tick,
    );
    const lag = (w: Wing) => w.until - tick;
    expect(Math.abs(lag(a) - lag(b))).toBe(3);
    const off = untilPhase(air, a, WP_REARM, tick);
    const plain = a.until - off;
    expect(plain).toBe(5);
    damageBuilding(ww.economy, REGION.berlin, "air_base", 2000);
    const dmg = air.baseDamagePm(REGION.berlin);
    expect(dmg).toBeGreaterThan(0);
    const next = untilPhase(air, a, WP_OUT, off + 1);
    const back = untilPhase(air, a, WP_REARM, next + 1);
    expect(a.until - back).toBe(rearmTicks(5, dmg));
  });

  test("no work, no flight: no fuel, a look every few ticks", async () => {
    const { ww, air, tick, notices } = await war();
    const ce = ww.economy.country(DEU)!;
    const fuel0 = ce.fuelLedgerMilli;
    // Close air support with no battle anywhere.
    const cas = giveWing(air, {
      owner: DEU,
      type: "cas",
      planes: 100,
      base: REGION.berlin,
    });
    air.issue(
      DEU,
      {
        kind: "wing_mission",
        wings: [cas.id],
        mission: "cas",
        target: REGION.krakow,
      },
      tick,
    );
    // No orders at all.
    const idle = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    // Too few planes: it stays down, and says so once a week.
    const weak = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 20,
      base: REGION.berlin,
    });
    air.issue(
      DEU,
      {
        kind: "wing_mission",
        wings: [weak.id],
        mission: "air_superiority",
        target: REGION.krakow,
      },
      tick,
    );
    drive(air, tick, tick + 40);
    expect(cas.phase).toBe(WP_GROUND);
    expect(idle.phase).toBe(WP_GROUND);
    expect(weak.phase).toBe(WP_GROUND);
    expect(ce.fuelLedgerMilli).toBe(fuel0);
    const said = notices.filter((k) => k.endsWith("ww1936_wing_understrength"));
    expect(said).toHaveLength(1);
    drive(air, tick + 41, tick + 40 + 8 * 8);
    expect(
      notices.filter((k) => k.endsWith("ww1936_wing_understrength")).length,
    ).toBeGreaterThan(1);
  });

  test("a ferry's until holds its rest: past it the wing is on the ground and flies", async () => {
    const { air, tick } = await war();
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
      sr: SR.eastLand,
      target: REGION.krakow,
      mission: "air_superiority",
      phase: 5,
      until: tick + 3,
      hit: REGION.munich,
    });
    drive(air, tick, tick + 2);
    expect(w.phase).toBe(5);
    drive(air, tick + 3, tick + 3);
    expect(w.phase).toBe(WP_OUT);
    expect(w.hit).toBe(REGION.krakow);
  });

  test("a new order flies from the next sortie; standing down turns home at once", async () => {
    const { air, rows, tick } = await war();
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    air.issue(
      DEU,
      {
        kind: "wing_mission",
        wings: [w.id],
        mission: "air_superiority",
        target: REGION.krakow,
      },
      tick,
    );
    const on = untilPhase(air, w, WP_STATION, tick);
    const until = w.until;
    air.issue(
      DEU,
      {
        kind: "wing_mission",
        wings: [w.id],
        mission: "interception",
        target: REGION.berlin,
      },
      on,
    );
    expect(w.mission).toBe(1);
    expect(w.sr).toBe(air.ww.scenario.regionSr(REGION.berlin));
    expect(w.flyMission).toBe(0);
    expect(w.flySr).toBe(air.ww.scenario.regionSr(REGION.krakow));
    expect(w.hit).toBe(REGION.krakow);
    expect(w.until).toBe(until);
    // Stand down: home now, with a row, and no more sums.
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [w.id],
          mission: "air_superiority",
          target: 0,
        },
        on + 1,
      ),
    ).toBeNull();
    expect(w.mission).toBe(WING_NO_MISSION);
    expect(w.sr).toBe(0);
    expect(w.phase).toBe(WP_BACK);
    expect(w.flyMilli).toBe(0);
    expect(w.until).toBe(on + 1 + w.leg);
    const r = rows[rows.length - 1];
    expect(r[0]).toBe(w.id);
    expect(r[1]).toBe(WP_BACK);
    expect(r[2]).toBe(w.until);
    // It lands, rearms, and stays down.
    drive(air, on + 2, on + 40);
    expect(w.phase).toBe(WP_GROUND);
  });
});

describe("the pulses (design §3.6)", () => {
  /** Two fighter wings on station over a sea zone, fought to the pulse only. */
  async function dogfight() {
    const fix = await war();
    const { air } = fix;
    const f = (owner: number, base: number) =>
      giveWing(air, {
        owner,
        type: "fighter",
        planes: 150,
        base,
        sr: SR.central,
        target: ZONE.middle,
        mission: "air_superiority",
        flying: true,
        until: fix.tick + 100_000,
      });
    const a = f(DEU, REGION.berlin);
    const b = f(POL, REGION.warsaw);
    a.until = b.until = fix.tick + 100_000;
    return { ...fix, a, b };
  }

  test("150 v 150 at the reference distance: the old day's losses, ±15%", async () => {
    const { air, a, b, tick, ww } = await dogfight();
    const days = 24;
    // Fighting every pulse flies far more than a day's work: what must match
    // the old day is the loss per sortie's worth of pulses (pulseMilli is the
    // unit), over enough days for the daily luck to average out.
    const ends = tick + days * 8;
    let pulses = 0;
    for (let t = tick; t < ends; t++) {
      pulseZones(air, t);
      if (t % 2 === air.ww.scenario.srIdxOf(SR.central) % 2) pulses++;
    }
    const lost = (w: Wing) => (150 - wingPlanes(w)) * 1000 + w.lossRest;
    const st = wingStats(air, a);
    const pm = pulseMilli(150_000, "fighter", "air_superiority");
    // What the old day's formula gives for 150 sorties a side.
    const old = airDuelMilli(
      [{ stats: st, milli: 150_000, weight: 1 }],
      [{ stats: st, milli: 150_000, weight: 200 }],
      300,
    );
    expect(old).toBeGreaterThan(2_000);
    expect(old).toBeLessThan(2_800);
    const sorties = (pulses * pm) / 150_000;
    expect(lost(a) / sorties).toBeGreaterThan(old * 0.85);
    expect(lost(a) / sorties).toBeLessThan(old * 1.15);
    expect(lost(b) / sorties).toBeGreaterThan(old * 0.85);
    expect(lost(b) / sorties).toBeLessThan(old * 1.15);
    // The kills add up to the planes that fell, and the day's rows hold them.
    expect(a.kills).toBe(150 - wingPlanes(b));
    expect(b.kills).toBe(150 - wingPlanes(a));
    expect(a.dayKills).toBe(a.kills);
    expect(a.dayLost).toBe(150 - wingPlanes(a));
    const z = air.zoneState[ww.scenario.srIdxOf(SR.central)];
    expect(z.today.result.get(DEU)![1]).toBe(150 - wingPlanes(a));
    expect(z.today.result.get(POL)![0]).toBe(150 - wingPlanes(a));
    expect(air.planesLostTotal).toBe(300 - wingPlanes(a) - wingPlanes(b));
  });

  test("a day's luck is fixed, a triangle around 1000", async () => {
    const seen = new Set<number>();
    let sum = 0;
    for (let d = 0; d < 400; d++) {
      const v = airLuckPm(7, SR.central, d);
      expect(v).toBeGreaterThanOrEqual(800);
      expect(v).toBeLessThanOrEqual(1200);
      expect(airLuckPm(7, SR.central, d)).toBe(v);
      seen.add(v);
      sum += v;
    }
    expect(seen.size).toBeGreaterThan(50);
    expect(sum / 400).toBeGreaterThan(960);
    expect(sum / 400).toBeLessThan(1040);
  });

  test("a sweep hits fighters first and an interceptor the others; escort cuts a bomber's losses", async () => {
    expect(escortKeepPm(0, 0, 100_000)).toBe(1000);
    expect(escortKeepPm(100_000, 0, 100_000)).toBe(400);
    expect(escortKeepPm(0, 50_000, 100_000)).toBe(400);
    expect(escortKeepPm(25_000, 0, 100_000)).toBe(850);
    const { air, tick, ww } = await war();
    const idx = ww.scenario.srIdxOf(SR.central);
    const t0 = tick + ((idx - tick) % 2 === 0 ? 0 : 1);
    const hunter = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 150,
      base: REGION.berlin,
      sr: SR.central,
      target: ZONE.middle,
      mission: "air_superiority",
      flying: true,
    });
    const bomber = giveWing(air, {
      owner: POL,
      type: "bomber",
      planes: 100,
      base: REGION.warsaw,
      sr: SR.central,
      target: ZONE.middle,
      mission: "strategic_bombing",
      flying: true,
    });
    hunter.until = bomber.until = tick + 100_000;
    const esc = giveWing(air, {
      owner: POL,
      type: "fighter",
      planes: 50,
      base: REGION.warsaw,
      sr: SR.central,
      target: ZONE.middle,
      mission: "escort",
      flying: true,
    });
    esc.until = tick + 100_000;
    // The same pulse twice: not linked, then linked. Only the cut differs.
    pulseZones(air, t0);
    const unlinked = bomber.lossRest;
    expect(unlinked).toBeGreaterThan(0);
    bomber.lossRest = 0;
    esc.escortOf = bomber.id;
    pulseZones(air, t0);
    expect(
      Math.abs(bomber.lossRest - Math.floor(unlinked * 0.4)),
    ).toBeLessThanOrEqual(2);
    expect(esc.lossRest).toBeGreaterThan(0);
    // The escort shoots back at the hunter too.
    expect(hunter.lossRest).toBeGreaterThan(0);
  });

  test("escorts leave with their bomber and land with it", async () => {
    const { ww, air, tick } = await war();
    const bomber = giveWing(air, {
      owner: DEU,
      type: "strat_bomber",
      planes: 100,
      base: REGION.berlin,
    });
    const esc = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [bomber.id],
          mission: "strategic_bombing",
          target: REGION.krakow,
          cls: "auto",
        },
        tick,
      ),
    ).toBeNull();
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [esc.id],
          mission: "escort",
          target: 0,
          escort: bomber.id,
        },
        tick,
      ),
    ).toBeNull();
    expect(esc.escortOf).toBe(bomber.id);
    expect(esc.sr).toBe(ww.scenario.regionSr(REGION.krakow));
    const off = untilPhase(air, bomber, WP_OUT, tick);
    expect(esc.phase).toBe(WP_OUT);
    expect(esc.until).toBe(bomber.until);
    expect(esc.hit).toBe(REGION.krakow);
    expect(esc.flyMission).toBe(10);
    const onSt = untilPhase(air, bomber, WP_STATION, off + 1);
    expect(esc.phase).toBe(WP_STATION);
    expect(esc.until).toBe(bomber.until);
    untilPhase(air, bomber, WP_BACK, onSt + 1);
    expect(esc.phase).toBe(WP_BACK);
    expect(esc.until).toBe(bomber.until);
  });

  test("the guns: a bombing run takes them on its whole load at the drop", async () => {
    const { ww, air, tick } = await war();
    ww.economy.addBuilding(REGION.krakow, "anti_air", 5);
    const bomber = giveWing(air, {
      owner: DEU,
      type: "strat_bomber",
      planes: 100,
      base: REGION.berlin,
    });
    air.issue(
      DEU,
      {
        kind: "wing_mission",
        wings: [bomber.id],
        mission: "strategic_bombing",
        target: REGION.krakow,
        cls: "auto",
      },
      tick,
    );
    const on = untilPhase(air, bomber, WP_STATION, tick);
    expect(bomber.lossRest).toBe(0);
    const fly = bomber.flyMilli;
    const back = untilPhase(air, bomber, WP_BACK, on + 1);
    expect(back).toBe(on + 4);
    // 5 levels × 3‰ on one load (a whole number of planes is gone; the rest in lossRest).
    const lost = (100 - wingPlanes(bomber)) * 1000 + bomber.lossRest;
    const load = Math.floor((50 * 200) / 15); // refCycle 50
    const expected = Math.floor((Math.floor((fly * load) / 100) * 15) / 1000);
    expect(lost).toBe(expected);
  });
});

describe("interception (design §3.7)", () => {
  async function raid(opts: { radar: boolean; named: boolean }) {
    const fix = await war();
    const { ww, air, tick } = fix;
    if (opts.radar) ww.economy.addBuilding(REGION.berlin, "radar", 2);
    const target = opts.named ? REGION.krakow : REGION.berlin;
    const guard = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
    });
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [guard.id],
          mission: "interception",
          target: opts.named ? REGION.berlin : target,
        },
        tick,
      ),
    ).toBeNull();
    if (opts.named) air.setWingZone(guard, ww.scenario.regionSr(REGION.krakow));
    if (opts.named) guard.target = REGION.krakow;
    return { ...fix, guard };
  }

  test("no radar and not its zone: it stays down, however the raid goes", async () => {
    const { air, tick, guard } = await raid({ radar: false, named: false });
    const enemy = giveWing(air, {
      owner: POL,
      type: "fighter",
      planes: 100,
      base: REGION.warsaw,
    });
    air.issue(
      POL,
      {
        kind: "wing_mission",
        wings: [enemy.id],
        mission: "air_superiority",
        target: REGION.krakow,
      },
      tick,
    );
    drive(air, tick, tick + 60);
    expect(enemy.flyMission === 0 || enemy.phase !== WP_GROUND).toBe(true);
    expect(guard.phase).toBe(WP_GROUND);
    expect(guard.flyMilli).toBe(0);
  });

  test("under radar it scrambles before the enemy arrives, and goes home when none is left", async () => {
    const { air, tick, guard, ww } = await raid({ radar: true, named: false });
    const sr = ww.scenario.regionSr(REGION.krakow);
    expect(radarPmAt(air, air.land.sideOf(DEU), sr)).toBeGreaterThan(0);
    const enemy = giveWing(air, {
      owner: POL,
      type: "fighter",
      planes: 100,
      base: REGION.warsaw,
    });
    air.issue(
      POL,
      {
        kind: "wing_mission",
        wings: [enemy.id],
        mission: "air_superiority",
        target: REGION.krakow,
      },
      tick,
    );
    const off = untilPhase(air, enemy, WP_OUT, tick);
    const arrival = enemy.until;
    expect(guard.hit).not.toBe(0);
    expect(guard.until).toBe(Math.max(off, arrival - WW_RADAR_WARN_TICKS));
    const up = untilPhase(air, guard, WP_OUT, off);
    expect(up).toBe(Math.max(off + 1, arrival - WW_RADAR_WARN_TICKS));
    expect(guard.flySr).toBe(sr);
    const on = untilPhase(air, guard, WP_STATION, up + 1);
    // The enemy stands down: within the least station plus a pulse it goes home.
    air.issue(
      POL,
      {
        kind: "wing_mission",
        wings: [enemy.id],
        mission: "air_superiority",
        target: 0,
      },
      on,
    );
    const home = untilPhase(air, guard, WP_BACK, on + 1);
    expect(home - on).toBeLessThanOrEqual(6);
    expect(home - on).toBeGreaterThanOrEqual(4);
  });

  test("its named zone with no radar: after the enemy is there", async () => {
    const { air, tick, guard } = await raid({ radar: false, named: true });
    const enemy = giveWing(air, {
      owner: POL,
      type: "fighter",
      planes: 100,
      base: REGION.warsaw,
    });
    air.issue(
      POL,
      {
        kind: "wing_mission",
        wings: [enemy.id],
        mission: "air_superiority",
        target: REGION.krakow,
      },
      tick,
    );
    const off = untilPhase(air, enemy, WP_OUT, tick);
    expect(guard.until).toBe(enemy.until + 2);
    expect(off).toBeGreaterThanOrEqual(tick);
  });

  test("an interceptor that lands is woken while the enemy is still there", async () => {
    const { air, tick, guard } = await raid({ radar: true, named: false });
    const enemy = giveWing(air, {
      owner: POL,
      type: "fighter",
      planes: 100,
      base: REGION.warsaw,
      sr: air.ww.scenario.regionSr(REGION.krakow),
      target: REGION.krakow,
      mission: "air_superiority",
      flying: true,
    });
    enemy.until = tick + 100_000;
    expect(guard.phase).toBe(WP_GROUND);
    drive(air, tick, tick + 8);
    expect(guard.phase).not.toBe(WP_GROUND);
  });

  test("radarAt is radarPmAt, through building, damage and capture", async () => {
    const { ww, air } = await war();
    const check = () => {
      for (const s of ww.scenario.strategicList()) {
        for (const side of [ww.land.sideOf(DEU), ww.land.sideOf(POL)]) {
          expect(radarAt(air, side, s.id)).toBe(radarPmAt(air, side, s.id));
        }
      }
    };
    check();
    ww.economy.addBuilding(REGION.berlin, "radar", 2);
    check();
    ww.economy.addBuilding(REGION.warsaw, "radar", 1);
    check();
    damageBuilding(ww.economy, REGION.berlin, "radar", 1500);
    check();
  });
});

describe("the sky (design §3.8)", () => {
  test("a wing over a zone moves the score, the penalty follows, and it all fades when it leaves", async () => {
    const { ww, air, tick } = await war();
    const sr = ww.scenario.regionSr(REGION.krakow);
    const idx = ww.scenario.srIdxOf(sr);
    const z = air.zoneState[idx];
    const polSide = air.land.sideOf(POL);
    const deuSide = air.land.sideOf(DEU);
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 150,
      base: REGION.berlin,
      sr,
      target: REGION.krakow,
      mission: "air_superiority",
      flying: true,
    });
    w.until = tick + 100_000;
    expect(z.score.size).toBe(0);
    const now = Math.floor((150_000 * wingStats(air, w).supWeightMilli) / 1000);
    const t0 = tick + ((idx - tick) % 2 === 0 ? 0 : 1);
    pulseZones(air, t0);
    expect(z.score.get(deuSide)).toBe(Math.trunc(now / 4));
    expect(air.airSup(deuSide, sr)).toBe(1000);
    // Alone in the sky: the side's enemies fly under its full superiority.
    expect(z.enemySup.get(polSide)).toBe(1000);
    expect(air.airPenaltyBp(REGION.krakow, polSide, 0)).toBe(
      airGroundPenaltyBp(1000, z.enemyPp.get(polSide) ?? 0, 0),
    );
    expect(air.airPenaltyBp(REGION.krakow, polSide, 0)).toBeLessThan(0);
    expect(air.airMoveFactorPm(REGION.krakow, polSide)).toBeLessThan(1000);
    // An enemy arrives: the superiority splits by score, the scores close on their wings.
    const e = giveWing(air, {
      owner: POL,
      type: "fighter",
      planes: 150,
      base: REGION.warsaw,
      sr,
      target: REGION.krakow,
      mission: "air_superiority",
      flying: true,
    });
    e.until = tick + 100_000;
    for (let i = 1; i <= 40; i++) pulseZones(air, t0 + i * 2);
    const sup = air.airSup(deuSide, sr);
    expect(sup).toBeGreaterThan(400);
    expect(sup).toBeLessThan(600);
    expect(z.enemySup.get(deuSide)).toBe(air.airSup(polSide, sr));
    // Both leave: it fades within a few days and the zone goes cold.
    w.phase = WP_BACK;
    e.phase = WP_BACK;
    let t = t0 + 82;
    for (let i = 0; i < 80 && z.score.size > 0; i++) {
      pulseZones(air, t);
      t += 2;
    }
    expect(z.score.size).toBe(0);
    expect(z.sup.size).toBe(0);
    expect(z.enemySup.size).toBe(0);
    expect(z.enemyPp.size).toBe(0);
  });

  test("the close moves today into yesterday, leaves recon, and tells the doctrine", async () => {
    const { ww, air, tick } = await war();
    const sr = SR.central;
    const idx = ww.scenario.srIdxOf(sr);
    const z = air.zoneState[idx];
    const day = ww.day(tick);
    const esc = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 150,
      base: REGION.berlin,
      sr,
      target: ZONE.middle,
      mission: "escort",
      flying: true,
    });
    const sw = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 150,
      base: REGION.berlin,
      sr,
      target: ZONE.middle,
      mission: "air_superiority",
      flying: true,
    });
    esc.until = sw.until = tick + 100_000;
    const t0 = tick + ((idx - tick) % 2 === 0 ? 0 : 1);
    for (let i = 0; i < 8; i++) pulseZones(air, t0 + i * 2);
    const row = z.today.sorties.get(air.land.sideOf(DEU))!;
    expect(row[0]).toBeGreaterThan(0);
    z.today.recon.set(5, 20);
    z.today.navalSearch.set(DEU, 11);
    z.today.navalAsw.set(DEU, 12);
    z.today.navalStrike.set(DEU, 13);
    z.today.airSupply.push([REGION.berlin, 5, 7]);
    const tally = () => ww.depth.dayTally[DEU * 9 + 6];
    const before = tally();
    closeAirZone(air, sr, day, tick);
    // pm × 8 pulses × 2 wings in sorties.
    const sum = Math.floor(row[0] / 1000);
    expect(z.sorties.get(air.land.sideOf(DEU))![0]).toBe(sum);
    expect(z.navalSearch.get(DEU)).toBe(11);
    expect(z.navalAsw.get(DEU)).toBe(12);
    expect(z.navalStrike.get(DEU)).toBe(13);
    expect(z.airSupply).toEqual([[REGION.berlin, 5, 7]]);
    expect(z.fightersSup.get(DEU)).toBeGreaterThan(0);
    // Sweep and escort both count for the air doctrine's track 6.
    expect(tally()).toBeGreaterThan(before);
    expect(z.today.recon.get(5)).toBe(20);
    expect(z.today.sorties.size).toBe(0);
    expect(z.today.navalSearch.size).toBe(0);
    expect(z.today.flown.size).toBe(0);
    expect(z.today.airSupply).toEqual([]);
    // A quiet zone's next close wipes yesterday without a fuss.
    closeAirZone(air, sr, day + 1, tick + 8);
    expect(z.sorties.size).toBe(0);
    expect(z.navalSearch.size).toBe(0);
  });
});

describe("close air support (design §3.6, §4.1)", () => {
  async function battle() {
    const fix = await war();
    const { g, ww, air, land } = fix;
    const ce = ww.economy.country(DEU)!;
    ce.manpower += 500_000;
    const cp = ww.economy.country(POL)!;
    cp.manpower += 500_000;
    const a = placeArmy(g, "DEU", REGION.munich, 2);
    placeArmy(g, "POL", REGION.krakow, 1);
    for (const id of a.divisions) joinBattle(land, id, REGION.krakow);
    stepBattles(land, g.ticks());
    return {
      ...fix,
      armyId: a.id,
      side: land.sideOf(DEU),
      sr: air.ww.scenario.regionSr(REGION.krakow),
    };
  }

  test("the wings on station give the battle its hits, and count on the card and in the odds", async () => {
    const { ww, air, land, tick, side, sr } = await battle();
    const idx = ww.scenario.srIdxOf(sr);
    const t0 = tick + ((idx - tick) % 2 === 0 ? 0 : 1);
    const b = land.battles.get(REGION.krakow)!;
    const plain = land.battleSummary(b);
    expect(plain.casAtt).toBeUndefined();
    const w = giveWing(air, {
      owner: DEU,
      type: "cas",
      planes: 100,
      base: REGION.berlin,
      sr,
      target: REGION.krakow,
      mission: "cas",
      flying: true,
    });
    w.until = tick + 100_000;
    expect(casHitsFor(air, REGION.krakow, side)).toBe(0);
    pulseZones(air, t0);
    const st = wingStats(air, w);
    const hits = casTickCenti(
      100_000,
      st.ground,
      ww.economy.country(DEU)!.stats.casPct,
      "cas",
    );
    expect(hits).toBeGreaterThan(0);
    expect(casHitsFor(air, REGION.krakow, side)).toBe(hits);
    expect(air.zoneState[idx].casNow).toEqual([[REGION.krakow, side, hits]]);
    expect(air.zoneState[idx].today.result.get(DEU)![2]).toBeGreaterThan(0);
    const summary = land.battleSummary(b);
    expect(summary.casAtt).toBe(1);
    expect(summary.casDef).toBeUndefined();
    expect(summary.midPm!).toBeGreaterThan(plain.midPm!);
    // When it leaves, the hits stop at the next pulse.
    w.phase = WP_BACK;
    pulseZones(air, t0 + 2);
    expect(casHitsFor(air, REGION.krakow, side)).toBe(0);
    expect(air.zoneState[idx].casNow).toEqual([]);
  });

  test("anti-air on the wing: the line's guns, and the region's when attacking", async () => {
    const { ww, air, tick, sr } = await battle();
    ww.economy.addBuilding(REGION.krakow, "anti_air", 5);
    const idx = ww.scenario.srIdxOf(sr);
    const t0 = tick + ((idx - tick) % 2 === 0 ? 0 : 1);
    const w = giveWing(air, {
      owner: DEU,
      type: "cas",
      planes: 100,
      base: REGION.berlin,
      sr,
      target: REGION.krakow,
      mission: "cas",
      flying: true,
    });
    w.until = tick + 100_000;
    pulseZones(air, t0);
    expect(w.lossRest).toBeGreaterThan(0);
  });

  test("predictBattle: close air support adds to the side it helps", () => {
    const side = {
      divisions: 2,
      width: 16,
      soft: 2000,
      hard: 200,
      def: 2000,
      brk: 2000,
      armor: 0,
      pierce: 0,
      hardnessPm: 100,
      orgMilli: 60_000,
      hpMilli: 40_000,
    };
    const ctx = {
      land: "plains" as const,
      directions: 1,
      attackerAttackBp: 10_000,
      attackerBlockBp: 10_000,
      defenderAttackBp: 10_000,
      defenderBlockBp: 10_000,
    };
    const base = predictBattle(side, side, ctx).ratioPm;
    expect(
      predictBattle(side, side, { ...ctx, casAttCenti: 500 }).ratioPm,
    ).toBeGreaterThan(base);
    expect(
      predictBattle(side, side, { ...ctx, casDefCenti: 500 }).ratioPm,
    ).toBeLessThan(base);
    expect(
      predictBattle(side, side, { ...ctx, casAttCenti: 0, casDefCenti: 0 })
        .ratioPm,
    ).toBe(base);
  });

  test("a wing following an army takes its battle, and stands down when the army is gone", async () => {
    const { ww, air, land, tick, armyId, notices } = await battle();
    const w = giveWing(air, {
      owner: DEU,
      type: "cas",
      planes: 100,
      base: REGION.berlin,
    });
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [w.id],
          mission: "cas",
          target: 0,
          army: armyId,
        },
        tick,
      ),
    ).toBeNull();
    expect(w.follow).toBe(armyId);
    expect(w.target).toBe(0);
    untilPhase(air, w, WP_OUT, tick);
    expect(w.hit).toBe(REGION.krakow);
    expect(w.flySr).toBe(ww.scenario.regionSr(REGION.krakow));
    expect(w.sr).toBe(w.flySr);
    // The army goes: at its next look on the ground the wing stands down and says so.
    land.armies.delete(armyId);
    drive(air, tick + 40, tick + 140);
    expect(w.mission).toBe(WING_NO_MISSION);
    expect(w.follow).toBe(0);
    expect(notices).toContain("events_display.ww1936_wing_army_gone");
  });
});

describe("carrier wings (design §9)", () => {
  test("a whole-zone order at L = 1, the record mirrors the deck, the losses come off it, docked it stays down", async () => {
    const humans: WwHuman[] = [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "ITA" },
    ];
    const runner = await wwRunner({}, humans, SEA.map);
    warAfterPrep(runner, HUMAN, "ITA");
    const ww = runner.game.worldWar()!;
    const { navy, air } = ww;
    liveWings(air);
    const GBR = TAG_ID.GBR;
    const ce = ww.economy.country(GBR)!;
    ce.stock[equipKey("cv_fighter", 1)] += 60;
    const f = navy.fleets.get(
      navy.createFleet(GBR, REGION.london, [["cv", 1, 1]]),
    )!;
    fillDecks(navy, GBR);
    const zone = ZONE.west;
    f.docked = 0;
    f.state = FLEET_STATES.indexOf("on_station");
    navy.setFleetZone(f, zone);
    const ship = f.ships[0];
    const r = navy.ships.rowOf(ship);
    const deck = navy.ships.deckOf(r);
    const on = deck[0] + deck[1] + deck[2];
    expect(on).toBeGreaterThan(0);
    const sr = ww.scenario.zoneSr(zone);
    const tick = runner.game.ticks();
    const w = giveWing(air, {
      owner: GBR,
      type: "cv_fighter",
      counts: [0, 0, 0],
      base: -ship,
      sr,
      mission: "air_superiority",
    });
    drive(air, tick, tick);
    expect(w.phase).toBe(WP_OUT);
    expect(w.leg).toBe(1);
    expect(w.until).toBe(tick + 1);
    expect(w.flySr).toBe(sr);
    expect(wingPlanes(w)).toBe(on);
    // Its rearm is the mission's, and a docked carrier grounds it.
    w.phase = WP_STATION;
    w.until = tick + 2;
    drive(air, tick + 2, tick + 2);
    expect(w.phase).toBe(WP_BACK);
    drive(air, tick + 3, tick + 3);
    expect(w.phase).toBe(WP_REARM);
    f.docked = REGION.london;
    drive(air, tick + 4, tick + 30);
    expect(w.phase).toBe(WP_GROUND);
    // Shot down: it comes off the deck too.
    f.docked = 0;
    const off = untilPhase(air, w, WP_STATION, tick + 31);
    w.lossRest = 2500;
    const enemy = giveWing(air, {
      owner: TAG_ID.ITA,
      type: "fighter",
      planes: 150,
      base: REGION.rome,
      sr,
      target: zone,
      mission: "air_superiority",
      flying: true,
    });
    enemy.until = off + 100;
    drive(air, off + 1, off + 2);
    const left = navy.ships.deckOf(r);
    expect(left[0] + left[1] + left[2]).toBe(wingPlanes(w));
    expect(wingPlanes(w)).toBeLessThan(on);
  });
});

describe("the convoy war's air (design §4.2)", () => {
  test("airOf reads the strike wings' own mix and yesterday's sorties", async () => {
    const humans: WwHuman[] = [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "ITA" },
    ];
    const runner = await wwRunner({}, humans, SEA.map);
    warAfterPrep(runner, HUMAN, "ITA");
    const ww = runner.game.worldWar()!;
    const { air, navy } = ww;
    liveWings(air);
    const sr = SR.central;
    const idx = ww.scenario.srIdxOf(sr);
    const w = giveWing(air, {
      owner: TAG_ID.ITA,
      type: "naval_bomber",
      planes: 100,
      base: REGION.rome,
      sr,
      target: ZONE.middle,
      mission: "naval_strike",
    });
    const st = wingStats(air, w);
    expect(airOf(navy, sr, idx).strike.size).toBe(0);
    air.zoneState[idx].navalStrike.set(TAG_ID.ITA, 50_000);
    air.zoneState[idx].navalAsw.set(TAG_ID.ITA, 3_000);
    const x = airOf(navy, sr, idx);
    expect(x.strike.get(TAG_ID.ITA)).toBe(
      Math.floor((100 * st.naval * 500) / 1000),
    );
    expect(x.patrol.get(TAG_ID.ITA)).toBe(3);
  });
});

describe("wing_mission (design §3.3)", () => {
  test("the judge: refusals, all or none", async () => {
    const { ww, air, tick } = await war();
    const send = (wings: number[], o: object): WwOrderBlock | null =>
      air.issue(DEU, { kind: "wing_mission", wings, ...o } as never, tick);
    const fighter = (base: number) =>
      giveWing(air, { owner: DEU, type: "fighter", planes: 100, base });
    // One out of range: none of them moves. (Berlin to the isthmus is past CAS's range.)
    const near = giveWing(air, {
      owner: DEU,
      type: "cas",
      planes: 100,
      base: REGION.warsaw,
    });
    const far = giveWing(air, {
      owner: DEU,
      type: "cas",
      planes: 100,
      base: REGION.berlin,
    });
    expect(ww.scenario.targetKm(REGION.berlin, REGION.isthmus)).toBeGreaterThan(
      wingStats(air, far).rangeKm,
    );
    expect(
      ww.scenario.targetKm(REGION.warsaw, REGION.isthmus),
    ).toBeLessThanOrEqual(wingStats(air, near).rangeKm);
    expect(
      send([near.id, far.id], { mission: "cas", target: REGION.isthmus }),
    ).toBe("out_of_range");
    expect(near.mission).toBe(WING_NO_MISSION);
    expect(far.mission).toBe(WING_NO_MISSION);
    // Wrong type, peace, nothing to hit, no base, not our land.
    const f = fighter(REGION.berlin);
    expect(send([f.id], { mission: "cas", target: REGION.krakow })).toBe(
      "bad_air_mission",
    );
    const bomber = giveWing(air, {
      owner: DEU,
      type: "strat_bomber",
      planes: 100,
      base: REGION.berlin,
    });
    expect(
      send([bomber.id], { mission: "strategic_bombing", target: REGION.paris }),
    ).toBe("not_at_war");
    expect(
      send([bomber.id], {
        mission: "strategic_bombing",
        target: REGION.krakow,
        cls: "port",
      }),
    ).toBe("no_bomb_target");
    const homeless = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
    });
    expect(
      send([homeless.id], {
        mission: "air_superiority",
        target: REGION.krakow,
      }),
    ).toBe("no_air_base");
    expect(
      send([f.id], { mission: "interception", target: REGION.krakow }),
    ).toBe("not_controlled");
    // A carrier wing takes no direct order.
    const cv = giveWing(air, {
      owner: DEU,
      type: "cv_fighter",
      counts: [0, 0, 0],
      base: -9,
    });
    expect(
      send([cv.id], { mission: "air_superiority", target: REGION.krakow }),
    ).toBe("bad_air_mission");
    // The bomb class goes on the wing.
    expect(
      send([bomber.id], {
        mission: "strategic_bombing",
        target: REGION.krakow,
        cls: "auto",
      }),
    ).toBeNull();
    expect(bomber.cls).toBe(0);
    expect(bomber.mission).toBe(3);
    // Escort: only a bomber, and only within reach of the bomber's target.
    expect(send([f.id], { mission: "escort", target: 0, escort: f.id })).toBe(
      "bad_air_mission",
    );
    expect(
      send([f.id], { mission: "escort", target: 0, escort: near.id }),
    ).toBe("bad_air_mission");
    const ce = ww.economy.country(DEU)!;
    ce.stats.airRangePct = -90;
    ce.statsVer++;
    expect(
      send([f.id], { mission: "escort", target: 0, escort: bomber.id }),
    ).toBe("escort_out_of_range");
    ce.stats.airRangePct = 0;
    ce.statsVer++;
    expect(
      send([f.id], { mission: "escort", target: 0, escort: bomber.id }),
    ).toBeNull();
  });

  test("a human's direct order pins only that wing, and a refused one pins nothing", async () => {
    const { runner, air } = await war();
    const a = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
      auto: true,
    });
    const b = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
      auto: true,
    });
    step(runner, 2, [
      order(HUMAN, {
        kind: "wing_mission",
        wings: [a.id],
        mission: "cas",
        target: REGION.krakow,
      }),
    ]);
    expect(a.auto).toBe(true);
    step(runner, 2, [
      order(HUMAN, {
        kind: "wing_mission",
        wings: [a.id],
        mission: "air_superiority",
        target: REGION.krakow,
      }),
    ]);
    expect(a.auto).toBe(false);
    expect(b.auto).toBe(true);
    // The AI's own order goes straight to the air war and pins nothing.
    expect(
      air.issue(
        DEU,
        {
          kind: "wing_mission",
          wings: [b.id],
          mission: "air_superiority",
          target: REGION.krakow,
        },
        runner.game.ticks(),
      ),
    ).toBeNull();
    expect(b.auto).toBe(true);
  });
});

describe("the memo and the determinism (design §10)", () => {
  test("wingStats keeps its result until the wing's mix, tier or ace changes", async () => {
    const { ww, air } = await war();
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      counts: [100, 0, 0],
      base: REGION.berlin,
    });
    const first = wingStats(air, w);
    expect(wingStats(air, w)).toBe(first);
    const ce = ww.economy.country(DEU)!;
    ce.statsVer++;
    const bumped = wingStats(air, w);
    expect(bumped).not.toBe(first);
    expect(bumped.airAtk).toBe(first.airAtk);
    // The same count of a newer generation is new numbers, no stale read.
    w.counts = [0, 100, 0];
    expect(wingStats(air, w).airAtk).toBe(
      air.planeStatsOf(DEU, "fighter", 2).airAtk,
    );
  });

  test("restored in mid-flight, the two games run on tick by tick the same", async () => {
    const { runner, ww, air, g, land } = await war();
    const tick = g.ticks();
    const ce = ww.economy.country(DEU)!;
    ce.manpower += 500_000;
    ww.economy.country(POL)!.manpower += 500_000;
    const a = placeArmy(g, "DEU", REGION.munich, 2);
    placeArmy(g, "POL", REGION.krakow, 1);
    for (const id of a.divisions) joinBattle(land, id, REGION.krakow);
    ww.economy.addBuilding(REGION.berlin, "radar", 1);
    const give = (
      owner: number,
      type: "fighter" | "cas",
      base: number,
      mission: string,
      target: number,
    ) => {
      const w = giveWing(air, { owner, type, planes: 150, base });
      const block = air.issue(
        owner,
        {
          kind: "wing_mission",
          wings: [w.id],
          mission: mission as never,
          target,
        },
        tick,
      );
      expect(block).toBeNull();
      return w;
    };
    give(DEU, "fighter", REGION.berlin, "air_superiority", REGION.krakow);
    give(DEU, "fighter", REGION.berlin, "air_superiority", REGION.krakow);
    give(POL, "fighter", REGION.warsaw, "air_superiority", REGION.krakow);
    give(POL, "fighter", REGION.warsaw, "interception", REGION.warsaw);
    give(DEU, "cas", REGION.berlin, "cas", REGION.krakow);
    const flying = () =>
      [...air.wings.values()].filter((w) => w.phase === WP_STATION).length;
    let guard = 0;
    while (flying() < 2 && guard++ < 80) step(runner);
    expect(flying()).toBeGreaterThanOrEqual(2);
    const z =
      air.zoneState[ww.scenario.srIdxOf(ww.scenario.regionSr(REGION.krakow))];
    expect(z.score.size).toBeGreaterThan(0);
    const copy = await wwRestore(runner, HUMANS, SEA.map);
    expect(gameHash(copy)).toBe(gameHash(runner));
    for (let i = 0; i < 60; i++) {
      step(runner);
      step(copy);
      expect(gameHash(copy), `tick +${i}`).toBe(gameHash(runner));
    }
  });
});
