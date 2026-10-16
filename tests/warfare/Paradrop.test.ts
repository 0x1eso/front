import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { AttackLogicInput } from "@openfront/engine/configuration/EngineConfig";
import { activeConditions } from "@openfront/engine/domestic/DomesticEconomy";
import { Game, Player, Unit } from "@openfront/engine/game/Game";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { vi } from "vitest";
import { grantLaws, grantTechs } from "../domestic/util";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

// plains: red holds x 0-29 with an airport at (10, 10), blue holds x 60-99.
// The drop at (70, 10) is 60 tiles away: 20 steps at 3 tiles a tick.
async function airfield(config: Parameters<typeof warfareGame>[1] = {}) {
  const game = await warfareGame("plains", config);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 60, 0, 40, 100);
  red.addGold(10_000_000n);
  red.addTroops(100_000);
  blue.addTroops(100_000);
  const airport = red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
  return { game, red, blue, airport };
}

function drop(game: Game, player: Player, troops: number, dst: TileRef) {
  game.addExecution(new ParadropExecution(player, troops, dst));
}

const plane = (p: Player): Unit | undefined =>
  p.units(UnitType.TransportPlane)[0];

describe("paradrop", () => {
  test("costs 100K, a sortie and the troops; lands, takes a radius-2 zone and attacks from it", async () => {
    const { game, red, blue, airport } = await airfield();
    const gold = red.gold();
    const troops = red.troops();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 2);
    expect(red.gold()).toBe(gold - 100_000n);
    expect(red.troops()).toBe(troops - 30_000);
    expect(airport.isInCooldown()).toBe(true);
    const flying = plane(red)!;
    expect(flying.troops()).toBe(30_000);

    executeTicks(game, 21);
    expect(flying.isActive()).toBe(false);
    for (const [x, y] of [
      [70, 10],
      [72, 10],
      [68, 10],
      [70, 12],
      [71, 11],
    ]) {
      expect(game.owner(game.ref(x, y)), `${x},${y}`).toBe(red);
    }
    const attack = red.outgoingAttacks().find((a) => a.target() === blue);
    expect(attack?.sourceTile()).toBe(game.ref(70, 10));
  });

  test("an ally's landing zone sends the troops home", async () => {
    const { game, red, blue } = await airfield();
    const troops = red.troops();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 6);
    red.createAllianceRequest(blue)?.accept();
    executeTicks(game, 20);
    expect(plane(red)).toBeUndefined();
    expect(red.troops()).toBe(troops);
    expect(game.owner(game.ref(70, 10))).toBe(blue);
    expect(red.outgoingAttacks()).toHaveLength(0);
  });

  test("lands home: the troops come back", async () => {
    const { game, red } = await airfield();
    const troops = red.troops();
    const target = game.ref(40, 10); // unclaimed when launched
    drop(game, red, 30_000, target);
    executeTicks(game, 3);
    red.conquer(target);
    executeTicks(game, 20);
    expect(red.troops()).toBe(troops);
  });

  test("without a free sortie nothing flies and the player is told", async () => {
    const { game, red, airport } = await airfield();
    airport.launch();
    const spy = vi.spyOn(game, "displayMessage");
    const gold = red.gold();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 3);
    expect(plane(red)).toBeUndefined();
    expect(red.gold()).toBe(gold);
    expect(spy).toHaveBeenCalledWith(
      "events_display.no_airport_available",
      MessageType.ATTACK_FAILED,
      red.id(),
    );
  });

  test("the target is warned like a naval invasion", async () => {
    const { game, red, blue } = await airfield();
    const spy = vi.spyOn(game, "displayIncomingUnit");
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 2);
    expect(spy).toHaveBeenCalledWith(
      plane(red)!.id(),
      "events_display.paradrop_inbound",
      MessageType.NAVAL_INVASION_INBOUND,
      blue.id(),
    );
  });

  test("survives a snapshot mid-flight and after landing", async () => {
    const { game, red } = await airfield();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 8);
    await expectSnapshotRoundTrip(game, "plains", 30);
  });

  test("does nothing with the option off", async () => {
    const game = await setup("plains", {}, [RED, BLUE]);
    const red = own(game, RED.id, 0, 0, 30, 100);
    own(game, BLUE.id, 60, 0, 40, 100);
    red.addGold(10_000_000n);
    red.addTroops(100_000);
    const troops = red.troops();
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 25);
    expect(plane(red)).toBeUndefined();
    expect(red.troops()).toBe(troops);
  });

  test("the intent validates", () => {
    expect(
      IntentSchema.safeParse({ type: "paradrop", troops: 1500.5, dst: 77 })
        .success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "paradrop", troops: -1, dst: 77 }).success,
    ).toBe(false);
  });
});

describe("paradrop in domestic mode", () => {
  test("is an attack: combat modifiers apply and it counts as attacking", async () => {
    const { game, red } = await airfield({ domesticMode: true });
    grantTechs(red, "industrialization");
    grantLaws(red, { service: "B" }); // attack losses -15%
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 21);
    const spy = vi.spyOn(game.config(), "attackLogic");
    executeTicks(game, 4);
    const inputs: AttackLogicInput[] = spy.mock.calls.map(([i]) => i);
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => i.attacker.lossScale === 0.85)).toBe(true);
    expect(activeConditions(red, 1_000_000).has("attacking")).toBe(true);
  });

  test("industrialization unlocks it", async () => {
    const { game, red } = await airfield({ domesticMode: true });
    drop(game, red, 30_000, game.ref(70, 10));
    executeTicks(game, 3);
    expect(plane(red)).toBeUndefined();
  });
});
