import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  BARRAGE_RADIUS,
  BARRAGE_SHELLS,
} from "@openfront/engine-lib/warfare/Warfare";
import { AttackLogicInput } from "@openfront/engine/configuration/EngineConfig";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { NukeExecution } from "@openfront/engine/execution/NukeExecution";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { barrageSuppresses } from "@openfront/engine/warfare/BarrageZone";
import { barrageImpacts } from "@openfront/engine/warfare/CoastalBarrageExecution";
import { vi } from "vitest";
import { grantLaws, grantTechs } from "../domestic/util";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// plains: red holds rows 0-49, blue rows 50-99; red's silo at (50, 10).
async function front(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", { instantBuild: true, ...config });
  const red = own(game, RED.id, 0, 0, 100, 50);
  const blue = own(game, BLUE.id, 0, 50, 100, 50);
  red.addGold(10_000_000n);
  red.addTroops(500_000);
  blue.addTroops(500_000);
  const silo = red.buildUnit(UnitType.MissileSilo, game.ref(50, 10), {});
  return { game, red, blue, silo };
}

function fire(game: Game, player: Player, tile: TileRef): void {
  game.addExecution(
    new ConstructionExecution(player, UnitType.CoastalBarrage, tile),
  );
}

/**
 * Attack-logic inputs of an attack launched from `from` for a few ticks.
 * The attack is called off afterwards so the next probe sees only its own.
 */
function probe(
  game: Game,
  red: Player,
  blue: Player,
  from: TileRef,
): AttackLogicInput[] {
  const spy = vi.spyOn(game.config(), "attackLogic");
  game.addExecution(new AttackExecution(20_000, red, blue.id(), from, true));
  executeTicks(game, 4);
  const inputs = spy.mock.calls.map(([input]) => input);
  spy.mockRestore();
  for (const attack of red.outgoingAttacks()) attack.delete();
  return inputs;
}

const marker = (game: Game): Unit | undefined =>
  game.units(UnitType.CoastalBarrage)[0];

