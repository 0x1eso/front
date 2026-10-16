import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  PlayerUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import {
  factoryWithFreeLine,
  interceptHitPct,
  isStockpiledNuke,
  pickNearestWithin,
  stockTotal,
  STRATEGIC_ONLY_UNITS,
  strikeCraterRadius,
  strikeSecondsLeft,
} from "@openfront/engine-lib/strategic/Strategic";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { BLUE, own, RED, strategicGame } from "./util";

const cost = (game: Game, player: Player, type: UnitType): bigint =>
  game.unitInfo(type).cost(game, player);

/** Runs one tick and returns `id`'s PlayerUpdate from it. */
function playerUpdate(game: Game, id: string): PlayerUpdate {
  const pu = game
    .executeNextTick()
    [GameUpdateType.Player].find((u) => u.id === id);
  expect(pu).toBeDefined();
  return pu!;
}

// plains: red holds x 0-29, blue x 60-99.
async function sides(on: boolean, config = {}) {
  const game = on
    ? await strategicGame("plains", config)
    : await setup("plains", config, [RED, BLUE]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(100_000_000n);
  return { game, red, blue };
}

describe("the strategicWeapons option", () => {
  test("off by default: no strategic state, both new units disabled, nukes paid at launch", async () => {
    const { game, red } = await sides(false);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});

    expect(game.config().strategicWeapons()).toBe(false);
    expect(red.strategic()).toBeNull();
    for (const type of STRATEGIC_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(true);
    }
    expect("strategic" in playerUpdate(game, RED.id)).toBe(false);
    expect(red.canBuild(UnitType.AtomBomb, game.ref(80, 50))).toBe(silo.tile());
    const gold = red.gold();
    red.buildUnit(UnitType.AtomBomb, silo.tile(), {
      targetTile: game.ref(80, 50),
      trajectory: [],
    });
    expect(red.gold()).toBe(gold - 750_000n);
  });

  test("on: launching takes a nuke from the stockpile instead of gold", async () => {
    const { game, red } = await sides(true);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    const target = game.ref(80, 50);
    const s = red.strategic()!;

    expect(game.config().strategicWeapons()).toBe(true);
    for (const type of STRATEGIC_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(false);
    }
    // The price stays the production price; a launch needs stock, not gold.
    expect(cost(game, red, UnitType.AtomBomb)).toBe(750_000n);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(false);
    s.addStock(UnitType.AtomBomb);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(silo.tile());
    const gold = red.gold();
    red.buildUnit(UnitType.AtomBomb, silo.tile(), {
      targetTile: target,
      trajectory: [],
    });
    expect(red.gold()).toBe(gold);
    expect(s.stock(UnitType.AtomBomb)).toBe(0);
    expect(red.canBuild(UnitType.AtomBomb, target)).toBe(false);
  });

  test("prices: missile 500K, satellite 25M, nukes as before", async () => {
    const { game, red } = await sides(true);
    expect(cost(game, red, UnitType.ConventionalMissile)).toBe(500_000n);
    expect(cost(game, red, UnitType.Satellite)).toBe(25_000_000n);
    expect(cost(game, red, UnitType.HydrogenBomb)).toBe(5_000_000n);
    expect(cost(game, red, UnitType.MIRV)).toBe(25_000_000n);
  });

  test("every client gets each player's strategic data, resent when it changes", async () => {
    const { game, red } = await sides(true);
    const first = playerUpdate(game, RED.id).strategic!;
    expect(first.stock[UnitType.AtomBomb]).toBe(0);
    expect(first.satellite).toEqual({ phase: "none" });
    red.strategic()!.addStock(UnitType.HydrogenBomb);
    const next = playerUpdate(game, RED.id).strategic!;
    expect(next.stock[UnitType.HydrogenBomb]).toBe(1);
    expect(next).not.toBe(first);
  });

  test("a satellite being prepared holds one slot of its silo", async () => {
    const { game, red } = await sides(true);
    const small = red.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});
    const big = red.buildUnit(UnitType.MissileSilo, game.ref(20, 20), {});
    red.upgradeUnit(big);
    big.reloadMissile(); // the upgraded tube starts reloading
    const s = red.strategic()!;

    s.setSatellite({
      phase: "preparing",
      siloId: small.id(),
      startTick: 0,
      readyTick: 900,
    });
    expect(small.isInCooldown()).toBe(true);
    s.setSatellite({
      phase: "preparing",
      siloId: big.id(),
      startTick: 0,
      readyTick: 900,
    });
    expect(small.isInCooldown()).toBe(false);
    expect(big.isInCooldown()).toBe(false);
    big.launch();
    expect(big.isInCooldown()).toBe(true);
  });

  test("survives a snapshot with stock, a line and a satellite counting down", async () => {
    const { game, red, blue } = await sides(true);
    const s = red.strategic()!;
    s.addStock(UnitType.MIRV);
    s.startJob({
      factoryId: 99,
      type: UnitType.HydrogenBomb,
      startTick: 0,
      endTick: 400,
    });
    s.setSatellite({
      phase: "targeted",
      target: blue.smallID(),
      strikeTick: 600,
      interceptors: [
        { by: blue.smallID(), type: UnitType.AtomBomb, resolveTick: 30 },
      ],
    });
    await expectSnapshotRoundTrip(game, "plains", 5);
  });

  test("the intents carry only the nukes they may", () => {
    const ok = (intent: object) => IntentSchema.safeParse(intent).success;
    expect(ok({ type: "produce_nuke", nukeType: UnitType.MIRV })).toBe(true);
    expect(ok({ type: "produce_nuke", nukeType: UnitType.MIRVWarhead })).toBe(
      false,
    );
    const intercept = { type: "intercept_satellite", attacker: "abcdefgh" };
    expect(ok({ ...intercept, nukeType: UnitType.AtomBomb })).toBe(true);
    expect(ok({ ...intercept, nukeType: UnitType.MIRV })).toBe(false);
  });
});

