// The air overhaul's contract (ww8, lane W0): the append-only lists, the
// wire, the cycle rules and their invariant, the order judge, and the new
// state in the snapshot and the hash. The behaviour is the lanes': an
// old-model game runs as ever (the digests pin that), and a wing-model game
// runs on stubs without falling over.
import { WwOrder, WwOrderSchema } from "@openfront/engine-api/Schemas";
import {
  AIR_MISSION_TYPES,
  AIR_MISSIONS,
  AIR_TYPES,
  AirMission,
  AirType,
  GROUP_ORDER_KINDS,
  WING_NEW_FIELD_DEFAULTS,
  WING_ORDER_KINDS,
  WING_PHASES,
  WP_STATION,
  WW_BOMB_CLASSES,
  WW_WINGS_LIVE,
} from "@openfront/engine-api/ww1936/AirTypes";
import { WW_ORDER_BLOCKS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  bombClassHits,
  ferryTicks,
  legTicks,
  loadCenti,
  pulseMilli,
  rearmTicks,
  refCycle,
  sortieFuelMilli,
  stationCentiPerDay,
  WING_CYCLE,
  WingMissionAsk,
  wingOrderBlock,
  wingUnderStrength,
} from "@openfront/engine-lib/ww1936/WingRules";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { WwAirView } from "../../src/client/view/WwAirView";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import "./oldAirModel";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  gameHash,
  HUMAN,
  step,
  stepTo,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";
import { giveWing, liveWings } from "./wingUtil";

withTestPolitics();

const HUMANS = [{ clientID: HUMAN, country: "DEU" as const }];
const DEU = TAG_ID.DEU;

describe("the lists are appended, never reordered", () => {
  test("missions, phases, classes, blocks and order kinds", () => {
    expect(AIR_MISSIONS.slice(-2)).toEqual(["recon", "escort"]);
    expect(AIR_MISSIONS.indexOf("recon")).toBe(9);
    expect(WING_PHASES).toEqual([
      "ground",
      "out",
      "station",
      "back",
      "rearm",
      "ferry",
    ]);
    expect(WW_BOMB_CLASSES[0]).toBe("auto");
    // The focus queue appended two after these, the research queues three.
    const at = WW_ORDER_BLOCKS.indexOf("too_many_wings");
    expect(at).toBeGreaterThan(0);
    expect(WW_ORDER_BLOCKS.slice(at, at + 3)).toEqual([
      "too_many_wings",
      "no_bomb_target",
      "escort_out_of_range",
    ]);
    const kinds = WwOrderSchema.options.map((o) => o.shape.kind.value);
    // ww42 appended army_direct last; the older pins read what is before it.
    // w50 appended the four air group orders last.
    expect(kinds.splice(-4)).toEqual([...GROUP_ORDER_KINDS]);
    // in_group, then w57 too_small and ww61 designer_off.
    expect(WW_ORDER_BLOCKS.slice(-3)).toEqual([
      "in_group",
      "too_small",
      "designer_off",
    ]);
    expect(kinds.pop()).toBe("start_oob");
    expect(kinds.pop()).toBe("army_direct");
    // ww9 appends thought_set after the wing orders.
    expect(kinds.slice(-13, -7)).toEqual([...WING_ORDER_KINDS]);
    expect(kinds.slice(-7, -6)).toEqual(["thought_set"]);
    // The research queues append their three after it, the per-slot
    // leaning one more.
    expect(kinds.slice(-6, -2)).toEqual([
      "research_reserve",
      "research_unreserve",
      "research_reorder",
      "research_lean_slot",
    ]);
    // Army templates append train_army last.
    expect(kinds.slice(-2)).toEqual(["train_army", "divisions_convert"]);
  });

  test("the wire: at most 20 wings, no empty list, no wing id 0", () => {
    const ok = (o: unknown) => WwOrderSchema.safeParse(o).success;
    const wings = [...Array(20).keys()].map((i) => i + 1);
    const m = { kind: "wing_mission", mission: "cas", target: 0 };
    expect(ok({ ...m, wings })).toBe(true);
    expect(ok({ ...m, wings: [...wings, 21] })).toBe(false);
    expect(ok({ ...m, wings: [] })).toBe(false);
    expect(ok({ ...m, wings: [0] })).toBe(false);
    expect(ok({ ...m, wings: [1], cls: "rail", army: 2, escort: 3 })).toBe(
      true,
    );
    expect(ok({ ...m, wings: [1], cls: "moon" })).toBe(false);
    expect(ok({ kind: "wing_disband", wing: 0 })).toBe(false);
    expect(ok({ kind: "air_field", region: 0 })).toBe(false);
  });
});

