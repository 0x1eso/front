import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { setup } from "../util/Setup";
import { constructionExecution } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

describe("tech locks", () => {
  test("factory and nukes are locked until researched", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(100_000_000n);
    expect(player.isUnitLocked(UnitType.AtomBomb)).toBe(true);
    expect(player.canBuild(UnitType.Factory, game.ref(5, 5))).toBe(false);
    grantTechs(player, "railroad", "rocketry", "manhattan_project");
    expect(player.isUnitLocked(UnitType.AtomBomb)).toBe(false);
    expect(player.canBuild(UnitType.Factory, game.ref(5, 5))).not.toBe(false);
  });

  test("build_unit for a locked unit is rejected", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(10_000_000n);
    constructionExecution(game, player, 5, 5, UnitType.MissileSilo, 20);
    expect(player.units(UnitType.MissileSilo)).toHaveLength(0);
    expect(player.gold()).toBe(10_000_000n);
  });

  test("buildableUnits marks locked units", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    const buildables = player.buildableUnits(game.ref(5, 5));
    expect(buildables.find((b) => b.type === UnitType.Warship)?.locked).toBe(
      true,
    );
    expect(buildables.find((b) => b.type === UnitType.City)?.locked).toBe(
      false,
    );
  });

  test("nothing is locked outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    expect(player.isUnitLocked(UnitType.AtomBomb)).toBe(false);
    expect(player.isUnitUnavailable(UnitType.AtomBomb)).toBe(false);
    expect(player.isUnitUnavailable(UnitType.ResearchInstitute)).toBe(true);
  });
});
