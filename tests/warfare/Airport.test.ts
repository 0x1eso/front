import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// big_plains (200x200): red holds the north-west corner, blue the rest of
// the south-east; red builds at (10, 10).
async function base(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("big_plains", {
    instantBuild: true,
    ...config,
  });
  const red = own(game, RED.id, 0, 0, 40, 40);
  const blue = own(game, BLUE.id, 100, 100, 100, 100);
  red.addGold(100_000_000n);
  return { game, red, blue };
}

function buildAirport(game: Game, red: Player): Unit {
  game.addExecution(
    new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
  );
  executeTicks(game, 3);
  const airport = red.units(UnitType.Airport)[0];
  expect(airport).toBeDefined();
  return airport;
}

const target = (game: Game) => game.ref(110, 110); // 141 tiles from (10, 10)

describe("airport", () => {
  test("takes 60 s to build", async () => {
    const { game, red } = await base({ instantBuild: false });
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
    );
    executeTicks(game, 3);
    const airport = red.units(UnitType.Airport)[0];
    expect(airport.isUnderConstruction()).toBe(true);
    executeTicks(game, 590);
    expect(airport.isUnderConstruction()).toBe(true);
    executeTicks(game, 15);
    expect(airport.isUnderConstruction()).toBe(false);
  });

  test("a level 1 airport has one sortie, back 30 s after it is used", async () => {
    const { game, red } = await base();
    const airport = buildAirport(game, red);
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(airport.tile());
    airport.launch();
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(false);
    expect(red.canBuild(UnitType.TransportPlane, target(game))).toBe(false);
    executeTicks(game, 299);
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(false);
    executeTicks(game, 2);
    expect(red.canBuild(UnitType.Bomber, target(game))).toBe(airport.tile());
  });

  test("an upgrade adds a sortie (reloading first) and 30 tiles of range", async () => {
    const { game, red } = await base();
    const airport = buildAirport(game, red);
    const far = game.ref(130, 130); // 170 tiles
    expect(red.canBuild(UnitType.Bomber, far)).toBe(false);

    red.upgradeUnit(airport);
    expect(airport.level()).toBe(2);
    expect(airport.missileTimerQueue()).toHaveLength(1);
    expect(airport.isInCooldown()).toBe(false);
    expect(red.canBuild(UnitType.Bomber, far)).toBe(airport.tile());

    airport.launch();
    expect(airport.isInCooldown()).toBe(true);
    executeTicks(game, 302);
    expect(airport.missileTimerQueue()).toHaveLength(0);
  });

  test("survives a snapshot while a sortie reloads", async () => {
    const { game, red } = await base();
    const airport = buildAirport(game, red);
    airport.launch();
    executeTicks(game, 10);
    await expectSnapshotRoundTrip(game, "big_plains", 20);
  });
});

describe("airport in domestic mode", () => {
  test("industrialization unlocks it; structure cost and build time modifiers apply", async () => {
    const { game, red } = await base({
      domesticMode: true,
      instantBuild: false,
    });
    expect(red.canBuild(UnitType.Airport, game.ref(10, 10))).toBe(false);
    grantTechs(red, "industrialization"); // all structures -15%
    grantLaws(red, { construction: "B" }); // build time -50%
    expect(game.unitInfo(UnitType.Airport).cost(game, red)).toBe(2_550_000n);
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(10, 10)),
    );
    executeTicks(game, 3);
    const airport = red.units(UnitType.Airport)[0];
    expect(airport.constructionTicks()).toBe(300);
    executeTicks(game, 305);
    expect(airport.isUnderConstruction()).toBe(false);
  });
});
