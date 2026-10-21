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
    const b = await wwRestore(a, GBR_HUMAN, SEA.map);
    expect(diffGraphs(a.game, b.game)).toEqual([]);
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
