import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { domesticConstructionTicks } from "@openfront/engine/domestic/DomesticEconomy";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import { Game } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  HUMAN,
} from "./util";

/** Starts a city at (5,5) and runs the two ticks that place it. */
function startCity(game: Game): void {
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 20);
  player.addGold(1_000_000n);
  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(5, 5)),
  );
  executeTicks(game, 2);
}

describe("build time modifiers", () => {
  test("rapid construction halves every build time; urban planning only cities", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    expect(domesticConstructionTicks(20, player, UnitType.City)).toBe(20);
    grantLaws(player, { construction: "B" });
    expect(domesticConstructionTicks(20, player, UnitType.City)).toBe(10);
    expect(domesticConstructionTicks(50, player, UnitType.Port)).toBe(25);
    grantLaws(player, { taxation: "B" });
    expect(domesticConstructionTicks(20, player, UnitType.City)).toBe(8);
    expect(domesticConstructionTicks(50, player, UnitType.Port)).toBe(25);
  });

  test("stacked build-time cuts stop at -60%", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantLaws(player, { construction: "B" });
    grantGovernment(player, "communism");
    expect(domesticConstructionTicks(50, player, UnitType.DefensePost)).toBe(
      20,
    );
  });

  test("instant build stays instant", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    grantLaws(player, { construction: "B" });
    expect(domesticConstructionTicks(0, player, UnitType.City)).toBe(0);
  });

  test("a structure finishes after its modified build time and says so", async () => {
    const game = await domesticGame();
    grantLaws(game.player(HUMAN.id), { construction: "B" });
    startCity(game);
    const city = game.player(HUMAN.id).units(UnitType.City)[0];
    expect(city.isUnderConstruction()).toBe(true);
    expect(city.constructionTicks()).toBe(10);
    expect(city.toUpdate().constructionTicks).toBe(10);
    executeTicks(game, 11);
    expect(city.isUnderConstruction()).toBe(false);
  });

  test("the build time survives a snapshot", async () => {
    const game = await domesticGame();
    grantLaws(game.player(HUMAN.id), { construction: "B" });
    startCity(game);
    const restored = await expectSnapshotRoundTrip(game, "plains", 11);
    const city = restored.player(HUMAN.id).units(UnitType.City)[0];
    expect(city.constructionTicks()).toBe(10);
    expect(city.isUnderConstruction()).toBe(false);
  });

  test("vanilla structures don't carry construction ticks", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    startCity(game);
    const city = game.player(HUMAN.id).units(UnitType.City)[0];
    expect(city.constructionTicks()).toBeUndefined();
    expect("constructionTicks" in city.toUpdate()).toBe(false);
    executeTicks(game, 11);
    expect(city.isUnderConstruction()).toBe(true);
  });
});
