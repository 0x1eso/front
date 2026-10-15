import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { setup } from "../util/Setup";
import { constructionExecution } from "../util/utils";
import { conquerSquare, domesticGame, HUMAN } from "./util";

describe("domestic buildings", () => {
  test("are disabled outside domestic mode", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    expect(game.config().domesticMode()).toBe(false);
    expect(game.config().isUnitDisabled(UnitType.ResearchInstitute)).toBe(true);
    expect(game.config().isUnitDisabled(UnitType.AdminOffice)).toBe(true);
  });

  test("are enabled in domestic mode", async () => {
    const game = await domesticGame();
    expect(game.config().domesticMode()).toBe(true);
    expect(game.config().isUnitDisabled(UnitType.ResearchInstitute)).toBe(
      false,
    );
  });

  test("cost 100k doubling per owned level, capped at 25M", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    const cost = (extra = 0) =>
      game.unitInfo(UnitType.ResearchInstitute).cost(game, player, extra);
    expect(cost()).toBe(100_000n);
    expect(cost(1)).toBe(200_000n);
    expect(cost(4)).toBe(1_600_000n);
    expect(cost(7)).toBe(12_800_000n);
    expect(cost(8)).toBe(25_000_000n); // 2^8 × 100k = 25.6M, capped
  });

  test("are built through ConstructionExecution and upgradable", async () => {
    const game = await domesticGame();
    const player = game.player(HUMAN.id);
    conquerSquare(game, player, 0, 0, 20);
    player.addGold(1_000_000n);
    constructionExecution(game, player, 3, 3, UnitType.ResearchInstitute, 60);
    constructionExecution(game, player, 16, 16, UnitType.AdminOffice, 60);
    const institutes = player.units(UnitType.ResearchInstitute);
    expect(institutes).toHaveLength(1);
    expect(institutes[0].isUnderConstruction()).toBe(false);
    expect(player.units(UnitType.AdminOffice)).toHaveLength(1);
    expect(game.config().unitInfo(UnitType.AdminOffice).upgradable).toBe(true);
  });
});
