import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WinCheckExecution } from "@openfront/engine/execution/WinCheckExecution";
import { conquerRect, domesticGame } from "./util";

const ALICE = new PlayerInfo(
  "alice",
  PlayerType.Human,
  "client_alice",
  "alice_id",
);
const BOB = new PlayerInfo("bob", PlayerType.Human, "client_bob", "bob_id");

describe("conquestPercent = 100 turns conquest victory off", () => {
  test("owning every land tile is not a win", async () => {
    const game = await domesticGame({ conquestPercent: 100 }, [ALICE, BOB]);
    const alice = game.player(ALICE.id);
    conquerRect(game, alice, 0, 0, 100, 100);
    game.addExecution(new WinCheckExecution());

    expect(game.config().conquestPercent()).toBe(100);
    for (let i = 0; i < 30; i++) {
      expect(game.executeNextTick()[GameUpdateType.Win]).toHaveLength(0);
    }
    expect(game.getWinner()).toBeNull();
  });

  test("the same land wins at 99", async () => {
    const game = await domesticGame({ conquestPercent: 99 }, [ALICE, BOB]);
    conquerRect(game, game.player(ALICE.id), 0, 0, 100, 100);
    game.addExecution(new WinCheckExecution());

    const wins = [];
    for (let i = 0; i < 30; i++) {
      wins.push(...game.executeNextTick()[GameUpdateType.Win]);
    }
    expect(wins[0]?.reason).toBe("conquest");
  });
});
