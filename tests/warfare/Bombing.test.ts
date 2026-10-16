import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { processVictoryProjectSecond } from "@openfront/engine/domestic/VictoryProjects";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { SAMLauncherExecution } from "@openfront/engine/execution/SAMLauncherExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { vi } from "vitest";
import { buildLevel, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// Whether a bomber evades is a seeded 50% roll (Interception.test.ts);
// here each test picks the outcome.
const control = vi.hoisted(() => ({ evade: false }));
vi.mock("@openfront/engine/warfare/Interception", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@openfront/engine/warfare/Interception")
  >()),
  bomberEvades: () => control.evade,
}));

// plains: red holds x 0-29 with an airport at (10, 10), blue holds x 60-99.
async function airfield(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  red.addTroops(100_000);
  blue.addTroops(100_000);
  const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
  return { game, red, blue, airport };
}

function bomb(game: Game, player: Player, dst: TileRef): void {
  game.addExecution(new ConstructionExecution(player, UnitType.Bomber, dst));
}

function samAt(game: Game, owner: Player, x: number, y: number): Unit {
  const sam = owner.buildUnit(UnitType.SAMLauncher, game.ref(x, y), {});
  game.addExecution(new SAMLauncherExecution(owner, null, sam));
  return sam;
}

const bomber = (p: Player): Unit | undefined => p.units(UnitType.Bomber)[0];

describe("bombing", () => {
  beforeEach(() => {
    control.evade = false;
  });

  test("costs 750K and a sortie, then leaves an 18-tile crater without fallout", async () => {
    const { game, red, blue, airport } = await airfield();
    const city = blue.buildUnit(UnitType.City, game.ref(72, 12), {});
    const blueAirport = blue.buildUnit(UnitType.Airport, game.ref(66, 8), {});
    const tiles = blue.numTilesOwned();
    const troops = blue.troops();
    const gold = red.gold();
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 3);
    expect(red.gold()).toBe(gold - 750_000n);
    expect(airport.isInCooldown()).toBe(true);
    expect(bomber(red)).toBeDefined();

    executeTicks(game, 22);
    expect(bomber(red)).toBeUndefined();
    expect(city.isActive()).toBe(false);
    expect(blueAirport.isActive()).toBe(false);
    expect(game.hasOwner(game.ref(70, 10))).toBe(false);
    expect(game.isLand(game.ref(70, 10))).toBe(true);
    // All of the inner disc (radius 8: about 200 tiles) is lost.
    expect(blue.numTilesOwned()).toBeLessThan(tiles - 190);
    expect(blue.troops()).toBeLessThan(troops);
    expect(game.numTilesWithFallout()).toBe(0);
  });

  test("a SAM shoots down a bomber that doesn't evade: no crater", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    const spy = vi.spyOn(game, "displayMessage");
    const tiles = blue.numTilesOwned();
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 40);
    expect(bomber(red)).toBeUndefined();
    expect(blue.numTilesOwned()).toBe(tiles);
    expect(spy).toHaveBeenCalledWith(
      "events_display.missile_intercepted",
      MessageType.SAM_HIT,
      blue.id(),
      undefined,
      { unit: "unit_type.bomber" },
    );
    expect(spy).toHaveBeenCalledWith(
      "events_display.plane_shot_down",
      MessageType.UNIT_DESTROYED,
      red.id(),
      undefined,
      { unit: "unit_type.bomber" },
    );
  });

  test("an evading bomber gets through and detonates", async () => {
    control.evade = true;
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    const city = blue.buildUnit(UnitType.City, game.ref(72, 12), {});
    const spy = vi.spyOn(game, "displayMessage");
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 40);
    expect(spy).toHaveBeenCalledWith(
      "events_display.bomber_evaded",
      MessageType.SAM_MISS,
      blue.id(),
    );
    expect(city.isActive()).toBe(false);
    expect(game.hasOwner(game.ref(70, 10))).toBe(false);
  });

  test("SAMs also shoot down transport planes; their troops are lost", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    const troops = red.troops();
    game.addExecution(new ParadropExecution(red, 30_000, game.ref(70, 10)));
    executeTicks(game, 40);
    expect(red.units(UnitType.TransportPlane)).toHaveLength(0);
    expect(red.troops()).toBe(troops - 30_000);
    expect(game.owner(game.ref(70, 10))).toBe(blue);
  });

  test("can't bomb own or allied land", async () => {
    const { game, red, blue } = await airfield();
    red.createAllianceRequest(blue)?.accept();
    const gold = red.gold();
    bomb(game, red, game.ref(70, 10));
    bomb(game, red, game.ref(20, 10));
    executeTicks(game, 5);
    expect(bomber(red)).toBeUndefined();
    expect(red.gold()).toBe(gold);
  });

  test("survives a snapshot mid-flight under SAM fire", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 64, 12);
    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 8);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });
});

describe("bombing in domestic mode", () => {
  test("destroys a victory-project host, which fails the project; it isn't an attack", async () => {
    const { game, red, blue } = await airfield({ domesticMode: true });
    grantTechs(red, "industrialization");
    const host = buildLevel(game, blue, UnitType.ResearchInstitute, 70, 12, 3);
    grantTechs(blue, "space_program");
    blue.addGold(5_000_000n);
    game.addExecution(new VictoryProjectExecution(blue, "science", host.id()));
    executeTicks(game, 1);
    expect(blue.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());

    bomb(game, red, game.ref(70, 10));
    executeTicks(game, 25);
    expect(host.isActive()).toBe(false);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
    processVictoryProjectSecond(game, blue, blue.domestic()!);
    expect(blue.domestic()!.victoryProject()).toBeNull();
  });
});
