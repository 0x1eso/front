import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { NukeProductionExecution } from "@openfront/engine/strategic/NukeProductionExecution";
import { buildLevel, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, strategicGame } from "./util";

/** ConstructionExecution, then the missile's init, then its launch. */
const LAUNCH = 3;
/** Long enough for the missile to cross the plains at the test speed. */
const FLIGHT = 80;

// plains: red holds x 0-29 with a silo at (10, 10); blue holds x 60-99.
async function range(config: Parameters<typeof strategicGame>[1] = {}) {
  const game = await strategicGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  blue.addGold(10_000_000n);
  red.addTroops(10_000);
  blue.addTroops(10_000);
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
  return { game, red, blue, silo };
}

function fire(game: Game, player: Player, aim: TileRef): void {
  game.addExecution(
    new ConstructionExecution(player, UnitType.ConventionalMissile, aim),
  );
}

function samAt(game: Game, owner: Player, x: number, y: number): Unit {
  const sam = owner.buildUnit(UnitType.SAMLauncher, game.ref(x, y), {});
  game.addExecution(new SAMLauncherExecution(owner, null, sam));
  return sam;
}

describe("conventional missile", () => {
  test("costs 500K and a silo slot, then takes one level off the enemy building and nothing else", async () => {
    const { game, red, blue, silo } = await range();
    const factory = blue.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    blue.upgradeUnit(factory);
    const gold = red.gold();
    const tiles = blue.numTilesOwned();
    const troops = blue.troops();
    fire(game, red, game.ref(82, 51));
    executeTicks(game, LAUNCH);
    expect(red.gold()).toBe(gold - 500_000n);
    expect(silo.isInCooldown()).toBe(true);
    expect(red.units(UnitType.ConventionalMissile)).toHaveLength(1);
    executeTicks(game, FLIGHT);
    expect(factory.isActive()).toBe(true);
    expect(factory.level()).toBe(1);
    expect(blue.numTilesOwned()).toBe(tiles);
    expect(blue.troops()).toBe(troops);
    expect(red.units(UnitType.ConventionalMissile)).toHaveLength(0);
  });

  test("a level-1 building is destroyed", async () => {
    const { game, red, blue } = await range();
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(city.isActive()).toBe(false);
  });

  test("a hit factory loses both nukes in production and one line", async () => {
    const { game, red, blue } = await range();
    const factory = blue.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    blue.upgradeUnit(factory);
    game.addExecution(
      new NukeProductionExecution(blue, UnitType.AtomBomb),
      new NukeProductionExecution(blue, UnitType.HydrogenBomb),
    );
    executeTicks(game, 1);
    expect(blue.strategic()!.jobs()).toHaveLength(2);
    const gold = blue.gold();

    fire(game, red, factory.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(factory.level()).toBe(1);
    expect(blue.strategic()!.jobs()).toHaveLength(0);
    expect(blue.gold()).toBe(gold);

    // One line left: one new order fits, a second doesn't.
    game.addExecution(
      new NukeProductionExecution(blue, UnitType.AtomBomb),
      new NukeProductionExecution(blue, UnitType.AtomBomb),
    );
    executeTicks(game, 1);
    expect(blue.strategic()!.jobs()).toHaveLength(1);
  });

  test("an ally's building can't be picked, even once it disconnects", async () => {
    const { game, red, blue } = await range();
    blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    red.createAllianceRequest(blue)?.accept();
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(80, 50))).toBe(
      false,
    );
    blue.markDisconnected(true);
    expect(red.canBuild(UnitType.ConventionalMissile, game.ref(80, 50))).toBe(
      false,
    );
  });

  test("a building that turns friendly mid-flight is spared", async () => {
    const { game, red, blue } = await range();
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + 2);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, FLIGHT);
    expect(city.isActive()).toBe(true);
  });

  test("a SAM shoots it down like a nuke", async () => {
    const { game, red, blue } = await range();
    const factory = blue.buildUnit(UnitType.Factory, game.ref(80, 50), {});
    blue.upgradeUnit(factory);
    samAt(game, blue, 78, 50);
    fire(game, red, factory.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(factory.level()).toBe(2);
    expect(red.units(UnitType.ConventionalMissile)).toHaveLength(0);
  });

  test("survives a snapshot mid-flight", async () => {
    const { game, red, blue } = await range();
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + 2);
    await expectSnapshotRoundTrip(game, "plains", 40);
  });
});

describe("conventional missile with the other modes", () => {
  test("expanded warfare: SAMs shoot it as well as the planes", async () => {
    const { game, red, blue } = await range({ warfareExpansion: true });
    const city = blue.buildUnit(UnitType.City, game.ref(80, 50), {});
    samAt(game, blue, 78, 50);
    fire(game, red, city.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(city.isActive()).toBe(true);
  });

  test("domestic: a victory-project host loses a level but keeps its project; no 'attacking'", async () => {
    const { game, red, blue } = await range({ domesticMode: true });
    const host = buildLevel(game, blue, UnitType.ResearchInstitute, 80, 12, 3);
    grantTechs(blue, "space_program");
    game.addExecution(new VictoryProjectExecution(blue, "science", host.id()));
    executeTicks(game, 1);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());

    fire(game, red, host.tile());
    executeTicks(game, LAUNCH + FLIGHT);
    expect(host.level()).toBe(2);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
    processVictoryProjectSecond(game, blue, blue.domestic()!);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());
  });
});
