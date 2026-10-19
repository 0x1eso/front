import { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import { columnById } from "../../src/client/hud/layers/lib/StatsColumns";
import { PlayerStats } from "../../src/client/hud/layers/PlayerStats";
import { UserSettings } from "../../src/client/UserSettings";
import type { GameView, PlayerView } from "../../src/client/view";
import { domesticScoreMap } from "../../src/client/view/DomesticScores";

interface Stub {
  tiles: number;
  science?: number;
  political?: number;
  gold?: number;
  type?: PlayerType;
  domestic?: boolean;
}

function player(id: number, s: Stub): PlayerView {
  const data =
    s.domestic === false
      ? null
      : ({
          cumulativeScience: s.science ?? 0,
          cumulativePolitical: s.political ?? 0,
        } as DomesticData);
  return {
    id: () => `p${id}`,
    smallID: () => id,
    name: () => `p${id}`,
    displayName: () => `p${id}`,
    clanTag: () => null,
    type: () => s.type ?? PlayerType.Human,
    numTilesOwned: () => s.tiles,
    gold: () => 0n,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    goldEarned: () => s.gold ?? 0,
    troops: () => 0,
    totalUnitLevels: () => 0,
    isAlive: () => true,
    isOnSameTeam: () => false,
    domesticData: () => data,
  } as unknown as PlayerView;
}

function game(players: PlayerView[]): GameView {
  return {
    myPlayer: () => players[0],
    playerViews: () => players,
    worldWarScenario: () => null,
    config: () => ({ maxTroops: () => 100 }),
    ticks: () => 600,
    numLandTiles: () => 1000,
    numTilesWithFallout: () => 0,
  } as unknown as GameView;
}

const A = () => player(1, { tiles: 300, science: 100, gold: 1000 });
const B = () =>
  player(2, { tiles: 100, science: 300, political: 50, gold: 1000 });

describe("domestic score column", () => {
  beforeEach(() => {
    localStorage.clear();
    (
      UserSettings as unknown as { cache: Map<string, string | null> }
    ).cache.clear();
  });

  it("scores alive humans and nations with the engine's formula, never bots", () => {
    const bot = player(3, {
      tiles: 600,
      type: PlayerType.Bot,
      domestic: false,
    });
    const scores = domesticScoreMap(game([A(), B(), bot]));
    expect(scores.get(1)?.total).toBe(37.5);
    expect(scores.get(2)?.total).toBe(62.5);
    expect(scores.has(3)).toBe(false);
  });

  it("the score column reads the shared score and can't be hidden", () => {
    const a = A();
    const g = game([a, B()]);
    const column = columnById("score");
    expect(column.value?.(a, g)).toBe(37.5);
    expect(column.cell({ position: 1, name: "a", value: 37.5 }, g)).toBe(
      "37.5",
    );
    expect(column.isHideable).toBe(false);
    expect(column.domesticOnly).toBe(true);
  });

  it("player stats show the score only in domestic games", async () => {
    const stats = new PlayerStats();
    stats.game = game([A()]);
    stats.visible = true;
    stats.domesticMode = true;
    document.body.append(stats);
    stats.refresh();
    await stats.updateComplete;
    // rank, clan, player | score, tiles, gold, maxtroops | picker
    expect(
      stats.querySelector(".stats-table-content")?.getAttribute("style"),
    ).toContain("34px 80px 100px auto auto auto auto 32px");
    stats.remove();
  });
});
