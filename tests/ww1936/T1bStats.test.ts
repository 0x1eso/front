// World War 1936 P6 T1b (navy/air half): the new navy and air stat keys
// (spec §21.2; plan Step 15's "P4 통계 읽기" row) read where P4 fights:
// the pure ship and plane numbers, naval battles, decks, the convoy war,
// sorties, naval patrol, the land war's air penalty and the superiority.
import {
  AIR_MISSIONS,
  AIR_TYPES,
  type AirMission,
  type AirType,
} from "@openfront/engine-api/ww1936/AirTypes";
import { EQUIPMENT_GENS } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  CONVOY_USES,
  FLEET_STATES,
  type ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { airSupPm } from "@openfront/engine-lib/ww1936/AirRules";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import { GEN_DECK, shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  dailyAirZone,
  zoneFlights,
} from "@openfront/engine/ww1936/air/AirCombat";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import { deckSize } from "@openfront/engine/ww1936/navy/Carriers";
import {
  convoyLossPmOf,
  convoyWar,
} from "@openfront/engine/ww1936/navy/ConvoyWar";
import {
  startNavalBattle,
  stepNavalBattles,
} from "@openfront/engine/ww1936/navy/NavalBattles";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { seaGame, war } from "./convoyUtil";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import { grantDoctrineStats, stepTo, wwRunner } from "./util";

const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;
const none = new Set<never>();
const S = (p: Partial<WwStats>): WwStats => ({ ...emptyStats(), ...p });

/** Within the integer floors of `expected`. */
function near(got: number, expected: number): void {
  expect(Math.abs(got - expected)).toBeLessThanOrEqual(
    Math.max(5, Math.floor(expected / 200)),
  );
}

describe("T1b: the new stat keys in the pure numbers", () => {
  it("ships: torpedoPct, depthChargePct, carrierDeckPct, navalOrg, mioStatPct_naval", () => {
    const dd = shipStats("dd", 1, emptyStats(), none);
    expect(shipStats("dd", 1, S({ torpedoPct: 20 }), none).torpedo).toBe(
      Math.floor((dd.torpedo * 120) / 100),
    );
    expect(shipStats("dd", 1, S({ depthChargePct: 15 }), none).depth).toBe(
      Math.floor((dd.depth * 115) / 100),
    );
    expect(shipStats("dd", 1, S({ navalOrg: 5 }), none).orgMilli).toBe(
      dd.orgMilli + 5_000,
    );
    const mio = shipStats("dd", 1, S({ mioStatPct_naval: 5 }), none);
    expect(mio.light).toBe(Math.floor((dd.light * 105) / 100));
    expect(mio.torpedo).toBe(Math.floor((dd.torpedo * 105) / 100));
    expect(mio.aa).toBe(Math.floor((dd.aa * 105) / 100));
    expect(mio.armor).toBe(dd.armor);
    expect(shipStats("cv", 1, S({ carrierDeckPct: 10 }), none).deck).toBe(
      Math.floor((GEN_DECK[0] * 110) / 100),
    );
    // Nothing given, nothing changed (P4's numbers).
    expect(shipStats("bb", 2, emptyStats(), none)).toEqual(
      shipStats("bb", 2, S({}), none),
    );
  });

  it("planes: bomberDefensePct, airRangePct, the aircraft MIOs' stat %", () => {
    const sb = planeStats("strat_bomber", 1, emptyStats(), none);
    expect(
      planeStats("strat_bomber", 1, S({ bomberDefensePct: 15 }), none).airDef,
    ).toBe(Math.floor((sb.airDef * 115) / 100));
    // A fighter is no bomber.
    const f = planeStats("fighter", 1, emptyStats(), none);
    expect(
      planeStats("fighter", 1, S({ bomberDefensePct: 15 }), none).airDef,
    ).toBe(f.airDef);
    expect(planeStats("fighter", 2, S({ airRangePct: 15 }), none).rangeKm).toBe(
      Math.floor(
        (planeStats("fighter", 2, emptyStats(), none).rangeKm * 115) / 100,
      ),
    );
    const light = planeStats(
      "fighter",
      1,
      S({ mioStatPct_air_light: 5 }),
      none,
    );
    expect(light.airAtk).toBe(Math.floor((f.airAtk * 105) / 100));
    expect(
      planeStats("fighter", 1, S({ mioStatPct_air_heavy: 5 }), none).airAtk,
    ).toBe(f.airAtk);
    const heavy = planeStats(
      "strat_bomber",
      1,
      S({ mioStatPct_air_heavy: 8 }),
      none,
    );
    expect(heavy.strat).toBe(Math.floor((sb.strat * 108) / 100));
  });
});