describe("the cycle rules (design §3.5)", () => {
  const cycle = (m: AirMission, km: number, speed: number) =>
    2 * legTicks(km, speed) + WING_CYCLE[m].station + WING_CYCLE[m].rearm;

  test.each<[AirType, AirMission, number, number[], number[]]>([
    ["fighter", "air_superiority", 450, [100, 325, 650], [19, 27, 37]],
    ["cas", "cas", 350, [100, 225, 450], [20, 24, 34]],
    ["bomber", "strategic_bombing", 380, [150, 450, 900], [22, 34, 52]],
    ["strat_bomber", "strategic_bombing", 350, [300, 750, 1500], [30, 50, 82]],
  ])("%s on %s: the design's table", (t, m, speed, kms, cycles) => {
    expect(kms.map((km) => cycle(m, km, speed))).toEqual(cycles);
    expect(refCycle(t, m)).toBe(cycles[1]);
  });

  test("the invariant: at half the range one plane does one sortie's work a day, ±5%", () => {
    for (const m of AIR_MISSIONS) {
      if (m === "paradrop") continue;
      for (const t of AIR_MISSION_TYPES[m]) {
        const fly = 100_000;
        const pulsesCenti = stationCentiPerDay(t, m) / 2;
        const perDay = (pulsesCenti * pulseMilli(fly, t, m)) / 100 / fly;
        expect(perDay, `${t} ${m} pulses`).toBeGreaterThan(0.95);
        expect(perDay, `${t} ${m} pulses`).toBeLessThan(1.05);
        const drops = (7.5 * loadCenti(t, m)) / 100 / refCycle(t, m);
        expect(drops, `${t} ${m} load`).toBeGreaterThan(0.95);
        expect(drops, `${t} ${m} load`).toBeLessThan(1.05);
      }
    }
  });

  test("legs, ferries, rearming, fuel, strength", () => {
    expect(legTicks(0, 450)).toBe(1);
    expect(legTicks(60, 450)).toBe(1);
    expect(legTicks(61, 450)).toBe(2);
    expect(ferryTicks(600, 450)).toBe(10);
    expect(rearmTicks(10, 0)).toBe(10);
    expect(rearmTicks(10, 500)).toBe(15);
    // Fighters at the reference distance: 22 ticks flown, 6 to the sortie.
    expect(sortieFuelMilli(150_000, 2000, 6, 10)).toBe(1_100_000);
    expect(wingUnderStrength("fighter", 44)).toBe(true);
    expect(wingUnderStrength("fighter", 45)).toBe(false);
  });

  test("a bomb class needs its buildings", () => {
    const none = () => 0;
    const rail = (b: string) => (b === "rail" ? 1 : 0);
    const infra = (b: string) => (b === "infra" ? 1 : 0);
    expect(bombClassHits("auto", none, false)).toBe(true);
    expect(bombClassHits("rail", none, false)).toBe(false);
    expect(bombClassHits("rail", rail, false)).toBe(true);
    expect(bombClassHits("fuel", infra, false)).toBe(false);
    expect(bombClassHits("fuel", infra, true)).toBe(true);
  });
});

