import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  MILLI,
  POLITICAL_PROJECT_GOLD,
  POLITICAL_PROJECT_POLITICAL,
} from "@openfront/engine-lib/domestic/Balance";
import { lawCost } from "@openfront/engine-lib/domestic/Laws";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { nationDomesticTick } from "@openfront/engine/execution/nation/NationDomesticBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { nationVictoryTick } from "@openfront/engine/execution/nation/NationVictoryBehavior";
import { Game, Player } from "@openfront/engine/game/Game";
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

/**
 * Qualified for the space program with a level 3 institute and 1M gold:
 * earned (an income that brings the 5M within a few minutes) or, with
 * `earned` false, starting gold and no income at all.
 */
async function readyForTheSpaceProgram(
  personality: Personality,
  earned = true,
) {
  const game = await domesticGame({
    difficulty: Difficulty.Hard,
    startingGold: earned ? 0 : 1_000_000,
  });
  const nation = game.addPlayer(nationWith(personality));
  conquerRect(game, nation, 0, 0, 60, 60);
  buildLevel(game, nation, UnitType.ResearchInstitute, 10, 10, 3);
  grantTechs(nation, "space_program");
  if (earned) nation.addGold(1_000_000n);
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

  test("keeps building while the project's cost is out of reach", async () => {
    const { behavior } = await readyForTheSpaceProgram("scholar", false);
    expect(behavior.handleStructures()).toBe(true);
  });

  test("builds as usual when its personality goes for no project", async () => {
    const { behavior } = await readyForTheSpaceProgram("conqueror");
    expect(behavior.handleStructures()).toBe(true);
  });
});

/**
 * A Hard zealot at government tier 3 with 8,000 political power, its tier 2
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

/** Leaves `political` political power available. */
function setPolitical(nation: Player, political: number): void {
  const d = nation.domestic()!;
  const diff = d.politicalMilliAvailable() - political * MILLI;
  if (diff >= 0) d.spendPoliticalMilli(diff);
  else d.addYield(0, -diff);
}

function structureBehavior(game: Game, nation: Player) {
  return new NationStructureBehavior(new PseudoRandom(7), game, nation);
}

describe("a zealot saving for world government", () => {
  test("spends only the political power beyond the project's on laws, then starts the project", async () => {
    const { game, nation } = await zealotAtTier3(true);
    const d = nation.domestic()!;
    // Half the project's gold, earned: the rest is within reach.
    nation.addGold(POLITICAL_PROJECT_GOLD / 2n);
    const nextLaw = lawCost(0, d.pct("lawCost"));

    setPolitical(nation, POLITICAL_PROJECT_POLITICAL + nextLaw - 1);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(d.proclaimedLaws().size).toBe(0);

    setPolitical(nation, POLITICAL_PROJECT_POLITICAL + nextLaw);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(d.proclaimedLaws().size).toBe(1);
    expect(d.politicalMilliAvailable()).toBe(
      POLITICAL_PROJECT_POLITICAL * MILLI,
    );

    // NationExecution's order: the project step, then the domestic check.
    nation.addGold(POLITICAL_PROJECT_GOLD);
    nationVictoryTick(game, nation, "political");
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(d.victoryProject()?.kind).toBe("political");
  });

  test("holds back structures while short of the project's gold", async () => {
    const { game, nation } = await zealotAtTier3(true);
    nation.addGold(POLITICAL_PROJECT_GOLD / 2n);
    expect(structureBehavior(game, nation).handleStructures()).toBe(false);
  });

  test("builds once it has the gold and only waits for political power", async () => {
    const { game, nation } = await zealotAtTier3(true);
    setPolitical(nation, POLITICAL_PROJECT_POLITICAL - 1);
    nation.addGold(POLITICAL_PROJECT_GOLD * 2n);
    expect(structureBehavior(game, nation).handleStructures()).toBe(true);
  });

  test("holds back structures once it has everything, until the project starts", async () => {
    const { game, nation } = await zealotAtTier3(true);
    nation.addGold(POLITICAL_PROJECT_GOLD * 2n);
    expect(structureBehavior(game, nation).handleStructures()).toBe(false);
  });

  test("proclaims laws as usual while it has no level 3 host", async () => {
    const { game, nation } = await zealotAtTier3(false);
    nationDomesticTick(game, nation);
    executeTicks(game, 1);
    expect(nation.domestic()!.proclaimedLaws().size).toBe(1);
  });
});