describe("T1b: the new stat keys at sea", () => {
  beforeEach(() => usePoliticsContent(depthFixture()));
  afterEach(() => usePoliticsContent(null));

  function atSea(
    navy: WwNavy,
    owner: number,
    comp: readonly (readonly [ShipClass, number, number])[],
  ): Fleet {
    const port = owner === GBR ? REGION.london : REGION.rome;
    const f = navy.fleets.get(navy.createFleet(owner, port, comp))!;
    f.docked = 0;
    f.state = FLEET_STATES.indexOf("on_station");
    navy.setFleetZone(f, ZONE.west);
    return f;
  }
  const hpSum = (navy: WwNavy, f: Fleet) =>
    f.ships.reduce((n, id) => n + navy.ships.hp[navy.ships.rowOf(id)], 0);

  /** Italy's HP lost to Britain in `rounds` rounds; `give` sets the stats first. */
  async function battle(
    mine: readonly (readonly [ShipClass, number, number])[],
    theirs: readonly (readonly [ShipClass, number, number])[],
    give: (ww: WorldWar, f: Fleet) => void,
    rounds = 1,
  ): Promise<number> {
    const g = await seaGame();
    war(g, "GBR", "ITA");
    const { navy, ww } = g;
    const tick = g.runner.game.ticks();
    const f = atSea(navy, GBR, mine);
    const i = atSea(navy, ITA, theirs);
    give(ww, f);
    const before = hpSum(navy, i);
    startNavalBattle(navy, ZONE.west, navy.sideOf(GBR), i.id, tick);
    for (let k = 0; k < rounds; k++) stepNavalBattles(navy, tick);
    return before - hpSum(navy, i);
  }

  it("screenAttackPct and navalDamageTakenPct in naval battles", async () => {
    const DD: [ShipClass, number, number][] = [["dd", 1, 4]];
    const BB: [ShipClass, number, number][] = [["bb", 1, 1]];
    const plain = await battle(DD, BB, () => {});
    const screen = await battle(DD, BB, (ww) =>
      grantDoctrineStats(ww, GBR, { screenAttackPct: 10 }),
    );
    near(screen, Math.floor((plain * 110) / 100));
    const tough = await battle(DD, BB, (ww) =>
      grantDoctrineStats(ww, ITA, { navalDamageTakenPct: -10 }),
    );
    near(tough, Math.floor((plain * 90) / 100));
  });

  it("carrierCycleCut and carrierDeckPct on carriers", async () => {
    const CV: [ShipClass, number, number][] = [["cv", 1, 1]];
    const BB: [ShipClass, number, number][] = [["bb", 1, 1]];
    const deck = (_: WorldWar, f: Fleet, navy: WwNavy) => {
      const r = navy.ships.rowOf(f.ships[0]);
      navy.ships.deckOf(r)[6] = 30; // cv_naval_bomber, generation 1
    };
    const run = (cut: boolean, rounds: number) =>
      battle(
        CV,
        BB,
        (ww, f) => {
          deck(ww, f, ww.navy);
          if (cut) grantDoctrineStats(ww, GBR, { carrierCycleCut: 1 });
        },
        rounds,
      );
    // Strikes every third round (P4); every second with the cut.
    expect(await run(true, 1)).toBe(await run(false, 1));
    expect(await run(true, 2)).toBeGreaterThan(await run(false, 2));
    // The deck's size.
    const g = await seaGame();
    const f = g.navy.fleets.get(
      g.navy.createFleet(GBR, REGION.london, [["cv", 1, 1]]),
    )!;
    const r = g.navy.ships.rowOf(f.ships[0]);
    const before = deckSize(g.navy, r, f);
    grantDoctrineStats(g.ww, GBR, { carrierDeckPct: 10 });
    const st = g.ce("GBR").stats;
    expect(deckSize(g.navy, r, f)).toBe(
      Math.floor((GEN_DECK[0] * (100 + st.deckPct + st.carrierDeckPct)) / 100),
    );
    expect(deckSize(g.navy, r, f)).toBeGreaterThan(before);
  });

  it("convoyLossPct on the victim's convoy losses", async () => {
    const g = await seaGame();
    const { navy, ww } = g;
    war(g, "ITA", "GBR");
    const day = ww.day(g.runner.game.ticks());
    navy.routes.set(navy.nextRouteId, {
      id: navy.nextRouteId++,
      use: CONVOY_USES.indexOf("trade"),
      owner: GBR,
      ref: 999,
      zones: [ZONE.west],
      km: 0,
      srs: [SR.approaches],
      need: 30,
      got: 30,
      nextDay: day + 7,
    });
    // 50 units of Italian mines: 50‰ of 30 convoys = 1,500 milli; −10%.
    ww.depth.sea.mines = [[SR.approaches, ww.land.sideOf(ITA), 500_000]];
    ww.depth.reindexSparse();
    grantDoctrineStats(ww, GBR, { convoyLossPct: -10 });
    convoyWar(navy, SR.approaches, day);
    const idx = ww.scenario.srIdxOf(SR.approaches);
    expect(navy.srState[idx].lossYesterday.get(GBR)).toBe(1_350);
    expect(convoyLossPmOf(navy, GBR, SR.approaches)).toBe(45);
  });
});

