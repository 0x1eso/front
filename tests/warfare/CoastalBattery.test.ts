import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// half_land_half_ocean: land x 0-7, sea x 8-15. Red holds the north half
// of the coast, blue the south half.
async function coast(
  config: Parameters<typeof warfareGame>[1] = {},
): Promise<{ game: Game; red: Player; blue: Player }> {
  const game = await warfareGame("half_land_half_ocean", {
    instantBuild: true,
    ...config,
  });
  const red = own(game, RED.id, 0, 0, 8, 8);
  const blue = own(game, BLUE.id, 0, 8, 8, 8);
  red.addGold(10_000_000n);
  blue.addGold(10_000_000n);
  return { game, red, blue };
}

function buildBattery(game: Game, player: Player, x: number, y: number): Unit {
  game.addExecution(
    new ConstructionExecution(player, UnitType.CoastalBattery, game.ref(x, y)),
  );
  executeTicks(game, 3);
  const battery = player.units(UnitType.CoastalBattery)[0];
  expect(battery).toBeDefined();
  return battery;
}

const shellsFired = (p: Player) => p.unitsConstructed(UnitType.Shell);

describe("coastal battery", () => {
  test("is built on its owner's shore through the build intent", async () => {
    const { game, red } = await coast();
    const battery = buildBattery(game, red, 7, 3);
    expect(battery.tile()).toBe(game.ref(7, 3));
    expect(battery.isUnderConstruction()).toBe(false);
  });

  test("sinks an enemy transport ship with one shell", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    const boat = blue.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    executeTicks(game, 10);
    expect(boat.isActive()).toBe(false);
    expect(shellsFired(red)).toBe(1);
  });

  test("needs several shells for a warship", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    const ship = blue.buildUnit(UnitType.Warship, game.ref(12, 4), {
      patrolTile: game.ref(12, 4),
    });
    executeTicks(game, 25);
    expect(ship.isActive()).toBe(true);
    expect(ship.health()).toBeLessThan(1000);
    executeTicks(game, 400);
    expect(ship.isActive()).toBe(false);
  });

  test("never shoots trade ships", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    const port = blue.buildUnit(UnitType.Port, game.ref(7, 12), {});
    const trader = blue.buildUnit(UnitType.TradeShip, game.ref(11, 3), {
      targetUnit: port,
    });
    executeTicks(game, 60);
    expect(trader.isActive()).toBe(true);
    expect(shellsFired(red)).toBe(0);
  });

  test("leaves allied ships alone", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    red.createAllianceRequest(blue)?.accept();
    const boat = blue.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 12),
    });
    executeTicks(game, 30);
    expect(boat.isActive()).toBe(true);
    expect(shellsFired(red)).toBe(0);
  });

  test("fires faster after an upgrade", async () => {
    const shots = async (level: number): Promise<number> => {
      const { game, red, blue } = await coast();
      const battery = buildBattery(game, red, 7, 3);
      for (let l = 1; l < level; l++) red.upgradeUnit(battery);
      blue.buildUnit(UnitType.Warship, game.ref(12, 4), {
        patrolTile: game.ref(12, 4),
      });
      executeTicks(game, 40);
      return shellsFired(red);
    };
    expect(await shots(1)).toBe(2); // every 30 ticks
    expect(await shots(2)).toBe(3); // every 15 ticks
  });

  test("a nuke destroys it like any structure", async () => {
    const { game, red, blue } = await coast();
    const battery = buildBattery(game, red, 7, 3);
    blue.buildUnit(UnitType.MissileSilo, game.ref(2, 12), {});
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, blue, battery.tile(), null),
    );
    executeTicks(game, 30);
    expect(battery.isActive()).toBe(false);
  });

  test("survives a snapshot mid-fight", async () => {
    const { game, red, blue } = await coast();
    buildBattery(game, red, 7, 3);
    blue.buildUnit(UnitType.Warship, game.ref(12, 4), {
      patrolTile: game.ref(12, 4),
    });
    executeTicks(game, 5);
    await expectSnapshotRoundTrip(game, "half_land_half_ocean", 40);
  });
});

describe("coastal battery in domestic mode", () => {
  test("fortification unlocks it and the build-time laws apply", async () => {
    const { game, red } = await coast({
      domesticMode: true,
      instantBuild: false,
    });
    grantTechs(red, "fortification");
    grantLaws(red, { construction: "B" }); // build time -50%
    game.addExecution(
      new ConstructionExecution(red, UnitType.CoastalBattery, game.ref(7, 3)),
    );
    executeTicks(game, 3);
    const battery = red.units(UnitType.CoastalBattery)[0];
    expect(battery.isUnderConstruction()).toBe(true);
    expect(battery.constructionTicks()).toBe(50);
    executeTicks(game, 55);
    expect(battery.isUnderConstruction()).toBe(false);
  });

  test("shooting a boat doesn't count as attacking", async () => {
    const { game, red, blue } = await coast({ domesticMode: true });
    grantTechs(red, "fortification");
    buildBattery(game, red, 7, 3);
    blue.buildUnit(UnitType.TransportShip, game.ref(11, 3), {
      troops: 500,
      targetTile: game.ref(7, 3),
    });
    executeTicks(game, 3);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
  });
});
