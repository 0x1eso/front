import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { conquerRect } from "../domestic/util";
import { setup } from "../util/Setup";
import { executeTicks } from "../util/utils";
import { BLUE, own, RED, warfareGame } from "./util";

describe("encirclement capture (spec §14c)", () => {
  test("with expanded warfare a paradrop deep in enemy land keeps its beachhead and attack", async () => {
    const game = await warfareGame("plains");
    const red = own(game, RED.id, 0, 0, 30, 100);
    const blue = own(game, BLUE.id, 40, 0, 60, 100);
    red.addGold(10_000_000n);
    red.addTroops(200_000);
    blue.addTroops(10_000);
    red.buildUnit(UnitType.Airport, game.ref(10, 50), {});
    game.addExecution(new PlayerExecution(red), new PlayerExecution(blue));
    const drop = game.ref(80, 50);
    game.addExecution(new ParadropExecution(red, 40_000, drop));
    executeTicks(game, 30);
    expect(red.outgoingAttacks().length).toBeGreaterThan(0);
    const troopsInAttacks = () =>
      red.outgoingAttacks().reduce((n, a) => n + a.troops(), 0);
    expect(troopsInAttacks()).toBeGreaterThan(0);
    executeTicks(game, 60);
    // Never swallowed by the surrounding nation: the landing is still red's.
    expect(game.owner(drop)).toBe(red);
    expect(red.numTilesOwned()).toBeGreaterThan(30 * 100 + 12);
  });

  test("an enclave is absorbed by its surrounder only with the option off", async () => {
    for (const warfare of [false, true]) {
      const game = await setup("plains", { warfareExpansion: warfare }, [
        RED,
        BLUE,
      ]);
      const red = game.player(RED.id);
      const blue = game.player(BLUE.id);
      conquerRect(game, blue, 40, 0, 60, 100);
      conquerRect(game, red, 0, 0, 30, 100);
      conquerRect(game, red, 80, 50, 5, 5);
      red.addTroops(10_000);
      blue.addTroops(10_000);
      game.addExecution(new PlayerExecution(red), new PlayerExecution(blue));
      executeTicks(game, 30);
      // A fresh tile change makes the cluster pass run.
      red.conquer(game.ref(35, 5));
      blue.conquer(game.ref(35, 95));
      executeTicks(game, 60);
      expect(game.owner(game.ref(82, 52)) === blue, `warfare ${warfare}`).toBe(
        !warfare,
      );
    }
  });
});
