import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  domesticScores,
  projectProgress,
  ScoreInput,
} from "@openfront/engine-lib/domestic/Score";
import {
  ProjectAttempt,
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";

const READY: ProjectAttempt = {
  busy: false,
  qualified: true,
  hostLevel: 3,
  gold: 5_000_000n,
  politicalMilli: 0,
};

describe("victory projects", () => {
  test("costs, hosts and durations follow spec §8.1", () => {
    expect(VICTORY_PROJECTS.science.hostType).toBe(UnitType.ResearchInstitute);
    expect(VICTORY_PROJECTS.science.goldCost).toBe(5_000_000n);
    expect(VICTORY_PROJECTS.science.politicalCostMilli).toBe(0);
    expect(VICTORY_PROJECTS.science.ticks).toBe(2400);
    expect(VICTORY_PROJECTS.science.pausesWhileAttacking).toBe(false);
    expect(VICTORY_PROJECTS.political.hostType).toBe(UnitType.AdminOffice);
    expect(VICTORY_PROJECTS.political.goldCost).toBe(1_000_000n);
    expect(VICTORY_PROJECTS.political.politicalCostMilli).toBe(3_000_000);
    expect(VICTORY_PROJECTS.political.ticks).toBe(2400);
    expect(VICTORY_PROJECTS.political.pausesWhileAttacking).toBe(true);
  });

  test("qualification: the space program tech, or government tier 3", () => {
    expect(projectQualified("science", true, 0)).toBe(true);
    expect(projectQualified("science", false, 3)).toBe(false);
    expect(projectQualified("political", false, 3)).toBe(true);
    expect(projectQualified("political", true, 2)).toBe(false);
  });

  test("blocks are reported in order", () => {
    expect(victoryProjectBlock("science", READY)).toBeNull();
    expect(
      victoryProjectBlock("science", {
        ...READY,
        busy: true,
        qualified: false,
      }),
    ).toBe("busy");
    expect(
      victoryProjectBlock("science", {
        ...READY,
        qualified: false,
        hostLevel: null,
      }),
    ).toBe("requirement");
    expect(victoryProjectBlock("science", { ...READY, hostLevel: null })).toBe(
      "host",
    );
    expect(victoryProjectBlock("science", { ...READY, hostLevel: 2 })).toBe(
      "host",
    );
    expect(victoryProjectBlock("science", { ...READY, gold: 4_999_999n })).toBe(
      "gold",
    );
    expect(
      victoryProjectBlock("political", {
        ...READY,
        gold: 1_000_000n,
        politicalMilli: 2_999_999,
      }),
    ).toBe("political");
    expect(
      victoryProjectBlock("political", {
        ...READY,
        gold: 999_999n,
        politicalMilli: 3_000_000,
      }),
    ).toBe("gold");
    expect(
      victoryProjectBlock("political", {
        ...READY,
        gold: 1_000_000n,
        politicalMilli: 3_000_000,
      }),
    ).toBeNull();
  });
});

function input(over: Partial<ScoreInput>): ScoreInput {
  return {
    scored: true,
    tiles: 0,
    science: 0,
    political: 0,
    gold: 0,
    donationGold: 0,
    projectProgress: 0,
    ...over,
  };
}

describe("domestic score", () => {
  test("each category is my share of the total times 25", () => {
    const [a, b] = domesticScores([
      input({ tiles: 300, science: 100, political: 0, gold: 1000 }),
      input({ tiles: 100, science: 300, political: 50, gold: 1000 }),
    ]);
    expect(a.land).toBe(18.75);
    expect(a.science).toBe(6.25);
    expect(a.political).toBe(0);
    expect(a.economy).toBe(12.5);
    expect(a.total).toBe(37.5);
    expect(b.total).toBe(62.5);
  });

  test("bots score nothing and don't count toward the totals", () => {
    const [human, bot] = domesticScores([
      input({ tiles: 100, science: 10, political: 10, gold: 10 }),
      input({ scored: false, tiles: 900 }),
    ]);
    expect(human.total).toBe(100);
    expect(bot.total).toBe(0);
  });

  test("an empty category gives nobody points", () => {
    const [a] = domesticScores([input({ tiles: 10 })]);
    expect(a.total).toBe(25);
  });

  test("a running project adds up to 10 points by progress", () => {
    const [a] = domesticScores([input({ tiles: 10, projectProgress: 0.5 })]);
    expect(a.project).toBe(5);
    expect(a.total).toBe(30);
    expect(projectProgress(null)).toBe(0);
    expect(projectProgress(undefined)).toBe(0);
    expect(
      projectProgress({
        kind: "science",
        hostUnitId: 1,
        ticksLeft: 600,
        totalTicks: 2400,
        paused: false,
      }),
    ).toBe(0.75);
  });
});
