import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";
import { conquerSquare, domesticGame, grantLaws, HUMAN } from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");

class LongRangeConfig extends TestConfig {
  override samRange(_level: number): number {
    return 140;
  }
}

function buildSam(game: Game) {
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 20);
  player.addGold(10_000_000n);
  return player.buildUnit(UnitType.SAMLauncher, game.ref(5, 5), {});
}

describe("air defense network", () => {
  test("SAM range +30%", async () => {
    const game = await domesticGame();
    const sam = buildSam(game);
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBe(20);
    grantLaws(game.player(HUMAN.id), { nuclear: "B" });
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBeCloseTo(26, 9);
  });

  test("never beyond the maximum SAM range", async () => {
    const game = await setup(
      "plains",
      { domesticMode: true },
      [HUMAN],
      undefined,
      LongRangeConfig,
    );
    const sam = buildSam(game);
    grantLaws(game.player(HUMAN.id), { nuclear: "B" });
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBe(
      game.config().maxSamRange(),
    );
  });

  test("an upgrade starts from the unmodified range", async () => {
    const game = await domesticGame();
    const sam = buildSam(game);
    grantLaws(game.player(HUMAN.id), { nuclear: "B" });
    sam.increaseLevel();
    expect(sam.samLauncherState()?.startRange).toBe(20);
    expect(game.config().dynamicSamRange(sam, game.ticks())).toBeCloseTo(26, 9);
  });
});

describe("isolationism", () => {
  test("no trade with anyone, both ways, allies included", async () => {
    const game = await domesticGame({}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    conquerSquare(game, a, 0, 0, 10);
    conquerSquare(game, b, 50, 50, 10);
    expect(a.canTrade(b)).toBe(true);
    a.createAllianceRequest(b)?.accept();
    expect(a.isAlliedWith(b)).toBe(true);
    grantLaws(a, { diplomacy: "B" });
    expect(a.canTrade(b)).toBe(false);
    expect(b.canTrade(a)).toBe(false);
    expect(a.tradingPartners()).toEqual([]);
    expect(b.tradingPartners()).not.toContain(a);
  });

  test("trade outside domestic mode is unchanged", async () => {
    const game = await setup("plains", {}, [HUMAN, OTHER]);
    const a = game.player(HUMAN.id);
    const b = game.player(OTHER.id);
    conquerSquare(game, a, 0, 0, 10);
    conquerSquare(game, b, 50, 50, 10);
    expect(a.canTrade(b)).toBe(true);
    expect(a.canTrade(a)).toBe(false);
  });
});
