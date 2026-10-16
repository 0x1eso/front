import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  BombDropUpdate,
  GameUpdateType,
} from "@openfront/engine-api/game/GameUpdates";
import {
  CARPET_BOMB_OUTER,
  CARPET_BOMBS,
  carpetBombPoints,
} from "@openfront/engine-lib/warfare/Warfare";
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

/** Runs `n` ticks and returns every BombDrop update, with its tick. */
function runCollect(
  game: Game,
  n: number,
): (BombDropUpdate & { at: number })[] {
  const out: (BombDropUpdate & { at: number })[] = [];
  for (let i = 0; i < n; i++) {
    const updates = game.executeNextTick();
    for (const u of updates[GameUpdateType.BombDrop] ?? []) {
      out.push({ ...(u as BombDropUpdate), at: game.ticks() });
    }
  }
  return out;
}

const bomber = (p: Player): Unit | undefined => p.units(UnitType.Bomber)[0];

describe("bombing", () => {
  beforeEach(() => {
    control.evade = false;
  });

  test("costs 750K and a sortie, then carpets the line with fallout", async () => {
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

    executeTicks(game, 45);
    expect(bomber(red)).toBeUndefined();
    expect(city.isActive()).toBe(false);
    expect(blueAirport.isActive()).toBe(false);
    expect(blue.numTilesOwned()).toBeLessThan(tiles - 300);
    expect(blue.troops()).toBeLessThan(troops);
    // A bombed tile carries fallout, as under an atom bomb.
    expect(game.numTilesWithFallout()).toBeGreaterThan(0);
    expect(game.hasFallout(game.ref(73, 10))).toBe(true);
    expect(game.hasOwner(game.ref(73, 10))).toBe(false);
  });

  test("drops one bomb per carpet point along the airport-aim line, in order", async () => {
    const { game, red } = await airfield();
    bomb(game, red, game.ref(70, 10));
    const drops = runCollect(game, 60);
    const points = carpetBombPoints(10, 10, 70, 10);
    expect(drops).toHaveLength(CARPET_BOMBS);
    drops.forEach((d, i) => {
      expect(d.index).toBe(i);
      expect(d.last).toBe(i === CARPET_BOMBS - 1);
      expect(d.attackerID).toBe(red.smallID());
      expect(game.x(d.tile)).toBe(points[i].x);
      expect(game.y(d.tile)).toBe(points[i].y);
      if (i > 0) expect(d.at).toBeGreaterThanOrEqual(drops[i - 1].at);
    });
    // The line runs from the airport through the aim, centred on it.
    expect(game.x(drops[0].tile)).toBeLessThan(70);
    expect(game.x(drops[CARPET_BOMBS - 1].tile)).toBeGreaterThan(70);
    expect(drops[0].at).toBeLessThan(drops[CARPET_BOMBS - 1].at);
    expect(bomber(red)).toBeUndefined();
  });

  test("a diagonal aim bombs along the diagonal and skips off-map points", async () => {
    const game = await warfareGame("plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 20, 20);
    own(game, BLUE.id, 40, 40, 60, 60);
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.Airport, game.ref(5, 5), {});
    // The line ends past the map corner: its last points are off the map.
    bomb(game, red, game.ref(90, 90));
    const drops = runCollect(game, 80);
    const points = carpetBombPoints(5, 5, 90, 90).filter(
      (p) => p.x < 100 && p.y < 100,
    );
    expect(points.length).toBeLessThan(CARPET_BOMBS);
    expect(drops).toHaveLength(points.length);
    expect(drops[drops.length - 1].last).toBe(true);
    drops.forEach((d, i) => {
      expect(game.x(d.tile)).toBe(points[i].x);
      expect(game.y(d.tile)).toBe(points[i].y);
    });
  });

  test("a SAM shoots the bomber down mid-run: the remaining bombs are not dropped", async () => {
    const { game, red, blue } = await airfield();
    samAt(game, blue, 99, 12);
    const spy = vi.spyOn(game, "displayMessage");
    bomb(game, red, game.ref(70, 10));
    const drops = runCollect(game, 60);
    expect(bomber(red)).toBeUndefined();
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.length).toBeLessThan(CARPET_BOMBS);
    expect(drops.some((d) => d.last)).toBe(false);
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
    executeTicks(game, 60);
    expect(spy).toHaveBeenCalledWith(
      "events_display.bomber_evaded",
      MessageType.SAM_MISS,
      blue.id(),
    );
    expect(city.isActive()).toBe(false);
    expect(bomber(red)).toBeUndefined();
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

  test("a carpet crossing own land is allowed and those bombs are skipped; an own aim is refused", async () => {
    const game = await warfareGame("plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 30, 100);
    own(game, RED.id, 44, 0, 13, 100);
    const blue = own(game, BLUE.id, 85, 0, 15, 100);
    red.addGold(10_000_000n);
    red.addTroops(100_000);
    red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const aim = game.ref(65, 10);
    expect(red.canBuild(UnitType.Bomber, aim)).not.toBe(false);
    expect(red.canBuild(UnitType.Bomber, game.ref(50, 10))).toBe(false);
    expect(red.canBuild(UnitType.Bomber, game.ref(20, 10))).toBe(false);
    const own0 = red.numTilesOwned();
    const expected = carpetBombPoints(10, 10, 65, 10).filter(
      (p) => game.owner(game.ref(p.x, p.y)) !== red,
    );
    expect(expected.length).toBeLessThan(CARPET_BOMBS);
    bomb(game, red, aim);
    const drops = runCollect(game, 60);
    expect(drops).toHaveLength(expected.length);
    expect(drops.filter((d) => d.last)).toHaveLength(1);
    expect(drops[drops.length - 1].last).toBe(true);
    drops.forEach((d, i) => {
      expect(game.x(d.tile)).toBe(expected[i].x);
    });
    // Blasts follow the atom-bomb rules: the striker's border may be scorched.
    expect(red.numTilesOwned()).toBeLessThan(own0);
    expect(blue.numTilesOwned()).toBeLessThan(15 * 100);
    expect(bomber(red)).toBeUndefined();
    expect(CARPET_BOMB_OUTER).toBe(8);
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

  test("survives a snapshot mid-run, after some bombs have fallen", async () => {
    const { game, red } = await airfield();
    bomb(game, red, game.ref(70, 10));
    const before = runCollect(game, 22);
    expect(before.length).toBeGreaterThan(0);
    expect(before.length).toBeLessThan(CARPET_BOMBS);
    await expectSnapshotRoundTrip(game, "plains", 40);
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