describe("the order judge (design §3.3)", () => {
  const ask = (o: Partial<WingMissionAsk>): WingMissionAsk => ({
    order: "mission",
    type: "fighter",
    mission: "air_superiority",
    carrier: false,
    hasBase: true,
    standDown: false,
    targetKind: "land",
    ownLand: false,
    enemyLand: false,
    armyNamed: false,
    armyOk: false,
    escortNamed: false,
    escortOk: false,
    bombable: true,
    km: 100,
    rangeKm: 650,
    ...o,
  });

  test("each mission's refusals", () => {
    const j = (o: Partial<WingMissionAsk>) => wingOrderBlock(ask(o));
    expect(j({})).toBeNull();
    expect(j({ km: 651 })).toBe("out_of_range");
    expect(j({ hasBase: false })).toBe("no_air_base");
    expect(j({ carrier: true })).toBe("bad_air_mission");
    expect(j({ type: "bomber" })).toBe("bad_air_mission");
    expect(j({ mission: "paradrop" })).toBe("bad_air_mission");
    expect(j({ targetKind: "none" })).toBe("bad_air_mission");
    expect(j({ armyNamed: true })).toBe("bad_index");
    expect(j({ standDown: true, km: 9999, hasBase: false })).toBeNull();
    // Interception keeps to our land, or a sea zone.
    const int: Partial<WingMissionAsk> = { mission: "interception" };
    expect(j(int)).toBe("not_controlled");
    expect(j({ ...int, ownLand: true })).toBeNull();
    expect(j({ ...int, targetKind: "sea" })).toBeNull();
    // Escort needs a wing to fly with, and to reach its target.
    const esc: Partial<WingMissionAsk> = { mission: "escort" };
    expect(j(esc)).toBe("bad_air_mission");
    expect(j({ ...esc, escortNamed: true })).toBe("bad_air_mission");
    const ok = { ...esc, escortNamed: true, escortOk: true };
    expect(j(ok)).toBeNull();
    expect(j({ ...ok, km: 700 })).toBe("escort_out_of_range");
    // Bombs: an enemy's region with something to hit.
    const b: Partial<WingMissionAsk> = {
      type: "strat_bomber",
      mission: "strategic_bombing",
      rangeKm: 1500,
    };
    expect(j(b)).toBe("not_at_war");
    expect(j({ ...b, enemyLand: true, bombable: false })).toBe(
      "no_bomb_target",
    );
    expect(j({ ...b, enemyLand: true })).toBeNull();
    expect(j({ ...b, enemyLand: true, targetKind: "sea" })).toBe(
      "bad_air_mission",
    );
    // The sea's missions, and air supply on our land.
    const sea = { type: "naval_bomber" as const, targetKind: "sea" as const };
    expect(j({ ...sea, mission: "naval_strike" })).toBeNull();
    expect(j({ ...sea, mission: "naval_patrol", targetKind: "land" })).toBe(
      "bad_air_mission",
    );
    const sup: Partial<WingMissionAsk> = {
      type: "transport_plane",
      mission: "air_supply",
    };
    expect(j(sup)).toBe("not_controlled");
    expect(j({ ...sup, ownLand: true })).toBeNull();
  });

  test("a move's refusals", () => {
    const j = (o: Record<string, unknown>) =>
      wingOrderBlock({
        order: "base",
        carrier: false,
        isBase: true,
        ownSide: true,
        room: 150,
        planes: 150,
        ...o,
      });
    expect(j({})).toBeNull();
    expect(j({ carrier: true })).toBe("bad_air_mission");
    expect(j({ isBase: false })).toBe("no_air_base");
    expect(j({ ownSide: false })).toBe("not_controlled");
    // w50: a base holds any number of planes.
    expect(j({ room: 149 })).toBeNull();
  });
});

