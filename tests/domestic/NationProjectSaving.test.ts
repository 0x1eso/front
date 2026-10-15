import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { nationDomesticTick } from "@openfront/engine/execution/nation/NationDomesticBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { nationVictoryTick } from "@openfront/engine/execution/nation/NationVictoryBehavior";
import { executeTicks } from "../util/utils";
import {
  buildLevel,
  conquerRect,
  domesticGame,
  grantGovernment,
  grantTechs,
  reachGovernmentTier3,
} from "./util";

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

/**
 * A Hard zealot at government tier 3 with 3,500 political power, its tier 2
 * government already adopted so its domestic check goes on to laws.
 */
async function zealotAtTier3(withHost: boolean) {
  const game = await domesticGame({ difficulty: Difficulty.Hard });
  const info = nationWith("zealot");
  const nation = game.addPlayer(info);
  conquerRect(game, nation, 0, 0, 60, 60);
  if (withHost) buildLevel(game, nation, UnitType.AdminOffice, 10, 10, 3);
  reachGovernmentTier3(nation);
  grantGovernment(nation, nationDomesticPlan(info.id).governments[1]);
  return { game, nation };
}

describe("a zealot saving for world government", () => {
  test("proclaims no law while it saves, then starts the project", async () => {
    const { game, nation } = await zealotAtTier3(true);
    const d = nation.domestic()!;

    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(d.proclaimedLaws().size).toBe(0);
    expect(d.politicalMilliAvailable()).toBe(3_500_000);

    // NationExecution's order: the project step, then the domestic check.
    nation.addGold(3_000_000n);
    nationVictoryTick(game, nation, "political");
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(d.victoryProject()?.kind).toBe("political");
    expect(d.proclaimedLaws().size).toBe(0);
  });

  test("proclaims laws as usual while it has no level 3 host", async () => {
    const { game, nation } = await zealotAtTier3(false);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.proclaimedLaws().size).toBe(1);
  });
});
