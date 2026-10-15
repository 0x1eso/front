import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  nationIsSavingForProject,
  nationProjectKind,
  nationVictoryTick,
} from "@openfront/engine/execution/nation/NationVictoryBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import {
  buildLevel,
  conquerRect,
  domesticGame,
  grantTechs,
  reachGovernmentTier3,
} from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

async function hardNation(): Promise<{ game: Game; nation: Player }> {
  const game = await domesticGame({ difficulty: Difficulty.Hard });
  const nation = game.addPlayer(NATION);
  conquerRect(game, nation, 0, 0, 40, 40);
  return { game, nation };
}

describe("nation victory projects", () => {
  test("only Hard and Impossible scholars and zealots go for a project", () => {
    expect(nationProjectKind(Difficulty.Easy, "scholar")).toBeNull();
    expect(nationProjectKind(Difficulty.Medium, "zealot")).toBeNull();
    expect(nationProjectKind(Difficulty.Hard, "scholar")).toBe("science");
    expect(nationProjectKind(Difficulty.Impossible, "zealot")).toBe(
      "political",
    );
    expect(nationProjectKind(Difficulty.Impossible, "conqueror")).toBeNull();
    expect(nationProjectKind(Difficulty.Hard, "merchant")).toBeNull();
  });

  test("a ready scholar starts the space program", async () => {
    const { game, nation } = await hardNation();
    const host = buildLevel(
      game,
      nation,
      UnitType.ResearchInstitute,
      10,
      10,
      3,
    );
    grantTechs(nation, "space_program");
    nation.addGold(5_000_000n);

    nationVictoryTick(game, nation, "science");
    executeTicks(game, 1);

    expect(nation.domestic()!.victoryProject()?.hostUnitId).toBe(host.id());
    expect(nation.gold()).toBe(0n);
  });

  test("it raises its best host one level at a time first", async () => {
    const { game, nation } = await hardNation();
    const host = buildLevel(
      game,
      nation,
      UnitType.ResearchInstitute,
      10,
      10,
      1,
    );
    grantTechs(nation, "space_program");
    nation.addGold(2_000_000n);

    nationVictoryTick(game, nation, "science");
    executeTicks(game, 1);

    expect(host.level()).toBe(2);
    expect(nation.domestic()!.victoryProject()).toBeNull();
  });

  test("a zealot nation proclaims world government at tier 3", async () => {
    const { game, nation } = await hardNation();
    buildLevel(game, nation, UnitType.AdminOffice, 10, 10, 3);
    reachGovernmentTier3(nation);
    nation.addGold(3_000_000n);

    nationVictoryTick(game, nation, "political");
    executeTicks(game, 1);

    expect(nation.domestic()!.victoryProject()?.kind).toBe("political");
  });

  test("saves while qualified with a level 3 host, until the project starts", async () => {
    const { game, nation } = await hardNation();
    buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
    // Earned: an income that brings the 5M within a few minutes.
    nation.addGold(1_000_000n);
    expect(nationIsSavingForProject(game, nation, "science")).toBe(false);
    grantTechs(nation, "space_program");
    expect(nationIsSavingForProject(game, nation, "science")).toBe(true);
    expect(nationIsSavingForProject(game, nation, null)).toBe(false);

    nationVictoryTick(game, nation, null);
    executeTicks(game, 1);
    expect(nation.domestic()!.victoryProject()).toBeNull();

    nation.addGold(4_000_000n);
    nationVictoryTick(game, nation, "science");
    executeTicks(game, 1);
    expect(nationIsSavingForProject(game, nation, "science")).toBe(false);
  });

  test("doesn't save while the project's gold is out of reach", async () => {
    const { game, nation } = await hardNation();
    buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
    grantTechs(nation, "space_program");
    // No income at all: 5M is never within a few minutes.
    expect(nationIsSavingForProject(game, nation, "science")).toBe(false);
  });
});
