import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  airportRange,
  cargoGold,
  coastalBatteryFireInterval,
  WARFARE_ONLY_UNITS,
} from "@openfront/engine-lib/warfare/Warfare";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { BLUE, own, RED, warfareGame } from "./util";

const cost = (game: Game, player: Player, type: UnitType): bigint =>
  game.unitInfo(type).cost(game, player);

describe("the warfareExpansion option", () => {
  test("off by default: all six units are disabled and none can be built", async () => {
    const game = await setup("plains", {}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 30);
    own(game, BLUE.id, 60, 0, 30, 30);
    red.addGold(100_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(5, 5), {});

    expect(game.config().warfareExpansion()).toBe(false);
    expect(WARFARE_ONLY_UNITS.size).toBe(6);
    for (const type of WARFARE_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(true);
      expect(red.canBuild(type, game.ref(70, 10)), type).toBe(false);
    }
  });

  test("on: the six units are enabled", async () => {
    const game = await warfareGame("plains");
    expect(game.config().warfareExpansion()).toBe(true);
    for (const type of WARFARE_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(false);
    }
  });

  test("unit costs: battery 250K steps to 1M, airport 3M → 6M → 9M counting upgrades", async () => {
    const game = await warfareGame("plains");
    const red = own(game, RED.id, 0, 0, 60, 60);
    red.addGold(1_000_000_000n);

    expect(cost(game, red, UnitType.CoastalBarrage)).toBe(300_000n);
    expect(cost(game, red, UnitType.Bomber)).toBe(750_000n);
    expect(cost(game, red, UnitType.TransportPlane)).toBe(100_000n);
    expect(cost(game, red, UnitType.CargoPlane)).toBe(0n);
    expect(cost(game, red, UnitType.CoastalBattery)).toBe(250_000n);
    expect(cost(game, red, UnitType.Airport)).toBe(3_000_000n);

    const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    expect(cost(game, red, UnitType.Airport)).toBe(6_000_000n);
    red.upgradeUnit(airport);
    expect(cost(game, red, UnitType.Airport)).toBe(9_000_000n);
    red.buildUnit(UnitType.Airport, game.ref(40, 40), {});
    expect(cost(game, red, UnitType.Airport)).toBe(9_000_000n);

    for (let i = 0; i < 4; i++) {
      red.buildUnit(UnitType.CoastalBattery, game.ref(5 + 12 * i, 55), {});
    }
    expect(cost(game, red, UnitType.CoastalBattery)).toBe(1_000_000n);
  });

  test("rules shared with the client", () => {
    expect(airportRange(1)).toBe(150);
    expect(airportRange(2)).toBe(180);
    expect(airportRange(4)).toBe(240);
    expect(coastalBatteryFireInterval(1)).toBe(30);
    expect(coastalBatteryFireInterval(2)).toBe(15);
    expect(coastalBatteryFireInterval(3)).toBe(10);
    expect(coastalBatteryFireInterval(7)).toBe(10);
    expect(cargoGold(60)).toBe(26_000);
  });
});

