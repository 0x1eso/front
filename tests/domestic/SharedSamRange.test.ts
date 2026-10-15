import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { conquerSquare, domesticGame, grantLaws, HUMAN } from "./util";

function buildSam(game: Game) {
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 20);
  player.addGold(10_000_000n);
  return player.buildUnit(UnitType.SAMLauncher, game.ref(5, 5), {});
}

// The client draws SAM rings with Config.samRangeOf; the engine intercepts
// with dynamicSamRange. Both must agree, air-defense law included.
describe("one SAM range for the engine and the client's rings", () => {
  test("the air-defense law widens both alike", async () => {
    const game = await domesticGame();
    const sam = buildSam(game);
    const player = game.player(HUMAN.id);
    const config = game.config();
    const ring = () => config.samRangeOf(player, config.samRange(sam.level()));
    expect(ring()).toBe(config.dynamicSamRange(sam, game.ticks()));
    grantLaws(player, { nuclear: "B" });
    expect(ring()).toBeCloseTo(config.samRange(sam.level()) * 1.3, 9);
    expect(ring()).toBe(config.dynamicSamRange(sam, game.ticks()));
  });

  test("never past the maximum SAM range", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantLaws(player, { nuclear: "B" });
    const config = game.config();
    expect(config.samRangeOf(player, config.maxSamRange() - 1)).toBe(
      config.maxSamRange(),
    );
  });

  test("outside domestic mode it is the base range", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const config = game.config();
    expect(config.samRangeOf(game.player(HUMAN.id), 42.5)).toBe(42.5);
  });
});
