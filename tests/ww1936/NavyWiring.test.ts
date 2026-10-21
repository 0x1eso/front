// World War 1936 P4 (plan Task 1 Step 25): the navy wired into the game,
// on the test map ww1936sea (no start navy: plan decision 31).
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { FLEET_STATES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { checkCapitulations } from "@openfront/engine/ww1936/Capitulation";
import {
  damageBuilding,
  repairBuilding,
} from "@openfront/engine/ww1936/economy/Buildings";
import { applyWwOrder } from "@openfront/engine/ww1936/economy/WwOrderExecution";
import { convoyLossPmOf } from "@openfront/engine/ww1936/navy/ConvoyWar";
import { navalBuildBlock } from "@openfront/engine/ww1936/navy/EndgameHooks";
import { applyShipDamage } from "@openfront/engine/ww1936/navy/NavalBattles";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import {
  createScriptedRunner,
  scriptedGameStart,
  stepScripted,
} from "../util/ScriptedGame";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import {
  NAVAL_BASE,
  REGION,
  SEA,
  START_CONVOYS,
  TAG_ID,
  ZONE,
} from "./seaFixture";
import {
  byTag,
  gameHash,
  HUMAN,
  step,
  stepTo,
  takeRegion,
  withTestPolitics,
  wwRestore,
  wwRunner,
} from "./util";

withTestPolitics();

const GBR_HUMAN = [{ clientID: HUMAN, country: "GBR" as const }];
const navyOf = (r: GameRunner) => r.game.worldWar()!.navy;

describe("navy wiring", () => {
  it("vanilla rules untouched when the mode is off", async () => {
    const runner = await createScriptedRunner("world", scriptedGameStart({}));
    for (let i = 0; i < 10; i++) stepScripted(runner);
    expect(runner.game.worldWar()).toBeNull();
    // tests/VanillaDigest.test.ts pins the vanilla digests themselves.
  }, 60_000);

  it("vanilla warships and ports are refused in World War 1936", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const cfg = runner.game.config();
    expect(cfg.isUnitDisabled(UnitType.Warship)).toBe(true);
    expect(cfg.isUnitDisabled(UnitType.Port)).toBe(true);
  });

  it("the test map starts with the formula navy", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const ww = runner.game.worldWar()!;
    expect(ww.navy.fleets.size).toBe(0);
    for (const [tag, n] of Object.entries(START_CONVOYS)) {
      const ce = ww.economy.country(TAG_ID[tag as keyof typeof TAG_ID])!;
      expect(ce.stock[equipKey("convoy", 1)], tag).toBe(n);
    }
    for (const r of ww.scenario.landRegions) {
      const want = (NAVAL_BASE as Record<number, number>)[r.id] ?? 0;
      expect(ww.economy.buildingArray("naval_base")[r.id], r.name).toBe(want);
      expect(ww.navy.isPort(r.id), r.name).toBe(want > 0);
    }
  });

  it("createFleet docks a fleet in its port's harbor zone", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const navy = navyOf(runner);
    const id = navy.createFleet(TAG_ID.GBR, REGION.london, [
      ["bb", 1, 2],
      ["dd", 1, 6],
    ]);
    const f = navy.fleets.get(id)!;
    expect(f.zone).toBe(ZONE.west);
    expect(f.docked).toBe(REGION.london);
    expect(f.ships).toHaveLength(8);
    expect([...f.ships].sort((a, b) => a - b)).toEqual(f.ships);
    expect(FLEET_STATES[f.state]).toBe("docked");
    expect(navy.fleetsIn(ZONE.west)).toEqual([id]);
    expect(navy.fleetsOf(TAG_ID.GBR).map((x) => x.id)).toEqual([id]);
    // A destroyer's numbered name; full HP.
    const r = navy.ships.rowOf(f.ships[7]);
    expect(navy.ships.nameIdx[r]).toBeLessThan(0);
    expect(navy.ships.hp[r]).toBe(navy.shipStatsOf(r).hpMilli);
  });

  it("commissionShip joins the port's new-ships fleet", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const navy = navyOf(runner);
    const a = navy.commissionShip(TAG_ID.GBR, "cl", 2, REGION.london);
    const b = navy.commissionShip(TAG_ID.GBR, "dd", 1, REGION.london);
    const c = navy.commissionShip(TAG_ID.GBR, "dd", 1, REGION.malta);
    const london = navy.fleetsOf(TAG_ID.GBR).filter((f) => f.docked === 10);
    expect(london).toHaveLength(1);
    expect(london[0].newShips).toBe(true);
    expect(london[0].ships).toEqual([a, b]);
    const malta = navy.fleetsOf(TAG_ID.GBR).find((f) => f.docked === 12)!;
    expect(malta.ships).toEqual([c]);
    expect(malta.zone).toBe(ZONE.middle);
    expect(navy.country(TAG_ID.GBR)!.commissionedToday).toEqual([a, b, c]);
  });

  it("removeShip drops the ship and an empty fleet", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const navy = navyOf(runner);
    const id = navy.createFleet(TAG_ID.GBR, REGION.london, [["dd", 1, 2]]);
    const [s1, s2] = navy.fleets.get(id)!.ships;
    navy.removeShip(s1, true, runner.game.ticks());
    expect(navy.fleets.get(id)!.ships).toEqual([s2]);
    expect(navy.ships.rowOf(s1)).toBe(-1);
    expect(navy.country(TAG_ID.GBR)!.shipsLostToday).toBe(1);
    navy.removeShip(s2, false, runner.game.ticks());
    expect(navy.fleets.has(id)).toBe(false);
    expect(navy.fleetsIn(ZONE.west)).toEqual([]);
  });

  it("a ship's damage names its killer and sinks it at 0 HP", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const navy = navyOf(runner);
    const id = navy.createFleet(TAG_ID.GBR, REGION.london, [["dd", 1, 1]]);
    const [s] = navy.fleets.get(id)!.ships;
    const hp = navy.ships.hp[navy.ships.rowOf(s)];
    applyShipDamage(navy, s, hp - 1, 0, 0, TAG_ID.ITA);
    expect(navy.ships.hp[navy.ships.rowOf(s)]).toBe(1);
    applyShipDamage(navy, s, 5, 0, 0, TAG_ID.ITA);
    expect(navy.ships.rowOf(s)).toBe(-1);
    expect(navy.country(TAG_ID.GBR)!.shipsLostToday).toBe(1);
    expect(navy.fleets.has(id)).toBe(false);
  });

  it("P5's hook points are neutral today", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const ww = runner.game.worldWar()!;
    const ce = ww.economy.country(TAG_ID.GBR)!;
    for (const what of ["dock", "naval_base", "bb", "convoy"] as const)
      expect(navalBuildBlock(ww.economy, ce, what)).toBeNull();
    // The day's convoy loss rate by side, as lane C's convoy war stores it.
    const i = ww.scenario.srIdxOf(1001);
    expect(ww.navy.lossRatePm(i, TAG_ID.GBR)).toBe(0);
    ww.navy.srState[i].lossRate.set(ww.land.sideOf(TAG_ID.GBR), 120);
    expect(ww.navy.lossRatePm(i, TAG_ID.GBR)).toBe(120);
    expect(convoyLossPmOf(ww.navy, TAG_ID.GBR, 1001)).toBe(120);
    expect(convoyLossPmOf(ww.navy, TAG_ID.GBR, 5)).toBe(0);
  });

  it("ports follow the land war's control the tick a port falls", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const g = runner.game;
    const ww = g.worldWar()!;
    const ce = ww.economy.country(TAG_ID.GBR)!;
    ce.navalLines.push({
      id: 99,
      cls: 0,
      gen: 1,
      docks: 1,
      activeDocks: 0,
      progress: 0,
      left: 1,
      port: REGION.london,
      fill: 0,
      lastOutput: 0,
      names: [],
    });
    const [gbrShip] = ww.navy.fleets.get(
      ww.navy.createFleet(TAG_ID.GBR, REGION.malta, [["dd", 1, 1]]),
    )!.ships;
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(TAG_ID.DEU, TAG_ID.GBR, g.ticks());
    takeRegion(g, REGION.london, "DEU");
    // The economy's control copy still says Britain until its next turn.
    expect(ww.economy.controllerOf(REGION.london)).toBe(TAG_ID.GBR);
    // The line moved away from the port it lost (to Malta, its other base).
    expect(ce.navalLines[ce.navalLines.length - 1].port).toBe(REGION.malta);
    // The ships effect skips it too.
    const ctx = makeCtx(ww.politics, TAG_ID.GBR, 0, 0, g.ticks());
    applyEffects(ctx, [
      { kind: "ships", cls: "cl", gen: 1, count: 1, port: REGION.london },
    ]);
    expect(
      ww.navy.fleetsOf(TAG_ID.GBR).every((f) => f.docked !== REGION.london),
    ).toBe(true);
    // A transferred ship reaches the captor's new port.
    ww.navy.transferShip(gbrShip, TAG_ID.DEU);
    const deu = ww.navy.fleetsOf(TAG_ID.DEU);
    expect(deu.map((f) => [f.docked, f.ships])).toEqual([
      [REGION.london, [gbrShip]],
    ]);
  });

  it("deck planes go back to the old owner's stock on transfer and disband", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const ww = runner.game.worldWar()!;
    const navy = ww.navy;
    const gbr = ww.economy.country(TAG_ID.GBR)!;
    const fra = ww.economy.country(TAG_ID.FRA)!;
    const k = equipKey("cv_fighter", 1);
    const total = (c: typeof gbr) => c.stock[k] + c.planesDeployed[k];
    const seed = () => {
      const id = navy.createFleet(TAG_ID.GBR, REGION.london, [["cv", 2, 1]]);
      const r = navy.ships.rowOf(navy.fleets.get(id)!.ships[0]);
      navy.ships.deckOf(r)[0] = 10;
      gbr.planesDeployed[k] += 10;
      return navy.fleets.get(id)!.ships[0];
    };
    const ship = seed();
    const before = [total(gbr), total(fra), gbr.stock[k]];
    navy.transferUnits(TAG_ID.GBR, TAG_ID.FRA, "transfer");
    expect([total(gbr), total(fra), gbr.stock[k]]).toEqual([
      before[0],
      before[1],
      before[2] + 10,
    ]);
    const r = navy.ships.rowOf(ship);
    expect(navy.ships.owner[r]).toBe(TAG_ID.FRA);
    expect([...navy.ships.deckOf(r)].every((n) => n === 0)).toBe(true);
    seed();
    navy.transferUnits(TAG_ID.GBR, TAG_ID.FRA, "disband");
    expect([total(gbr), gbr.stock[k], gbr.planesDeployed[k]]).toEqual([
      before[0] + 10,
      before[2] + 20,
      0,
    ]);
  });

  it("a capitulated country's ships and deployments vanish", async () => {
    const runner = await wwRunner({}, [], SEA.map);
    const g = runner.game;
    const ww = g.worldWar()!;
    const pl = TAG_ID.POL;
    const id = ww.navy.createFleet(pl, REGION.krakow, [["dd", 1, 2]]);
    // At sea, so the lost port does not send it home first.
    ww.navy.fleets.get(id)!.docked = 0;
    ww.air.addDeployment({
      owner: pl,
      sr: 2,
      type: 0,
      mission: 0,
      counts: [5, 0, 0],
      target: 5,
      base: REGION.warsaw,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
    });
    const ce = ww.economy.country(pl)!;
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(TAG_ID.DEU, pl, g.ticks());
    takeRegion(g, REGION.warsaw, "DEU");
    takeRegion(g, REGION.krakow, "DEU");
    ww.setCapitulationGauge(pl, WW_CAPITULATION_DAYS - 1);
    checkCapitulations(g, ww, g.ticks());
    expect(ww.isCapitulated(pl)).toBe(true);
    expect(ww.navy.fleetsOf(pl)).toEqual([]);
    expect(ww.navy.ships.count()).toBe(0);
    expect(ww.air.deploymentsOf(pl)).toEqual([]);
    // Removed, not sunk: no loss counted (P5's war score sees none).
    expect(ww.navy.country(pl)?.shipsLostToday ?? 0).toBe(0);
    expect(ce.smallID).toBe(pl);
  });

  it("orders route to navy and air", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "FRA" }],
      SEA.map,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const gbr = ww.navy.createFleet(TAG_ID.GBR, REGION.london, [["dd", 1, 1]]);
    const fra = ww.navy.createFleet(TAG_ID.FRA, REGION.lyon, [["dd", 1, 1]]);
    const me = byTag(g, "FRA");
    const order = (o: Parameters<typeof applyWwOrder>[3]) =>
      applyWwOrder(g, ww.economy, me, o, 0);
    expect(
      order({ kind: "fleet_mission", fleet: gbr, mission: "patrol", sr: 1001 }),
    ).toBe("no_fleet");
    expect(
      order({ kind: "fleet_mission", fleet: fra, mission: "patrol", sr: 1001 }),
    ).toBeNull();
    expect(order({ kind: "air_recall", sr: 5 })).toBe("bad_zone");
    expect(order({ kind: "air_recall", sr: 1001 })).toBeNull();
  });

  it("isPort follows the naval base level", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const ww = runner.game.worldWar()!;
    const before = ww.economy.portVer;
    damageBuilding(ww.economy, REGION.london, "naval_base", 5000);
    expect(ww.navy.isPort(REGION.london)).toBe(true);
    damageBuilding(ww.economy, REGION.london, "naval_base", 1000);
    expect(ww.navy.isPort(REGION.london)).toBe(false);
    expect(ww.economy.portVer).toBe(before + 1);
    repairBuilding(ww.economy, REGION.london, "naval_base", 1000);
    expect(ww.navy.isPort(REGION.london)).toBe(true);
    expect(ww.economy.portVer).toBe(before + 2);
  });

  it("a snapshot without its navy and air is refused (made before P4)", async () => {
    const runner = await wwRunner({}, GBR_HUMAN, SEA.map);
    const ww = runner.game.worldWar()!;
    const s = ww.snapshot();
    expect(() => ww.restoreState({ ...s, navy: undefined })).toThrow(
      /made before P4/,
    );
    expect(() => ww.restoreState({ ...s, air: undefined })).toThrow(
      /made before P4/,
    );
  });

  it("a mid-game snapshot restores equal", async () => {
    const a = await wwRunner({}, GBR_HUMAN, SEA.map);
    const navy = navyOf(a);
    navy.createFleet(TAG_ID.GBR, REGION.london, [
      ["bb", 1, 1],
      ["dd", 1, 3],
    ]);
    navy.createFleet(TAG_ID.ITA, REGION.rome, [["cl", 1, 2]]);
    navy.createFleet(TAG_ID.SUN, REGION.kiev, [["ss", 2, 4]]);
    const ww = a.game.worldWar()!;
    navy.srState[0].lossRate.set(ww.land.sideOf(TAG_ID.GBR), 75);
    stepTo(a, dayStartTick(40, ww.prepEndTick()) + 3);
    // Every kind of P4 state the stubs keep (P4 review): a deployment, a
    // damaged building, a named naval line, a battle, a route, a voyage
    // and a beachhead.
    const tick = a.game.ticks();
    const side = (id: number) => ww.land.sideOf(id);
    ww.air.addDeployment({
      owner: TAG_ID.DEU,
      sr: 2,
      type: 0,
      mission: 1,
      counts: [3, 0, 0],
      target: 3,
      base: REGION.berlin,
      lossRest: 250,
      auto: true,
      volunteerFor: 0,
    });
    damageBuilding(ww.economy, REGION.paris, "mil", 1500);
    ww.economy.country(TAG_ID.GBR)!.navalLines.push({
      id: 77,
      cls: 0,
      gen: 1,
      docks: 2,
      activeDocks: 0,
      progress: 1234,
      left: 2,
      port: REGION.london,
      fill: 0,
      lastOutput: 0,
      names: [3, 1],
    });
    const [gbrFleet] = navy.fleetsOf(TAG_ID.GBR);
    const [itaFleet] = navy.fleetsOf(TAG_ID.ITA);
    navy.battles.set(ZONE.west, {
      zone: ZONE.west,
      sides: [side(TAG_ID.GBR), side(TAG_ID.ITA)],
      fleets: [[gbrFleet.id], [itaFleet.id]],
      round: 2,
      startHp: [100_000, 200_000],
      startOrg: [5000, 6000],
      retreating: [false, true],
      sunk: [
        [0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0],
      ],
      sunkNamed: [],
      startTick: tick,
    });
    const route = navy.nextRouteId++;
    navy.routes.set(route, {
      id: route,
      use: 2,
      owner: TAG_ID.GBR,
      ref: 5,
      zones: [ZONE.west, ZONE.middle],
      km: 900,
      srs: [1001, 1002],
      need: 4,
      got: 3,
      nextDay: 50,
    });
    const voyage = navy.nextVoyageId++;
    navy.voyages.set(voyage, {
      id: voyage,
      owner: TAG_ID.GBR,
      army: 0,
      invasion: false,
      divisions: [],
      from: REGION.london,
      to: REGION.malta,
      route,
      zoneIdx: 0,
      prog: 300,
      need: 2,
      bound: 2,
      aborting: false,
      departTick: tick,
    });
    navy.beachhead.set(REGION.lyon, { side: side(TAG_ID.GBR), until: 60 });
    const b = await wwRestore(a, GBR_HUMAN, SEA.map);
    expect(diffGraphs(a.game, b.game)).toEqual([]);
    const nb = navyOf(b);
    // Lane C's own routes (the AI's sea trades) come along with the seeded one.
    expect([nb.battles.size, nb.routes.size, nb.voyages.size]).toEqual([
      1,
      navy.routes.size,
      1,
    ]);
    expect(nb.routes.get(route)?.got).toBe(3);
    expect(nb.beachhead.get(REGION.lyon)?.until).toBe(60);
    const lines = b.game.worldWar()!.economy.country(TAG_ID.GBR)!.navalLines;
    expect(lines.find((l) => l.id === 77)?.names).toEqual([3, 1]);
    // Lane AI: Germany's air AI deploys too; the seeded record is there.
    expect(
      b.game
        .worldWar()!
        .air.deploymentsOf(TAG_ID.DEU)
        .some((d) => d.sr === 2 && d.lossRest === 250),
    ).toBe(true);
    expect(b.game.worldWar()!.economy.damage).toEqual(ww.economy.damage);
    for (let i = 0; i < 30; i++) {
      step(a);
      step(b);
      expect(gameHash(b)).toBe(gameHash(a));
    }
    expect(diffSnapshots(snapshotGame(a.game), snapshotGame(b.game))).toEqual(
      [],
    );
    expect(diffGraphs(a.game, b.game)).toEqual([]);
    expect(navyOf(b).fleets.size).toBe(3);
  }, 120_000);
});
