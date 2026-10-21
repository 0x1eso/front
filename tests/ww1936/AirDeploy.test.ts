// World War 1936 P4 Task 7 (lane A1): air deployments, bases and refills
// (spec §13.2–§13.4) on ww1936sea, human countries only (no air AI), their
// production lines taken back so the stock moves only by the air war.
import type { AirType } from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_GENS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { rangeEffPm } from "@openfront/engine-lib/ww1936/AirRules";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import {
  damageBuilding,
  drawPlanes,
} from "@openfront/engine/ww1936/economy/Buildings";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { AIR_KM, REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  clearStartSetup,
  HUMAN,
  stepTo,
  takeRegion,
  warAfterPrep,
  withTestPolitics,
  WwHuman,
  wwRunner,
} from "./util";

withTestPolitics();

const GBR_ITA: WwHuman[] = [
  { clientID: HUMAN, country: "GBR" },
  { clientID: "HUMAN002", country: "ITA" },
];

function setStock(ww: WorldWar, id: number, type: AirType, counts: number[]) {
  const ce = ww.economy.country(id)!;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    ce.stock[equipKey(type, g)] = counts[g - 1] ?? 0;
  }
}

function stockOf(ww: WorldWar, id: number, type: AirType): number[] {
  const ce = ww.economy.country(id)!;
  return Array.from(
    { length: EQUIPMENT_GENS[type] },
    (_, g) => ce.stock[equipKey(type, g + 1)],
  );
}

function deployedOf(ww: WorldWar, id: number, type: AirType): number {
  const ce = ww.economy.country(id)!;
  let n = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    n += ce.planesDeployed[equipKey(type, g)];
  }
  return n;
}

function records(ww: WorldWar, sr: number, owner: number): Deployment[] {
  return ww.air
    .deploymentsIn(sr)
    .map((id) => ww.air.deployments.get(id)!)
    .filter((d) => d.owner === owner);
}

const total = (d: Deployment) => d.counts.reduce((a, b) => a + b, 0);

/** Runs through tick k of `day` (zones first, then countries, spec §2.2). */
function runThrough(runner: GameRunner, day: number, k: number): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(day, ww.prepEndTick()) + k + 1);
}

function today(runner: GameRunner): number {
  return runner.game.worldWar()!.day(runner.game.ticks());
}