describe("the game", () => {
  test("the switch on for real games; off (oldAirModel): air auto off (owner decision 5), wing orders refused", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    expect(WW_WINGS_LIVE).toBe(true);
    expect(ww.air.wingsLive).toBe(false);
    expect(ww.autoOn(DEU, "air")).toBe(false);
    expect(ww.autoMask(DEU)).toBe(0);
    const w = giveWing(ww.air, {
      owner: DEU,
      type: "fighter",
      planes: 10,
      base: REGION.berlin,
    });
    expect(w.mission).toBe(-1);
    expect(w.goalCount).toBe(0);
    const tick = runner.game.ticks();
    const orders: WwOrder[] = [
      { kind: "wing_auto", wings: [w.id], on: true },
      { kind: "wing_disband", wing: w.id },
      { kind: "air_field", region: REGION.berlin },
      { kind: "army_air_priority", army: 1, on: true },
    ];
    for (const order of orders) {
      expect(ww.air.issue(DEU, order, tick)).toBe("bad_index");
    }
  });

  test("the wing model refuses the old orders and another country's wings", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const air = runner.game.worldWar()!.air;
    liveWings(air);
    const tick = runner.game.ticks();
    expect(
      air.issue(
        DEU,
        {
          kind: "air_deploy",
          sr: SR.westLand,
          type: "fighter",
          mission: "air_superiority",
          count: 10,
        },
        tick,
      ),
    ).toBe("bad_index");
    const theirs = giveWing(air, {
      owner: TAG_ID.FRA,
      type: "fighter",
      planes: 10,
      base: REGION.paris,
    });
    const mine = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 10,
      base: REGION.berlin,
    });
    const orders: WwOrder[] = [
      { kind: "wing_auto", wings: [mine.id, theirs.id], on: true },
      { kind: "wing_base", wings: [theirs.id], base: REGION.berlin },
      { kind: "wing_disband", wing: theirs.id },
      { kind: "wing_disband", wing: 999 },
      {
        kind: "wing_mission",
        wings: [theirs.id],
        mission: "cas",
        target: REGION.paris,
      },
    ];
    for (const order of orders) {
      expect(air.issue(DEU, order, tick)).toBe("bad_index");
    }
  });

  test("the km helpers: base to a region's or a sea zone's center", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const sc = runner.game.worldWar()!.scenario;
    expect(sc.targetKm(REGION.berlin, REGION.paris)).toBeGreaterThan(0);
    expect(sc.targetKm(REGION.berlin, REGION.paris)).toBe(
      sc.targetKm(REGION.paris, REGION.berlin),
    );
    const zone = ZONE.west;
    expect(sc.targetKm(REGION.berlin, zone)).toBeGreaterThan(0);
    expect(sc.targetSr(REGION.berlin)).toBe(sc.regionSr(REGION.berlin));
    expect(sc.targetSr(zone)).toBe(sc.zoneSr(zone));
    expect(sc.targetSr(0)).toBe(0);
  });

  test("every new field is in the hash, and a game with none keeps it", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const air = runner.game.worldWar()!.air;
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 10,
      base: REGION.berlin,
    });
    const z = air.zoneState[0];
    const c = air.countries()[0];
    const changes: [string, () => void][] = [
      ...Object.keys(WING_NEW_FIELD_DEFAULTS).map((k): [string, () => void] => [
        `wing ${k}`,
        () => {
          (w as unknown as Record<string, number>)[k] += 7;
        },
      ]),
      ["goalCount", () => (w.goalCount += 1)],
      ["score", () => z.score.set(3, 5)],
      ["casNow", () => z.casNow.push([3, 3, 5])],
      ["today sorties", () => z.today.sorties.set(3, [1])],
      ["today result", () => z.today.result.set(3, [1])],
      ["today search", () => z.today.navalSearch.set(3, 1)],
      ["today asw", () => z.today.navalAsw.set(3, 1)],
      ["today strike", () => z.today.navalStrike.set(3, 1)],
      ["today fighters", () => z.today.fightersSup.set(3, 1)],
      ["today supply", () => z.today.airSupply.push([3, 3, 1])],
      ["today recon", () => z.today.recon.set(3, 1)],
      [
        "a report",
        () =>
          c.reports.push({
            day: 1,
            attacker: 1,
            victim: 2,
            region: 3,
            cls: 2,
            raids: 1,
            planes: 10,
            lost: 1,
            points: 5,
            stopped: [[5, 100]],
            fuelMilli: 0,
            shipsHit: 0,
            groundPlanes: 0,
            wsBp: 0,
            repairDays: 3,
          }),
      ],
      ["a priority army", () => c.priorityArmies.push(4)],
      ["next wing number", () => (c.nextWingNo[1] += 1)],
      ["reform day", () => (c.reformDay[1] = 9)],
      ["a strip", () => air.setStrip(REGION.berlin, 50)],
      ["the model", () => liveWings(air)],
    ];
    for (const [what, change] of changes) {
      const h = air.hash();
      change();
      expect(air.hash(), what).not.toBe(h);
    }
  });

  test("the new state restores exactly, and the wing model runs on", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const air = runner.game.worldWar()!.air;
    liveWings(air);
    const w = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 100,
      base: REGION.berlin,
      sr: SR.westLand,
      mission: "air_superiority",
      target: REGION.paris,
      flying: true,
      nameNo: 3,
      follow: 2,
      cls: 1,
      xpMilli: 650,
      kills: 21,
      lastFerryDay: 4,
      dayKills: 2,
      prevLost: 1,
    });
    expect(w.phase).toBe(WP_STATION);
    expect(w.flyMilli).toBe(100_000);
    const z = air.zoneState[3];
    z.score.set(5, 80);
    z.casNow.push([REGION.paris, 5, 40]);
    z.today.sorties.set(5, [1, 2]);
    z.today.result.set(DEU, [1, 2, 3, 4, 5]);
    z.today.navalSearch.set(DEU, 9);
    z.today.airSupply.push([REGION.paris, 5, 7]);
    z.today.recon.set(5, 20);
    const c = air.country(DEU)!;
    c.reports.push({
      day: 2,
      attacker: DEU,
      victim: TAG_ID.FRA,
      region: REGION.paris,
      cls: 2,
      raids: 3,
      planes: 90,
      lost: 2,
      points: 8000,
      stopped: [[5, 2000]],
      fuelMilli: 0,
      shipsHit: 0,
      groundPlanes: 0,
      wsBp: 0,
      repairDays: 21,
    });
    c.priorityArmies = [7];
    c.nextWingNo[0] = 4;
    c.reformDay[1] = 90;
    air.setStrip(REGION.rome, 80);
    air.setStrip(REGION.berlin, 50);
    expect([...air.strips.keys()]).toEqual(
      [REGION.rome, REGION.berlin].sort((a, b) => a - b),
    );
    // Restored at once equal, then equal tick by tick on the wing model
    // (past the end of the preparation, so its clock runs too).
    stepTo(runner, WW_PREP_TICKS + 2);
    const copy = await wwRestore(runner, HUMANS, SEA.map);
    expect(diffGraphs(runner.game, copy.game)).toEqual([]);
    expect(
      diffSnapshots(snapshotGame(runner.game), snapshotGame(copy.game)),
    ).toEqual([]);
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(copy);
      expect(gameHash(copy), `tick ${i}`).toBe(gameHash(runner));
    }
    expect(diffGraphs(runner.game, copy.game)).toEqual([]);
  }, 120_000);

  test("the screens read the wing model's rows; an old-model game sends none", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    const air = ww.air;
    const mine = giveWing(air, {
      owner: DEU,
      type: "fighter",
      planes: 10,
      base: REGION.berlin,
    });
    air.noteFlight([mine.id, 1, 50, 3, 10, 5, REGION.paris, 10]);
    air.noteFight(SR.westLand, ww.land.sideOf(DEU), 3);
    const old = air.takeData()!;
    expect(old.deployments.map((d) => d.id)).toEqual([mine.id]);
    expect(old.live).toBeUndefined();
    expect(old.flights).toBeUndefined();
    expect(old.briefs).toBeUndefined();
    expect(old.wings).toBeUndefined();

    liveWings(air);
    const theirs = giveWing(air, {
      owner: TAG_ID.FRA,
      type: "bomber",
      planes: 10,
      base: REGION.paris,
    });
    air.markWing(mine.id);
    air.noteFlight([mine.id, 1, 50, 3, 10, 5, REGION.paris, 10]);
    air.noteFight(SR.westLand, ww.land.sideOf(DEU), 3);
    air.markCountry(DEU);
    air.setStrip(REGION.berlin, 90);
    const data = air.takeData()!;
    expect(data.live).toBe(true);
    expect(data.briefs!.map((b) => b.id)).toEqual([mine.id, theirs.id]);
    expect(data.briefs![1].planes).toBe(10);
    expect(data.wings!.map((b) => b.id)).toEqual([mine.id]);
    expect(data.wings![0].rangeKm).toBeGreaterThan(0);
    expect(data.flights).toEqual([
      [mine.id, 1, 50, 3, 10, 5, REGION.paris, 10],
    ]);
    expect(data.fights).toEqual([[SR.westLand, ww.land.sideOf(DEU), 3]]);
    expect(data.details[0].strips).toEqual([[REGION.berlin, 90]]);

    const view = new WwAirView(ww.scenario, () => DEU);
    view.apply(data);
    expect(view.live).toBe(true);
    expect([...view.wingBriefs.keys()]).toEqual([mine.id, theirs.id]);
    expect([...view.wings.keys()]).toEqual([mine.id]);
    expect(view.flights.get(mine.id)![2]).toBe(50);
    expect(view.fights).toHaveLength(1);
    expect(view.detail?.strips).toEqual([[REGION.berlin, 90]]);
    view.apply({
      zones: [],
      deployments: [],
      removedDeployments: [mine.id],
      details: [],
    });
    expect(view.wings.has(mine.id)).toBe(false);
    expect(view.wingBriefs.has(mine.id)).toBe(false);
    expect(view.flights.has(mine.id)).toBe(false);
    expect(view.fights).toEqual([]);
    expect(AIR_TYPES[view.wingBriefs.get(theirs.id)!.type]).toBe("bomber");
  });
});
