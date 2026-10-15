import {
  ColoredTeams,
  GameMode,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it } from "vitest";
import {
  projectHostChoices,
  victoryStanding,
} from "../../src/client/hud/domestic/VictoryTab";
import { domesticScoreMap } from "../../src/client/view/DomesticScores";

function unit(id: number, level: number, underConstruction = false) {
  return {
    id: () => id,
    level: () => level,
    isUnderConstruction: () => underConstruction,
  };
}

describe("projectHostChoices", () => {
  it("lists finished level 3+ buildings, highest level first", () => {
    expect(
      projectHostChoices([
        unit(1, 3),
        unit(2, 2),
        unit(3, 5),
        unit(4, 4, true),
        unit(5, 3),
      ]),
    ).toEqual([
      { id: 3, level: 5 },
      { id: 1, level: 3 },
      { id: 5, level: 3 },
    ]);
  });
});

describe("victoryStanding (M4: team games are judged per team)", () => {
  function player(
    id: number,
    team: string | null,
    tiles: number,
    science: number,
    alive = true,
  ) {
    const data = {
      cumulativeScience: science,
      cumulativePolitical: 0,
      project: undefined,
    };
    return {
      smallID: () => id,
      team: () => team,
      isAlive: () => alive,
      numTilesOwned: () => tiles,
      domesticData: () => data,
      type: () => PlayerType.Human,
      goldEarned: () => 0,
    };
  }

  function game(mode: GameMode, players: ReturnType<typeof player>[]) {
    let tick = 0;
    return {
      ticks: () => tick++,
      playerViews: () => players,
      config: () => ({ gameConfig: () => ({ gameMode: mode }) }),
    } as any;
  }

  it("sums land and score over my team and ranks the teams", () => {
    const me = player(1, "Red", 100, 10);
    const mate = player(2, "Red", 300, 30);
    const blue = player(3, "Blue", 500, 50);
    const bot = player(4, ColoredTeams.Bot, 900, 0);
    const g = game(GameMode.Team, [me, mate, blue, bot]);
    const scores = domesticScoreMap(g);
    const standing = victoryStanding(g, me as any);

    expect(standing.team).toBe(true);
    expect(standing.tiles).toBe(400);
    expect(standing.score).toBeCloseTo(
      scores.get(1)!.total + scores.get(2)!.total,
      9,
    );
    // Blue's 500 tiles and 50 science beat Red's 400 and 40.
    expect([standing.rank, standing.count]).toEqual([2, 2]);
  });

  it("in a free-for-all it is my own land, score and rank", () => {
    const me = player(1, null, 100, 10);
    const other = player(2, null, 50, 5);
    const g = game(GameMode.FFA, [me, other]);
    const standing = victoryStanding(g, me as any);
    expect(standing.team).toBe(false);
    expect(standing.tiles).toBe(100);
    expect(standing.score).toBeCloseTo(domesticScoreMap(g).get(1)!.total, 9);
    expect([standing.rank, standing.count]).toEqual([1, 2]);
  });
});