describe("air deployments (spec §13)", () => {
  it("a deployment picks the nearest base in range and respects capacity", async () => {
    const runner = await wwRunner({}, [GBR_ITA[0]], SEA.map);
    const ww = runner.game.worldWar()!;
    const gbr = TAG_ID.GBR;
    clearStartSetup(ww.economy, ww.economy.country(gbr)!);
    stepTo(runner, WW_PREP_TICKS + 1);
    setStock(ww, gbr, "fighter", [600, 0, 0]);
    const deploy = (count: number) =>
      ww.air.issue(
        gbr,
        {
          kind: "air_deploy",
          sr: SR.central,
          type: "fighter",
          mission: "air_superiority",
          count,
        },
        runner.game.ticks(),
      );
    expect(deploy(600)).toBeNull();
    // London's air base (level 2) holds 400, 200 km from the zone's center.
    expect(ww.scenario.srKm(REGION.london, SR.central)).toBe(
      AIR_KM.londonToCentral,
    );
    let rs = records(ww, SR.central, gbr);
    expect(rs.map((d) => [d.base, total(d), d.target])).toEqual([
      [REGION.london, 400, 600],
    ]);
    expect(stockOf(ww, gbr, "fighter")).toEqual([200, 0, 0]);
    // A new base on Malta (60 km): the next day's refill fills it.
    ww.economy.addBuilding(REGION.malta, "air_base", 1);
    runThrough(runner, today(runner) + 1, TAG_ID.GBR % 7);
    rs = records(ww, SR.central, gbr);
    expect(rs.map((d) => [d.base, total(d), d.target])).toEqual([
      [REGION.london, 400, 600],
      [REGION.malta, 200, 600],
    ]);
    expect(stockOf(ww, gbr, "fighter")).toEqual([0, 0, 0]);
    // Down to nothing and out again: the nearest base comes first now.
    expect(deploy(0)).toBeNull();
    expect(records(ww, SR.central, gbr)).toEqual([]);
    expect(stockOf(ww, gbr, "fighter")).toEqual([600, 0, 0]);
    expect(deploy(300)).toBeNull();
    rs = records(ww, SR.central, gbr);
    expect(rs.map((d) => [d.base, total(d)])).toEqual([
      [REGION.malta, 200],
      [REGION.london, 100],
    ]);
    expect(deployedOf(ww, gbr, "fighter")).toBe(300);
    // More than the stock and the zone holds is refused.
    expect(deploy(901)).toBe("no_planes");
  }, 60_000);

  it("out-of-range bases are skipped", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      SEA.map,
    );
    const ww = runner.game.worldWar()!;
    const deu = TAG_ID.DEU;
    clearStartSetup(ww.economy, ww.economy.country(deu)!);
    const deploy = (count: number) =>
      ww.air.issue(
        deu,
        {
          kind: "air_deploy",
          sr: SR.eastern,
          type: "cas",
          mission: "naval_strike",
          count,
        },
        runner.game.ticks(),
      );
    // 1936 close air support reaches 450 km; Berlin is 532 km away.
    expect(ww.scenario.srKm(REGION.berlin, SR.eastern)).toBe(
      AIR_KM.berlinToEastern,
    );
    expect(ww.air.planeStatsOf(deu, "cas", 1).rangeKm).toBe(450);
    // Italy's Rome (393 km) is on Germany's side (the 1936 faction): no base there.
    expect(ww.land.sameSide(deu, TAG_ID.ITA)).toBe(true);
    ww.economy.addBuilding(REGION.rome, "air_base", -1);
    setStock(ww, deu, "cas", [100, 0, 0]);
    expect(deploy(50)).toBe("no_air_base");
    expect(ww.air.deployments.size).toBe(0);
    // The 1940 model reaches 540 km: only it goes, the 1936 ones wait.
    setStock(ww, deu, "cas", [100, 100, 0]);
    expect(rangeEffPm(532, ww.air.planeStatsOf(deu, "cas", 2).rangeKm)).toBe(
      758,
    );
    expect(deploy(200)).toBeNull();
    const rs = records(ww, SR.eastern, deu);
    expect(rs.map((d) => [d.base, d.counts, d.target])).toEqual([
      [REGION.berlin, [0, 100, 0], 200],
    ]);
    expect(stockOf(ww, deu, "cas")).toEqual([100, 0, 0]);
    // A land mission over the sea is refused by the zone's judge.
    expect(
      ww.air.issue(
        deu,
        {
          kind: "air_deploy",
          sr: SR.eastern,
          type: "cas",
          mission: "cas",
          count: 1,
        },
        runner.game.ticks(),
      ),
    ).toBe("bad_air_mission");
    expect(
      ww.air.issue(deu, { kind: "air_recall", sr: 4242 }, runner.game.ticks()),
    ).toBe("bad_zone");
  }, 60_000);

  it("planes are conserved across deploy, recall and loss", async () => {
    const runner = await wwRunner({}, GBR_ITA, SEA.map);
    const ww = runner.game.worldWar()!;
    const [gbr, ita] = [TAG_ID.GBR, TAG_ID.ITA];
    for (const id of [gbr, ita]) {
      clearStartSetup(ww.economy, ww.economy.country(id)!);
    }
    warAfterPrep(runner, HUMAN, "ITA");
    setStock(ww, gbr, "fighter", [500, 0, 0]);
    setStock(ww, gbr, "cv_fighter", [40, 0, 0]);
    setStock(ww, ita, "fighter", [300, 0, 0]);
    // A British carrier out on station in the Central Waters, its deck full.
    const navy = ww.navy;
    const fid = navy.createFleet(gbr, REGION.london, [["cv", 1, 1]]);
    const f = navy.fleets.get(fid)!;
    const ship = f.ships[0];
    const deckOf = () => navy.ships.deckOf(navy.ships.rowOf(ship));
    drawPlanes(ww.economy.country(gbr)!, "cv_fighter", 40).forEach(
      (n, g) => (deckOf()[g] = n),
    );
    f.docked = 0;
    navy.setFleetZone(f, ZONE.middle);
    f.mission = FLEET_MISSIONS.indexOf("patrol");
    f.missionSr = SR.central;
    f.state = FLEET_STATES.indexOf("on_station");
    const types: AirType[] = ["fighter", "cv_fighter"];
    const planes = () => {
      let n = 0;
      for (const id of [gbr, ita]) {
        for (const t of types) {
          n += stockOf(ww, id, t).reduce((a, b) => a + b, 0);
          n += deployedOf(ww, id, t);
        }
      }
      return n;
    };
    const ledgerMatches = () => {
      for (const id of [gbr, ita]) {
        let land = 0;
        for (const d of ww.air.deployments.values()) {
          if (d.owner === id && d.base >= 0) land += total(d);
        }
        const deck = deckOf();
        const onDeck = id === gbr ? deck[0] + deck[1] + deck[2] : 0;
        expect(
          deployedOf(ww, id, "fighter") + deployedOf(ww, id, "cv_fighter"),
        ).toBe(land + onDeck);
      }
    };
    const start = planes();
    const lost0 = ww.air.planesLostTotal;
    const deploy = (id: number, count: number) =>
      ww.air.issue(
        id,
        {
          kind: "air_deploy",
          sr: SR.central,
          type: "fighter",
          mission: "air_superiority",
          count,
        },
        runner.game.ticks(),
      );
    expect(deploy(gbr, 300)).toBeNull();
    expect(deploy(ita, 200)).toBeNull();
    ledgerMatches();
    const d0 = today(runner);
    runThrough(runner, d0 + 5, 6);
    // The carrier's wing flies over its zone, the deck's planes in it.
    const wing = records(ww, SR.central, gbr).find((d) => d.base < 0)!;
    expect(wing.base).toBe(-ship);
    expect(ww.air.planesLostTotal - lost0).toBeGreaterThan(0);
    expect(planes()).toBe(start - (ww.air.planesLostTotal - lost0));
    ledgerMatches();
    expect(deploy(gbr, 100)).toBeNull();
    ledgerMatches();
    runThrough(runner, d0 + 7, 6);
    expect(planes()).toBe(start - (ww.air.planesLostTotal - lost0));
    ledgerMatches();
    expect(
      ww.air.issue(
        gbr,
        { kind: "air_recall", sr: SR.central },
        runner.game.ticks(),
      ),
    ).toBeNull();
    expect(records(ww, SR.central, gbr).filter((d) => d.base >= 0)).toEqual([]);
    expect(planes()).toBe(start - (ww.air.planesLostTotal - lost0));
    ledgerMatches();
  }, 120_000);

  it("a lost base re-bases next day", async () => {
    const runner = await wwRunner({}, GBR_ITA, SEA.map);
    const ww = runner.game.worldWar()!;
    const gbr = TAG_ID.GBR;
    clearStartSetup(ww.economy, ww.economy.country(gbr)!);
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.economy.addBuilding(REGION.malta, "air_base", 1);
    setStock(ww, gbr, "fighter", [300, 0, 0]);
    expect(
      ww.air.issue(
        gbr,
        {
          kind: "air_deploy",
          sr: SR.central,
          type: "fighter",
          mission: "interception",
          count: 300,
        },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const at = () =>
      records(ww, SR.central, gbr).map((d) => [d.base, total(d), d.target]);
    expect(at()).toEqual([
      [REGION.malta, 200, 300],
      [REGION.london, 100, 300],
    ]);
    // Malta falls: nothing moves until Britain's day, then London takes all.
    takeRegion(runner.game, REGION.malta, "ITA");
    expect(at()[0]).toEqual([REGION.malta, 200, 300]);
    runThrough(runner, today(runner) + 1, gbr % 7);
    expect(at()).toEqual([[REGION.london, 300, 300]]);
    expect(stockOf(ww, gbr, "fighter")).toEqual([0, 0, 0]);
    // Bombs halve London's base: the planes over its room go home, kept.
    damageBuilding(ww.economy, REGION.london, "air_base", 1000);
    expect(ww.air.baseCapacity(REGION.london)).toBe(200);
    runThrough(runner, today(runner) + 1, gbr % 7);
    expect(at()).toEqual([[REGION.london, 200, 300]]);
    expect(stockOf(ww, gbr, "fighter")).toEqual([100, 0, 0]);
    expect(deployedOf(ww, gbr, "fighter")).toBe(200);
  }, 60_000);
});