describe("where warfare units can go", () => {
  test("a coastal battery only on the owner's shore", async () => {
    const game = await warfareGame("half_land_half_ocean");
    const red = own(game, RED.id, 0, 0, 8, 8);
    own(game, BLUE.id, 0, 8, 8, 8);
    red.addGold(10_000_000n);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 3))).toBe(
      game.ref(7, 3),
    );
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(2, 3))).toBe(false);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 12))).toBe(false);
  });

  test("a barrage needs a loaded silo within 200 tiles and an enemy target", async () => {
    const game = await warfareGame("big_plains");
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 100, 100, 100, 100);
    red.addGold(10_000_000n);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});

    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(150, 150))).toBe(
      silo.tile(),
    );
    // 254 tiles away
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(190, 190))).toBe(
      false,
    );
    // own land
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(20, 20))).toBe(false);
    red.createAllianceRequest(blue)?.accept();
    expect(red.canBuild(UnitType.CoastalBarrage, game.ref(150, 150))).toBe(
      false,
    );
  });

  test("bombing and paradrops need a free sortie from an airport in range", async () => {
    const game = await warfareGame("big_plains");
    const red = own(game, RED.id, 0, 0, 30, 30);
    own(game, BLUE.id, 100, 100, 100, 100);
    red.addGold(100_000_000n);
    const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const near = game.ref(110, 110); // 141 tiles
    const far = game.ref(150, 150); // 198 tiles

    expect(red.canBuild(UnitType.Bomber, near)).toBe(airport.tile());
    expect(red.canBuild(UnitType.TransportPlane, near)).toBe(airport.tile());
    expect(red.canBuild(UnitType.Bomber, far)).toBe(false);
    expect(red.canBuild(UnitType.TransportPlane, game.ref(20, 20))).toBe(false);

    red.upgradeUnit(airport);
    red.upgradeUnit(airport); // level 3: 210 tiles, the new sorties reload first
    airport.reloadMissile();
    airport.reloadMissile();
    expect(red.canBuild(UnitType.Bomber, far)).toBe(airport.tile());

    airport.launch();
    airport.launch();
    airport.launch();
    expect(airport.isInCooldown()).toBe(true);
    expect(red.canBuild(UnitType.Bomber, near)).toBe(false);
  });
});

describe("expanded warfare in domestic mode", () => {
  test("each unit waits for its tech", async () => {
    const game = await warfareGame("half_land_half_ocean", {
      domesticMode: true,
    });
    const red = own(game, RED.id, 0, 0, 8, 16);
    red.addGold(100_000_000n);
    const locked = (t: UnitType) => red.isUnitLocked(t);

    for (const type of [
      UnitType.CoastalBattery,
      UnitType.CoastalBarrage,
      UnitType.Airport,
      UnitType.Bomber,
      UnitType.TransportPlane,
    ]) {
      expect(locked(type), type).toBe(true);
    }
    expect(locked(UnitType.CargoPlane)).toBe(false);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 3))).toBe(false);
    expect(
      red.buildableUnits(null).find((b) => b.type === UnitType.Airport)?.locked,
    ).toBe(true);

    grantTechs(red, "fortification");
    expect(locked(UnitType.CoastalBattery)).toBe(false);
    expect(red.canBuild(UnitType.CoastalBattery, game.ref(7, 3))).toBe(
      game.ref(7, 3),
    );
    grantTechs(red, "industrialization");
    expect(locked(UnitType.Airport)).toBe(false);
    expect(locked(UnitType.Bomber)).toBe(false);
    expect(locked(UnitType.TransportPlane)).toBe(false);
    expect(locked(UnitType.CoastalBarrage)).toBe(true);
    grantTechs(red, "rocketry");
    expect(locked(UnitType.CoastalBarrage)).toBe(false);
  });

  test("structure and strike cost modifiers apply as for buildings and nukes", async () => {
    const game = await warfareGame("plains", { domesticMode: true });
    const red = own(game, RED.id, 0, 0, 30, 30);
    grantLaws(red, { construction: "A", nuclear: "A" });

    expect(cost(game, red, UnitType.Airport)).toBe(2_250_000n);
    expect(cost(game, red, UnitType.CoastalBattery)).toBe(187_500n);
    expect(cost(game, red, UnitType.CoastalBarrage)).toBe(240_000n);
    expect(cost(game, red, UnitType.Bomber)).toBe(600_000n);
    expect(cost(game, red, UnitType.TransportPlane)).toBe(100_000n);
  });

  test("with the option off, domestic mode is as before", async () => {
    const game = await setup("plains", { domesticMode: true }, [RED]);
    const red = own(game, RED.id, 0, 0, 30, 30);
    grantTechs(red, "rocketry", "fortification", "industrialization");
    expect(red.isUnitLocked(UnitType.MissileSilo)).toBe(false);
    for (const type of WARFARE_ONLY_UNITS) {
      expect(game.config().isUnitDisabled(type), type).toBe(true);
    }
  });
});
