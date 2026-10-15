import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { buildLevel, conquerRect, domesticGame, grantTechs } from "./util";

/**
 * A nation whose phase 2 personality is `personality`. Plans are fixed by
 * the player id, so the test picks an id instead of mocking the lookup.
 */
function nationWith(personality: Personality): PlayerInfo {
  for (let i = 0; i < 1000; i++) {
    const id = `nation_${i}`;
    if (nationDomesticPlan(id).personality === personality) {
      return new PlayerInfo("nation", PlayerType.Nation, null, id);
    }
  }
  throw new Error(`no ${personality} nation among the first 1000 ids`);
}

async function readyForTheSpaceProgram(personality: Personality) {
  const game = await domesticGame({ difficulty: Difficulty.Hard });
  const nation = game.addPlayer(nationWith(personality));
  conquerRect(game, nation, 0, 0, 60, 60);
  buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
  grantTechs(nation, "space_program");
  nation.addGold(1_000_000n);
  const behavior = new NationStructureBehavior(
    new PseudoRandom(7),
    game,
    nation,
  );
  return { nation, behavior };
}

describe("a nation saving for its victory project", () => {
  test("builds nothing while it saves", async () => {
    const { nation, behavior } = await readyForTheSpaceProgram("scholar");
    expect(behavior.handleStructures()).toBe(false);
    expect(nation.gold()).toBe(1_000_000n);
  });

  test("builds as usual when its personality goes for no project", async () => {
    const { behavior } = await readyForTheSpaceProgram("conqueror");
    expect(behavior.handleStructures()).toBe(true);
  });
});