describe("coastal barrage", () => {
  test("costs 300K and a silo slot, then lands 8 shells 5 ticks apart", async () => {
    const { game, red, blue, silo } = await front();
    const battery = blue.buildUnit(
      UnitType.CoastalBattery,
      game.ref(70, 60),
      {},
    );
    const gold = red.gold();
    fire(game, red, battery.tile());
    executeTicks(game, 3);
    expect(red.gold()).toBe(gold - 300_000n);
    expect(silo.isInCooldown()).toBe(true);
    expect(marker(game)?.tile()).toBe(battery.tile());

    executeTicks(game, 20);
    expect(red.unitsConstructed(UnitType.Shell)).toBe(4);
    executeTicks(game, 40);
    expect(red.unitsConstructed(UnitType.Shell)).toBe(BARRAGE_SHELLS);
    expect(battery.isActive()).toBe(false);
    expect(marker(game)?.reachedTarget()).toBe(true);
  });

  test("destroys only coastal batteries: no land, troops, cities or fallout", async () => {
    const { game, red, blue } = await front();
    const city = blue.buildUnit(UnitType.City, game.ref(72, 62), {});
    const tiles = blue.numTilesOwned();
    const troops = blue.troops();
    fire(game, red, game.ref(70, 60));
    executeTicks(game, 63);
    expect(city.isActive()).toBe(true);
    expect(blue.numTilesOwned()).toBe(tiles);
    expect(blue.troops()).toBe(troops);
    expect(game.numTilesWithFallout()).toBe(0);
  });

  test("spares an allied nation's battery near the impact", async () => {
    const game = await warfareGame("plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 100, 50);
    const blue = own(game, BLUE.id, 0, 50, 50, 50);
    red.addGold(10_000_000n);
    red.buildUnit(UnitType.MissileSilo, game.ref(50, 10), {});
    // The aimed tile is unclaimed; blue (an ally) has a battery next to it.
    red.createAllianceRequest(blue)?.accept();
    const allied = blue.buildUnit(
      UnitType.CoastalBattery,
      game.ref(49, 60),
      {},
    );
    fire(game, red, game.ref(51, 60));
    executeTicks(game, 63);
    expect(allied.isActive()).toBe(true);
  });

  test("defense posts are off and attackers lose 40% less in the zone for 20 s", async () => {
    const { game, red, blue } = await front();
    blue.buildUnit(UnitType.DefensePost, game.ref(30, 52), {});
    blue.buildUnit(UnitType.DefensePost, game.ref(70, 52), {});

    const before = probe(game, red, blue, game.ref(30, 49));
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((i) => i.defenderHasDefensePost)).toBe(true);
    expect(before.every((i) => i.attacker.lossScale === 1)).toBe(true);

    fire(game, red, game.ref(70, 55));
    executeTicks(game, 63);
    expect(barrageSuppresses(game, game.ref(70, 50), blue)).toBe(true);
    expect(barrageSuppresses(game, game.ref(30, 50), blue)).toBe(false);
    const during = probe(game, red, blue, game.ref(70, 49));
    expect(during.length).toBeGreaterThan(0);
    expect(during.every((i) => !i.defenderHasDefensePost)).toBe(true);
    expect(during.every((i) => i.attacker.lossScale === 0.6)).toBe(true);

    executeTicks(game, 200);
    expect(marker(game)).toBeUndefined();
    expect(barrageSuppresses(game, game.ref(60, 50), blue)).toBe(false);
    const after = probe(game, red, blue, game.ref(60, 49));
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((i) => i.defenderHasDefensePost)).toBe(true);
    expect(after.every((i) => i.attacker.lossScale === 1)).toBe(true);
  });

  test("a zone never helps against its shooter", async () => {
    const { game, red, blue } = await front();
    fire(game, red, game.ref(70, 55));
    executeTicks(game, 63);
    expect(barrageSuppresses(game, game.ref(70, 45), red)).toBe(false);
    expect(barrageSuppresses(game, game.ref(70, 55), blue)).toBe(true);
  });

  test("aimed at a corner, every shell lands on the map", async () => {
    const game = await warfareGame("plains");
    const corner = game.ref(0, 0);
    const impacts = barrageImpacts(game, corner, new PseudoRandom(7));
    expect(impacts).toHaveLength(BARRAGE_SHELLS);
    expect(impacts[0]).toBe(corner);
    for (const t of impacts) {
      expect(game.isValidRef(t)).toBe(true);
      expect(game.euclideanDistSquared(t, corner)).toBeLessThanOrEqual(
        BARRAGE_RADIUS * BARRAGE_RADIUS,
      );
    }
  });

  test("its zone marker survives a nuke", async () => {
    const { game, red, blue } = await front();
    fire(game, red, game.ref(70, 55));
    executeTicks(game, 63);
    red.buildUnit(UnitType.MissileSilo, game.ref(20, 10), {});
    game.addExecution(
      new NukeExecution(UnitType.AtomBomb, red, game.ref(70, 55), null),
    );
    executeTicks(game, 30);
    expect(marker(game)?.isActive()).toBe(true);
    expect(blue.isAlive()).toBe(true);
  });

  test("fires from a silo anywhere; far targets land later (no range limit)", async () => {
    const game = await warfareGame("big_plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 150, 150, 50, 50);
    red.addGold(10_000_000n);
    const silo = red.buildUnit(UnitType.MissileSilo, game.ref(10, 10), {});
    const battery = blue.buildUnit(
      UnitType.CoastalBattery,
      game.ref(190, 190),
      {},
    );
    // ~254 tiles from the silo, past the old 200-tile limit.
    fire(game, red, battery.tile());
    executeTicks(game, 3);
    expect(silo.isInCooldown()).toBe(true);
    expect(marker(game)?.tile()).toBe(battery.tile());
    // Shells still fly 6 tiles a tick: the first can't land within 40 ticks.
    executeTicks(game, 37);
    expect(battery.isActive()).toBe(true);
    executeTicks(game, 120);
    expect(battery.isActive()).toBe(false);
    expect(marker(game)?.reachedTarget()).toBe(true);
  });

  test("own land can't be shelled", async () => {
    const { game, red } = await front();
    const gold = red.gold();
    fire(game, red, game.ref(40, 40));
    executeTicks(game, 5);
    expect(marker(game)).toBeUndefined();
    expect(red.gold()).toBe(gold);
  });

  test("survives a snapshot mid-salvo", async () => {
    const { game, red, blue } = await front();
    blue.buildUnit(UnitType.CoastalBattery, game.ref(72, 60), {});
    fire(game, red, game.ref(70, 60));
    executeTicks(game, 12);
    await expectSnapshotRoundTrip(game, "plains", 60);
  });
});

describe("coastal barrage in domestic mode", () => {
  test("rocketry unlocks it; nuclear deterrence cuts its price; it isn't an attack", async () => {
    const { game, red } = await front({ domesticMode: true });
    grantTechs(red, "rocketry");
    grantLaws(red, { nuclear: "A" });
    const gold = red.gold();
    fire(game, red, game.ref(70, 60));
    executeTicks(game, 10);
    expect(red.gold()).toBe(gold - 240_000n);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(false);
  });
});
