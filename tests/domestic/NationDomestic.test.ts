import { TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  GameMode,
  Gold,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import {
  NATION_PEACE_RECRUIT_TARGET_PCT,
  nationDomesticTick,
} from "@openfront/engine/execution/nation/NationDomesticBehavior";
import {
  BALANCED_RESEARCH_ORDER,
  FALLBACK_LAW_ORDER,
  NationDomesticPlan,
} from "@openfront/engine/execution/nation/NationPersonality";
import { NationStructureBehavior } from "@openfront/engine/execution/nation/NationStructureBehavior";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");
/** Phase 1's single research order, independent of the nation's personality. */
const BALANCED_PLAN: NationDomesticPlan = {
  personality: "merchant",
  techOrder: BALANCED_RESEARCH_ORDER,
  lawOrder: FALLBACK_LAW_ORDER,
  governments: ["republic", "democracy"],
  instituteRatio: 0.5,
  officeRatio: 0.5,
};

describe("nation domestic behavior", () => {
  test("starts the first affordable tech and sets the peace recruit target", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 30, 30, 10);
    nation.domestic()!.addYield(TECHS.currency.cost * MILLI, 0);
    nationDomesticTick(game, nation, BALANCED_PLAN);
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

describe("nations don't save gold for locked units", () => {
  async function savingNation(
    techs: TechId[],
    config: Partial<GameConfig> = {},
  ) {
    const game = await domesticGame(config);
    const nation = game.addPlayer(NATION);
    conquerSquare(game, nation, 0, 0, 40);
    grantTechs(nation, ...techs);
    game.endSpawnPhase();
    const behavior = new NationStructureBehavior(
      new PseudoRandom(42),
      game,
      nation,
    );
    const cost = (type: UnitType): Gold =>
      game.unitInfo(type).cost(game, nation);
    const saveUpTarget = (): Gold => behavior["getSaveUpTarget"]();
    const blocked = (): boolean => behavior["isInPostSaveUpBlockedPhase"]();
    return { game, nation, cost, saveUpTarget, blocked };
  }

  test("a silo but no Manhattan Project or Radar: saves nothing", async () => {
    const { nation, saveUpTarget } = await savingNation(["rocketry"]);
    expect(nation.isUnitUnavailable(UnitType.MissileSilo)).toBe(false);
    expect(nation.isUnitLocked(UnitType.AtomBomb)).toBe(true);
    expect(saveUpTarget()).toBe(0n);
  });

  test("a silo and Radar but no Manhattan Project: saves for a SAM once a hostile player owns a silo", async () => {
    const { game, cost, saveUpTarget } = await savingNation([
      "rocketry",
      "radar",
    ]);
    expect(saveUpTarget()).toBe(0n);
    const human = game.player(HUMAN.id);
    human.conquer(game.ref(90, 90));
    human.buildUnit(UnitType.MissileSilo, game.ref(90, 90), {});
    expect(saveUpTarget()).toBe(cost(UnitType.SAMLauncher));
  });

  test("no nuke to buy: placements never pause for nuke spending", async () => {
    const { game, nation, cost, blocked } = await savingNation([
      "rocketry",
      "radar",
    ]);
    // Between the target and twice the target, where the pause would apply.
    nation.addGold((cost(UnitType.SAMLauncher) * 3n) / 2n);
    for (let i = 0; i < 40; i++) {
      expect(blocked(), `tick ${game.ticks()}`).toBe(false);
      executeTicks(game, 10);
    }
  });

  test("with the Manhattan Project: saves for atom bombs and paces placements", async () => {
    const { game, nation, cost, saveUpTarget, blocked } = await savingNation([
      "rocketry",
      "manhattan_project",
    ]);
    const target = cost(UnitType.AtomBomb) * 20n;
    expect(saveUpTarget()).toBe(target);
    nation.addGold((target * 3n) / 2n);
    let everBlocked = false;
    for (let i = 0; i < 40; i++) {
      everBlocked ||= blocked();
      executeTicks(game, 10);
    }
    expect(everBlocked).toBe(true);
  });

  test("team game, only the Manhattan Project: saves for an atom bomb", async () => {
    const { cost, saveUpTarget } = await savingNation(
      ["rocketry", "manhattan_project"],
      { gameMode: GameMode.Team, playerTeams: 2 },
    );
    expect(saveUpTarget()).toBe(cost(UnitType.AtomBomb));
  });

  test("team game with Thermonuclear: saves for a hydrogen bomb", async () => {
    const { cost, saveUpTarget } = await savingNation(
      ["rocketry", "manhattan_project", "thermonuclear"],
      { gameMode: GameMode.Team, playerTeams: 2 },
    );
    expect(saveUpTarget()).toBe(cost(UnitType.HydrogenBomb));
  });

  test("team game, silo but no nukes and no Radar: saves nothing", async () => {
    const { saveUpTarget, blocked, nation } = await savingNation(["rocketry"], {
      gameMode: GameMode.Team,
      playerTeams: 2,
    });
    nation.addGold(100_000_000n);
    expect(saveUpTarget()).toBe(0n);
    expect(blocked()).toBe(false);
  });
});