describe("T1b: the new stat keys in the air", () => {
  beforeEach(() => usePoliticsContent(depthFixture()));
  afterEach(() => usePoliticsContent(null));
  const WEST = DEEP.sr.westLand;

  async function atWar() {
    const runner = await wwRunner(
      {},
      [
        { clientID: "HUMANGBR", country: "GBR" },
        { clientID: "HUMANITA", country: "ITA" },
      ],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = runner.game.worldWar()!;
    ww.setWar(GBR, ITA, runner.game.ticks());
    for (const id of [GBR, ITA]) ww.economy.country(id)!.fuelMilli = 1e12;
    // Only the test's planes fly here.
    for (const sr of [WEST, DEEP.sr.approaches]) {
      for (const id of [...ww.air.deploymentsIn(sr)]) {
        ww.air.removeDeployment(id, true);
      }
    }
    return { runner, ww, day: ww.day(runner.game.ticks()) };
  }

  function deploy(
    ww: WorldWar,
    owner: number,
    type: AirType,
    mission: AirMission,
    planes: number,
    sr: number = WEST,
  ): Deployment {
    const counts = new Array<number>(EQUIPMENT_GENS[type]).fill(0);
    counts[0] = planes;
    return ww.air.addDeployment({
      owner,
      sr,
      type: AIR_TYPES.indexOf(type),
      mission: AIR_MISSIONS.indexOf(mission),
      counts,
      target: planes,
      base: 0,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
    });
  }

  it("sortieEffPct raises the sorties, never past one a day", async () => {
    const { ww } = await atWar();
    // CAS without yesterday's superiority flies at a low rate.
    const cas = deploy(ww, GBR, "cas", "cas", 100);
    const plain = zoneFlights(ww.air, WEST).find((f) => f.id === cas.id)!;
    const pm = Math.floor(plain.milli[0] / 100);
    expect(pm).toBeLessThan(1000);
    grantDoctrineStats(ww, GBR, { sortieEffPct: 5 });
    const more = zoneFlights(ww.air, WEST).find((f) => f.id === cas.id)!;
    expect(more.milli[0]).toBe(
      100 * Math.min(1000, Math.floor((pm * 105) / 100)),
    );
  });

  it("navalPatrolPct, enemyAirPenaltyPp and interceptShareBp on the zone's day", async () => {
    const { ww, day } = await atWar();
    const air = ww.air;
    // Naval patrol over the Western Approaches: the search × 3 (naval bombers) × 110%.
    const nb = deploy(
      ww,
      GBR,
      "naval_bomber",
      "naval_patrol",
      30,
      DEEP.sr.approaches,
    );
    grantDoctrineStats(ww, GBR, {
      navalPatrolPct: 10,
      enemyAirPenaltyPp: 5,
      interceptShareBp: 2_500,
    });
    dailyAirZone(air, DEEP.sr.approaches, day);
    const f = zoneFlights(air, DEEP.sr.approaches).find((x) => x.id === nb.id)!;
    const za = air.zoneState[ww.scenario.srIdxOf(DEEP.sr.approaches)];
    expect(za.navalSearch.get(GBR)).toBe(Math.floor((f.total * 3 * 110) / 100));
    // Britain's interceptors against Italy's superiority fighters.
    deploy(ww, GBR, "fighter", "interception", 100);
    deploy(ww, ITA, "fighter", "air_superiority", 60);
    dailyAirZone(air, WEST, day);
    const flights = zoneFlights(air, WEST);
    const score = (owner: number, bp: number) => {
      let s = 0;
      for (const x of flights) {
        if (x.owner !== owner) continue;
        x.stats.forEach((st, g) => {
          const w = Math.floor((x.milli[g] * st.supWeightMilli) / 1000);
          s += Math.floor((w * bp) / 10_000);
        });
      }
      return s;
    };
    const z = air.zoneState[ww.scenario.srIdxOf(WEST)];
    const gs = score(GBR, 7_500);
    const is = score(ITA, 10_000);
    expect(z.sup.get(ww.land.sideOf(GBR))).toBe(airSupPm(gs, is));
    // Italy's side reads Britain's air penalty bonus: P4's supPenaltyPp + 5.
    const st = ww.economy.country(GBR)!.stats;
    expect(st.enemyAirPenaltyPp).toBe(5);
    expect(z.enemyPp.get(ww.land.sideOf(ITA)) ?? 0).toBe(
      st.supPenaltyPp + st.enemyAirPenaltyPp,
    );
  });
});