describe("where strategic weapons can go", () => {
  test("a conventional missile needs a loaded silo and an enemy building near the aim", async () => {
    const { game, red, blue } = await sides(true);
    blue.addGold(10_000_000n);
    blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    red.buildUnit(UnitType.City, game.ref(20, 50), {});
    const aim = game.ref(82, 52);

    expect(red.canBuild(UnitType.ConventionalMissile, aim)).toBe(false);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    expect(red.canBuild(UnitType.ConventionalMissile, aim)).toBe(silo.tile());
    expect(red.missileTarget(aim)?.tile()).toBe(game.ref(80, 50));
    // 15 tiles from the city: outside the 10-tile pick.
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(95, 50))).toBe(
      false,
    );
    // Its own city.
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(21, 50))).toBe(
      false,
    );
    red.createAllianceRequest(blue)?.accept();
    expect(red.canBuild(UnitType.ConventionalMissile, aim)).toBe(false);
  });

  test("the satellite goes to the player's ready silo nearest the aim, one at a time", async () => {
    const { game, red } = await sides(true);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    expect(red.canBuild(UnitType.Satellite, game.ref(12, 14))).toBe(
      silo.tile(),
    );
    // 25 tiles away: outside the 15-tile pick.
    expect(red.canBuild(UnitType.Satellite, game.ref(28, 28))).toBe(false);
    red.strategic()!.setSatellite({ phase: "orbit" });
    expect(red.canBuild(UnitType.Satellite, game.ref(12, 14))).toBe(false);
  });
});

describe("strategic weapons in domestic mode", () => {
  test("the space program unlocks the satellite; the nuclear law discounts everything", async () => {
    const { game, red } = await sides(true, { domesticMode: true });
    expect(red.isUnitLocked(UnitType.Satellite)).toBe(true);
    expect(red.isUnitLocked(UnitType.ConventionalMissile)).toBe(false);
    grantTechs(red, "space_program");
    expect(red.isUnitLocked(UnitType.Satellite)).toBe(false);
    grantLaws(red, { nuclear: "A" });
    expect(cost(game, red, UnitType.ConventionalMissile)).toBe(400_000n);
    expect(cost(game, red, UnitType.Satellite)).toBe(20_000_000n);
    expect(cost(game, red, UnitType.AtomBomb)).toBe(600_000n);
  });
});

describe("rules shared with the client", () => {
  test("factory lines, picks, odds, craters and the countdown", () => {
    expect(isStockpiledNuke(UnitType.MIRV)).toBe(true);
    expect(isStockpiledNuke(UnitType.MIRVWarhead)).toBe(false);
    // One free line each: the lower id wins.
    expect(
      factoryWithFreeLine(
        [
          { id: 7, level: 1 },
          { id: 3, level: 2 },
        ],
        [{ factoryId: 3 }],
      ),
    ).toBe(3);
    expect(factoryWithFreeLine([{ id: 7, level: 1 }], [{ factoryId: 7 }])).toBe(
      null,
    );
    expect(
      factoryWithFreeLine(
        [
          { id: 7, level: 1 },
          { id: 9, level: 3 },
        ],
        [],
      ),
    ).toBe(9);
    expect(
      pickNearestWithin(0, 0, 10, [
        { id: 2, x: 6, y: 0 },
        { id: 1, x: 0, y: 6 },
        { id: 0, x: 11, y: 0 },
      ])?.id,
    ).toBe(1);
    expect(pickNearestWithin(0, 0, 5, [{ id: 2, x: 6, y: 0 }])).toBeNull();
    expect(interceptHitPct(UnitType.HydrogenBomb)).toBe(10);
    expect(interceptHitPct(UnitType.AtomBomb)).toBe(2);
    expect(strikeCraterRadius(100)).toBe(3);
    expect(strikeCraterRadius(1600)).toBe(6);
    expect(strikeCraterRadius(7000)).toBe(10);
    expect(strikeSecondsLeft(700, 100)).toBe(60);
    expect(strikeSecondsLeft(700, 695)).toBe(1);
    expect(strikeSecondsLeft(700, 800)).toBe(0);
    expect(stockTotal(null)).toBe(0);
    expect(
      stockTotal({
        stock: {
          [UnitType.AtomBomb]: 2,
          [UnitType.HydrogenBomb]: 1,
          [UnitType.MIRV]: 1,
        },
        jobs: [],
        satellite: { phase: "none" },
      }),
    ).toBe(4);
  });
});
