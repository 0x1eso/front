import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Difficulty,
  Gold,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { AiAttackBehavior } from "@openfront/engine/execution/utils/AiAttackBehavior";
import { executeTicks } from "../util/utils";
import { conquerRect, domesticGame, grantTechs, HUMAN } from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

/**
 * A Medium nation with eight cities and plenty of gold, and the human in
 * the far corner. SAMs need Radar; the silo needs Rocketry; nukes need the
 * Manhattan Project. Whether anyone can nuke is a question about the game,
 * not about this nation's own techs.
 */
async function nationWith(techs: TechId[]) {
  const game = await domesticGame({ difficulty: Difficulty.Medium });
  const human = game.player(HUMAN.id);
  const nation = game.addPlayer(NATION);
  conquerRect(game, human, 90, 90, 10, 10);
  conquerRect(game, nation, 0, 0, 80, 80);
  grantTechs(nation, ...techs);
  for (let i = 0; i < 8; i++) {
    nation.buildUnit(UnitType.City, game.ref(5 + i * 9, 5 + (i % 3) * 30), {});
  }
  nation.addGold(100_000_000n);
  const behavior = new NationStructureBehavior(
    new PseudoRandom(42),
    game,
    nation,
  );
  const saveUpTarget = (): Gold => behavior["getSaveUpTarget"]();
  const samCost = (): Gold =>
    game.unitInfo(UnitType.SAMLauncher).cost(game, nation);
  const build = () => {
    for (let i = 0; i < 60; i++) {
      behavior.handleStructures();
      executeTicks(game, 30);
    }
  };
  return { game, human, nation, saveUpTarget, samCost, build };
}

describe("domestic nations build SAMs against the nukes of others", () => {
  test("Radar without Rocketry or the Manhattan Project builds a SAM once a hostile player owns a silo", async () => {
    const { game, human, nation, saveUpTarget, samCost, build } =
      await nationWith(["radar"]);
    human.buildUnit(UnitType.MissileSilo, game.ref(95, 95), {});
    expect(saveUpTarget()).toBe(samCost());
    build();
    expect(nation.units(UnitType.SAMLauncher).length).toBeGreaterThan(0);
    // Its own silo still needs Rocketry.
    expect(nation.units(UnitType.MissileSilo)).toHaveLength(0);
  });

  test("Radar and Rocketry without the Manhattan Project builds a SAM too", async () => {
    const { game, human, nation, saveUpTarget, samCost, build } =
      await nationWith(["rocketry", "radar"]);
    human.buildUnit(UnitType.MissileSilo, game.ref(95, 95), {});
    expect(saveUpTarget()).toBe(samCost());
    build();
    expect(nation.units(UnitType.SAMLauncher).length).toBeGreaterThan(0);
  });

  test("no SAM, and no gold saved for one, while no hostile player owns a silo", async () => {
    const { nation, saveUpTarget, build } = await nationWith(["radar"]);
    expect(saveUpTarget()).toBe(0n);
    build();
    expect(nation.units(UnitType.SAMLauncher)).toHaveLength(0);
  });

  test("its own silo is no reason for a SAM", async () => {
    const { game, nation, saveUpTarget } = await nationWith([
      "rocketry",
      "radar",
    ]);
    nation.buildUnit(UnitType.MissileSilo, game.ref(40, 40), {});
    expect(saveUpTarget()).toBe(0n);
  });

  test("nukes disabled in the game: no SAM even with a hostile silo", async () => {
    const game = await domesticGame({
      difficulty: Difficulty.Medium,
      disabledUnits: [UnitType.AtomBomb, UnitType.HydrogenBomb, UnitType.MIRV],
    });
    const human = game.player(HUMAN.id);
    const nation = game.addPlayer(NATION);
    conquerRect(game, human, 90, 90, 10, 10);
    conquerRect(game, nation, 0, 0, 80, 80);
    grantTechs(nation, "radar");
    human.buildUnit(UnitType.MissileSilo, game.ref(95, 95), {});
    const behavior = new NationStructureBehavior(
      new PseudoRandom(42),
      game,
      nation,
    );
    expect(behavior["getSaveUpTarget"]()).toBe(0n);
  });
});

describe("domestic nations retake fallout", () => {
  test("a nation without Rocketry sees the fallout on its border", async () => {
    const game = await domesticGame({ difficulty: Difficulty.Hard });
    const nation = game.addPlayer(NATION);
    conquerRect(game, nation, 0, 0, 20, 20);
    for (let y = 0; y < 20; y++) game.setFallout(game.ref(20, y), true);
    expect(nation.isUnitUnavailable(UnitType.MissileSilo)).toBe(true);
    const attack = new AiAttackBehavior(
      new PseudoRandom(42),
      game,
      nation,
      0.5,
      0.3,
      0.2,
    );
    expect(attack["isBorderingNukedTerritory"]()).toBe(true);
  });
});
