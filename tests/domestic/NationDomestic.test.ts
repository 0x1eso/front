import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import {
  NATION_PEACE_RECRUIT_TARGET_PCT,
  nationDomesticTick,
} from "@openfront/engine/execution/nation/NationDomesticBehavior";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, HUMAN } from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

describe("nation domestic behavior", () => {
  test("starts the first affordable tech and sets the peace recruit target", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 30, 30, 10);
    nation.domestic()!.addYield(100_000, 0);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.currentResearch()?.tech).toBe("currency");
    expect(nation.domestic()!.recruitTargetPct()).toBe(
      NATION_PEACE_RECRUIT_TARGET_PCT,
    );
  });

  test("waits instead of skipping ahead when the next tech is unaffordable", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 30, 30, 10);
    nation.domestic()!.addYield(50_000, 0);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.currentResearch()).toBeNull();
  });

  test("recruits at 100% while attacked", async () => {
    const game = await domesticGame();
    const human = game.player(HUMAN.id);
    const nation = game.addPlayer(NATION);
    conquerSquare(game, human, 0, 0, 10);
    conquerSquare(game, nation, 10, 0, 60);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.recruitTargetPct()).toBe(70);

    human.setTroops(100_000);
    game.addExecution(new AttackExecution(50_000, human, nation.id(), null));
    executeTicks(game, 3);
    expect(nation.incomingAttacks().length).toBeGreaterThan(0);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.recruitTargetPct()).toBe(100);
  });

  test("a nation keeps researching over three minutes", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 0, 0, 40); // 16% of the land
    game.addExecution(new DomesticExecution());
    for (let t = 0; t < 1800; t += 50) {
      nationDomesticTick(game, nation);
      executeTicks(game, 50);
    }
    expect(nation.domestic()!.researchedTechs().size).toBeGreaterThanOrEqual(2);
  });

  test("nations build research institutes or admin offices", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 0, 0, 40);
    nation.addGold(50_000_000n);
    const behavior = new NationStructureBehavior(
      new PseudoRandom(42),
      game,
      nation,
    );
    for (let i = 0; i < 40; i++) {
      behavior.handleStructures();
      executeTicks(game, 100);
    }
    const built =
      nation.units(UnitType.ResearchInstitute).length +
      nation.units(UnitType.AdminOffice).length;
    expect(built).toBeGreaterThan(0);
  });
});
